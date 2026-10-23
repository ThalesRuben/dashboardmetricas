-- 0049_whatsapp_threads_br_lid_fossils.sql
-- Pós-0048: a view `whatsapp_threads_br` filtrava phone BR estrito,
-- escondendo (a) threads 'agendado' em contatos LID órfãos pre-15/10
-- e (b) clientes internacionais reais (ex.: italiano 39...).
--
-- Fix: usa `phone != lid` como signal de "contato real" em vez de
-- regex BR estrito. Lógica:
--   - lid is null                → nunca viu LID observação → é phone real
--   - phone != lid               → phone foi gravado via inbound (real) OU
--                                  é internacional desmarcado pela 0047
--   - lid = phone AND status
--     in ('agendado','venda')    → fóssil LID com valor cruzado (manter)
--   - lid = phone AND status
--     in ('aberta','lead')       → provisional puro (excluir, ruído)
--
-- Mantém security_invoker = true (introduzido pelo operador em prod ao
-- aplicar 0048 — correção crítica de RLS que não pode ser perdida).

create or replace view public.whatsapp_threads_br
with (security_invoker = true) as
  select t.*
    from public.whatsapp_threads t
    join public.whatsapp_contatos c on c.id = t.contato_id
   where (
     c.lid is null                             -- phone real, nunca viu LID
     or c.phone <> c.lid                       -- phone real diferente do LID (BR ou int'l)
     or t.status in ('agendado', 'venda')      -- fóssil LID com valor cruzado
   );

comment on view public.whatsapp_threads_br is
  'Threads de contatos reais (phone != lid) + fósseis LID com agendado/venda. Exclui provisórios LID puros (phone=lid, status=aberta/lead) que são ruído de outbound ainda não fundido. security_invoker=true respeita RLS.';

grant select on public.whatsapp_threads_br to anon, authenticated, service_role;

notify pgrst, 'reload schema';
