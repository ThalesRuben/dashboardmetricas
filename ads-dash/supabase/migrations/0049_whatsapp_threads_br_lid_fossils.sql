-- 0049_whatsapp_threads_br_lid_fossils.sql
-- Pós-0048: a view `whatsapp_threads_br` filtrava por phone BR estrito,
-- escondendo 19 threads 'agendado' que estavam em contatos LID órfãos
-- — agendamentos reais fossilizados em thread paralela ao cliente.
--
-- Causa raiz: pre-15/10, cada envio outbound da Z-API vinha com
-- `phone: <lid>@lid`. O ingest antigo criava contato órfão com phone=LID
-- e thread separada. Quando o atendente respondia "te espero amanhã às
-- 14h", o trg_whatsapp_msgs_auto_agendado marcava o status da thread
-- órfã como 'agendado'. O cliente real existia em outra thread (com
-- phone BR) que NUNCA fundiu com a LID porque o par só começou a ser
-- gravado em 15/10 via chat_lid no inbox-ingest novo. Essas 19 threads
-- representam agendamentos operacionais reais — não dá pra fundir
-- (histórico n8n cobre só 7,7 dias).
--
-- Fix: inclui threads de contatos com `lid` quando status in
-- ('agendado', 'venda'). Threads 'aberta'/'lead' em LID puro continuam
-- fora (ruído de provisório recém-criado, ainda vai fundir pelo runtime
-- quando o cliente responder).
--
-- Mantém security_invoker = true (introduzido pelo operador em prod ao
-- aplicar 0048 — correção crítica de RLS que não pode ser perdida).

create or replace view public.whatsapp_threads_br
with (security_invoker = true) as
  select t.*
    from public.whatsapp_threads t
    join public.whatsapp_contatos c on c.id = t.contato_id
   where (
     c.phone ~ '^55[0-9]{10,11}$'
     or (c.lid is not null and t.status in ('agendado', 'venda'))
   );

comment on view public.whatsapp_threads_br is
  'Threads de contatos com phone BR válido + fósseis LID (threads órfãs com agendado/venda confirmados pelo auto-trigger). Exclui provisórios LID puros (sem valor cruzado). security_invoker=true pra respeitar RLS de whatsapp_threads.';

grant select on public.whatsapp_threads_br to anon, authenticated, service_role;

notify pgrst, 'reload schema';
