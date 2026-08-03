-- Adiciona colunas com métricas agregadas da janela de 28 dias
-- (mesma janela do Meta Business Suite). Cada linha diária de
-- instagram_account_metrics guarda também o snapshot retroativo
-- dos últimos 28 dias, calculado pelo Meta com deduplicação.
--
-- Motivo: somar valores diários infla reach (usuários únicos) porque
-- o mesmo user pode aparecer em N dias distintos. O Graph API entrega
-- o total_value com since/until da janela deduplicado.

alter table public.instagram_account_metrics
  add column if not exists reach_28d          integer,
  add column if not exists views_28d          integer,
  add column if not exists interactions_28d   integer,
  add column if not exists profile_views_28d  integer,
  add column if not exists website_clicks_28d integer,
  add column if not exists follows_28d        integer;

notify pgrst, 'reload schema';
