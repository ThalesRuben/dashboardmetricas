-- 0055_whatsapp_summary_receita.sql
-- Adiciona campo `receita_total` (R$) no resumo de WhatsApp, pra o dono ver
-- faturamento no mesmo card deck dos outros KPIs. Soma crm_vendas.valor_cents
-- no período, filtrando por inbox via join com whatsapp_threads_br.
--
-- Reaproveita toda a lógica da 0054, só adiciona a soma.

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
  v_vendas_crm        int;
  v_ticket_medio      int;
  v_receita_total     int;
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
  v_receita_prev int;
  v_conv_delta   numeric;
  v_leads_delta  numeric;
  v_agend_delta  numeric;
  v_receita_delta numeric;

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

  select count(*) into v_total_conv
    from whatsapp_threads_br
    where criado_em >= v_from and criado_em <= v_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_leads
    from whatsapp_threads_br
    where criado_em >= v_from and criado_em <= v_to
      and status in ('lead', 'agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_agendamentos
    from whatsapp_threads_br
    where criado_em >= v_from and criado_em <= v_to
      and status in ('agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select
    count(*),
    coalesce(round(avg(cv.valor_cents) / 100.0)::int, 0),
    coalesce(round(sum(cv.valor_cents) / 100.0)::int, 0)
    into v_vendas_crm, v_ticket_medio, v_receita_total
  from crm_vendas cv
  join whatsapp_threads_br t on t.id = cv.thread_id
  where cv.data >= v_from::date and cv.data <= v_to::date
    and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone);

  select coalesce(round(sum(cv.valor_cents) / 100.0)::int, 0)
    into v_receita_prev
  from crm_vendas cv
  join whatsapp_threads_br t on t.id = cv.thread_id
  where cv.data >= v_prev_from::date and cv.data < v_prev_to::date
    and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone);

  select count(*) into v_msg_recebidas
    from whatsapp_msgs m
    where m.autor = 'cliente'
      and m.hora >= v_from and m.hora <= v_to
      and exists (
        select 1 from whatsapp_threads_br t
        where t.id = m.thread_id
          and t.status <> 'arquivada'
          and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone)
      );

  select count(distinct m.thread_id) into v_threads_resp
    from whatsapp_msgs m
    join whatsapp_threads_br t on t.id = m.thread_id
    where m.autor = 'atendente'
      and t.criado_em >= v_from and t.criado_em <= v_to
      and t.status <> 'arquivada'
      and (p_inbox_phone is null or t.inbox_phone = p_inbox_phone);

  v_taxa_resposta := case when v_total_conv > 0
    then round(v_threads_resp * 100.0 / v_total_conv, 1)
    else 0 end;

  v_taxa_conv := case when v_total_conv > 0
    then round(v_agendamentos * 100.0 / v_total_conv, 1)
    else 0 end;

  with allowed as (
    select id from whatsapp_threads_br
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
    select id from whatsapp_threads_br
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

  select count(*) into v_total_prev from whatsapp_threads_br
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);
  select count(*) into v_leads_prev from whatsapp_threads_br
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status in ('lead', 'agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);
  select count(*) into v_agend_prev from whatsapp_threads_br
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status in ('agendado', 'venda')
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  v_conv_delta    := least(greatest(pct_delta(v_total_conv,    v_total_prev),   -999), 999);
  v_leads_delta   := least(greatest(pct_delta(v_leads,         v_leads_prev),   -999), 999);
  v_agend_delta   := least(greatest(pct_delta(v_agendamentos,  v_agend_prev),   -999), 999);
  v_receita_delta := least(greatest(pct_delta(v_receita_total, v_receita_prev), -999), 999);

  v_funil := jsonb_build_array(
    jsonb_build_object('etapa', 'Conversas iniciadas',  'valor', v_total_conv),
    jsonb_build_object('etapa', 'Respondidas',          'valor', v_threads_resp),
    jsonb_build_object('etapa', 'Leads qualificados',   'valor', v_leads),
    jsonb_build_object('etapa', 'Agendamentos',         'valor', v_agendamentos),
    jsonb_build_object('etapa', 'Vendas concluídas',    'valor', v_vendas_crm)
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
        select 1 from whatsapp_threads_br t
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
      count(*) filter (where status in ('agendado', 'venda')) as agendados
    from whatsapp_threads_br
    where criado_em >= v_from and criado_em <= v_to
      and status <> 'arquivada'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone)
    group by date_trunc('week', criado_em)::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(semanas.wk, 'DD/MM'),
      'value', case when coalesce(agg.total, 0) > 0
        then round(coalesce(agg.agendados, 0) * 100.0 / agg.total, 1)
        else 0 end
    ) order by semanas.wk), '[]'::jsonb)
    into v_serie_taxa
  from semanas left join agg on agg.wk = semanas.wk;

  with primeiras as (
    select distinct on (m.thread_id) m.thread_id, m.texto
    from whatsapp_msgs m
    join whatsapp_threads_br t on t.id = m.thread_id
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

  with allowed as (
    select id from whatsapp_threads_br
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
        when texto ~* '(est[áa]gio|academy|curso)'                                     then 'Curso / Estágio VIP'
        when texto ~* '(marca|agend|hor[áa]rio|dispon[íi]ve|reserv|vag[ae])'           then 'Agendar horário'
        when texto ~* '(pre[çc]o|valor|quanto custa|tabela|or[çc]amento)'              then 'Preço / valor'
        when texto ~* '(d[úu]vida|como funciona|procedimento|posso fazer|sobre)'      then 'Dúvida procedimento'
        when texto ~* '(cancel|reagend|desmarc|adia)'                                  then 'Reagendar / cancelar'
        when texto ~* '^\s*(\[(midia|audio|sticker|imagem|foto|video|sem\s+texto)\])\s*$' then 'Sem texto / mídia'
        when char_length(regexp_replace(coalesce(texto,''), '\s', '', 'g')) < 4        then 'Sem texto / mídia'
        when texto ~* '^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad[ao])\.?\s*$'  then 'Saudação sem contexto'
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
      'ticket_medio',             v_ticket_medio,
      'receita_total',            v_receita_total,
      'receita_delta',            v_receita_delta,
      'msg_recebidas',            v_msg_recebidas,
      'vendas_registradas',       v_vendas_crm
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

notify pgrst, 'reload schema';
