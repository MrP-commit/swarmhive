// OFFLINE TEST: GEARSA-2026-10-25 (owner: gear plan -> stock first (bag / warehouse) -> S.A. weapon: the clan leader brings the soul crystal (bag ->
// private WH -> clan WH, "not available" is reported), gemstones clan warehouse first then Helvetia, base weapon from the luxury shop, the rest of the
// plan, Pushkin's S.A. exchange, put on). Runs the GEARSA-PURE block and gearSaPlanMine of Scripts_dev/swarm.js in node against the real
// Scripts/data (soul_sa_recipes.json, giran_market.json, gear_prefs.json, gear_items.json) + source checks of the wiring.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = process.env.SWARM_SRC || path.join(ROOT, 'Scripts_dev', 'swarm.js');
const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('marker not found: ' + (i < 0 ? a : b)); return src.slice(i, j); };
const DATA = path.join(ROOT, 'Scripts', 'data');
const rj = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8').replace(/^﻿/, ''));
const P = new Function(cut('// ==== GEARSA-PURE begin', '// ==== GEARSA-PURE end') + '\nreturn { gsaRecipe, gsaCounts, gsaNeed, gsaStock, gsaGiveRows, gsaOfferPick, gsaScOfferPick, gsaMatRows, gsaScPlan, gsaApplyFix, gsaLiveDiff, GSA_FIX, gsaStockSrc, gsaSupCounts, gsaWhIsClan, gsaStockEnch, gsaEnchMap };')();
const RAW = rj('soul_sa_recipes.json'), REC = Array.isArray(RAW) ? RAW : RAW.recipes, M = rj('giran_market.json'), ITEMS = rj('gear_items.json').items;
const idOf = (n) => { const k = Object.keys(ITEMS).find(x => ITEMS[x].n === n); if (!k) throw new Error('no item ' + n); return Number(k); };

// ---- 1) recipes + offers (real data)
const lance = P.gsaRecipe(REC, 4860);
check(lance && lance.w === 97 && lance.cid === 4661 && lance.gem.id === 2132 && lance.gem.count === 339 && lance.adena === 3390000, `Lance - Towering Blow (4860): Lance 97 + Blue SC stage 10 (4661) + 339 Gemstone B + 3.39M (${JSON.stringify(lance)})`);
check(!P.gsaRecipe(REC, 97), 'a plain Lance (97) is no S.A. weapon');
const gem = P.gsaOfferPick(M, 2132);
check(gem && gem.npc === 'Helvetia' && gem.kind === 'shop' && gem.price === 11550 && gem.shopId, `Gemstone B: Helvetia shop 11,550 (same price as Kiki: Helvetia first) (${gem && gem.npc} ${gem && gem.price})`);
const lw = P.gsaOfferPick(M, 97);
check(lw && lw.npc === 'Galladucci' && lw.kind === 'exchange' && lw.listId === 5004 && lw.price === 10091400 && lw.x && lw.y, `Lance: Galladucci multisell 5004 for 10,091,400 (${lw && lw.npc} ${lw && lw.price})`);
check(!P.gsaOfferPick(M, 4661), 'Blue SC stage 10: no adena offer (Alexandria wants crystals) -> the clan leader brings it');
check(!P.gsaOfferPick(M, 8830), 'Shadow Item: Katana is never an offer');

