-- 0020_whatsapp_response_time_median.sql
-- Troca `tempo_resposta_min` de média para mediana (percentile_cont(0.5))
-- e adiciona `pct_sla_resposta` (% de threads com primeira resposta em
-- ≤10 min). Motivação: em prod a média chegou em ~8.500min (~6 dias) por
-- causa de threads antigas com resposta muito tardia inflando o AVG.
-- Mediana é robusta a outliers; SLA% dá a leitura gerencial de fato.

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

  select count(*) into v_total_conv
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_leads
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status = 'lead'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  select count(*) into v_agendamentos
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and status = 'agendado'
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
      and (
        p_inbox_phone is null
        or exists (
          select 1 from whatsapp_threads t
          where t.id = m.thread_id and t.inbox_phone = p_inbox_phone
        )
      );

  select count(distinct m.thread_id) into v_threads_resp
    from whatsapp_msgs m
    where m.autor = 'atendente'
      and m.hora >= v_from and m.hora <= v_to
      and (
        p_inbox_phone is null
        or exists (
          select 1 from whatsapp_threads t
          where t.id = m.thread_id and t.inbox_phone = p_inbox_phone
        )
      );

  v_taxa_resposta := case when v_total_conv > 0
    then round(v_threads_resp * 100.0 / v_total_conv, 1)
    else 0 end;

  v_taxa_conv := case when v_leads > 0
    then round(v_vendas * 100.0 / v_leads, 1)
    else 0 end;

  -- Tempo de resposta: MEDIANA em minutos + % dentro do SLA de 10min.
  with allowed as (
    select id from whatsapp_threads
    where (p_inbox_phone is null or inbox_phone = p_inbox_phone)
  ),
  first_client as (
    select m.thread_id, min(m.hora) as t_cliente
    from whatsapp_msgs m
    join allowed a on a.id = m.thread_id
    where m.autor = 'cliente'
      and m.hora >= v_from and m.hora <= v_to
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

  select count(*) into v_total_prev from whatsapp_threads
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);
  select count(*) into v_leads_prev from whatsapp_threads
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status = 'lead'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);
  select count(*) into v_agend_prev from whatsapp_threads
    where criado_em >= v_prev_from and criado_em < v_prev_to
      and status = 'agendado'
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone);

  v_conv_delta  := pct_delta(v_total_conv,   v_total_prev);
  v_leads_delta := pct_delta(v_leads,        v_leads_prev);
  v_agend_delta := pct_delta(v_agendamentos, v_agend_prev);

  v_funil := jsonb_build_array(
    jsonb_build_object('etapa', 'Mensagens recebidas',  'valor', v_msg_recebidas),
    jsonb_build_object('etapa', 'Respondidas',          'valor', v_threads_resp),
    jsonb_build_object('etapa', 'Conversas qualificadas (leads)', 'valor', v_leads),
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
      and (
        p_inbox_phone is null
        or exists (
          select 1 from whatsapp_threads t
          where t.id = m.thread_id and t.inbox_phone = p_inbox_phone
        )
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

  with src as (
    select coalesce(origem, 'whatsapp') as origem, count(*) as n
    from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
      and (p_inbox_phone is null or inbox_phone = p_inbox_phone)
    group by coalesce(origem, 'whatsapp')
  ),
  totals as (select sum(n) as total from src)
  select coalesce(jsonb_agg(jsonb_build_object(
      'origem',    src.origem,
      'conversas', src.n,
      'pct',       case when totals.total > 0
        then round(src.n * 100.0 / totals.total, 1) else 0 end
    ) order by src.n desc), '[]'::jsonb)
    into v_origens
  from src, totals;

  with allowed as (
    select id from whatsapp_threads
    where criado_em >= v_from and criado_em <= v_to
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
        when texto ~* '(marca|agend|hor[áa]rio|dispon[íi]ve|reserv|vag[ae])'    then 'Agendar horário'
        when texto ~* '(pre[çc]o|valor|quanto custa|tabela|or[çc]amento)'        then 'Preço / valor'
        when texto ~* '(d[úu]vida|como funciona|procedimento|posso fazer|sobre)' then 'Dúvida procedimento'
        when texto ~* '(cancel|reagend|desmarc|adia)'                            then 'Reagendar / cancelar'
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
        when 'Agendar horário'      then 'quente'
        when 'Preço / valor'        then 'quente'
        when 'Dúvida procedimento'  then 'morno'
        else                              'frio'
      end
    ) order by grouped.n desc), '[]'::jsonb)
    into v_motivos
  from grouped, totals;

  return jsonb_build_object(
    'resumo', jsonb_build_object(
      'conversas',           v_total_conv,
      'conversas_delta',     v_conv_delta,
      'leads',               v_leads,
      'leads_delta',         v_leads_delta,
      'agendamentos',        v_agendamentos,
      'agendamentos_delta',  v_agend_delta,
      'taxa_resposta',       v_taxa_resposta,
      'tempo_resposta_min',  v_tempo_resp_min,
      'pct_sla_resposta',    v_pct_sla_resposta,
      'taxa_conversao',      v_taxa_conv,
      'ticket_medio',        0
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
