-- 0010_whatsapp_normalize_phones.sql
-- Mescla contatos duplicados em whatsapp_contatos que se referem ao mesmo
-- número de telefone mas estavam armazenados em variantes diferentes (com/
-- sem DDI 55, com/sem o "9" do celular, com formatação). Esses duplicados
-- foram criados pelo inbox-ingest antigo, que fazia upsert no phone bruto
-- vindo do n8n.
--
-- O fix em código (commit 6b507f4) faz o ingest normalizar antes do upsert
-- — esta migration limpa o histórico. Idempotente: pode rodar várias vezes.
--
-- Estratégia:
--   1. Cria a função SQL normalizar_phone_br() — espelho fiel do util do
--      front (src/features/whatsapp/lib/phone.ts) e do helper do
--      inbox-ingest.
--   2. Pra cada grupo de contatos com mesmo (tenant_id, phone_normalizado),
--      elege o mais antigo como canônico, move todas as threads dos
--      duplicados pra ele, preserva o nome se faltar, e deleta os
--      duplicados (CASCADE não dispara porque já movemos as threads).
--   3. Reescreve o phone do canônico no formato canônico.
--
-- Pra ver duplicados ANTES de rodar:
--   SELECT phone, COUNT(*) FROM whatsapp_contatos GROUP BY phone HAVING COUNT(*) > 1;

create or replace function public.normalizar_phone_br(raw text)
returns text
language plpgsql
immutable
as $$
declare
  n text;
begin
  n := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  if n = '' then return ''; end if;
  if length(n) >= 11 and left(n, 1) = '0' then n := substring(n from 2); end if;
  if length(n) = 10 or length(n) = 11 then n := '55' || n; end if;
  if length(n) = 12 and left(n, 2) = '55' then
    n := substring(n from 1 for 4) || '9' || substring(n from 5);
  end if;
  return n;
end
$$;

do $$
declare
  grp record;
  canonico_id  uuid;
  canonico_phone text;
  dup_id uuid;
  i int;
  total_mesclados int := 0;
  total_normalizados int := 0;
  grupos_com_duplicata int := 0;
begin
  for grp in
    select
      tenant_id,
      public.normalizar_phone_br(phone) as phone_canon,
      array_agg(id    order by criado_em asc) as ids,
      array_agg(phone order by criado_em asc) as phones_originais
    from public.whatsapp_contatos
    where phone is not null
      and phone <> ''
      and public.normalizar_phone_br(phone) <> ''
    group by tenant_id, public.normalizar_phone_br(phone)
  loop
    canonico_id := grp.ids[1];
    canonico_phone := grp.phone_canon;

    if array_length(grp.ids, 1) > 1 then
      grupos_com_duplicata := grupos_com_duplicata + 1;
      for i in 2..array_length(grp.ids, 1) loop
        dup_id := grp.ids[i];

        -- Move todas as threads do duplicado pro canônico.
        update public.whatsapp_threads
          set contato_id = canonico_id
          where contato_id = dup_id;

        -- Preserva nome no canônico se ele não tinha.
        update public.whatsapp_contatos as c1
          set nome = coalesce(c1.nome, c2.nome),
              atualizado_em = now()
          from public.whatsapp_contatos as c2
          where c1.id = canonico_id
            and c2.id = dup_id
            and c2.nome is not null;

        -- Apaga o duplicado. CASCADE existe na FK, mas como já movemos as
        -- threads ele só remove a linha do contato e nada mais.
        delete from public.whatsapp_contatos where id = dup_id;
        total_mesclados := total_mesclados + 1;
      end loop;
    end if;

    -- Reescreve o phone do canônico no formato canônico (se já não estiver).
    update public.whatsapp_contatos
      set phone = canonico_phone,
          atualizado_em = now()
      where id = canonico_id
        and phone <> canonico_phone;
    if found then total_normalizados := total_normalizados + 1; end if;
  end loop;

  raise notice 'normalizar_phone_br: % grupos com duplicata, % contatos mesclados, % phones normalizados',
    grupos_com_duplicata, total_mesclados, total_normalizados;
end
$$;
