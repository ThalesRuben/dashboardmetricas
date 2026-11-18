-- Relatório a partir das mensagens recebidas, sem alterar status ou histórico.
-- Agendamento = conversa com confirmação explícita em texto, não agenda oficial.

create or replace function public.classificar_agendamento_whatsapp(p_texto text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare
  v_texto text := translate(lower(coalesce(p_texto, '')),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_parte text[];
  v_evento text := null;
begin
  -- Analisa frases separadamente: confirmação seguida de pergunta continua
  -- válida, mas "você já tem horário agendado?" não vira uma confirmação.
  for v_parte in select regexp_matches(v_texto, '([^.!?\n]+)([.!?\n]|$)', 'g') loop
    if v_parte[2] = '?' then continue; end if;
    if v_parte[1] ~ '(\m(agendamento|horario|reserva|vaga)\M.{0,35}\m(cancelad[oa]|desmarcad[oa])\M|\m(cancelei|desmarquei)\M.{0,45}\m(agendamento|horario|reserva|vaga)\M)' then
      v_evento := 'cancelamento';
      continue;
    end if;
    if v_parte[1] ~ '(\m(nao|nunca|ainda nao)\M.{0,40}\m(agendei|reservei|marquei|confirmei|agendad[oa]|confirmad[oa]|reservad[oa]|marcad[oa])\M|\m(posso|podemos|gostaria|pretendo|preciso|quero|vamos)\M.{0,30}\m(agendar|reservar|marcar|confirmar)\M)' then
      continue;
    end if;
    if v_parte[1] ~ '(\m(agendamento|horario|reserva|vaga)\M.{0,35}\m(confirmad[oa]|agendad[oa]|reservad[oa]|marcad[oa])\M|\m(confirmad[oa]|agendad[oa]|reservad[oa]|marcad[oa])\M.{0,25}\m(agendamento|horario|reserva|vaga)\M|\m(agendei|reservei|marquei)\M.{0,60}\m(voce|seu|sua|para|pra)\M|\m(ficou|deixei)\M.{0,12}\m(agendad[oa]|reservad[oa]|marcad[oa])\M)' then
      v_evento := 'confirmacao';
    end if;
  end loop;
  return v_evento;
end;
$$;

create or replace function public.get_whatsapp_message_summary(
  p_inbox_phone text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql stable
security invoker
set search_path = public
as $$
with bounds as (
  select coalesce(p_to, now()) as date_to,
    coalesce(p_from, coalesce(p_to, now()) - interval '30 days') as date_from
), periods as (
  select 'current'::text as period, date_from, date_to from bounds
  union all
  select 'previous', date_from - (date_to - date_from + interval '1 millisecond'),
    date_from - interval '1 microsecond' from bounds
), allowed_tenants as materialized (
  select public.current_user_tenants() as tenant_id
), own_numbers as materialized (
  select distinct t.tenant_id, public.pg_normalizar_phone_br(t.inbox_phone) as phone
  from public.whatsapp_threads t join allowed_tenants a using (tenant_id)
  where t.inbox_phone is not null
), thread_keys as materialized (
  select t.id, t.tenant_id, t.inbox_phone, t.origem,
    coalesce(nullif(public.pg_normalizar_phone_br(c.phone), ''), c.id::text) as contact_key
  from public.whatsapp_threads t
  join allowed_tenants a on a.tenant_id = t.tenant_id
  join public.whatsapp_contatos c on c.id = t.contato_id and c.tenant_id = t.tenant_id
  where (p_inbox_phone is null or t.inbox_phone = p_inbox_phone)
    and coalesce(c.phone, '') !~ '(@g\.us|@broadcast)'
    and not exists (
      select 1 from own_numbers o where o.tenant_id = t.tenant_id
        and o.phone = public.pg_normalizar_phone_br(c.phone)
    )
), messages as materialized (
  select p.period, t.tenant_id, t.inbox_phone, t.contact_key, t.origem,
    m.id, m.autor, m.texto, m.hora,
    case when m.texto ~* '(agend|hor[áa]rio|reserv|marc|confirm|cancel)'
      then public.classificar_agendamento_whatsapp(m.texto) else null end as appointment_event
  from public.whatsapp_msgs m
  join thread_keys t on t.id = m.thread_id and t.tenant_id = m.tenant_id
  join periods p on m.hora >= p.date_from and m.hora <= p.date_to
  where m.hora <= now() and m.status <> 'erro'
    and coalesce(m.metadata->>'simulacao', 'false') <> 'true'
), message_context as (
  select m.*, min(hora) filter (where autor = 'cliente') over (
    partition by period, tenant_id, inbox_phone, contact_key
  ) as first_client
  from messages m
), outcomes as materialized (
  select period, tenant_id, inbox_phone, contact_key, first_client,
    count(*) filter (where autor = 'cliente')::int as incoming_messages,
    bool_or(public.detectar_lead_texto(texto)) filter (where autor = 'cliente') as interested,
    (array_agg(texto order by hora, id) filter (where autor = 'cliente'))[1] as first_text,
    (array_agg(coalesce(nullif(origem, ''), 'WhatsApp') order by hora, id) filter (where autor = 'cliente'))[1] as origin,
    min(hora) filter (where autor = 'atendente' and hora >= first_client) as first_reply,
    max(hora) filter (where autor = 'atendente' and hora >= first_client
      and appointment_event = 'confirmacao') as confirmed_at,
    max(hora) filter (where hora >= first_client and appointment_event = 'cancelamento') as cancelled_at
  from message_context
  group by period, tenant_id, inbox_phone, contact_key, first_client
  having first_client is not null
), conversations as materialized (
  select o.*, confirmed_at is not null and (cancelled_at is null or confirmed_at > cancelled_at) as scheduled,
    extract(epoch from first_reply - first_client) / 60.0 as response_minutes
  from outcomes o
), previous_author as (
  select m.*, lag(autor) over (
    partition by period, tenant_id, inbox_phone, contact_key order by hora, id
  ) as previous_author
  from messages m
), numbered_turns as (
  select m.*, sum(case when autor = 'cliente' and previous_author is distinct from 'cliente' then 1 else 0 end) over (
    partition by period, tenant_id, inbox_phone, contact_key order by hora, id rows unbounded preceding
  ) as turn_id
  from previous_author m
), turns as (
  select period, tenant_id, inbox_phone, contact_key, turn_id,
    min(hora) filter (where autor = 'cliente') as client_at,
    min(hora) filter (where autor = 'atendente') as reply_at
  from numbered_turns group by period, tenant_id, inbox_phone, contact_key, turn_id
), turn_stats as (
  select period, count(*)::int as samples,
    round(percentile_cont(0.5) within group (order by extract(epoch from reply_at - client_at) / 60.0))::int as minutes
  from turns where client_at is not null and reply_at >= client_at
  group by period
), sales as (
  select p.period, count(*)::int as records,
    coalesce(round(sum(v.valor_cents) / 100.0)::int, 0) as revenue,
    coalesce(round(avg(v.valor_cents) / 100.0)::int, 0) as ticket
  from public.crm_vendas v
  join thread_keys t on t.id = v.thread_id and t.tenant_id = v.tenant_id
  join periods p on v.data >= (p.date_from at time zone 'America/Sao_Paulo')::date
    and v.data <= (p.date_to at time zone 'America/Sao_Paulo')::date
  group by p.period
), stats as (
  select p.period,
    count(c.contact_key)::int as conversations,
    count(c.contact_key) filter (where c.interested)::int as leads,
    count(c.contact_key) filter (where c.scheduled)::int as scheduled,
    count(c.first_reply)::int as responded,
    coalesce(sum(c.incoming_messages), 0)::int as incoming_messages,
    round(percentile_cont(0.5) within group (order by c.response_minutes))::int as first_response_minutes,
    coalesce(round(100.0 * count(c.contact_key) filter (where c.response_minutes <= 10) / nullif(count(c.contact_key), 0), 1), 0) as sla_percent
  from periods p left join conversations c on c.period = p.period group by p.period
), days as (
  select generate_series(
    (date_from at time zone 'America/Sao_Paulo')::date,
    (date_to at time zone 'America/Sao_Paulo')::date, interval '1 day'
  )::date as day from bounds
), daily as (
  select (first_client at time zone 'America/Sao_Paulo')::date as day, count(*) as total
  from conversations where period = 'current' group by 1
), weekly as (
  select date_trunc('week', first_client at time zone 'America/Sao_Paulo')::date as week,
    round(100.0 * count(*) filter (where scheduled) / nullif(count(*), 0), 1) as percent
  from conversations where period = 'current' group by 1
), origins as (
  select origin, count(*) as total from conversations where period = 'current' group by origin
), classified_motives as (
  select case
    when first_text ~* '(cancel|reagend|desmarc|adia)' then 'Reagendar / cancelar'
    when first_text ~* '(est[áa]gio|academy|curso)' then 'Curso / Estágio VIP'
    when first_text ~* '(marca|agend|hor[áa]rio|dispon[íi]ve|reserv|vag[ae])' then 'Agendar horário'
    when first_text ~* '(pre[çc]o|valor|quanto custa|tabela|or[çc]amento)' then 'Preço / valor'
    when first_text ~* '(d[úu]vida|como funciona|procedimento|posso fazer|sobre)' then 'Dúvida procedimento'
    else 'Outros' end as motive
  from conversations where period = 'current'
), motives as (
  select motive, count(*) as total from classified_motives group by motive
)
select jsonb_build_object(
  'resumo', jsonb_build_object(
    'conversas', cur.conversations,
    'conversas_delta', case when prev.conversations > 0 then round((cur.conversations - prev.conversations) * 100.0 / prev.conversations, 1) else 0 end,
    'leads', cur.leads,
    'leads_delta', case when prev.leads > 0 then round((cur.leads - prev.leads) * 100.0 / prev.leads, 1) else 0 end,
    'agendamentos', cur.scheduled,
    'agendamentos_delta', case when prev.scheduled > 0 then round((cur.scheduled - prev.scheduled) * 100.0 / prev.scheduled, 1) else 0 end,
    'respondidas', cur.responded,
    'sem_resposta', cur.conversations - cur.responded,
    'taxa_resposta', case when cur.conversations > 0 then round(cur.responded * 100.0 / cur.conversations, 1) else 0 end,
    'tempo_resposta_min', cur.first_response_minutes,
    'pct_sla_resposta', cur.sla_percent,
    'tempo_resposta_turno_min', ts.minutes,
    'amostra_respostas', cur.responded,
    'amostra_turnos', coalesce(ts.samples, 0),
    'taxa_conversao', case when cur.conversations > 0 then round(cur.scheduled * 100.0 / cur.conversations, 1) else 0 end,
    'msg_recebidas', cur.incoming_messages,
    'vendas_registradas', coalesce(s.records, 0),
    'ticket_medio', coalesce(s.ticket, 0),
    'receita_total', coalesce(s.revenue, 0),
    'receita_delta', case when sp.revenue > 0 then round((coalesce(s.revenue, 0) - sp.revenue) * 100.0 / sp.revenue, 1) else 0 end
  ),
  'periodo', (select jsonb_build_object('from', date_from, 'to', date_to) from bounds),
  'fontes', jsonb_build_object('conversas', 'mensagens_recebidas', 'agendamentos', 'confirmacao_em_mensagens', 'vendas', 'crm'),
  'funil', jsonb_build_array(
    jsonb_build_object('etapa', 'Conversas recebidas', 'valor', cur.conversations),
    jsonb_build_object('etapa', 'Respondidas', 'valor', cur.responded),
    jsonb_build_object('etapa', 'Interesse detectado', 'valor', cur.leads),
    jsonb_build_object('etapa', 'Agendamentos detectados', 'valor', cur.scheduled),
    jsonb_build_object('etapa', 'Vendas registradas', 'valor', coalesce(s.records, 0))
  ),
  'serie_conversas', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(d.day, 'DD/MM'), 'value', coalesce(a.total, 0)) order by d.day), '[]'::jsonb) from days d left join daily a using (day)),
  'serie_conversao', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(week, 'DD/MM'), 'value', percent) order by week), '[]'::jsonb) from weekly),
  'origens', (select coalesce(jsonb_agg(jsonb_build_object('origem', origin, 'conversas', total, 'pct', case when cur.conversations > 0 then round(total * 100.0 / cur.conversations, 1) else 0 end) order by total desc, origin), '[]'::jsonb) from origins),
  'motivos', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motive, 'total', total, 'pct', case when cur.conversations > 0 then round(total * 100.0 / cur.conversations, 1) else 0 end, 'tag', case when motive in ('Agendar horário', 'Preço / valor', 'Curso / Estágio VIP') then 'quente' when motive = 'Dúvida procedimento' then 'morno' else 'frio' end) order by total desc, motive), '[]'::jsonb) from motives),
  'conversas_recentes', '[]'::jsonb
)
from stats cur join stats prev on prev.period = 'previous'
left join turn_stats ts on ts.period = cur.period
left join sales s on s.period = cur.period
left join sales sp on sp.period = 'previous'
where cur.period = 'current';
$$;

revoke all on function public.classificar_agendamento_whatsapp(text) from public, anon;
revoke all on function public.get_whatsapp_message_summary(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.classificar_agendamento_whatsapp(text) to authenticated, service_role;
grant execute on function public.get_whatsapp_message_summary(text, timestamptz, timestamptz) to authenticated, service_role;

notify pgrst, 'reload schema';