// ---- 2) gsaNeed
{
  const prices = { weapon: lw.price, gem: gem.price };
  const n0 = P.gsaNeed(lance, { bag: {}, wh: {}, clan: { 2132: 828 } }, prices);
  check(n0.crystal.from === 'leader' && n0.gems.clan === 339 && n0.gems.buy === 0 && n0.weapon.from === 'buy', `Mei: crystal from the clan leader, 339 gems from the clan WH (828 there), Lance bought (${JSON.stringify(n0.gems)})`);
  check(n0.adena === 10091400 + Math.ceil(339 * 11550 * 1.25) + Math.ceil(3390000 * 1.2) && !n0.why, `Mei: adena = Lance + the clan share of gems as if bought (shared by the run) + fee with tax = ${n0.adena}`);
  const n1 = P.gsaNeed(lance, { bag: { 2132: 100 }, wh: {}, clan: { 2132: 39 } }, prices);
  check(n1.gems.bag === 100 && n1.gems.clan === 39 && n1.gems.buy === 200 && n1.adena === 10091400 + Math.ceil(239 * 11550 * 1.25) + Math.ceil(3390000 * 1.2), `gems: bag 100 + clan 39 + 200 bought at Helvetia (${n1.adena})`);
  const n2 = P.gsaNeed(lance, { bag: { 97: 1, 4661: 1 }, wh: {}, clan: {} }, prices);
  check(n2.weapon.from === 'bag' && n2.crystal.from === 'bag' && n2.weapon.price === 0, 'Lance + crystal in the bag: nothing bought for them');
  const n3 = P.gsaNeed(lance, { bag: {}, wh: { 4860: 1 }, clan: {} }, prices);
  check(n3.sa === 'wh' && n3.adena === 0, 'the finished Lance - Towering Blow in my warehouse: no chain');
  const n4 = P.gsaNeed(lance, { bag: {}, wh: {}, clan: {} }, { weapon: 0, gem: gem.price });
  check(/not in my bag \/ warehouses and no Giran NPC sells it/.test(n4.why), `no weapon offer -> not doable: ${n4.why}`);
}
// ---- 3) stock first + hand-over rows
{
  const st = P.gsaStock([{ id: 864, alts: [] }, { id: 864, alts: [] }, { id: 926, alts: [] }, { id: 895, alts: [] }], { 864: 1 }, { 864: 1 }, { 926: 1 });
  check(JSON.stringify(st.map(x => x.src)) === JSON.stringify(['bag', 'wh', 'clan', 'buy']), `2 earrings: one from the bag, one from the warehouse; necklace from the clan WH; ring bought (${st.map(x => x.src).join(',')})`);
  const c = P.gsaCounts([{ id: 97, count: 1, enchant: 3 }, { id: 97, count: 1, enchant: 7 }, { id: 2132, count: 828 }], 4);
  check(c[97] === 1 && c[2132] === 828, 'a +7 piece never counts as stock (above the safe +4)');
  const bag = [{ objId: 1, id: 4661, name: 'Blue Soul Crystal - Stage 10', count: 1 }, { objId: 2, id: 4661, name: 'Blue Soul Crystal - Stage 10', count: 1 }, { objId: 3, id: 2132, name: 'Gemstone B', count: 500, stackable: true },
    { objId: 4, id: 4636, name: 'Red Soul Crystal - Stage 7', count: 1 }, { objId: 5, id: 97, name: 'Lance', count: 1, equipped: true }];
  const rows = P.gsaGiveRows(bag, { 4661: 1, 2132: 339, 4636: 1, 97: 1 }, new Set([4]));
  check(rows.length === 2 && rows[0].objId === 1 && rows[1].count === 339 && rows[1].stack, `hand-over rows: 1 crystal + 339 of the gem stack; never my soul-plan crystal (kept back) or a worn piece (${JSON.stringify(rows)})`);
}
// ---- 4) gearSaPlanMine with the real gear plan (Mei: Swordsinger 21, lvl 53, plan B weapon "Lance - Towering Blow")
{
  const code = [cut('const ROLEKIND = {', '// role regexes'), cut('let shopIdxCache = null;', '/** Kamael: if I wear a sword'), cut('const isSaWeapon =', '/** Buy the picks:'),
    cut('let gearDbCache = null', 'const BODY_SLOTS = ['), cut('const BODY_SLOTS = [', 'const badEquip = {};'), cut('// ==== GEARSA-PURE begin', '// ==== GEARSA-PURE end'), cut('const GSA = {', '/** a promise mutex')].join('\n');
  const run = (o) => {
    const inv = (o.bag || []).map((b, k) => ({ Id: b.id, objId: 1000 + k, Count: b.count || 1, IsEquiped: !!b.eq, EnchantLvl: 0, Name: b.name || '' }));
    const files = { 'wh_private_Mei.json': o.wh ? JSON.stringify({ items: o.wh }) : null, 'clan_state.json': JSON.stringify({ warehouse: { items: o.clan || [] } }),
      'wh_private_Mats.json': o.matsWh ? JSON.stringify({ items: o.matsWh }) : null, 'bag_Mats.json': o.matsBag ? JSON.stringify({ items: o.matsBag }) : null };
    const File = { Exists: () => true, ReadAllText: (f) => { const s = String(f).replace(/\\/g, '/'), b = path.basename(s); if (b in files) { if (files[b] === null) throw new Error('ENOENT'); return files[b]; } return fs.readFileSync(s.replace(/^__S__\/data/, DATA), 'utf8'); }, GetLastWriteTimeUtc: () => ({ Ticks: 1 }) };
    const Me = { Name: 'Mei', Level: o.level || 53, ClassId: 21, objId: 1 };
    const CONFIG = { gear: { roles: {}, races: {}, gradeLevel: { NONE: 1, D: 20, C: 40, B: 52, A: 61, S: 76, S80: 80, S84: 84 }, upgrade: { on: true, keep: 300000, minGain: 1, order: [], casterSets: [] } }, healer: { roles: [] } };
    const num = (v) => Number(v) || 0;
    const fn = new Function('Me', 'state', 'CONFIG', 'File', '__SCRIPTS__', 'Inventory', 'hostSnap', 'now', 'num', 'logError', 'teamOf', 'soulTarget', 'myCrystals', 'soulReady', 'fileStamp', 'isHealerRole', 'rtFlag', 'SWARM_ROOT', 'note', 'appendShared', 'clanLeaderName',
      code + '\nreturn { gearSaPlanMine };');
    return fn(Me, { role: 'melee' }, CONFIG, File, '__S__', { forEach: (f) => inv.forEach(f) }, { inv: () => inv }, () => Date.now(), num, (w, e) => { throw new Error(w + ': ' + (e && e.message)); },
      () => 'P', () => null, () => [], () => false, () => '1', () => false, (n, d) => (n === 'gearSA' && o.flag !== undefined ? o.flag : d), '__R__', () => { }, () => { }, () => o.cl || '').gearSaPlanMine();
  };
  const worn = [{ id: idOf('Common Item - Orcish Poleaxe'), eq: true }];
  const a = run({ bag: worn, clan: [{ id: 2132, count: 828 }] });
  check(a && a.name === 'Lance - Towering Blow' && a.need.crystal.from === 'leader' && a.need.gems.clan === 339 && a.need.weapon.from === 'buy' && a.offers.weapon.npc === 'Galladucci' && a.offers.gem.npc === 'Helvetia',
    `Mei: plan = Lance - Towering Blow; crystal from Mats, 339 clan gems, Lance at Galladucci (${a && JSON.stringify({ n: a.name, c: a.need.crystal, g: a.need.gems, w: a.need.weapon, adena: a.need.adena })})`);
  check(run({ bag: worn.concat([{ id: 4860, eq: false }]) }).need.sa === 'bag', 'the finished S.A. weapon in the bag: taken from stock');
  check(run({ bag: [{ id: 4860, eq: true }] }) === null, 'wearing Lance - Towering Blow: nothing to do');
  check(run({ bag: worn, flag: false }) === null, 'runtime flag gearSA false: no chain');
  check(run({ bag: worn, level: 45 }) === null, 'level 45 (C): the B plan weapon is not my grade yet');
  const none = run({ bag: worn, cl: 'Mats', matsWh: [{ id: 4639, count: 1 }], matsBag: [{ id: 4636, count: 1 }] });
  check(none && /no Blue Soul Crystal stage 10 with Mats/.test(none.need.why), `no Blue stage 10 anywhere in Mats's records: not doable, said before the purse pays (${none && none.need.why})`);
  const yes = run({ bag: worn, cl: 'Mats', matsWh: [{ id: 4661, count: 1 }] });
  check(yes && !yes.need.why, 'one in Mats\'s warehouse record: doable');
}
// ---- 4b) TOUR-2026-10-25: nearest-first, every NPC once
{
  const T = P.gsaTourOrder || null;
  const P2 = new Function(cut('// ==== GEARSA-PURE begin', '// ==== GEARSA-PURE end') + '\nreturn { gsaTourOrder };')();
  const at = { Taurin: [80752, 146400], Helvetia: [80518, 147922], Galladucci: [79599, 145522], Alexandria: [79599, 145457], Radia: [79654, 150788], Sandra: [80511, 149183] };
  const pts = ['Helvetia', 'Alexandria', 'Radia', 'Galladucci', 'Sandra'].map(n => ({ n, x: at[n][0], y: at[n][1] })).concat([{ n: 'Nowhere', x: null, y: null }]);
  const o = P2.gsaTourOrder(pts, { x: at.Taurin[0], y: at.Taurin[1] }).map(p => p.n);
  check(o.join(',') === 'Galladucci,Alexandria,Helvetia,Sandra,Radia,Nowhere', `tour from Taurin: ${o.join(' → ')} (no coordinates = last)`);
  check(new Set(o).size === o.length, 'every NPC once');
  const bg = cut('async function buyGearPicks(', '/** How many copies of an item');
  check(/stopOf\(String\(G\.offer\.npc\)\)/.test(bg) && /stopOf\(String\(x\.npc\)\)/.test(bg) && /for \(const x of o\.S\.extra\)/.test(bg), 'one stop per NPC: all its lists + the S.A. chain\'s buys there (Galladucci weapon + plan pieces in one visit)');
  const ij = cut('async function ijBuyAt(', 'async function giranScanOrder(');
  check(/Math\.hypot\(num\(atl\.x\) - Me\.X, num\(atl\.y\) - Me\.Y\) < 350/.test(ij), 'ijBuyAt: no walk again when I already stand at the NPC (several pieces = one visit)');
  const ss = cut('function gearSaStops(', 'function gearSaCheck(');
  check(/if \(st\.failed && !\(st\.scFailed && baseBetter\)\) \{ res\.push\(`\$\{r\.wn\}: NOT bought — the chain stopped before/.test(ss), 'a failed gem buy earlier in the tour = the weapon is not bought');
  check(/gsaLookedRecently\(\)/.test(cut('function gearStockPlan(', '/** a stocked piece arrived')) && /wh_look_\$\{Me\.Name\}\.json/.test(cut('async function gearStockWh(', '/** the S.A. chain')), 'WHLOOK: a warehouse look without a list (empty warehouse) is not repeated for 12 h');
}
// ---- 5) wiring (incl. the review fixes 2026-10-25)
{
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  const at = (t) => gu.indexOf(t);
  check(at('gearStockPlan(plan.buys, deep)') > 0 && at('gsaAskStart(q, nm)') > at('gearStockPlan(') && at('gearStockWh(') > at('gsaAskStart(q, nm)') && at('gsaAskWait(h)') > at('gearStockWh(') && at('gearSaStops(sa, ask)') > at('gsaAskWait(h)') && at('buyGearPicks(plan.buys.filter(p => !p.bought && !(p.offer && p.offer.stock)), (chain && chain.ok ? chain.stops : chain && chain.base ? chain.base.stops : []).concat(duSt ? duSt.stops : []))') > at('gearSaStops(sa, ask)') && at('gearSaCheck(sa, chain)') > at('buyGearPicks(plan.buys.filter') && at('ijSA(') > at('gearSaCheck(') && at('equipBought(plan.buys)') > at('ijSA('),
    'gearUpgrade order: bag -> ask the clan leader -> my warehouse -> his hand-over -> ONE tour (chain gems + weapon + the plan, every NPC once) -> blacksmith -> put on');
  check(/const deep = \/\^!\/\.test/.test(gu) && /if \(deep\) \{ try \{ sa = gearSaPlanMine\(\)/.test(gu), 'S.A. chain + warehouse only for an order (!gearup), not in a supply run');
  check(/sa \? \{ noWeapon: `S\.A\. chain: \$\{sa\.name\}` \} : du \? \{ noWeapon: `dual craft: \$\{du\.name\}` \} : \{\}, stockMap \? \{ stock: stockMap \} : \{\}\)\)/.test(gu) && !/plan\.buys = plan\.buys\.filter\(p => p\.slot !== 'weapon'\)/.test(gu) && /if \(opts && opts\.noWeapon\) locked\.weapon/.test(cut('function planUpgrades(', 'async function buyGearPicks(')),
    'review #1: the plan is made WITHOUT the weapon slot (no budget eaten by a weapon that is dropped later)');
  check(/if \(deep && Me\.Name === clanLeaderName\(\) && gsaOn\(\)\) \{ const t0 = now\(\); while \(now\(\) - t0 < 90000 \|\| \(GSA\.pending > 0/.test(gu), 'review #4: the clan leader serves the queued requests first (90 s + until none pending), only for an order');
  check(/finally \{ try \{ await giranGo\('start'\); \} catch \(e\) \{ \} if \(gsaRel\)/.test(gu), 'review #3: the queue is freed after the walk back');
  check(/if \(!GSA\.serving\) Send\.StopMove\(\)/.test(gu) && /if \(!\(typeof GSA !== 'undefined' && GSA\.serving\)\) Send\.StopMove\(\)/.test(cut('function errandStart(', 'function errandEnd(')), 'review #2: no StopMove while the clan leader walks for a request');
  const sv = cut('async function gsaServe(', 'function gsaServeQueued(');
  check(/errandStart\('gsa', 20 \* 60000\)/.test(sv) && /GSA\.serving = true/.test(sv) && /errandEnd\('gsa'\)/.test(sv), 'review #2: the clan leader serves on an errand (follow cannot pull him back)');
  check(sv.indexOf("gsaWhTake('private', [{ id: cid") > 0 && sv.indexOf("gsaWhTake('clan', [{ id: cid") > sv.indexOf("gsaWhTake('private', [{ id: cid") && /has no \$\{nm\} for \$\{d\.from\}/.test(sv) && /gsaSay\(why, true\)/.test(sv), 'clan leader: crystal bag -> private WH -> clan WH, else reported in party chat');
  check(/gsaWhTake\('private', \[\{ id: gid, count: want - freeCount\(gid\) \}\]/.test(sv) && /if \(freeCount\(gid\) < want && isCL\) \{ const r = await gsaWhTake\('clan'/.test(sv) && /hovCommand\(\['!handover', hid\]\)/.test(sv), 'supplier: gemstones bag -> its warehouse -> (clan leader) clan WH; everything handed over (hand-over machinery)');
  check(/!before\.has\(num\(b\.objId\)\)/.test(sv), 'review #7: gear pieces handed over = only the ones that just came out of the clan warehouse');
  check(/bagCount\(num\(id\)\) > c0\[id\] - given\[id\]/.test(sv) && /give: given/.test(sv), 'review #5/#6: the reply says what is given; the wait counts items (a part of a stack keeps its objId)');
  check(/GSA\.cancel\.has\(d\.rid\)/.test(sv) && /swarm\.gearsa\.cancel/.test(cut('async function gsaAskWait(', '/** STOCK FIRST, part 1')), 'review #4: a buyer that gave up cancels; the clan leader skips it');
  check(/const gk0 = state\.gkBusy; try \{ return await whTake\(.*\} finally \{ state\.gkBusy = gk0; \}/.test(cut('async function gsaWhTake(', '/** a promise mutex')), 'review #9: the run\'s gkBusy guard survives whTake');
  check(/p\.stockId = s\.id/.test(cut('function gearStockPlan(', '/** a stocked piece arrived')) && /function gearStockGot\(/.test(src), 'review #8: a twin id is used only when it arrives');
  check(/warehouse record'\} showed one, it did not reach my bag \(old record\?\) — nothing bought for the chain/.test(cut('function gearSaStops(', '// --- FRENZY KIT BUY')), 'review #10: a weapon expected from stock that did not come is not bought with unplanned adena');
  check(/offers\.weapon\.kind === 'shop' \? Math\.ceil\(offers\.weapon\.price \* 1\.25\)/.test(cut('function gearSaPlanMine(', '/** whTake for the chain')), 'review #10: a shop weapon is planned with the 1.25 margin ijBuyAt checks');
  check(/gsaOwnCrystals\(r\.wn\)/.test(cut('function gearSaPlanMine(', '/** whTake for the chain')) && /own\.ids\[cid\]/.test(cut('function gearSaStops(', '// --- FRENZY KIT BUY')), 'review #11: my soul plan\'s crystal for another weapon is never counted / used');
  check(/queued at \$\{Me\.Name\}/.test(cut("App.on('swarm.gearsa.ask'", "App.on('swarm.gearsa.cancel'")), 'the clan leader acknowledges a request at once (the asker waits up to 40 min, not 3)');
  const lead = cut("  if (cmd === '!gearup') {", "    })().catch(e => { logError('!gearup', e);");
  check(/GUPST\[n\]/.test(lead) && /60 \* 60000/.test(lead) && !/await sleep\(Math\.max\(60000, names\.length \* 25000\)\)/.test(lead), '!gearup: the leader waits for every buyer\'s done (max 60 min) instead of a fixed time');
  const mem = cut("App.on('swarm.gearup', async (e) => {", "App.on('swarm.zig'");
  check(/swarm\.gearup\.state', \{ name: Me\.Name, st: 'start' \}/.test(mem) && /st: 'done'/.test(mem) && /errandStart\('buy', 60 \* 60000\)/.test(mem), 'member: start / done states, 60 min errand');
  const pi = cut('function purseInfoMine(', 'function pursePublic(');
  check(/gearSaPlanMine\(\)/.test(pi) && /o\.want \+= num\(s2\.need\.adena\)/.test(pi) && /planUpgrades\(1e15, s2 \? \{ noWeapon/.test(pi), 'purse: the S.A. chain counts in the member\'s need, the plan without the weapon slot');
}
// OWNSTAGE (Mats live 2026-10-25: soul plan Red -> stage 9 for Sword of Valhalla; Red stage 7 (levelling) + Red stage 10 (taken out for Wizard's Tear))
{
  const own = new Function('num', 'soulTarget', 'myCrystals', cut('function gsaOwnCrystals(', '/** my gear plan') + '\nreturn gsaOwnCrystals;')(
    (v) => Number(v) || 0,
    () => ({ now: { color: 'red', stage: 9, weapon: 'Sword of Valhalla' } }),
    () => [{ objId: 1, id: 4636, color: 'red', stage: 7, count: 1 }, { objId: 2, id: 4639, color: 'red', stage: 10, count: 1 }, { objId: 3, id: 4650, color: 'green', stage: 10, count: 1 }]);
  const o = own("Wizard's Tear");
  check(o.objIds.has(1) && !o.objIds.has(2) && !o.objIds.has(3) && !o.ids[4639], `own crystals = only Red up to stage 9 (the levelled one), the Red stage 10 is stock for the chain (${[...o.objIds].join(',')})`);
  check(own('Sword of Valhalla').objIds.size === 0, 'the soul plan\'s own weapon: nothing held back');
}
// SABASE-early (owner 2026-10-25: "maZe didn't buy the Spell Breaker that he has on the list" - no Red Soul Crystal stage 9 anywhere)
{
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/if \(sa\.need\.why && gsaBaseOnly\(sa\)\) \{ sa\.baseOnly = true; sa\.need = Object\.assign\(\{\}, sa\.need, \{ adena: num\(sa\.need\.weapon\.price\) \}\)/.test(gu) && /if \(sa && sa\.need\.why && !sa\.baseOnly\) \{ saNote/.test(gu), 'crystal nowhere: the chain is kept for the plain weapon only (its price set aside), not dropped');
  check(/if \(!sa\.baseOnly && bagCount\(num\(r\.cid\)\)/.test(gu) && /if \(N\.gems && !sa\.baseOnly\)/.test(gu), 'plain weapon only: no crystal / gemstones asked from the clan leader');
  const bo = cut('function gsaBaseOnly(', '/** whTake for the chain');
  check(/\/Soul Crystal\/i\.test\(sa\.need\.why\)/.test(bo) && /itemScore\(num\(sa\.r\.w\), wi, g\.owned\) > itemScore\(num\(cur\.id\), cur\.info, g\.owned\)/.test(bo), 'only for a missing crystal, and only when the plain weapon beats mine (Spell Breaker M.Atk 122 > Homunkulus\'s Sword - Acumen 101)');
  check(/gsaBaseOnly\(s2\) \? Object\.assign/.test(cut('function purseInfoMine(', '/** swarm_state.purse')), 'the purse pays for the plain weapon too');
}
// SCBUY (owner 2026-10-25: "soul crystals can be bought at the luxury shop ... they cost some B/C/D crystals ... given by the clan leader from the wh / clan wh")
{
  const o9 = P.gsaScOfferPick(M, 4638);
  check(o9 && o9.npc === 'Alexandria' && o9.kind === 'exchange' && o9.listId === 5005 && o9.entry === 11 && o9.x && o9.y && o9.price === 0, `Red SC stage 9: Alexandria list 5005 entry 11 (${o9 && o9.npc} ${o9 && o9.listId}/${o9 && o9.entry})`);
  check(o9 && JSON.stringify(o9.cost.map(c => [c.id, c.count])) === JSON.stringify([[1459, 135], [1460, 44]]), `Red SC stage 9 costs 135 Crystal C + 44 Crystal B (${o9 && JSON.stringify(o9.cost)})`);
  const o10 = P.gsaScOfferPick(M, 4661);
  check(o10 && o10.entry === 8 && o10.cost.length === 2 && o10.cost[0].count === 150 && o10.cost[1].count === 50, 'Blue SC stage 10: 150 C + 50 B');
  const o7 = P.gsaScOfferPick(M, 4636);
  check(o7 && o7.cost[0].id === 1458 && o7.cost[0].count === 500 && o7.cost[1].id === 1459, 'Red SC stage 7: 500 D + 100 C');
  check(!P.gsaScOfferPick(M, 97) && !P.gsaScOfferPick(M, 2132) && !P.gsaScOfferPick(M, 0), 'a weapon / gemstones / id 0: no crystal-cost offer');
  // the clan warehouse 2026-10-25: Crystal C 72,772, no Crystal B anywhere
  const p0 = P.gsaScPlan(o9, { bag: {}, wh: {}, clan: { 1459: 72772 } }, {});
  check(p0 && p0.short.length === 1 && p0.short[0].id === 1460 && p0.short[0].missing === 44 && p0.mats[0].clan === 135 && p0.mats[0].rest === 0, `no Crystal B anywhere: 44 Crystal (B-Grade) short (${JSON.stringify(p0.short)})`);
  const p1 = P.gsaScPlan(o9, { bag: { 1459: 50, 1460: 4 }, wh: { 1459: 50 }, clan: { 1459: 72772 } }, { 1460: 100 });
  check(!p1.short.length && p1.mats[0].bag === 50 && p1.mats[0].wh === 50 && p1.mats[0].clan === 35 && p1.mats[1].bag === 4 && p1.mats[1].rest === 40 && p1.adena === 0, `C: my bag 50 + my wh 50 + clan 35; B: my bag 4 + 40 from the clan leader (${JSON.stringify(p1.mats)})`);
  check(P.gsaScPlan(null, {}, {}) === null, 'no offer -> null');
  const pm = cut('function gearSaPlanMine(', '/** SABASE-early');
  check(/gsaScPlan\(gsaScOffer\(cid\), hold, CL === Me\.Name \? \{\} : LH\)/.test(pm) && /from: 'buy', buy: sc/.test(pm) && /missing to buy one at/.test(pm), 'plan: the crystal nowhere -> bought for grade crystals, or said what is short');
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/N\.crystal\.from === 'buy' && N\.crystal\.buy/.test(gu) && /req\.mats\.push\(\{ id: m\.id, count: left - fromWh, name: m\.name \}\)/.test(gu) && /extraWh\.push\(\{ id: m\.id, count: fromWh \}\)/.test(gu), 'gearUpgrade: grade crystals from my bag, my warehouse, the rest asked from the clan leader (req.mats)');
  check(/if \(chain\.scFailed\) \{ chain\.ok = false; chain\.base = \{ objId: chain\.objId \}; \}/.test(gu), 'the crystal exchange failed: the plain weapon goes on like SABASE');
  const ss = cut('function gearSaStops(', '/** after the tour');
  check(/first: true, what: cname/.test(ss) && /ijBuyAt\(o, cid, 1, ''\)/.test(ss) && /st\.scFailed = true/.test(ss), 'tour: the soul crystal stop (first), exchanged at the luxury shop');
  check(/if \(st\.failed\) \{ res\.push\(`\$\{r\.gem\.name\}: NOT bought/.test(ss) && /st\.failed && !\(st\.scFailed && baseBetter\)/.test(ss), 'no gemstones without the crystal; the plain weapon only when it beats mine');
  check(/matsIn = !!buy && buy\.mats\.every\(m => bagCount\(m\.id\) >= m\.need\)/.test(ss), 'grade crystals not all in my bag -> the base path (SABASE)');
  const bg = cut('async function buyGearPicks(', '/** where an NPC stands');
  check(/p\.S\.extra\.some\(x => x\.first\)/.test(bg) && /fp\.concat\(mid, gsaTourOrder\(lp/.test(bg) && /p\.S\.extra\.some\(x => x\.last\)/.test(bg), 'buyGearPicks: the first stop first, the last stop (S.A. weapon) last, the rest nearest-first');
  const sv = cut('async function gsaServe(', 'function gsaServeQueued(');
  check(/for \(const m of \(Array\.isArray\(d\.mats\) \? d\.mats : \[\]\)\)/.test(sv) && /gsaWhTake\('private', \[\{ id, count: n - freeCount\(id\) \}\]/.test(sv) && /gsaWhTake\('clan', \[\{ id, count: n - freeCount\(id\) \}\]/.test(sv), 'the clan leader: grade crystals from his bag -> his warehouse -> the clan warehouse');
}
// SAFIX + WORNBASE (maZe live 2026-10-26: Pushkin list 4000 = 211 Magic Hold <= Red 9, 212 Mental Shield <= Green 9, 213 Acumen <= Blue 9; the 1st
// Spell Breaker was worn (SABASE) and a 2nd one was bought)
{
  const live = [211, 212, 213].map((entry, i) => ({ entry, products: [{ id: [8143, 8142, 8141][i], count: 1 }], ings: [{ id: 7892, count: 1 }, { id: [4638, 4649, 4660][i], count: 1 }, { id: 2132, count: 222 }, { id: 57, count: 2220000 }] }));
  const sc = new Set(REC.map(r => Number(r.cid)));
  const raw = REC.map(r => r.saId === 8141 ? Object.assign({}, r, { cid: 4638, color: 'red' }) : r.saId === 8143 ? Object.assign({}, r, { cid: 4660, color: 'blue' }) : r);   // the L2J rows
  const d = P.gsaLiveDiff(live, raw, sc);
  check(d[8141] && d[8141].cid === 4660 && d[8141].was === 4638 && d[8143] && d[8143].cid === 4638 && !d[8142], `the live list against the L2J rows: Acumen wants Blue 9, Magic Hold Red 9, Mental Shield as planned (${JSON.stringify(d)})`);
  const fixed = P.gsaApplyFix(raw, P.GSA_FIX), a = P.gsaRecipe(fixed, 8141), m = P.gsaRecipe(fixed, 8143);
  check(a.cid === 4660 && a.color === 'blue' && a.stage === 9 && a.fixed === 4638 && m.cid === 4638 && m.color === 'red', `GSA_FIX: Spell Breaker - Acumen = Blue 9 (4660), Magic Hold = Red 9 (${a.color} ${a.stage} / ${m.color} ${m.stage})`);
  check(!Object.keys(P.gsaLiveDiff(live, fixed, sc)).length, 'after the fix the live list and the recipes agree');
  check(P.gsaRecipe(fixed, 4860).cid === 4661 && P.gsaRecipe(fixed, 8117).cid === 4639 && P.gsaRecipe(fixed, 9322).cid === 4650 && P.gsaRecipe(fixed, 4717).cid === 4639, 'the S.A.s made live on L2Toggle stay as they were (Lance - Towering Blow Blue 10, Wizard\'s Tear - Acumen Red 10, Dismantler - Health Green 10, Sword of Damascus - Focus Red 10)');
  check(P.gsaRecipe(REC, 8141).cid === 4660 && P.gsaRecipe(REC, 10899).cid === 4660 && P.gsaRecipe(REC, 8143).cid === 4638, 'Scripts/data/soul_sa_recipes.json carries the fix too (the Items page reads it)');
  const rc = cut('function gsaRecipes() {', 'function gsaOffer(id) {');
  check(/gsaApplyFix\(v, Object\.assign\(\{\}, GSA_FIX, gsaLiveFix\(\)\)\)/.test(rc) && /soul_sa_live\.json/.test(rc) && /GSA\.recipes = null/.test(rc), 'gsaRecipes: the known fix + what the blacksmiths taught (Logs/soul_sa_live.json); learning re-plans');
  const ij = cut('async function ijSA(', '/** enchant this one piece');
  check(/gsaLearn\(entries, listId, String\(who\.Name\)\)/.test(ij) && /const forSA = entries\.filter\(e => e\.products\.some\(x => x\.id === num\(sa\.saId\)\) && e\.ings\.some\(x => x\.id === wid\)\)/.test(ij) && /wrongCrystal: liveC/.test(ij), 'ijSA: the entry by product + weapon, the server\'s crystal (learned; named when I do not have it)');
  const pm = cut('function gearSaPlanMine(', '/** SABASE-early');
  check(/\(g\.eq\.weapon \|\| \[\]\)\.forEach\(e => \{ if \(num\(e\.id\) === num\(r\.w\) \|\| \(tw\[num\(r\.w\)\] && num\(e\.id\) === tw\[num\(r\.w\)\]\)\) bag\[num\(e\.id\)\]/.test(pm), 'WORNBASE: the plain weapon I wear is stock (no 2nd purchase)');
  const ss = cut('function gearSaStops(', '/** after the tour');
  check(/objId: gsaWeaponObj\(w\)/.test(ss) && /last: true, what: r\.wn/.test(ss), 'gearSaStops: the worn weapon is found; the weapon stop is the last');
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/tookOff = num\(saObj\); Send\.UseItem\(tookOff\)/.test(gu) && /if \(tookOff\) \{ try \{ Send\.UseItem\(tookOff\)/.test(gu), 'a worn weapon is taken off before the exchange, put back on when it fails');
}
// SUPPLY-2026-10-28 (owner: "check the clan leader's bag + warehouse and the same for a mule for A grade, AgradeWH")
{
  const RJ = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'Logs', f), 'utf8'));
  // pure: the source order and the grade filter
  const srcs = [{ key: 'bag', m: {} }, { key: 'wh', m: {} }, { key: 'sup', by: 'Mats', m: { 5768: 1 } }, { key: 'sup', by: 'AgradeWH', grades: ['A'], m: { 5768: 3, 864: 1, 6327: 1 } }, { key: 'clan', m: { 5768: 5, 864: 4 } }];
  const r1 = P.gsaStockSrc([{ id: 5768, g: 'A' }, { id: 5768, g: 'A' }, { id: 864, g: 'B' }, { id: 862, g: 'A', sealed: [6327] }], srcs);
  check(r1[0].src === 'sup' && r1[0].by === 'Mats' && r1[1].by === 'AgradeWH' && r1[2].src === 'clan' && r1[3].by === 'AgradeWH' && r1[3].sealed, `order: Mats (bag + wh) -> AgradeWH (A only: the B earring goes to the clan WH) -> clan; a sealed piece from the mule (${JSON.stringify(r1.map(x => x.src + ':' + x.by + (x.sealed ? ':sealed' : '')))})`);
  const r2 = P.gsaStockSrc([{ id: 5768, g: 'A' }], [{ key: 'bag', m: { 5768: 1 } }].concat(srcs));
  check(r2[0].src === 'bag', 'my own bag first');
  const c1 = P.gsaSupCounts([{ id: 5768, count: 1 }, { id: 5768, count: 1, eq: true }, { id: 864, name: '+6 Earring of Black Ore', count: 1 }], [{ id: 2382, count: 1, enchant: 4 }, { id: 547, count: 1, enchant: 5 }]);
  check(c1[5768] === 1 && !c1[864] && c1[2382] === 1 && !c1[547], `supplier counts: bag = not worn, not enchanted; warehouse up to +4 (${JSON.stringify(c1)})`);
  const clanRows = RJ('clan_state.json').warehouse.items;
  let agWh = []; try { agWh = RJ('wh_private_AgradeWH.json').items; } catch (e) { }
  check(!agWh.length || P.gsaWhIsClan(agWh, clanRows), `AgradeWH's warehouse record (${agWh.length} rows) = the clan warehouse list -> ignored`);
  check(!P.gsaWhIsClan([{ id: 1, count: 1 }], clanRows), 'a short / different list is not the clan list');
  // pure: gsaNeed with suppliers (gemstones from Mats' bag first, then the clan; the weapon from the mule)
  const lw = P.gsaOfferPick(M, 97), gem = P.gsaOfferPick(M, 2132), lance = P.gsaRecipe(REC, 4860);
  const n4 = P.gsaNeed(lance, { bag: {}, wh: {}, clan: { 2132: 300 }, sups: [{ name: 'Mats', m: { 2132: 100 } }, { name: 'AgradeWH', m: { 97: 1 } }] }, { weapon: lw.price, gem: gem.price });
  check(n4.gems.sup.Mats === 100 && n4.gems.clan === 239 && n4.gems.buy === 0 && n4.weapon.from === 'sup' && n4.weapon.by === 'AgradeWH' && n4.weapon.price === 0, `gsaNeed: gems Mats 100 + clan 239, Lance from AgradeWH (${JSON.stringify(n4.gems)} ${JSON.stringify(n4.weapon)})`);
  // wiring
  const sv = cut('async function gsaServe(', 'function gsaServeQueued(');
  check(/gsaWhTake\('private', short\(\), why0\)/.test(sv) && /if \(short\(\)\.length && isCL\) \{ const r = await gsaWhTake\('clan', short\(\), why0\)/.test(sv) && /\$\{d\.from\} buys it/.test(sv), 'supplier: gear pieces bag -> its warehouse -> (clan leader) clan WH; what is missing is said');
  check(/if \(d\.to \? d\.to !== Me\.Name : Me\.Name !== clanLeaderName\(\)\) return;/.test(cut("App.on('swarm.gearsa.ask'", "App.on('swarm.gearsa.cancel'")), 'a request is served by the one it is addressed to (old requests: the clan leader)');
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/Object\.keys\(sp\.supPicks \|\| \{\}\)\.forEach\(nm => sp\.supPicks\[nm\]\.forEach\(p => addItem\(nm/.test(gu) && /gsaAskStart\(q, nm\)/.test(gu) && /for \(const h of askHs\)/.test(gu), 'gearUpgrade: one request per supplier, all answers merged');
  const sp = cut('function gsaStockSrcs(', '/** STOCK FIRST, part 1');
  check(/deep \? gsaSuppliers\(\)\.map\(x => \(\{ key: 'sup', by: x\.name, e: x\.e, grades: x\.grades \}\)\) : \[\]/.test(sp), 'stock plan: suppliers between my warehouse and the clan warehouse (an order only)');
  const gs = cut('function gsaSuppliers(', '/** SUPPLY: the suppliers that serve');
  check(/15 \* 60000/.test(gs) && /gsaWhIsClan\(whRows, clanRows\)/.test(gs) && /if \(CL\) add\(CL, null, true\)/.test(gs), 'suppliers: the clan leader always, mules only when online (bag record < 15 min), a clan-list warehouse record ignored');
}
// BESTENCH-2026-10-28 (owner: "always the highest enchant available; a sealed +6 beats an unsealed +5 - take it and unseal it")
{
  const pk = (o) => Object.assign({ id: 5768, g: 'A', sealed: [] }, o);
  const e1 = P.gsaStockEnch([pk({ sealed: [5320] })], [{ key: 'bag', e: { 5768: { 0: 1 } } }, { key: 'sup', by: 'Mats', e: { 5768: { 5: 1 } } }, { key: 'sup', by: 'AgradeWH', grades: ['A'], e: { 5320: { 6: 1 } } }, { key: 'clan', e: { 5768: { 3: 2 } } }]);
  check(e1[0].by === 'AgradeWH' && e1[0].sealed && e1[0].ench === 6 && e1[0].id === 5320, `sealed +6 (AgradeWH) beats unsealed +5 (Mats), +3 (clan), +0 (my bag) (${JSON.stringify(e1[0])})`);
  const e2 = P.gsaStockEnch([pk({ sealed: [5320] })], [{ key: 'bag', e: {} }, { key: 'sup', by: 'Mats', e: { 5320: { 5: 1 } } }, { key: 'clan', e: { 5768: { 5: 1 } } }]);
  check(e2[0].src === 'clan' && !e2[0].sealed && e2[0].ench === 5, 'same enchant: the unsealed piece first (no trip to the blacksmith)');
  const e3 = P.gsaStockEnch([pk({}), pk({})], [{ key: 'bag', e: { 5768: { 0: 1 } } }, { key: 'clan', e: { 5768: { 0: 1 } } }]);
  check(e3[0].src === 'bag' && e3[1].src === 'clan', 'same enchant, same kind: the source order (my bag first); one piece is used once');
  const e4 = P.gsaStockEnch([pk({ g: 'B', id: 864 })], [{ key: 'sup', by: 'AgradeWH', grades: ['A'], e: { 864: { 6: 1 } } }, { key: 'clan', e: { 864: { 0: 1 } } }]);
  check(e4[0].src === 'clan', 'a grade-limited mule never serves another grade');
  check(P.gsaStockEnch([pk({})], [{ key: 'bag', e: {} }])[0].src === 'buy', 'nothing anywhere: buy');
  const m = P.gsaEnchMap([{ id: 1, count: 1, enchant: 6 }, { id: 1, count: 1, name: '+12 X' }, { id: 1, count: 1, eq: true }, { id: 2, name: '+3 Tallum Helm', count: 1 }], 9);
  check(m[1][6] === 1 && !m[1][12] && !m[1][0] && m[2][3] === 1, `enchant map: +10 and up never, worn never, "+3 ..." names read (${JSON.stringify(m)})`);
  const us = cut('async function usUnseal(', '// --- FRENZY KIT BUY');
  check(/const pick = entries\.find\(e => okE\(e\) && num\(sIng\(e\)\.ench\) === ue\) \|\| entries\.find\(okE\);/.test(us) && !/the enchant would not be kept/.test(us) && !/num\(pick\.products\[0\]\.ench\) !== ue/.test(us), 'unseal: the entry of that enchant when the list shows it, else the plain entry - never refused for the enchant (owner: the unseal keeps it)');
  check(/num\(i\.EnchantLvl\) > num\(it\.EnchantLvl\)/.test(cut('async function equipBought(', 'async function equipCommonFromBag(')), 'the highest enchant piece goes on');
  check(/\{ id: num\(id\), count: want\[k\], ench: num\(en\) \}/.test(cut('async function gearStockWh(', '/** WHLOOK-2026-10-25')), 'my warehouse: that exact enchant');
  check(/x\.ench !== undefined \? enchLevelOf\(num\(b\.objId\)\) === num\(x\.ench\)/.test(cut('async function gsaServe(', 'function gsaServeQueued(')) && /addItem\(CLn, num\(p\.stockId \|\| p\.id\), 1, num\(p\.stockEnch\)\)/.test(cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;')), 'suppliers get the enchant in the request and hand over that piece');
}
// STOCKPICK-2026-10-28 (owner: "Mats did not hand Ring of Core / Frintezza to Mei; AgradeWH did not come") + online by the state file
{
  const pu = cut('function planUpgrades(', '/** Buy the picks:');
  check(/const SK = Object\.assign\(\{\}, \(opts && opts\.stock\) \|\| \{\}\), userSlot = \{\}/.test(pu) && /if \(!fromRec\) userSlot\[slot\] = true;/.test(pu), 'planner: the stock map (an order only); the slots the user plan names');
  check(/const stockOffers = sIds\.filter\(i => SK\[num\(i\)\] > 0\)\.map\(i => \(\{ npc: 'stock', price: 0, stock: true/.test(pu) && /const pick = stockO \|\| shopO;/.test(pu), 'plan entries: a piece in stock is taken for 0 adena, also when no shop sells it');
  check(pu.indexOf('STOCKPICK-2026-10-28: a better piece already in stock') > 0 && pu.indexOf('STOCKPICK-2026-10-28: a better piece already in stock') < pu.indexOf('// c) budget: in slot order') && /\(l === 'preferred' && userSlot\[slot\]\)/.test(pu) && /upgradeGain\(id, info, g, ownOk\(slot, info\)\); if \(gain < U\.minGain\) continue;/.test(pu) && /if \(guard\(slot, info, false\)\) continue;/.test(pu), 'stock step: open / recommended slots, gain over what I wear, guard - before the budget; the user plan is never overruled');
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/if \(deep\) \{ try \{ stockMap = gsaStockMap\(\); \}/.test(gu) && /stockMap \? \{ stock: stockMap \} : \{\}/.test(gu) && /plan\.buys\.filter\(p => !p\.bought && !\(p\.offer && p\.offer\.stock\)\)/.test(gu), 'gearUpgrade: the stock map for an order; a stock pick that did not come is never bought');
  const sm = cut('function gsaStockMap(', '/** SUPPLY: the suppliers that serve');
  check(/gsaSuppliers\(\)\.forEach\(x => addE\(x\.e, x\.grades\)\)/.test(sm) && /U\.byS/.test(sm) && /wh_private_\$\{Me\.Name\}/.test(sm) && /clan_state\.json/.test(sm), 'stock map: my bag + warehouse, the suppliers (grades), the clan warehouse; sealed pieces count as what they unseal into');
  check(/swarm_state_\$\{name\}\.json/.test(cut('function gsaSuppliers(', '/** STOCKPICK-2026-10-28')) && /now\(\) - alive > 10 \* 60000/.test(cut('function gsaSuppliers(', '/** STOCKPICK-2026-10-28')), 'a mule is online when its state file is fresh (the bag record is written only on changes)');
}
// EQUIPFIX + GRADEFIX (owner 2026-10-28: "Mei did not put on Ring of Core, one slot stayed empty; Frintezza's Necklace is S grade on this server")
{
  const ep = cut('async function equipPiece(', 'async function equipBought(');
  check(/off = num\(worn\[0\]\.objId\);/.test(ep) && /if \(!offOn\) \{ try \{ Send\.UseItem\(off\); \}/.test(ep) && /lastSysMsg\.at >= tEq\) EQLAST\.why/.test(ep), 'a ring / earring taken off for a piece that does not go on goes back on; the server reason is kept');
  check(/could NOT equip' \+ \(EQLAST\.why \? ' \(server: ' \+ EQLAST\.why \+ '\)' : ''\)/.test(cut('async function equipBought(', 'async function equipCommonFromBag(')), 'the report says the server reason');
  check(/gear_grade_fix\.json/.test(cut('function gearDb(', 'function gearShop(')), 'gearDb applies Scripts/data/gear_grade_fix.json');
  const fx = JSON.parse(fs.readFileSync(path.join(DATA, 'gear_grade_fix.json'), 'utf8'));
  check(fx.items['8191'] === 'S', "Frintezza's Necklace = S on L2Toggle");
  check(/!\(enchOver\[slot\] && !fromRec\)/.test(cut('function planUpgrades(', '/** Buy the picks:')), 'the user plan replaces an enchanted piece ABOVE my grade (Mei: +3 Frintezza S -> Majestic Necklace)');
}
// STOCKCOUNT + UNSEALENCH (gonz live 2026-10-28: 2 rings planned from ONE stocked Ring of Core; +3 sealed earrings refused on the plain list)
{
  const pu = cut('function planUpgrades(', '/** Buy the picks:');
  check(/shopO = gearPrefChoose\(offers, E\.buy, casterArmor, realWanted\)/.test(pu) && /let off = pick; if \(off\.stock\) \{ if \(SK\[num\(off\.id\)\] > 0\) SK\[num\(off\.id\)\]--; else off = shopO; \}/.test(pu) && !/if \(pick\.stock\) SK\[num\(pick\.id\)\]--;/.test(pu), 'a stocked piece serves one pick; the 2nd ring = the shop offer or the stock step');
  check(!/usUnsealBest|noEnch/.test(src), 'no unseal block / fallback for the enchant any more');
}
// SAENCH-2026-10-28 (owner, Mats: "AgradeWH has a Sword of Miracles +6" - the chain got the +0)
{
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/gsaStockEnch\(\[\{ id: w, alts: twW \? \[twW\] : \[\], g: String\(wi\.g \|\| r\.g \|\| ''\) \}\], gsaStockSrcs\(deep\)\)\[0\]/.test(gu) && /num\(b\.ench\) > mine/.test(gu) && /addItem\(N\.weapon\.by, wI, 1, wE\)/.test(gu) && /ench: wE \}/.test(gu), 'the S.A. weapon = the highest enchant of all sources, asked with that enchant');
  check(/enchLevelOf\(oid\) > enchLevelOf\(num\(cur\.objId\)\)/.test(gu), 'the same weapon at a higher enchant goes on (no S.A. yet)');
  check(/const e = num\(i\.EnchantLvl\), k = e \* 2 \+ \(i\.IsEquiped \? 0 : 1\)/.test(cut('function gsaWeaponObj(', '/** whTake for the chain')), 'gsaWeaponObj: my highest enchant (worn or not)');
  check(/const srcs = gsaStockSrcs\(deep\);/.test(cut('function gearStockPlan(', '/** a stocked piece arrived')), 'one source list for the gear pieces and the S.A. weapon');
}
// ASKWAIT-RUN (maur0x live 2026-10-25 23:25: "S.A. chain stopped — no Red Soul Crystal stage 10: max is not defined" - a lost line break had
// commented out `const max ...; let reply ...` - text checks never ran the code): gsaAskWait really runs here against a mocked bag
(async () => {
  const bag = { 4639: 0 }, GSA = { replies: {} }; let t = 0, emitted = [];
  const fn = new Function('num', 'bagCount', 'itemCount', 'GSA', 'now', 'sleep', 'App', 'gsaServe', cut('async function gsaAskWait(', '/** STOCK FIRST, part 1') + '\nreturn gsaAskWait;')(
    (v) => Number(v) || 0, (id) => bag[id] || 0, () => 0, GSA, () => t, async (ms) => { t += ms; if (t >= 6000) bag[4639] = 1; }, { emit: (n, d) => emitted.push(n) }, async () => ({}));
  const h = { CL: 'Mats', rid: 'r1', req: { crystal: { id: 4639, count: 1, name: 'Red SC 10' } }, want: { 4639: 1 }, before: { 4639: 0 }, t0: 0, self: false, d: {} };
  GSA.replies.r1 = { at: 0, done: true, ok: true, handing: true, give: { 4639: 1 } };
  let r = null, err = null; try { r = await fn(h); } catch (e) { err = e; }
  check(!err && r && r.ok && r.got[4639] === 1 && !emitted.includes('swarm.gearsa.cancel'), `gsaAskWait runs: the crystal handed over -> ok (${err ? err.message : JSON.stringify(r)})`);
  bag[4639] = 0; t = 0; GSA.replies.r2 = { at: 0, done: true, ok: false, why: 'Mats has none' };
  let r2 = null, err2 = null; try { r2 = await fn(Object.assign({}, h, { rid: 'r2' })); } catch (e) { err2 = e; }
  check(!err2 && r2 && !r2.ok && r2.why === 'Mats has none' && emitted.includes('swarm.gearsa.cancel'), `gsaAskWait runs: he says no -> not ok, his reason (${err2 ? err2.message : JSON.stringify(r2)})`);
  // ERRANDOWN-2026-10-28 (Mats live 15:21: a 2nd !gearup during the run ended the running run's 'buy' errand -> L2Swarm Follow pulled him back
  // to Mei on the walk to Pushkin): the member handler + the errand helpers really run here
  {
    const line = (re) => { const m = src.split('\n').find(l => re.test(l)); return m || ''; };
    const helpers = [line(/^function errandBlocks\(/), line(/^function errandStart\(/), line(/^function errandEnd\(/), line(/^function errandNow\(/)].join('\n');
    const hs = src.indexOf("App.on('swarm.gearup', async (e) => {"), he = src.indexOf('\n});', hs) + 4;
    const handlerSrc = src.slice(hs, he);
    let t = 1000; const state = { errand: null, errandHold: 0, followHoldUntil: 0 }, GUP = { busy: false }, notes = [], calls = [];
    let release = null, handler = null;
    const App = { on: (n, f) => { handler = f; }, emit: () => { } };
    const gearUpgrade = async () => { calls.push('run'); if (GUP.busy) return { msg: 'already shopping' }; GUP.busy = true; await new Promise(r => { release = r; }); GUP.busy = false; return { msg: 'done' }; };
    new Function('App', 'state', 'GUP', 'now', 'sleep', 'followHold', 'Send', 'CONFIG', 'isLeader', 'Me', 'gearUpgrade', 'note', 'logError',
      helpers + '\n' + handlerSrc)(App, state, GUP, () => t, async () => { }, (ms) => { state.followHoldUntil = t + ms; }, { StopMove: () => { } }, { leader: 'Mei' }, () => false, { Name: 'Mats' }, gearUpgrade, (m) => notes.push(m), (w, e) => notes.push('ERR ' + w + ' ' + (e && e.message)));
    const ev = { source: { characterName: 'Mei' }, data: { names: ['Mats'] } };
    const p1 = handler(ev); await new Promise(r => setImmediate(r));
    const e1 = state.errand;
    check(!!e1 && e1.kind === 'buy' && GUP.busy && state.followHoldUntil > t, 'ERRANDOWN: the 1st !gearup runs on its buy errand (follow held)');
    t += 60000; await handler(ev);
    check(state.errand === e1 && state.followHoldUntil > t && calls.length === 1 && notes.some(n => /already shopping/.test(n)), `ERRANDOWN: a 2nd !gearup during the run leaves the running errand + follow hold alone (${JSON.stringify({ calls, errand: !!state.errand, hold: state.followHoldUntil - t })})`);
    release(); await p1;
    check(state.errand === null && state.followHoldUntil === 0 && !GUP.busy, 'ERRANDOWN: the run ends -> its own errand ends');
    const e2 = { kind: 'buy', until: t + 1e6 }; state.errand = e2;
    new Function('state', helpers + '\nerrandEnd("buy", {});')(state);
    check(state.errand === e2, "ERRANDOWN: errandEnd(kind, mine) never ends somebody else's errand");
    check(/if \(errandNow\(\) \|\| GUP\.busy\) return;/.test(src), 'ERRANDOWN: the Fight-with-L2Swarm keeper never switches Follow on during a gear run');
    check(/let gfErrand = null; if \(!state\.errand\) \{ try \{ gfErrand = errandStart\('buy'/.test(src) && /errandEnd\('buy', gfErrand\)/.test(src), 'ERRANDOWN: gearUpgrade ends only the errand it started');
  }
  // SAGRADE-2026-10-28 (Mats live 15:51: Sword of Miracles (A) -> list 4000 EMPTY; A / S weapons are on Pushkin's Seven Signs links)
  {
    const P = new Function(cut('function gsaSaLinkKinds(', '/** at the Giran blacksmith: weapon objId') + '\nreturn { gsaSaLinkKinds, gsaSaLinkPick };')();
    const L = ['Craft a Dualsword.', 'Bestow a special ability on a weapon.', 'Craft an item.', 'Unseal armor and accessories.', 'Smelt an item.', 'Cancel smelting.', 'Learn skills.', 'Ask about Skill Enchanting.', 'Ask about the local lord and tax rate.', 'Quest',
      'Manufacture an S-grade sword', 'Bestow the special S-grade weapon some abilities', 'Release the S-grade armor seal', 'Release the S-grade accessory seal', 'Manufacture an A-grade sword', 'Bestow the special A-grade weapon some abilities',
      'Release the A-grade armor seal', 'Release the A-grade accessory seal', 'Seal the A-grade armor again', 'Remove the special abilities from a weapon', 'Upgrade weapon', 'Make an even exchange of weapons'].map(text => ({ text }));
    const tx = (k) => (P.gsaSaLinkPick(L, k) || {}).text;
    check(JSON.stringify(P.gsaSaLinkKinds('A')) === '["A","gen","S"]' && JSON.stringify(P.gsaSaLinkKinds('S80')) === '["S","gen","A"]' && JSON.stringify(P.gsaSaLinkKinds('B')) === '["gen"]' && JSON.stringify(P.gsaSaLinkKinds('')) === '["gen"]', 'SAGRADE: A -> the A-grade link first, S/S80/S84 -> S-grade, C/B -> only the plain link (as before)');
    check(tx('A') === 'Bestow the special A-grade weapon some abilities' && tx('S') === 'Bestow the special S-grade weapon some abilities' && tx('gen') === 'Bestow a special ability on a weapon.', `SAGRADE: Pushkin's real page -> the right link per kind (${tx('A')} / ${tx('S')} / ${tx('gen')})`);
    check(P.gsaSaLinkPick([{ text: 'Remove the special abilities from a weapon' }], 'gen') === null, 'SAGRADE: never "Remove the special abilities"');
    const ij = cut('async function ijSA(', '/** enchant this one piece');
    check(/trySmith\(ps, gsaSaLinkKinds\(grade\)\)/.test(ij) && /for \(const kind of kinds\)/.test(ij) && /if \(pick\) return 'ok';/.test(ij) && /sa\.g \|\| \(gearDb\(\)\.items\[wid\]/.test(ij), 'SAGRADE: Pushkin: the grade link, then the next one when the list has no entry');
    // MAMMON-2026-10-28: the custom Maestro of Mammon "Basics" (Logs/npc_Mei.html, 16:15) first for A / S weapons
    const B = ['Browse Mammon Merchant Goods', 'Craft S-Grade Dualsword', 'Bestow special capability on S-Grade weapon', 'Release seal on S-Grade armor', 'Release seal on S-Grade accessory', 'Craft A-Grade Dualsword',
      'Bestow special capability on A-Grade weapon', 'Release seal on A-Grade armor', 'Release seal on A-Grade accessory', 'Re-seal A-Grade armor', "Remove a weapon's special capability", 'Upgrade weapon', 'Make an even exchange of weapons',
      'Complete a Foundation Item', 'Exchange Seal Stones', 'Purchase consumable items'].map(text => ({ text }));
    check((P.gsaSaLinkPick(B, 'A') || {}).text === 'Bestow special capability on A-Grade weapon' && (P.gsaSaLinkPick(B, 'S') || {}).text === 'Bestow special capability on S-Grade weapon' && P.gsaSaLinkPick(B, 'gen') === null, 'MAMMON: Basics\' page -> "Bestow special capability on A-Grade / S-Grade weapon", never "Remove"');
    check(ij.indexOf('await gsaGoMammon()') > 0 && ij.indexOf('await gsaGoMammon()') < ij.indexOf("gsaWalkToSmith(['Pushkin'])") && /if \(high\)/.test(ij) && /if \(!npc\) \{/.test(ij), 'MAMMON: an A / S weapon goes to Basics first, Pushkin only when he has no entry');
    check(/maestro of mammon/i.test(cut('function gsaMammonNpc(', 'async function gsaGoMammon(')) && /x: 82232, y: 148648/.test(src), 'MAMMON: Basics found by name / title, his spot by the Giran start');
  }
  // EPICFB-2026-10-28 (owner: epic jewel not available -> 52-60 Black Ore, 61-75 Majestic, 76+ Tateossian else Majestic)
  {
    const E = new Function(cut('const EPIC_JEWELS = new Set(', '/** What to buy:') + '\nreturn { EPIC_JEWELS, EPIC_FB, epicFbChain };')();
    check(JSON.stringify([40, 51, 52, 60, 61, 62, 75, 76, 80, 85].map(E.epicFbChain)) === JSON.stringify([[], [], ['B'], ['B'], ['A'], ['A'], ['A'], ['S', 'A'], ['S', 'A'], ['S', 'A']]), 'EPICFB: 52-60 Black Ore, 61-75 Majestic, 76+ Tateossian then Majestic, below 52 nothing');
    check(E.EPIC_FB.ring.B[0] === 895 && E.EPIC_FB.ring.A[0] === 893 && E.EPIC_FB.ring.S[0] === 889 && E.EPIC_FB.earring.A[0] === 862 && E.EPIC_FB.neck.S[0] === 920 && [6660, 6662, 6661, 6659, 6658, 6657, 6656, 8191].every(i => E.EPIC_JEWELS.has(i)) && !E.EPIC_JEWELS.has(893), 'EPICFB: the fallback ids per slot, the epic jewels (never Majestic)');
    const pu = cut('function planUpgrades(budget, opts) {', '// JEWELFALLBACK-2026-10-25');
    check(/const epicIds = \(E\) =>/.test(pu) && /if \(n === 1\) \{ prefs\[S2\] = mk\(E1, fb\)/.test(pu) && /epicFb: true, preferIds/.test(pu), 'EPICFB: an epic entry nobody has / sells / stocks -> the fallback; a pair keeps the epic for the copies I own');
    const pu2 = cut('function planUpgrades(budget, opts) {', '/** Buy the picks:');
    check(/const pairWant = \['', '2'\]/.test(pu2) && /length >= Math\.max\(want, pairWant\)/.test(pu2) && /E\.from === 'role' \|\| E\.epicFb/.test(pu2), 'EPICFB: one enchanted ring keeps one ring (not the pair); the fallback may come from the luxury shop');
  }
  // KAMAELCW-2026-10-28 (owner, BinKz: plan Undertaker - Evil Spirit - Health, AgradeWH has Dragon Slayer - Evil Spirit - Health = its Change Weapon twin)
  {
    const r = { w: 11084, wn: 'Undertaker - Evil Spirit', saId: 11085, sa: 'Health', cid: 5580, gem: { id: 2133, count: 140 }, adena: 0 };
    const tw = { 11085: 11097, 11084: 11096 };
    const a = P.gsaNeed(r, { bag: {}, wh: {}, clan: {}, sups: [{ name: 'Mats', m: {} }, { name: 'AgradeWH', m: { 11097: 1, 81: 1 } }], tw }, {});
    check(a.sa === 'sup' && a.saBy === 'AgradeWH' && a.saItem === 11097, `KAMAELCW: the finished S.A. weapon's twin at a supplier counts (${JSON.stringify({ sa: a.sa, by: a.saBy, item: a.saItem })})`);
    const b = P.gsaNeed(r, { bag: { 11096: 1 }, wh: {}, clan: {}, sups: [], tw }, {});
    check(!b.sa && b.weapon.from === 'bag' && b.weapon.item === 11096 && b.weapon.id === 11084, 'KAMAELCW: the plain weapon\'s twin in my bag = the base weapon (item 11096, turned before the blacksmith)');
    const c = P.gsaNeed(r, { bag: { 11085: 1, 11097: 1 }, wh: {}, clan: {}, sups: [], tw }, {});
    check(c.sa === 'bag' && c.saItem === 11085, 'KAMAELCW: the piece itself first, the twin only when it is missing');
    const d = P.gsaNeed(r, { bag: {}, wh: {}, clan: {}, sups: [{ name: 'AgradeWH', m: { 11097: 1 } }] }, {});
    check(!d.sa, 'KAMAELCW: no twins (not a Kamael) = as before');
    const pm = cut('function gearSaPlanMine(', '/** SABASE-early');
    check(/const kw = kamaelWeaponFor\(gearRole\(\)\), tw = \{\}/.test(pm) && /sups, tw \}/.test(pm) && /Object\.keys\(x\.e \|\| \{\}\)/.test(pm), 'KAMAELCW: gearSaPlanMine passes the twins (a Kamael) and the suppliers\' enchanted pieces');
    const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
    check(/await kamaelTurnInto\(want, tw\)/.test(gu) && gu.indexOf('await kamaelTurnInto(want, tw)') < gu.indexOf('await ijSA(') && /addItem\(N\.saBy, sI, 1, sE\)/.test(gu), 'KAMAELCW: the twin is asked with its enchant, put on and turned (Change Weapon) before the blacksmith / the equip');
    const K = new Function('gearDb', 'num', cut('function kamaelTwinOf(', '/** KAMAELCW: the twin in my bag') + '\nreturn kamaelTwinOf;')(() => ({ items: { 11085: { n: 'U', cw: 11097 }, 11097: { n: 'D', cw: 11085 }, 9340: { n: 'L' }, 81: { n: 'DS', cw: 9344 }, 9344: { n: 'X' } } }), (v) => Number(v) || 0);
    check(K(11085) === 11097 && K(11097) === 11085 && K(9344) === 81 && K(9340) === 0, 'KAMAELCW: kamaelTwinOf both directions (gear_items cw)');
  }
  console.log(`gearsa: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

