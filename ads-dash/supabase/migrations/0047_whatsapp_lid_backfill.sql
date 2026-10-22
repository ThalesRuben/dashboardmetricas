-- 0047_whatsapp_lid_backfill.sql
-- Backfill de pares LID → telefone extraídos do histórico de execuções
-- do n8n (período 15/10 → 22/10, janela máxima de 7,7 dias).
--
-- 323 pares distintos (1:1). Fonte: lid_phone_pares_n8n_2026-10-15_a_22.csv.
--
-- Ação:
--   1. REPLACE da função whatsapp_merge_lid — corrige:
--      a) bug do alias no copy de crm_thread_tags (perdia tags)
--      b) reabre thread arquivada no reassign (ex-órfão volta à vida)
--      Ordem de chamada no ingest: merge PRIMEIRO, update lid DEPOIS.
--   2. Hygiene — desmarca lid=phone pros 28 contatos de DDI internacional
--      que foram marcados por engano pela 0046 (clientes europeus/NANP).
--   3. Backfill — carrega 323 pares, preenche lid nos contatos reais,
--      chama whatsapp_merge_lid pros 27 que têm par (9 com thread aberta,
--      18 só com arquivadas).
--
-- Pré-requisito: migration 0046 aplicada (coluna lid + função merge).
-- Idempotente: pode rodar várias vezes sem efeito colateral.

-- ============================================================
-- 1) REPLACE da função whatsapp_merge_lid (fix: tag alias + unarchive)
-- ============================================================
create or replace function public.whatsapp_merge_lid(
  p_tenant_id uuid,
  p_real_contato_id uuid,
  p_lid text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orphan_id uuid;
  v_orphan_thread record;
  v_target_thread_id uuid;
  v_fused int := 0;
begin
  if p_lid is null then return 0; end if;

  select id into v_orphan_id
    from public.whatsapp_contatos
    where tenant_id = p_tenant_id
      and lid = p_lid
      and id <> p_real_contato_id
    limit 1;
  if v_orphan_id is null then return 0; end if;

  for v_orphan_thread in
    select id, inbox_phone, nao_lidas, ultima_atividade, ultima_msg_cliente_em, status
      from public.whatsapp_threads
      where contato_id = v_orphan_id
  loop
    select id into v_target_thread_id
      from public.whatsapp_threads
      where contato_id = p_real_contato_id
        and (
          (inbox_phone is null and v_orphan_thread.inbox_phone is null)
          or inbox_phone = v_orphan_thread.inbox_phone
        )
      limit 1;

    if v_target_thread_id is not null then
      update public.whatsapp_msgs
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      update public.crm_notas
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      update public.crm_followups
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      update public.crm_vendas
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      -- Tags: só move as que o destino ainda NÃO tem. Alias explícito
      -- (t_src/t_dst) impede auto-referência no not exists.
      update public.crm_thread_tags t_src
         set thread_id = v_target_thread_id
       where t_src.thread_id = v_orphan_thread.id
         and not exists (
           select 1 from public.crm_thread_tags t_dst
            where t_dst.thread_id = v_target_thread_id
              and t_dst.tag_id = t_src.tag_id
         );
      delete from public.crm_thread_tags where thread_id = v_orphan_thread.id;
      update public.whatsapp_threads
         set nao_lidas = nao_lidas + v_orphan_thread.nao_lidas,
             ultima_atividade = greatest(ultima_atividade, v_orphan_thread.ultima_atividade),
             -- nullif evita gravar '-infinity' quando as duas threads
             -- têm ultima_msg_cliente_em = NULL (290 threads assim no banco).
             ultima_msg_cliente_em = nullif(
               greatest(
                 coalesce(ultima_msg_cliente_em, '-infinity'::timestamptz),
                 coalesce(v_orphan_thread.ultima_msg_cliente_em, '-infinity'::timestamptz)
               ),
               '-infinity'::timestamptz
             )
       where id = v_target_thread_id;
      delete from public.whatsapp_threads where id = v_orphan_thread.id;
    else
      -- Sem thread irmã → reatribui contato. Se estava arquivada pela
      -- 0045 (phone era LID antes), reabre: agora pertence a contato
      -- legítimo e precisa aparecer no kanban/inbox.
      update public.whatsapp_threads
         set contato_id = p_real_contato_id,
             status = case when status = 'arquivada' then 'aberta' else status end
       where id = v_orphan_thread.id;
    end if;
    v_fused := v_fused + 1;
  end loop;

  delete from public.whatsapp_contatos where id = v_orphan_id;

  return v_fused;
end;
$$;

grant execute on function public.whatsapp_merge_lid(uuid, uuid, text)
  to anon, authenticated, service_role;

-- ============================================================
-- 2) Hygiene — desmarca lids falso-positivos (telefones internacionais)
--
-- A 0046 marcou qualquer phone fora de ^55\d{10,11}$ como lid. Isso
-- pegou também 28 contatos de DDI estrangeira (NANP, Espanha, Portugal,
-- UK, França). Desmarca os que casam padrão de mobile internacional.
-- Padrões conservadores — se um LID real cair num desses, fica marcado.
-- ============================================================
do $$
declare v_count int;
begin
  update public.whatsapp_contatos
     set lid = null
   where lid is not null
     and lid = phone  -- marcação da 0046 (não par descoberto)
     and (
          phone ~ '^1[2-9]\d{9}$'       -- NANP (US/Canadá, 11 dígitos)
       or phone ~ '^34[6-9]\d{8}$'       -- Espanha mobile (12 dígitos)
       or phone ~ '^351[9]\d{8}$'        -- Portugal mobile (12 dígitos)
       or phone ~ '^44[7]\d{9}$'         -- UK mobile (12 dígitos)
       or phone ~ '^33[6-7]\d{8}$'       -- França mobile (11 dígitos)
     );
  get diagnostics v_count = row_count;
  raise notice 'Falsos-positivos de lid (DDI internacional) desmarcados: %', v_count;
