-- 0009_whatsapp_summary_fn.sql
-- Função que agrega métricas reais das tabelas whatsapp_threads/msgs/contatos
-- e retorna o objeto WhatsAppSummary esperado pelo front. Substitui a leitura
-- da tabela whatsapp_metrics (que era preenchida por job externo).
--
-- Classificação de motivo é heurística por regex na 1ª msg do cliente.
-- Quando volume cresce ou a precisão deixar a desejar, trocar pra IA.

-- Helper: delta percentual (atual vs anterior). Precisa existir antes do summary.
create or replace function public.pct_delta(atual int, anterior int)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(anterior, 0) = 0 then 0::numeric
    else round((atual - anterior) * 100.0 / anterior, 1)
  end;
$$;

create or replace function public.get_whatsapp_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_conv     int;
  v_leads          int;
  v_agendamentos   int;
  v_vendas         int;
  v_msg_recebidas  int;
  v_threads_resp   int;
  v_taxa_resposta  numeric;
  v_tempo_resp_min int;
  v_taxa_conv      numeric;

  v_total_prev      int;
  v_leads_prev      int;
  v_agend_prev      int;
  v_conv_delta      numeric;
  v_leads_delta     numeric;
  v_agend_delta     numeric;

  v_funil         jsonb;
  v_serie_conv    jsonb;
  v_serie_taxa    jsonb;
  v_origens       jsonb;
  v_motivos       jsonb;
begin
  -- ============ KPIs principais ============
  select count(*) into v_total_conv from whatsapp_threads;
  select count(*) into v_leads        from whatsapp_threads where status = 'lead';
  select count(*) into v_agendamentos from whatsapp_threads where status = 'agendado';
  select count(*) into v_vendas       from whatsapp_threads where status = 'venda';

  select count(*) into v_msg_recebidas from whatsapp_msgs where autor = 'cliente';

  -- Threads que tiveram pelo menos uma resposta do atendente
  select count(distinct thread_id) into v_threads_resp
  from whatsapp_msgs where autor = 'atendente';

  v_taxa_resposta := case when v_total_conv > 0
    then round(v_threads_resp * 100.0 / v_total_conv, 1)
    else 0 end;

  v_taxa_conv := case when v_leads > 0
    then round(v_vendas * 100.0 / v_leads, 1)
    else 0 end;

  -- Tempo médio de resposta (min) entre 1ª msg do cliente e 1ª resposta posterior
  with first_client as (
    select thread_id, min(hora) as t_cliente
    from whatsapp_msgs where autor = 'cliente'
    group by thread_id
  ),
  first_resp as (
    select m.thread_id, min(m.hora) as t_resp
    from whatsapp_msgs m
    join first_client fc on fc.thread_id = m.thread_id
    where m.autor = 'atendente' and m.hora > fc.t_cliente
    group by m.thread_id
  )
  select coalesce(round(avg(extract(epoch from (fr.t_resp - fc.t_cliente)) / 60))::int, 0)
    into v_tempo_resp_min
  from first_client fc
  join first_resp fr on fr.thread_id = fc.thread_id;

  -- ============ Deltas (últimos 30d vs 30d anteriores) ============
  select count(*) into v_total_prev from whatsapp_threads
    where criado_em >= now() - interval '60 days'
      and criado_em <  now() - interval '30 days';
  select count(*) into v_leads_prev from whatsapp_threads
    where criado_em >= now() - interval '60 days'
      and criado_em <  now() - interval '30 days'
      and status = 'lead';
  select count(*) into v_agend_prev from whatsapp_threads
    where criado_em >= now() - interval '60 days'
      and criado_em <  now() - interval '30 days'
      and status = 'agendado';

  v_conv_delta  := pct_delta(v_total_conv, v_total_prev);
  v_leads_delta := pct_delta(v_leads,      v_leads_prev);
  v_agend_delta := pct_delta(v_agendamentos, v_agend_prev);

  -- ============ Funil ============
  v_funil := jsonb_build_array(
    jsonb_build_object('etapa', 'Mensagens recebidas',  'valor', v_msg_recebidas),
    jsonb_build_object('etapa', 'Respondidas',          'valor', v_threads_resp),
    jsonb_build_object('etapa', 'Conversas qualificadas (leads)', 'valor', v_leads),
    jsonb_build_object('etapa', 'Agendamentos',         'valor', v_agendamentos),
    jsonb_build_object('etapa', 'Vendas concluídas',    'valor', v_vendas)
  );

  -- ============ Série: conversas por dia (últimos 7 dias) ============
  with dias as (
    select generate_series(
      (now()::date - 6),
      now()::date,
      interval '1 day'
    )::date as d
  ),
  by_day as (
    select hora::date as d, count(*) as n
    from whatsapp_msgs where autor = 'cliente'
      and hora >= now() - interval '7 days'
    group by hora::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(dias.d, 'DD/MM'),
      'value', coalesce(by_day.n, 0)
    ) order by dias.d), '[]'::jsonb)
    into v_serie_conv
  from dias left join by_day on by_day.d = dias.d;

  -- ============ Série: taxa de conversão por semana (últimas 4) ============
  with semanas as (
    select date_trunc('week', d)::date as wk
    from generate_series(
      now() - interval '3 weeks',
      now(),
      interval '1 week'
    ) d
  ),
  agg as (
    select date_trunc('week', criado_em)::date as wk,
      count(*) as total,
      count(*) filter (where status = 'venda') as vendas
    from whatsapp_threads
    where criado_em >= now() - interval '4 weeks'
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

  -- ============ Origens ============
  with src as (
    select coalesce(origem, 'whatsapp') as origem, count(*) as n
    from whatsapp_threads
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

  -- ============ Motivos (heurística regex na 1ª msg do cliente) ============
  with first_msgs as (
    select distinct on (thread_id) thread_id, texto
    from whatsapp_msgs
    where autor = 'cliente'
    order by thread_id, hora
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

  -- ============ Retorno ============
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
      'taxa_conversao',      v_taxa_conv,
      'ticket_medio',        0
    ),
    'funil',           v_funil,
    'serie_conversas', v_serie_conv,
    'serie_conversao', v_serie_taxa,
    'motivos',         v_motivos,
    'origens',         v_origens,
    'conversas_recentes', '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_whatsapp_summary() to anon, authenticated;
grant execute on function public.pct_delta(int, int)    to anon, authenticated;
