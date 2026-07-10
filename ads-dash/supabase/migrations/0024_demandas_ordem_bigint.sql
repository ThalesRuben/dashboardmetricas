-- 0024_demandas_ordem_bigint.sql
-- `demandas.ordem` foi criada como int em 0022, mas o cliente usa `Date.now()`
-- (~1.75e12) que estoura int32. Promove pra bigint pra corrigir os inserts.

alter table public.demandas
  alter column ordem type bigint;

notify pgrst, 'reload schema';