end $$;

-- ============================================================
-- 3) Backfill dos 323 pares LID → telefone
-- ============================================================
create temp table _pairs_0047 (lid text primary key, phone_zapi text) on commit drop;

insert into _pairs_0047 (lid, phone_zapi) values
    ('100721395519634', '553171333419'),
    ('102765799964834', '553186016350'),
    ('102778819096651', '553181139577'),
    ('104320527818953', '553194449089'),
    ('105265454174342', '553884291551'),
    ('105694934085757', '553187430063'),
    ('106691433648347', '553198912424'),
    ('106751462477953', '553199196837'),
    ('107249762599166', '553186400521'),
    ('107692697866360', '553184034066'),
    ('10784864223470', '553599278900'),
    ('109397246271613', '553192075944'),
    ('109946884620388', '553186726164'),
    ('112133123662059', '553186801195'),
    ('112317790466087', '553188973400'),
    ('113692230291628', '553175323439'),
    ('114216115658831', '553288722566'),
    ('114572631511231', '553194639260'),
    ('116320834207812', '553192698747'),
    ('117381590450238', '553194759579'),
    ('118382233940149', '553192678006'),
    ('119168296841250', '553199389229'),
    ('119954644975690', '553199341350'),
    ('120220513472628', '553193698991'),
    ('120573137039391', '553191271891'),
    ('120993657946157', '5524981344411'),
    ('121942711492805', '553185065285'),
    ('122947817713767', '553184299015'),
    ('123553408151732', '553191181848'),
    ('123583456133152', '553185844868'),
    ('12446848802929', '553184524319'),
    ('1267099242749', '553186051340'),
    ('127514055839908', '554988905016'),
    ('12794791465207', '553188852525'),
    ('128174876811328', '553193805000'),
    ('128363771482268', '553197432308'),
    ('12872117686449', '553191966379'),
    ('131142682427515', '556181471156'),
    ('131349411324152', '554791422316'),
    ('132255112507506', '553196843134'),
    ('134320824017074', '553191356535'),
    ('135283030917339', '553193228479'),
    ('137138356146219', '553591093531'),
    ('138023740141675', '553171701213'),
    ('138216661369033', '553192790395'),
    ('141901508390996', '553199412287'),
    ('142189657112799', '554999405151'),
    ('142228026556428', '553788422229'),
    ('142399674306587', '553199953880'),
    ('143039775412256', '553183643395'),
    ('144955196575825', '553799395618'),
    ('14594332475434', '553191425822'),
    ('147541119221895', '553193085573'),
    ('148082016669899', '553188924625'),
    ('149585171325081', '553798666188'),
    ('150860860518524', '553182053350'),
    ('15105467150433', '553194454623'),
    ('151358992818191', '553191053489'),
    ('152029091602509', '553193887761'),
    ('153532414038229', '553399635780'),
    ('155447885574318', '553184714175'),
    ('158806617157673', '553171461555'),
    ('160288313716859', '553399137271'),
    ('161031359881419', '553899495660'),
    ('161074309509367', '553192320099'),
    ('163329234448422', '553192221212'),
    ('163457882132560', '553784072804'),
    ('163548126810312', '553199779209'),
    ('165279619391639', '553191870798'),
    ('166112272584818', '553388108060'),
    ('16613537521903', '5511930337186'),
    ('167289127235676', '553197894150'),
    ('167538201759768', '553194953365'),
    ('167765851791512', '553599689764'),
    ('168289770729571', '553199077570'),
    ('168324717650145', '553184291088'),
    ('168882509750319', '553799086423'),
    ('168968375541881', '553186860765'),
    ('172125260349483', '553187063033'),
    ('172452248289445', '553171702865'),
    ('172529004081398', '553788354342'),
    ('172550445351136', '553197420826'),
    ('17291571929222', '553288715200'),
    ('17377504845945', '553192692125'),
    ('173937753366644', '553195808004'),
    ('174655046475808', '553197357569'),
    ('174878351171782', '553186263946'),
    ('175062934102221', '553196533153'),
    ('1752497672315', '553186152123'),
    ('175380828831970', '553188875412'),
    ('177154650296515', '553799973040'),
    ('178056559861830', '553199117268'),
    ('178099576664169', '553193946240'),
    ('178361552867354', '553184768221'),
    ('18086308642945', '553899781698'),
    ('181569893478421', '553197879925'),
    ('181659970363623', '553195910473'),
    ('183309304897786', '553399100387'),
    ('18472771809334', '553193925953'),
    ('185302102622340', '553183946351'),
    ('187827644014646', '553188585323'),
    ('188794112323816', '553199771519'),
    ('189021728817370', '553199750495'),
    ('189416832254141', '553199778535'),
    ('189811935723545', '553892364414'),
    ('191083581587654', '553175312457'),
    ('191482879320083', '34611147039'),
    ('191594951102501', '12134098546'),
    ('192655136915567', '553186202497'),
    ('193222139736226', '553591901332'),
    ('193453950529583', '553898571417'),
    ('19378909216775', '553199021001'),
    ('196112552050895', '553198740606'),
    ('196434724974609', '553391087046'),
    ('196791156916470', '553182594082'),
    ('199084770091070', '553199350139'),
    ('200716857655332', '556798159104'),
    ('201206366531754', '5511996704073'),
    ('201777681018997', '553197091906'),
    ('202847127904376', '553187792077'),
    ('203083233681462', '553194885275'),
    ('203663825997913', '553171737197'),
    ('203998145593369', '553197243023'),
    ('205003117621337', '553194420858'),
    ('206068252713076', '553198487553'),
    ('206523670245481', '553188063466'),
    ('207416939528338', '553191075823'),
    ('208267376619719', '553399064903'),
    ('208430669279280', '553183316222'),
    ('209366888280153', '553186883227'),
    ('209491475865676', '553198057441'),
    ('209869365887154', '553192312721'),
    ('21041766223994', '553191617025'),
    ('210698361667660', '553182797162'),
    ('211050951610598', '553175471006'),
    ('212089847173168', '553191952212'),
    ('212205861621886', '553175939000'),
    ('212497835532363', '553192083198'),
    ('212790010732724', '553399761266'),
    ('213408402125053', '556692343463'),
    ('214516554035412', '553798170089'),
    ('215800648564983', '553196915057'),
    ('216497003720863', '553196203363'),
    ('216517941698589', '553791337334'),
    ('217377136492545', '553484057012'),
    ('218424923959474', '553183377897'),
    ('21947450703985', '553194097339'),
    ('221611873533993', '5521999155249'),
    ('223153682911270', '553195844253'),
    ('223733520273416', '553199668428'),
    ('226108570095717', '558591881853'),
    ('22703834714215', '553198416803'),
    ('227397211267296', '553189464780'),
    ('228428238352402', '553196731910'),
    ('230652662255775', '5511972663050'),
    ('230961967050976', '553198426059'),
    ('231142338900066', '553184921208'),
    ('232869268037760', '553175221414'),
    ('233384345395386', '553175751327'),
    ('233981362593938', '553191637226'),
    ('235119445029082', '553193360373'),
    ('236816041005176', '553184272080'),
    ('237546185425084', '553193726127'),
    ('237769439879365', '553183416293'),
    ('238984915611771', '553198104477'),
    ('239170203185154', '553173146314'),
    ('240475369902334', '553192249146'),
    ('24069147762761', '553187776793'),
    ('241136778104960', '5521982469165'),
    ('242292208218351', '553198433207'),
    ('242459544182840', '553191351128'),
    ('243361554415813', '553193366741'),
    ('243426079592506', '553187192637'),
    ('244439557660794', '553199743553'),
    ('244534080499807', '553199827733'),
    ('245178946310237', '553193904642'),
    ('246222002610417', '553188287618'),
    ('24803520053353', '553196944879'),
    ('248043068747896', '553187862930'),
    ('248120411689187', '553192084905'),
    ('248317946667051', '553198770995'),
    ('248743131619415', '553194863046'),
    ('249632139571219', '553188042205'),
    ('249649386516696', '553197885620'),
    ('249700909346976', '553188766676'),
    ('250993644151006', '553175087541'),
    ('251543483867158', '553197687697'),
    ('252887775064290', '553388073597'),
    ('252982230806548', '557381979949'),
    ('25409110454362', '553196841686'),
    ('255920055521308', '553193668686'),
    ('256774754037869', '553195828237'),
    ('256989384970401', '553191968618'),
    ('257526390100020', '553799554549'),
    ('257650860290096', '553199949122'),
    ('258144848634050', '553192297663'),
    ('258295105376328', '553197350310'),
    ('25902981337235', '553193224434'),
    ('259240031735815', '553186677401'),
    ('262147741347999', '553175014371'),
    ('265575125242075', '553193917390'),
    ('268671763128498', '553192495076'),
    ('269028312514631', '553193402371'),
    ('271145714626598', '553199680073'),
    ('271820041285737', '553185700403'),
    ('272103458771089', '553175743003'),
    ('273005401907229', '553186151733'),
    ('273018270036144', '553192145558'),
    ('273370490908892', '553186761491'),
    ('273374836187332', '553186634226'),
    ('273718383239243', '553199470723'),
    ('273731234582714', '553185809093'),
    ('274049011843277', '553194173490'),
    ('275135739252773', '553194057459'),
    ('275917322625159', '5511969244545'),
    ('276037665603602', '553191728858'),
    ('276553028100143', '553197898989'),
    ('276746301661260', '553195223590'),
    ('277746978709745', '5511960711854'),
    ('279233020612862', '553391313038'),
    ('279267380322552', '553183181709'),
    ('279920349573370', '553185618632'),
    ('280117918044253', '553185757179'),
    ('280658983272670', '553191233307'),
    ('28093448196280', '19369009743'),
    ('281062710235346', '553187303534'),
    ('281127738691598', '555197048869'),
    ('281371897557094', '553197958585'),
    ('2903465001195', '553185459940'),
    ('29742749233308', '553186151090'),
    ('30378421145607', '553194683084'),
    ('30868097790030', '553188731185'),
    ('31160121995351', '553184473080'),
    ('32032067465467', '559181092534'),
    ('32160882925785', '553492121954'),
    ('360810823885', '5511965275873'),
    ('36704991858878', '553191028248'),
    ('36739838136575', '553899495461'),
    ('36782636826709', '553195740218'),
    ('37400743006228', '553798059129'),
    ('37851681038505', '553196130217'),
    ('39251706138734', '553191867215'),
    ('39840267694314', '553192788729'),
    ('42305780195389', '553172019202'),
    ('42932509921351', '553184927156'),
    ('42988394782853', '553198868077'),
    ('43044195832030', '553194334300'),
    ('43186030428286', '553188196189'),
    ('44667726999630', '553188730960'),
    ('4522768359606', '553183612497'),
    ('45552523813053', '553186116154'),
    ('46188145455138', '553199810901'),
    ('46394404548666', '553183902348'),
    ('46720771702807', '553195469033'),
    ('46935486541892', '553194070109'),
    ('47721515864245', '553192762001'),
    ('48138060607698', '553498134286'),
    ('48541888209013', '553187423398'),
    ('50148155609195', '553199199071'),
    ('50505225121890', '553198592412'),
    ('5179780907032', '553197603233'),
    ('53047258574922', '553194729292'),
    ('54279998013541', '554499197876'),
    ('55881953722543', '557197270596'),
    ('57123182493947', '553192083213'),
    ('58196823683309', '553182815000'),
    ('58381859557463', '553193677854'),
    ('58497572032748', '553387118693'),
    ('58604946223276', '553798597520'),
    ('61564195487985', '553492765584'),
    ('6189148586020', '553184992801'),
    ('61993658671198', '553194496645'),
    ('63419705196701', '553191736173'),
    ('63536206200996', '553184779686'),
    ('64218367823918', '553599006732'),
    ('64222780256326', '553791946824'),
    ('66335820234797', '553185840808'),
    ('66610765275155', '553191967414'),
    ('66752381759536', '553588938882'),
    ('68229934354592', '553891575519'),
    ('68453272653848', '553192696244'),
    ('69106124497118', '553791077333'),
    ('69166740553840', '553884130270'),
    ('704508911666', '553191272769'),
    ('70866993987805', '553291849440'),
    ('71008694358236', '553197670822'),
    ('71086054064145', '553198574378'),
    ('71756740067444', '553185735005'),
    ('72340234833939', '553186471880'),
    ('73061856485512', '553188180181'),
    ('73706101575857', '553194438320'),
    ('76524036296934', '553182685846'),
    ('77945754353880', '34607238795'),
    ('78327419252941', '553199018557'),
    ('79495700729929', '553185583790'),
    ('80337564655668', '553193605462'),
    ('80483610312704', '553191254929'),
    ('80947382865978', '553175131433'),
    ('81535810203676', '553188848574'),
    ('81716215545906', '553175913898'),
    ('83867859943538', '553192472059'),
    ('83936680083492', '553198250961'),
    ('84679659139209', '553194704305'),
    ('85805007695897', '553184614404'),
    ('88863158628380', '553172430835'),
    ('89103626448985', '553193093039'),
    ('89511598026811', '553183536056'),
    ('89580216778819', '553196888009'),
    ('89825013145819', '553191092464'),
    ('90327658557517', '553186342376'),
    ('92741312741631', '553199671607'),
    ('9367457939530', '15618663952'),
    ('94493743263916', '553299537986'),
    ('96185960419335', '553188893927'),
    ('96478001426519', '553187253418'),
    ('96959054508257', '553188247298'),
    ('97031934709774', '553193824229'),
    ('97225342500882', '553193622627'),
    ('97234234433591', '553185424143'),
    ('98174379261971', '553799742090'),
    ('98935259582587', '553184701565'),
    ('99591802339381', '553188148973'),
    ('99656260386922', '553198614277');

