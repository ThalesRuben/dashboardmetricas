-- 0050_whatsapp_threads_br_client_engagement.sql
-- Pós-0049: a view ainda escondia contatos com `phone = lid` + `nome`
-- preenchido + msgs de cliente reais. Casos observados em prod:
-- Silmara Boás e Kadija Ayari — reais, com nome, com engajamento, mas
-- a Z-API nunca entregou o phone real (privacidade da conta Meta ou
-- bug antigo do fluxo), então o phone no banco é o LID.
--
-- Fix: adiciona "thread tem msg de cliente" como 4ª condição OR.
--
-- Lógica final:
--   lid is null                     → phone real por definição
--   phone != lid                    → phone real gravado (BR/int'l)
--   status in ('agendado','venda')  → fóssil LID com valor cruzado
--   tem msg de cliente              → real conversa, mesmo que phone=lid
--
-- Mantém security_invoker = true.

create or replace view public.whatsapp_threads_br
with (security_invoker = true) as
  select t.*
    from public.whatsapp_threads t
    join public.whatsapp_contatos c on c.id = t.contato_id
   where (
     c.lid is null
     or c.phone <> c.lid
     or t.status in ('agendado', 'venda')
     or exists (
       select 1 from public.whatsapp_msgs m
        where m.thread_id = t.id and m.autor = 'cliente'
     )
   );

comment on view public.whatsapp_threads_br is
  'Threads reais: contatos com phone real (BR ou int''l), fósseis LID com agendado/venda, ou threads com qualquer msg de cliente. Exclui provisórios LID puros sem engajamento. security_invoker=true respeita RLS.';

grant select on public.whatsapp_threads_br to anon, authenticated, service_role;

notify pgrst, 'reload schema';
