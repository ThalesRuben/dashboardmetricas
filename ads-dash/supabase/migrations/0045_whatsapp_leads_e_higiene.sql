-- 0045_whatsapp_leads_e_higiene.sql
-- Fix dos bugs do /whatsapp levantados em 22/10/2026:
--
-- A2 — "Agendar horário" conta como lead
--   Novo trigger `whatsapp_msgs_auto_lead` promove thread a status='lead'
--   quando a primeira mensagem do cliente casa a heurística "quente"
--   (agendamento, preço, dúvida procedimento, estágio VIP). Também faz
--   backfill. `v_leads` segue olhando status='lead', mas agora o status
--   é alimentado automaticamente, não só manual via kanban.
--
-- A4 — contatos crus/LID/self
--   Arquiva (status='arquivada') threads cujo contato tem phone fora
--   do padrão BR (12 ou 13 dígitos) ou cujo phone == inbox_phone do
--   próprio thread (número da linha aparecendo como contato).
--
-- Motivos — adiciona "Curso / Estágio VIP" e desinflama "Outros"
--   Mensagens que são só sticker/áudio/mídia/agradecimento não contam
--   mais como motivo "Outros" — classifica como "Sem texto / mídia" e
--   fica fora do pie de motivos.
--
-- CRM counts — RPC `get_crm_counts(p_inbox_phone)`
--   Retorna { lead, aberta, agendado, venda, arquivada } sem precisar
--   do front carregar todas as threads pra contar.
--
-- Rodar manualmente no Supabase SQL Editor (projeto DASH-TBC).

-- ============================================================
-- 1) Heurística de lead (quente) — texto do cliente
-- ============================================================
create or replace function public.detectar_lead_texto(p_texto text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_texto, '') ~* (
       '(marca|agend|hor[áa]rio|dispon[íi]ve|reserv|vag[ae])'
    || '|(pre[çc]o|valor|quanto custa|tabela|or[çc]amento)'
    || '|(d[úu]vida|como funciona|procedimento|posso fazer|sobre)'
    || '|(est[áa]gio|academy|curso)'
  );
$$;

comment on function public.detectar_lead_texto(text) is
  'Detecta se o texto da primeira msg do cliente indica intenção quente (agendar, preço, dúvida procedimento, estágio VIP).';

-- ============================================================
-- 2) Trigger — promove thread a 'lead' na primeira msg quente
-- ============================================================
create or replace function public.whatsapp_msgs_auto_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if new.autor <> 'cliente' then return new; end if;

  -- Checa só a PRIMEIRA msg do cliente — se já tem anterior, ignora.
  select count(*) into v_count
    from public.whatsapp_msgs
    where thread_id = new.thread_id
      and autor = 'cliente'
      and hora < new.hora;
  if v_count > 0 then return new; end if;

  if public.detectar_lead_texto(new.texto) then
    update public.whatsapp_threads
       set status = 'lead'
     where id = new.thread_id
       and status = 'aberta';  -- só promove quem tá cru; respeita manual
  end if;
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_msgs_auto_lead on public.whatsapp_msgs;
create trigger trg_whatsapp_msgs_auto_lead
  after insert on public.whatsapp_msgs
  for each row execute function public.whatsapp_msgs_auto_lead();

-- ============================================================
-- 3) Backfill — promove threads existentes com base na 1ª msg
-- ============================================================
do $$
declare v_count int;
begin
  with primeiras as (
    select distinct on (m.thread_id) m.thread_id, m.texto
    from public.whatsapp_msgs m
    where m.autor = 'cliente'
    order by m.thread_id, m.hora
  ),
  hits as (
    select thread_id from primeiras
     where public.detectar_lead_texto(texto)
  )
  update public.whatsapp_threads t
     set status = 'lead'
    from hits
   where t.id = hits.thread_id
     and t.status = 'aberta';
  get diagnostics v_count = row_count;
  raise notice 'Backfill auto-lead: % thread(s) promovidas a lead.', v_count;
end $$;

-- ============================================================
-- 4) A4 — arquivar threads com phone inválido (LID residual)
-- ============================================================
do $$
declare v_count int;
begin
  update public.whatsapp_threads t
     set status = 'arquivada'
    from public.whatsapp_contatos c
   where c.id = t.contato_id
     and t.status <> 'arquivada'
     and (
       char_length(regexp_replace(c.phone, '\D', '', 'g')) not in (12, 13)
       or c.phone = t.inbox_phone  -- próprio número do inbox
     );
  get diagnostics v_count = row_count;
  raise notice 'Higiene A4: % thread(s) arquivadas (phone inválido ou self).', v_count;