-- Normaliza o telefone_zapi pro formato canônico 55DDXXXXXXXXX (13 dígitos).
-- A Z-API manda com 12 dígitos (sem o 9 do celular). Mesma heurística do
-- front/edge: insere "9" entre DDD e número quando length = 12 começando em 55.
alter table _pairs_0047 add column phone_canonico text;
update _pairs_0047
   set phone_canonico = case
     when char_length(phone_zapi) = 12 and phone_zapi like '55%'
       then substring(phone_zapi, 1, 4) || '9' || substring(phone_zapi, 5)
     when char_length(phone_zapi) = 13 and phone_zapi like '55%'
       then phone_zapi
     else phone_zapi  -- telefone internacional ou formato inesperado — preserva
   end;

-- 3.1) UPDATE lid nos contatos reais (identificados por phone BR).
--
-- IMPORTANTE: pula contatos cujo lid ainda está num órfão (apagado só
-- no 3.2 abaixo). Sem esse not exists, 26 updates violariam o
-- whatsapp_contatos_tenant_lid_uidx e a transação inteira seria
-- desfeita. O 3.3 re-roda o mesmo update DEPOIS do merge pra pegar
-- esses 26 pendentes.
do $$
declare v_count int;
begin
  update public.whatsapp_contatos c
     set lid = p.lid
    from _pairs_0047 p
   where c.phone = p.phone_canonico
     and c.lid is null
     and not exists (
       select 1 from public.whatsapp_contatos o
        where o.tenant_id = c.tenant_id
          and o.lid = p.lid
          and o.id <> c.id
     );
  get diagnostics v_count = row_count;
  raise notice 'Contatos reais que ganharam lid (pré-merge): %', v_count;
