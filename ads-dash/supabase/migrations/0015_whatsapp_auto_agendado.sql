-- 0015_whatsapp_auto_agendado.sql
-- Auto-detecção de agendamento por conteúdo da mensagem do atendente.
--
-- Hoje nenhum fluxo seta `whatsapp_threads.status = 'agendado'`, então o
-- KPI "Agendamentos" do painel fica em zero. Esta migração:
--
--   1. Cria a função `detectar_agendamento_texto(text)` com a heurística.
--   2. Adiciona trigger em `whatsapp_msgs` que, quando o ATENDENTE manda
--      mensagem confirmando agendamento, promove o thread a 'agendado'.
--   3. Faz backfill nas mensagens existentes.
--
-- A heurística foca em verbos de confirmação em passado/perfeito (sinal
-- forte de que a marcação aconteceu). Não promove threads já fechadas
-- como 'venda' nem 'arquivada' — essas têm precedência.

-- ============================================================
-- 1) Detector — IMMUTABLE pra cache e uso em índices/views se precisar.
-- ============================================================
create or replace function public.detectar_agendamento_texto(p_texto text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_texto, '') ~* (
       '(\magendei\M)'
    || '|(\mreservei\M)'
    || '|(\mmarquei\M)'
    || '|(\mconfirmei\M)'
    || '|(\magendad[oa]\M)'
    || '|(\mreservad[oa]\M)'
    || '|(\mmarcad[oa]\M)'
    || '|(\mconfirmad[oa]\M)'
    || '|(t[áa] confirmad)'
    || '|(fic(a|ou) (marcad|agendad|reservad))'
    || '|(deixei (marcad|reservad|agendad))'
    || '|(reservei (seu|sua) (vaga|hor[áa]rio))'
    || '|(te aguardo (no|na|em|dia|amanh|hoje))'
  );
$$;

comment on function public.detectar_agendamento_texto(text) is
  'Detecta confirmação de agendamento no texto de uma mensagem (heurística por verbos em passado / perfeito + frases-âncora).';

-- ============================================================
-- 2) Trigger — após cada insert em whatsapp_msgs.
-- ============================================================
create or replace function public.whatsapp_msgs_auto_agendado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.autor = 'atendente'
     and public.detectar_agendamento_texto(new.texto) then
    update public.whatsapp_threads
       set status = 'agendado'
     where id = new.thread_id
       and status not in ('venda', 'agendado', 'arquivada');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_msgs_auto_agendado on public.whatsapp_msgs;
create trigger trg_whatsapp_msgs_auto_agendado
  after insert on public.whatsapp_msgs
  for each row execute function public.whatsapp_msgs_auto_agendado();

-- ============================================================
-- 3) Backfill — aplica o detector no histórico existente.
-- ============================================================
do $$
declare v_count int;
begin
  with hits as (
    select distinct m.thread_id
    from public.whatsapp_msgs m
    where m.autor = 'atendente'
      and public.detectar_agendamento_texto(m.texto)
  )
  update public.whatsapp_threads t
     set status = 'agendado'
    from hits
   where t.id = hits.thread_id
     and t.status not in ('venda', 'agendado', 'arquivada');
  get diagnostics v_count = row_count;
  raise notice 'Backfill auto-agendado: % thread(s) promovidas a agendado.', v_count;
end $$;

-- Verificação rápida (descomente):
-- select status, count(*) from public.whatsapp_threads group by status order by status;
