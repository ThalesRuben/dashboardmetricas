-- 0008_whatsapp_anon_read.sql
-- MVP "paciente 1": app privado, login estático (sem sessão Supabase real).
-- Libera leitura anônima nas tabelas da Inbox e disparo de WhatsApp.
-- Escrita continua restrita: edge functions usam service role, não anon.
-- Quando o app virar multi-tenant com Supabase Auth real, remover essas
-- políticas e voltar ao isolamento por tenant_id.

create policy "whatsapp_threads_anon_read"
  on public.whatsapp_threads for select using (true);

create policy "whatsapp_msgs_anon_read"
  on public.whatsapp_msgs for select using (true);

create policy "whatsapp_contatos_anon_read"
  on public.whatsapp_contatos for select using (true);

create policy "whatsapp_disparos_anon_read"
  on public.whatsapp_disparos for select using (true);