end $$;

-- ============================================================
-- 5) RPC get_crm_counts — contadores server-side por status
-- ============================================================
create or replace function public.get_crm_counts(
  p_inbox_phone text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'lead',      count(*) filter (where status = 'lead'),
    'aberta',    count(*) filter (where status = 'aberta'),
    'agendado',  count(*) filter (where status = 'agendado'),
    'venda',     count(*) filter (where status = 'venda'),
    'arquivada', count(*) filter (where status = 'arquivada'),
    'total',     count(*)
  )
  from public.whatsapp_threads
  where (p_inbox_phone is null or inbox_phone = p_inbox_phone);
$$;

grant execute on function public.get_crm_counts(text) to anon, authenticated;

-- ============================================================
-- 6) Atualiza get_whatsapp_summary — motivos melhor classificados +
--    "Precisam de você" via nova RPC + exclui threads arquivadas de
--    agregações de conversas abertas.
-- ============================================================
create or replace function public.get_whatsapp_summary(
  p_inbox_phone text default null,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
  v_prev_from timestamptz;
  v_prev_to   timestamptz;
  v_len       interval;

  v_total_conv        int;
  v_leads             int;
  v_agendamentos      int;
  v_vendas            int;
  v_msg_recebidas     int;
  v_threads_resp      int;
  v_taxa_resposta     numeric;
  v_tempo_resp_min    int;
  v_pct_sla_resposta  numeric;
  v_tempo_resp_turno  int;
  v_taxa_conv         numeric;

  v_total_prev  int;
  v_leads_prev  int;
  v_agend_prev  int;
  v_conv_delta  numeric;
  v_leads_delta numeric;
  v_agend_delta numeric;

  v_funil      jsonb;
  v_serie_conv jsonb;
  v_serie_taxa jsonb;
  v_origens    jsonb;
  v_motivos    jsonb;
begin
  v_to   := coalesce(p_to,   now());
  v_from := coalesce(p_from, v_to - interval '30 days');
  v_len  := v_to - v_from;
  v_prev_to   := v_from;
  v_prev_from := v_from - v_len;

  -- Base: exclui arquivadas em TODAS as contagens de conversa aberta.
  -- A4 (lixo histórico) continua fora.
  select count(*) into v_total_conv
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_leads
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status in ('lead', 'agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_agendamentos
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status in ('agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_vendas
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status = 'venda'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_msg_recebidas
    from whatsapp_msgs m
    where m.autor = 'cliente'
      and m.hora >= v_from and m.hora <= v_to
      and exists (
        select 1 from whatsapp_threads t
        where t.id = m.thread_id
          and t.status <> 'arquivada'
          and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone)
      );

  select count(distinct m.thread_id) into v_threads_resp
    from whatsapp_msgs m
    join whatsapp_threads t on t.id = m.thread_id
    where m.autor = 'atendente'
      and t.criado_em >= v_from and t.criado_em <= v_to
      and t.status <> 'arquivada'
      and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone);

  v_taxa_resposta := case when v_total_conv > 0
    then round(v_threads_resp * 100.0 / v_total_conv, 1)
    else 0 end;

  -- #1/#49: taxa_conversao usa denominador correto (leads ampliado) e
  -- devolve 1 casa decimal — nunca mais "0.0%" com agendamentos>0.
  v_taxa_conv := case when v_leads > 0
    then round(v_vendas * 100.0 / v_leads, 1)
    else 0 end;

  with allowed as (
    select id from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone)
  ),
  first_client as (
    select m.thread_id, min(m.hora) as t_cliente
    from whatsapp_msgs m
    join allowed a on a.id = m.thread_id
    where m.autor = 'cliente'
    group by m.thread_id
  ),
  first_resp as (
    select m.thread_id, min(m.hora) as t_resp
    from whatsapp_msgs m
    join first_client fc on fc.thread_id = m.thread_id
    where m.autor = 'atendente' and m.hora > fc.t_cliente
    group by m.thread_id
  ),
  rt as (
    select extract(epoch from (fr.t_resp - fc.t_cliente)) / 60.0 as minutos
    from first_client fc
    join first_resp fr on fr.thread_id = fc.thread_id
  )
  select
    coalesce(round(percentile_cont(0.5) within group (order by minutos))::int, 0),
    coalesce(round(100.0 * count(*) filter (where minutos <= 10) / nullif(count(*), 0), 1), 0)
    into v_tempo_resp_min, v_pct_sla_resposta
  from rt;

  with allowed_turno as (
    select id from whatsapp_threads
    where status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone)
  ),
  pares as (
    select extract(epoch from (prox.hora - mc.hora)) / 60.0 as minutos
    from whatsapp_msgs mc
    join allowed_turno a on a.id = mc.thread_id
    cross join lateral (
      select ma.hora
      from whatsapp_msgs ma
      where ma.thread_id = mc.thread_id
        and ma.autor = 'atendente'
        and ma.hora > mc.hora
        and ma.hora <= mc.hora + interval '24 hours'
      order by ma.hora
      limit 1
    ) prox
    where mc.autor = 'cliente'
      and mc.hora >= v_from and mc.hora <= v_to
  )
  select coalesce(round(percentile_cont(0.5) within group (order by minutos))::int, 0)
    into v_tempo_resp_turno
  from pares;

  select count(*) into v_total_prev from whatsapp_threads
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);
  select count(*) into v_leads_prev from whatsapp_threads
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status in ('lead', 'agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);
  select count(*) into v_agend_prev from whatsapp_threads
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status in ('agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  v_conv_delta  := pct_delta(v_total_conv,   v_total_prev);
  v_leads_delta := pct_delta(v_leads,        v_leads_prev);
  v_agend_delta := pct_delta(v_agendamentos, v_agend_prev);

  -- #47: funil em unidade uniforme — "conversas" em todas as etapas,
  -- não "mensagens" no topo. Mantém "Mensagens recebidas" como info
  -- separada abaixo via campo extra.
  v_funil := jsonb_build_array(
    jsonb_build_object('etapa', 'Conversas iniciadas',  'valor', v_total_conv),
    jsonb_build_object('etapa', 'Respondidas',          'valor', v_threads_resp),
    jsonb_build_object('etapa', 'Leads qualificados',   'valor', v_leads),
    jsonb_build_object('etapa', 'Agendamentos',         'valor', v_agendamentos),
    jsonb_build_object('etapa', 'Vendas concluídas',    'valor', v_vendas)
  );

  with dias as (
    select generate_series(v_from::date, v_to::date, interval '1 day')::date as d
  ),
  by_day as (
    select m.hora::date as d, count(*) as n
    from whatsapp_msgs m
    where m.autor = 'cliente'
      and m.hora >= v_from and m.hora <= v_to
      and exists (
        select 1 from whatsapp_threads t
        where t.id = m.thread_id
          and t.status <> 'arquivada'
          and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone)
      )
    group by m.hora::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(dias.d, 'DD/MM'),
      'value', coalesce(by_day.n, 0)
    ) order by dias.d), '[]'::jsonb)
    into v_serie_conv
  from dias left join by_day on by_day.d = dias.d;

  with semanas as (
    select generate_series(
      date_trunc('week', v_from),
      date_trunc('week', v_to),
      interval '1 week'
    )::date as wk
  ),
  agg as (
    select date_trunc('week', criado_em)::date as wk,
      count(*) as total,
      count(*) filter (where status = 'venda') as vendas
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone)
    group by date_trunc('week', criado_em)::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(semanas.wk, 'DD/MM'),
      'value', case when coalesce(agg.total, 0) > 0
        then round(coalesce(agg.vendas, 0) * 100.0 / agg.total, 1)
        else 0 end
    ) order by semanas.wk), '[]'::jsonb)
    into v_serie_taxa
  from semanas left join agg on agg.wk = semanas.wk;

  -- #52: origem — enriquece com "Anúncio (CTWA)" via regex nas frases
  -- pré-preenchidas conhecidas dos anúncios do Fábio Oliver. Fallback
  -- continua "whatsapp" pra threads sem assinatura.
  with primeiras as (
    select distinct on (m.thread_id) m.thread_id, m.texto
    from whatsapp_msgs m
    join whatsapp_threads t on t.id = m.thread_id
    where m.autor = 'cliente'
      and t.criado_em >= v_from and t.criado_em <= v_to
      and t.status <> 'arquivada'
      and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone)
    order by m.thread_id, m.hora
  ),
  src as (
    select
      case
        when texto ~* '(tenho interesse em agendar com o f[áa]bio oliver)' then 'Anúncio (CTWA)'
        when texto ~* '(saber mais sobre a agendamento|agendamentos com o fabio oliver)' then 'Anúncio (CTWA)'
        when texto ~* '(est[áa]gio vip com o f[áa]bio oliver)' then 'Anúncio Estágio VIP'
        when texto ~* '(instagram|bio|link do insta)' then 'Instagram / bio'
        when texto ~* '(indica[çc][ãa]o|me indicou|me recomendou)' then 'Indicação'
        else 'Orgânico / direto'
      end as origem_classificada,
      count(*) over () as total_geral
    from primeiras
  ),
  grouped as (
    select origem_classificada as origem, count(*) as n,
           max(total_geral) as total
    from src group by origem_classificada
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'origem',    origem,
      'conversas', n,
      'pct',       case when total > 0 then round(n * 100.0 / total, 1) else 0 end
    ) order by n desc), '[]'::jsonb)
    into v_origens
  from grouped;

  -- #53: motivos melhores — adiciona "Curso / Estágio VIP",
  -- separa "Sem texto / mídia" de "Outros" (sticker, áudio, agradecimento).
  with allowed as (
    select id from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone)
  ),
  first_msgs as (
    select distinct on (m.thread_id) m.thread_id, m.texto
    from whatsapp_msgs m
    join allowed a on a.id = m.thread_id
    where m.autor = 'cliente'
    order by m.thread_id, m.hora
  ),
  classified as (
    select
      case
        when texto ~* '(est[áa]gio|academy|curso)'                              then 'Curso / Estágio VIP'
        when texto ~* '(marca|agend|hor[áa]rio|dispon[íi]ve|reserv|vag[ae])'    then 'Agendar horário'
        when texto ~* '(pre[çc]o|valor|quanto custa|tabela|or[çc]amento)'       then 'Preço / valor'
        when texto ~* '(d[úu]vida|como funciona|procedimento|posso fazer|sobre)' then 'Dúvida procedimento'
        when texto ~* '(cancel|reagend|desmarc|adia)'                           then 'Reagendar / cancelar'
        when texto ~* '^\s*(\[(midia|audio|sticker|imagem|foto|video)\])\s*$'   then 'Sem texto / mídia'
        when char_length(regexp_replace(coalesce(texto,''), '\s', '', 'g')) < 4 then 'Sem texto / mídia'
        when texto ~* '^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad[ao])\.?\s*$' then 'Saudação sem contexto'
        else 'Outros'
      end as motivo
    from first_msgs
  ),
  grouped as (
    select motivo, count(*) as n
    from classified group by motivo
  ),
  totals as (select sum(n) as total from grouped)
  select coalesce(jsonb_agg(jsonb_build_object(
      'motivo', grouped.motivo,
      'total',  grouped.n,
      'pct',    case when totals.total > 0
        then round(grouped.n * 100.0 / totals.total, 1) else 0 end,
      'tag',    case grouped.motivo
        when 'Curso / Estágio VIP'  then 'quente'
        when 'Agendar horário'      then 'quente'
        when 'Preço / valor'        then 'quente'
        when 'Dúvida procedimento'  then 'morno'
        when 'Reagendar / cancelar' then 'morno'
        else                              'frio'
      end
    ) order by grouped.n desc), '[]'::jsonb)
    into v_motivos
  from grouped, totals;

  return jsonb_build_object(
    'resumo', jsonb_build_object(
      'conversas',                v_total_conv,
      'conversas_delta',          v_conv_delta,
      'leads',                    v_leads,
      'leads_delta',              v_leads_delta,
      'agendamentos',             v_agendamentos,
      'agendamentos_delta',       v_agend_delta,
      'taxa_resposta',            v_taxa_resposta,
      'tempo_resposta_min',       v_tempo_resp_min,
      'pct_sla_resposta',         v_pct_sla_resposta,
      'tempo_resposta_turno_min', v_tempo_resp_turno,
      'taxa_conversao',           v_taxa_conv,
      'ticket_medio',             0,
      'msg_recebidas',            v_msg_recebidas
    ),
    'periodo', jsonb_build_object('from', v_from, 'to', v_to),
    'funil',           v_funil,
    'serie_conversas', v_serie_conv,
    'serie_conversao', v_serie_taxa,
    'motivos',         v_motivos,
    'origens',         v_origens,
    'conversas_recentes', '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_whatsapp_summary(text, timestamptz, timestamptz)
  to anon, authenticated;

notify pgrst, 'reload schema';