end $$;

-- 3.2) Merge dos órfãos cujo LID casa com algum par
do $$
declare
  v_pair record;
  v_tenant uuid;
  v_real_id uuid;
  v_fused int;
  v_total_fused int := 0;
  v_merges int := 0;
begin
  select id into v_tenant from public.tenants where slug = 'the-blonde-concept';
  if v_tenant is null then raise notice 'Tenant the-blonde-concept não encontrado — abortando merge.'; return; end if;

  for v_pair in
    select p.lid, p.phone_canonico
      from _pairs_0047 p
     where exists (
       select 1 from public.whatsapp_contatos
        where tenant_id = v_tenant
          and lid = p.lid
          and phone <> p.phone_canonico  -- existe como órfão
     )
  loop
    select id into v_real_id
      from public.whatsapp_contatos
      where tenant_id = v_tenant
        and phone = v_pair.phone_canonico;
    if v_real_id is null then continue; end if;

    v_fused := public.whatsapp_merge_lid(v_tenant, v_real_id, v_pair.lid);
    v_total_fused := v_total_fused + v_fused;
    v_merges := v_merges + 1;
  end loop;

  raise notice 'Órfãos fundidos: % em % merges.', v_total_fused, v_merges;
end $$;

-- 3.3) Repete o UPDATE do 3.1 — agora os órfãos foram apagados pelo
-- merge, então os ~26 contatos reais que ficaram sem lid na primeira
-- passada podem recebê-lo sem violar o índice único.
do $$
declare v_count int;
begin
  update public.whatsapp_contatos c
     set lid = p.lid
    from _pairs_0047 p
   where c.phone = p.phone_canonico
     and c.lid is null;
  get diagnostics v_count = row_count;
  raise notice 'Contatos reais que ganharam lid (pós-merge): %', v_count;
end $$;

-- Verificação pós-backfill (sugestão pra devolver pro operador):
--   select
--     count(*) filter (where phone ~ '^55[0-9]{10,11}$') as reais,
--     count(*) filter (where phone !~ '^55[0-9]{10,11}$' and lid is not null) as orfaos_restantes,
--     count(*) filter (where lid is not null and phone ~ '^55[0-9]{10,11}$') as reais_com_lid_mapeado
--   from public.whatsapp_contatos;

notify pgrst, 'reload schema';
