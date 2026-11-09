// OFFLINE TEST: UNSEAL-2026-10-25 (owner: "its still missing gloves boots, in shop those items are sold as 'Sealed' (sometimes helmet also).
// Incorporate this so char looks for sealed/unsealed version. Unsealed has priority if in inventory/wh. If only sealed is available char goes to the
// blacksmith to unseal it. Pay attention to choose the right type. Same sealed gloves can be unsealed for robe/light/heavy set.")
// Harness of test_luxury_shop.js + the GEARSA-PURE block + Scripts/data/unseal_h5.json.
// (former header of test_luxury_shop.js:) LUXURYSHOP-2026-10-25 (owner: "while trying to buy gear for Mei selected in gear plan, Mei reported that shops in Giran stop on
// C grade. In fact luxury shop NPCs sell armors / jewels / weapons up to A grade"). Runs the REAL planUpgrades of Scripts_dev/swarm.js in node
// (harness of test_gear_starter.js) against the real Scripts/data (gear_items.json, shopscan_giran.json, giran_market.json, gear_prefs.json).
//  * giranLuxuryIndex: Alexandria / Galladucci adena-only multisell gear; no Shadow Items, no soul crystals (crystal cost), no Mammon
//  * Mei's Fortune Seeker plan (gear_prefs.json _class 117, S80): Tallum Helm / Tallum Plate Armor / 2x Sealed Majestic Earring are bought at
//    Alexandria (multisell 5001), Tallum Gloves / Boots - Heavy Armor are NOT (Alexandria only has the Sealed twins = other items)
//  * a class RECOMMENDATION is not bought there (flag 'plan'), it is with 'all'; flag off = nothing from the luxury shop
//  * buyGearPicks sends a luxury pick to ijBuyAt; ijStatus without a job id writes no job file
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = process.env.SWARM_SRC || path.join(ROOT, 'Scripts_dev', 'swarm.js');
const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('marker not found: ' + (i < 0 ? a : b)); return src.slice(i, j); };
const code = [
  cut('const ROLEKIND = {', '// role regexes'),
  cut('let shopIdxCache = null;', '/** Kamael: if I wear a sword'),
  cut('const isSaWeapon =', '/** Buy the picks:'),
  cut('let gearDbCache = null', 'const BODY_SLOTS = ['),
  cut('const BODY_SLOTS = [', 'const badEquip = {};'),
  cut('// ==== GEARSA-PURE begin', '// ==== GEARSA-PURE end'),
].join('\n');
const UNSEAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'Scripts', 'data', 'unseal_h5.json'), 'utf8')).rows;
const H = new Function(cut('// ==== GEARSA-PURE begin', '// ==== GEARSA-PURE end') + '\nreturn { usIndex, usFixType, usSealedFor, usPickLink, gsaStock };')();
const U = H.usIndex(UNSEAL);
const DATA = path.join(ROOT, 'Scripts', 'data');
const ITEMS = JSON.parse(fs.readFileSync(path.join(DATA, 'gear_items.json'), 'utf8')).items;
const REALPREFS = fs.readFileSync(path.join(DATA, 'gear_prefs.json'), 'utf8');
const idOf = (n) => { const k = Object.keys(ITEMS).find(x => ITEMS[x].n === n); if (!k) throw new Error('no item ' + n); return Number(k); };

function harness(o) {
  const env = {
    Me: { Name: 'Tester', Level: o.level || 20, ClassId: o.classId, objId: 1 },
    state: { role: o.role },
    CONFIG: { gear: { roles: {}, races: {}, gradeLevel: { NONE: 1, D: 20, C: 40, B: 52, A: 61, S: 76, S80: 80, S84: 84 },
      upgrade: { on: true, auto: true, keep: 300000, minGain: 1, order: ['weapon', 'chest', 'legs', 'shield', 'head', 'gloves', 'feet', 'neck', 'earring', 'earring', 'ring', 'ring'],
        casterSets: [{ from: 1, healer: 'Devotion', caster: 'Devotion' }, { from: 40, healer: 'Karmian', caster: "Demon's" }] } },
      healer: { roles: ['bishop', 'shilliensaint', 'healer'] } },
  };
  let oid = 100;
  const inv = (o.worn || []).map(n => ({ Id: idOf(n), objId: ++oid, Count: 1, IsEquiped: true, EnchantLvl: 0, Name: n }));
  const files = {
    'gear_auto.json': JSON.stringify({ default: true, sameGradeSwap: false, keepArmorType: true }),
    'gear_prefs.json': o.prefs === undefined ? REALPREFS : JSON.stringify(o.prefs || {}),
  };
  const File = {
    Exists: (f) => { const b = path.basename(String(f).replace(/\\/g, '/')); return b in files || fs.existsSync(String(f).replace(/^__S__\\data/, DATA).replace(/\\/g, '/')); },
    ReadAllText: (f) => { const s = String(f), b = path.basename(s.replace(/\\/g, '/')); if (b in files) return files[b]; return fs.readFileSync(s.replace(/^__S__\\data/, DATA).replace(/\\/g, '/'), 'utf8'); },
    GetLastWriteTimeUtc: () => ({ Ticks: 1 }),
  };
  const fn = new Function('Me', 'state', 'CONFIG', 'File', '__SCRIPTS__', 'Inventory', 'hostSnap', 'now', 'num', 'logError', 'teamOf', 'soulTarget', 'myCrystals', 'soulReady', 'fileStamp', 'isHealerRole', 'rtFlag', 'usData',
    code + '\nreturn { planUpgrades, giranLuxuryIndex, luxuryShopMode, usIndex, usFixType, usSealedFor, usPickLink, gsaStock };');
  const num = (v) => typeof v === 'bigint' ? Number(v) : (Number(v) || 0);
  return fn(env.Me, env.state, env.CONFIG, File, '__S__', { forEach: (f) => inv.forEach(f) }, { inv: () => inv }, () => Date.now(), num,
    (w, e) => { throw new Error(w + ': ' + (e && e.message)); }, () => 'P', () => null, () => [], () => false, () => '1',
    () => /bishop|shilliensaint|healer/.test(o.role), (name, d) => (name === 'luxuryShop' && o.flag !== undefined ? o.flag : d),
    o.noUnseal ? undefined : () => H.usIndex(UNSEAL));

}
const plan = (o) => harness(o).planUpgrades(o.budget === undefined ? 40000000 : o.budget);
const lux = (r) => (r.buys || []).filter(p => p.offer && p.offer.market);


const offerOf = (r, slot) => (r.buys || []).find(p => p.slot === slot);
const show = (who, r) => { console.log(`     ${who} buys:`, (r.buys || []).map(p => `${p.slot}:${p.info.n} ${p.offer.price} @${p.offer.npc}${p.offer.unseal ? ' [sealed ' + p.offer.buyId + ']' : ''}`).join(' | ')); console.log(`     ${who} notes:`, (r.notes || []).filter(n => /instead of|seal/i.test(n)).join(' || ')); };

// ---- 1) the table
{
  const bw = U.byS[2487] || [];
  check(bw.length === 3 && ['HEAVY', 'LIGHT', 'MAGIC'].every(t => bw.some(r => r.t === t)), `Sealed Blue Wolf Gloves (2487) unseal into Heavy / Light / Robe (${bw.map(r => r.pn).join(', ')})`);
  check(UNSEAL.every(r => ITEMS[r.p] && ITEMS[r.s]), 'every sealed id and product of unseal_h5.json is in gear_items.json');
  check(UNSEAL.filter(r => r.l === '1002').every(r => r.a === 0) && UNSEAL.filter(r => r.l !== '1002').every(r => r.a > 0), 'B-grade (1002) unseal is free, A-grade costs adena');
}
// ---- 2) the right type
{
  const heavy = idOf('Blue Wolf Gloves - Heavy Armor'), light = idOf('Blue Wolf Gloves - Light Armor'), robe = idOf('Blue Wolf Gloves - Robe');
  check(H.usFixType(U, light, 'HEAVY') === heavy && H.usFixType(U, heavy, 'MAGIC') === robe && H.usFixType(U, robe, 'LIGHT') === light, 'usFixType: the same sealed gloves -> the type of the body armor');
  check(H.usFixType(U, heavy, '') === heavy && H.usFixType(U, idOf('Blue Wolf Breastplate'), 'MAGIC') === idOf('Blue Wolf Breastplate'), 'usFixType: no body type / not an unseal product = unchanged');
  check(H.usSealedFor(U, heavy).some(r => r.s === 2487 && r.a === 0), 'usSealedFor: BW Gloves - Heavy Armor <- Sealed Blue Wolf Gloves, free');
}
// ---- 3) stock: the unsealed piece first, the sealed one only when no unsealed piece is anywhere
{
  const heavy = idOf('Blue Wolf Gloves - Heavy Armor');
  const picks = [{ id: heavy, alts: [], sealed: [2487] }];
  const a = H.gsaStock(picks, { 2487: 1 }, { [heavy]: 1 }, {})[0];
  check(a.src === 'wh' && a.id === heavy && !a.sealed, `sealed in my bag + unsealed in my warehouse -> the unsealed one from the warehouse (${JSON.stringify(a)})`);
  const b = H.gsaStock(picks, { 2487: 1 }, {}, {})[0];
  check(b.src === 'bag' && b.id === 2487 && b.sealed, `only the sealed one in my bag -> it (to unseal) (${JSON.stringify(b)})`);
  const c = H.gsaStock(picks, {}, {}, { 2487: 1 })[0];
  check(c.src === 'clan' && c.sealed, `only a sealed one in the clan warehouse -> it (${JSON.stringify(c)})`);
  const d = H.gsaStock(picks, {}, {}, {})[0];
  check(d.src === 'buy', 'nothing anywhere -> buy');
}
// ---- 4) the blacksmith's links (Pushkin's real main page)
{
  const L = ['Craft a Dualsword.', 'Bestow a special ability on a weapon.', 'Craft an item.', 'Unseal armor and accessories.', 'Smelt an item.', 'Cancel smelting.', 'Learn skills.', 'Quest',
    'Release the S-grade armor seal', 'Release the S-grade accessory seal', 'Release the A-grade armor seal', 'Release the A-grade accessory seal', 'Seal the A-grade armor'];
  check(L[H.usPickLink(L, 'B', false)] === 'Unseal armor and accessories.', `B armor -> "${L[H.usPickLink(L, 'B', false)]}"`);
  // live 2026-10-25: every unseal (B gloves/boots, A armor, A accessories) is under "Unseal armor and accessories." -> first choice for A too;
  // the Seven Signs "Release the A-grade ... seal" links are the 2nd try
  check(L[H.usPickLink(L, 'A', false)] === 'Unseal armor and accessories.' && L[H.usPickLink(L, 'A', true)] === 'Unseal armor and accessories.', 'A armor / jewel -> "Unseal armor and accessories." first');
  const L2 = L.filter(x => x !== 'Unseal armor and accessories.');
  check(L2[H.usPickLink(L2, 'A', false)] === 'Release the A-grade armor seal', `A armor, 2nd try -> "${L2[H.usPickLink(L2, 'A', false)]}"`);
  check(L2[H.usPickLink(L2, 'A', true)] === 'Release the A-grade accessory seal', `A jewel, 2nd try -> "${L2[H.usPickLink(L2, 'A', true)]}"`);
  check(H.usPickLink(['Seal the A-grade armor', 'Quest'], 'A', false) < 0, 'never "Seal the A-grade armor" (the reverse exchange)');
  // Pushkin's live 2nd page (Logs/unseal_blacksmith1_Mei.html, 2026-10-25 12:26)
  const P2 = ['Break the seal on the gloves and boots, B-Grade', 'Again, seal the gloves and boots, B-Grade', 'Break the seal on the armor A-Grade', 'Break the seal on accessories A-Grade', 'Again, seal armor A-Grade', 'Back'];
  check(P2[H.usPickLink(P2, 'B', false)] === 'Break the seal on the gloves and boots, B-Grade', `live page 2, B gloves -> "${P2[H.usPickLink(P2, 'B', false)]}"`);
  check(P2[H.usPickLink(P2, 'A', false)] === 'Break the seal on the armor A-Grade', `live page 2, A armor -> "${P2[H.usPickLink(P2, 'A', false)]}"`);
  check(P2[H.usPickLink(P2, 'A', true)] === 'Break the seal on accessories A-Grade', `live page 2, A jewel -> "${P2[H.usPickLink(P2, 'A', true)]}"`);
  check(H.usPickLink(['Again, seal armor A-Grade', 'Again, seal the gloves and boots, B-Grade', 'Back'], 'A', false) < 0 && H.usPickLink(['Again, seal armor A-Grade', 'Back'], 'B', false) < 0, 'never "Again, seal ..." (the reverse exchange)');
}
// ---- 5) the planner: Mei (Swordsinger 21, lvl 53, heavy) gets Blue Wolf Gloves / Boots - Heavy Armor from the SEALED pieces at Alexandria
{
  const worn = ['Common Item - Full Plate Armor', 'Common Item - Full Plate Helmet', 'Common Item - Full Plate Gauntlet', 'Common Item - Full Plate Boots'];
  const m = plan({ classId: 21, level: 53, role: 'melee', worn, budget: 40000000 });
  show('Mei', m);
  const gl = offerOf(m, 'gloves'), ft = offerOf(m, 'feet');
  check(gl && gl.info.n === 'Blue Wolf Gloves - Heavy Armor' && gl.offer.buyId === 2487 && gl.offer.unseal && gl.offer.unseal.p === gl.id, `Mei gloves: Blue Wolf Gloves - Heavy Armor via Sealed Blue Wolf Gloves (${gl && gl.info.n} buy ${gl && gl.offer.buyId})`);
  check(ft && /^Blue Wolf Boots - Heavy Armor$/.test(ft.info.n) && ft.offer.buyId === 2439, `Mei boots: Blue Wolf Boots - Heavy Armor via Sealed Blue Wolf Boots (${ft && ft.info.n} buy ${ft && ft.offer.buyId})`);
  check(m.buys.some(p => p.info.n === 'Blue Wolf Breastplate') && m.buys.some(p => p.info.n === 'Blue Wolf Gaiters'), 'Mei: still Breastplate + Gaiters');
  const off = plan({ classId: 21, level: 53, role: 'melee', worn, budget: 40000000, noUnseal: true });
  check(!offerOf(off, 'gloves') || !/Blue Wolf/.test(offerOf(off, 'gloves').info.n), 'without the unseal table no Blue Wolf gloves (the old gap)');
}
// ---- 6) a robe wearer (Elven Elder 30, lvl 53) gets the ROBE version, a light-armor wearer the LIGHT one
{
  const robe = plan({ classId: 30, level: 53, role: 'healer', worn: ['Common Item - Karmian Tunic', 'Common Item - Karmian Stockings'], budget: 40000000 });
  show('maur0x', robe);
  const bad = (robe.buys || []).filter(p => ['gloves', 'feet', 'head'].includes(p.slot) && / - (Heavy Armor|Light Armor)/.test(p.info.n));
  check(!bad.length, `robe wearer: no Heavy / Light gloves, boots or helmet (${bad.map(p => p.info.n).join(', ') || 'none'})`);
  const rg = (robe.buys || []).filter(p => / - Robe$/.test(p.info.n));
  console.log('     robe typed pieces:', rg.map(p => p.info.n).join(', ') || 'none');
  // the final body decides: whatever chest is bought (or worn), the typed gloves / boots / helmet are of that type
  const tOf = (id) => ((U.byP[Number(id)] || [])[0] || {}).t || '';
  const consistent = (r, wornChest) => { const bc = (r.buys || []).find(p => p.slot === 'chest'), ft = bc ? ITEMS[bc.id].t : (wornChest ? ITEMS[idOf(wornChest)].t : '');
    return (r.buys || []).filter(p => ['gloves', 'feet', 'head'].includes(p.slot) && tOf(p.id) && p.offer.unseal && tOf(p.id) !== ft); };
  const light = plan({ classId: 34, level: 53, role: 'melee', worn: ['Common Item - Theca Leather Armor'], budget: 40000000 });
  show('Kerrigan (light)', light);
  check(!consistent(light, 'Common Item - Theca Leather Armor').length, `Bladedancer in light armor: typed pieces match the body (${consistent(light, 'Common Item - Theca Leather Armor').map(p => p.info.n).join(', ') || 'all match'})`);
  const mix = plan({ classId: 34, level: 53, role: 'support', worn: [], budget: 40000000 });
  show('caster set + BW', mix);
  check(!consistent(mix, '').length, `a robe bought in the same plan -> Robe gloves / boots (${consistent(mix, '').map(p => p.info.n).join(', ') || 'all match'})`);
  check((mix.notes || []).some(n => /Robe instead of .* - Heavy Armor \(matches the robe body\)/.test(n)) || !(mix.buys || []).some(p => / - Heavy Armor$/.test(p.info.n)), 'the switch is said in the notes');
}
// ---- 7) wiring
{
  const bg = cut('async function buyGearPicks(', '/** How many copies of an item');
  check(/const buyId = num\(p\.offer\.buyId \|\| p\.id\)/.test(bg) && /ijBuyAt\(MK, buyId, 1, /.test(bg) && /p\.needUnseal = Object\.assign\(\{\}, p\.offer\.unseal\)/.test(bg), 'buyGearGroup buys the sealed id and marks the piece for the blacksmith');
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  const iU = gu.indexOf('usUnseal(p.needUnseal)'), iS = gu.indexOf('ijSA('), iB = gu.indexOf('buyGearPicks('), iE = gu.indexOf('equipBought(plan.buys)');
  check(iB > 0 && iU > iB && iS > iU && iE > iS, 'gearUpgrade: tour -> unseal -> S.A. -> equip');
  const us = cut('async function usUnseal(', '// --- FRENZY KIT BUY');
  check(/e\.ings\.every\(g => num\(g\.id\) === num\(u\.s\) \|\| num\(g\.id\) === 57 \|\| num\(g\.id\) === 5575\)/.test(us) && /num\(e\.products\[0\]\.id\) === num\(u\.p\)/.test(us), 'usUnseal: only an entry "this sealed id (+ adena / Ancient Adena) -> this product"');
  check(/parsed\.some\(x => !x\)/.test(us) && /msDump/.test(us), 'usUnseal: an unreadable list = nothing exchanged');
  check(/if \(!p\.needUnseal && id !== num\(p\.id\)/.test(cut('function gearStockGot(', '\n')), 'gearStockGot keeps the unsealed product id for a sealed stock piece');
  // GIRANWEST (live 2026-10-25: boots "could not walk the Giran route to the blacksmith" right after the gloves)
  check(/if \(!smithNear\(\) && !\(await gsaWalkToSmith\(\['Pushkin', 'Rupio'\]\)\)\)/.test(us), 'usUnseal: no walk when Pushkin / Rupio stands next to me (the next piece)');
  // GIRANSMITH (owner 2026-10-25: "after shopping at Helvetia char goes back to giran starting location instead of going directly to the blacksmith")
  const ws = cut('async function gsaWalkToSmith(', '/** unseal ONE sealed piece');
  check(/townWalkToNpc\(atl, \{ solo: true, atlasFirst: true \}\)/.test(ws) && ws.indexOf('townWalkToNpc') < ws.indexOf("ijGiranGo('blacksmith')"), 'the blacksmith walk goes straight (street graph), the recorded Giran route only as the fallback');
  check(/if \(!smithHere && !\(await gsaWalkToSmith\(\['Pushkin'\]\)\)\)/.test(cut('async function ijSA(', '/** enchant this one piece')), 'ijSA: the same direct walk');
  { const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'Scripts', 'data', 'npc_atlas.json'), 'utf8')).npcs.find(n => n.name === 'Pushkin' && n.x > 76000 && n.x < 90000 && n.y > 139000 && n.y < 157000);
    check(!!P, `Pushkin is in the NPC atlas inside Giran (${P && P.x},${P && P.y})`); }
  // TOPUP (owner 2026-10-25: gonz / BinKz "adena: needs 27,713 more for Ring of Black Ore ... skipped" with 6-9M left after the S.A. chain)
  const gu2 = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  const iSA = gu2.indexOf('await ijSA('), iTop = gu2.indexOf('const plan2 = planUpgrades(itemCount(57) - gearKeep())'), iMsg = gu2.indexOf('const buyBad = bought.filter');
  check(iSA > 0 && iTop > iSA && iMsg > iTop && /if \(\(sa \|\| du\) && \(plan\.skipped \|\| \[\]\)\.some\(t => \/ \\\(\\d\+\\\)\$\/\.test/.test(gu2), 'TOPUP: after the S.A. chain the budget-skipped pieces get a 2nd plan with the real adena (before the report)');
  check(/await buyGearPicks\(toBuy, \[\]\)/.test(gu2) && /usUnseal\(p\.needUnseal\)[\s\S]{0,400}equipBought\(more\)/.test(gu2), 'TOPUP: one more tour, unseal, put on');
  const ctk = cut('function currentTownKey(', '/** Korteste');
  check(/GIRANWEST/.test(ctk) && /< 800\) return 'Giran'/.test(ctk) && ctk.indexOf("return 'Giran'") < ctk.indexOf('TOWN_LAND'), 'currentTownKey: within 800 of a recorded Giran route point = Giran (checked first)');
  { const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'Scripts', 'data', 'giran_routes.json'), 'utf8')), e = G.routes.blacksmith.points.slice(-1)[0];
    check(Math.hypot(e[0] - G.start[0], e[1] - G.start[1]) > 3000, `the blacksmith route end is ${Math.round(Math.hypot(e[0] - G.start[0], e[1] - G.start[1]))} from the .giran landing (> the 3000 town rule = why it failed)`); }
}
// ---- 8) Mats (Bishop 16, lvl 53) live 2026-10-25 12:59: Karmian Tunic + Stockings (C caster set) were "kept" against the recommended Blue Wolf
//      Tunic / Stockings; the recommended Ring of Queen Ant (drop only) left the 2nd ring on a Common Aquastone Ring
{
  const worn = ['Karmian Tunic', 'Karmian Stockings', 'Common Item - Aquastone Ring', 'Ring of Black Ore', 'Blue Wolf Helmet', 'Blue Wolf Gloves - Robe', 'Blue Wolf Boots - Robe', 'Necklace of Black Ore', 'Earring of Black Ore', 'Earring of Black Ore', 'Doom Shield'];
  const m = plan({ classId: 16, level: 53, role: 'healer', worn, budget: 20000000 });
  show('Mats', m);
  const bn = (m.buys || []).map(p => p.info.n);
  check(bn.includes('Blue Wolf Tunic') && bn.includes('Blue Wolf Stockings'), `BODYGRADE: Blue Wolf Tunic + Stockings (B) bought over the worn Karmian set (C) (${bn.join(', ')})`);
  const src2 = cut('function upgradeGain(', 'const badEquip');
  check(/ggGrade\(info\.g\) > ggGrade\(cur\[0\]\.info\.g\)/.test(src2), 'upgradeGain: a higher-grade body piece is judged on plain stats against a worn caster-set piece');
  const pu = cut('function planUpgrades(', 'async function buyGearPicks(');
  check(/JEWELFALLBACK/.test(pu) && /preferIds: gearTwins\(num\(E\.id\)\)/.test(pu) && /preferIds: E\.preferIds \|\| null/.test(pu), 'JEWELFALLBACK wired (pair slot, preferIds on the pick)');
}
// ---- 9) S.A. chain without a crystal: the base weapon is still bought / worn (SABASE)
{
  const ss = cut('function gearSaStops(', 'function gearSaCheck(');
  check(/SABASE/.test(ss) && /return \{ ok: false, why, base: bst \}/.test(ss), 'gearSaStops: no crystal -> { ok:false, base: weapon stop }');
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  check(/chain && chain\.base \? chain\.base\.stops : \[\]/.test(gu) && /equipped \(no S\.A\. yet\)/.test(gu), 'gearUpgrade: the base weapon is in the tour and worn when better');
  const sp = cut('function gearStockPlan(', '/** a stocked piece arrived');
  check(/const stockIds = \(p\) =>/.test(sp), 'gearStockPlan: the wanted (preferred) ring is looked for first in bag / warehouses');
}
// SUNSEAL-2026-10-28 (owner: "unsealing S and higher is available at the NPC Basics"): Basics' page, S rows (Ancient Adena), the index by my AA
{ const num = (v) => Number(v) || 0;
{
  const B = ['Browse Mammon Merchant Goods', 'Craft S-Grade Dualsword', 'Bestow special capability on S-Grade weapon', 'Release seal on S-Grade armor', 'Release seal on S-Grade accessory', 'Craft A-Grade Dualsword',
    'Bestow special capability on A-Grade weapon', 'Release seal on A-Grade armor', 'Release seal on A-Grade accessory', 'Re-seal A-Grade armor', "Remove a weapon's special capability", 'Upgrade weapon', 'Make an even exchange of weapons', 'Complete a Foundation Item', 'Exchange Seal Stones', 'Purchase consumable items'];
  check(B[H.usPickLink(B, 'S', true)] === 'Release seal on S-Grade accessory' && B[H.usPickLink(B, 'S', false)] === 'Release seal on S-Grade armor', `S jewel / armor at Basics -> "${B[H.usPickLink(B, 'S', true)]}" / "${B[H.usPickLink(B, 'S', false)]}"`);
  check(B[H.usPickLink(B, 'A', true)] === 'Release seal on A-Grade accessory' && B[H.usPickLink(B, 'A', false)] === 'Release seal on A-Grade armor', 'A at Basics -> the A links, never "Re-seal" / S-grade');
  const L = ['Craft a Dualsword.', 'Bestow a special ability on a weapon.', 'Unseal armor and accessories.', 'Release the S-grade armor seal', 'Release the S-grade accessory seal', 'Release the A-grade armor seal'];
  check(L[H.usPickLink(L, 'A', true)] === 'Unseal armor and accessories.' && L[H.usPickLink(L, 'S', true)] === 'Release the S-grade accessory seal', 'Pushkin: A as before, S -> "Release the S-grade accessory seal"');
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'Scripts', 'data', 'unseal_h5.json'), 'utf8').replace(/^﻿/, ''));
  const tr = J.rows.find(r => num(r.s) === 6725 && num(r.p) === 889), SR = J.rows.filter(r => num(r.pay) === 5575);
  check(tr && num(tr.pay) === 5575 && num(tr.a) > 0 && tr.g === 'S' && SR.length >= 200 && SR.every(r => /^S/.test(String(r.g))), `unseal_h5.json: S / S80 / S84 rows with their Ancient Adena (Sealed Tateossian Ring -> ${tr ? tr.a : '?'} AA; ${SR.length} rows)`);
  const UI = H.usIndex(J.rows);
  check(JSON.stringify(H.usSealedFor(UI, 889)) === JSON.stringify([{ s: 6725, a: 0, aa: num(tr.a) }]) && H.usSealedFor(UI, 893).every(x => x.a > 0 && !x.aa), 'usSealedFor: an S piece costs Ancient Adena (no adena in the offer price), an A piece adena');
  const ud = cut('function usData() {', '\n}\n') + '\n}';
  let aa = 0; const C = { v: null };
  const mk = new Function('File', '__SCRIPTS__', 'now', 'num', 'itemCount', 'usIndex', 'let usCache = { at: 0, U: null, rows: null, all: null, aa: -1 };\n' + ud + '\nreturn usData;');
  const usD = mk({ ReadAllText: () => JSON.stringify(J) }, '', () => 1, num, () => aa, H.usIndex);
  const n0 = (usD().byP[889] || []).length; aa = 10 * 1e6; const n1 = (usD().byP[889] || []).length;
  check(n0 === 0 && n1 === 1 && (usD().byP[893] || []).length > 0, `usData: a sealed S piece counts only with its Ancient Adena in my bag (0 AA -> ${n0}, enough -> ${n1})`);
  const us = cut('async function usUnseal(', '// --- FRENZY KIT BUY');
  check(/if \(grade === 'S'\) \{ try \{ npc = await gsaGoMammon\(\)/.test(us) && /needs \$\{aaNeed\} Ancient Adena/.test(us), 'usUnseal: an S piece at Basics (Pushkin after), its Ancient Adena checked first');
}
}
// AASTONES-2026-10-28 (owner: Ancient Adena + seal stones from bag / warehouse / suppliers / clan warehouse like the other items)
{ const num = (v) => Number(v) || 0;
  const P = new Function('num', cut("const AA_ID = 5575,", '/** where Ancient Adena / seal stones lie') + '\n' + cut('/** pure: how `need` Ancient Adena is put together.', '/** all the Ancient Adena I could get') + '\nreturn { gsaAaPlan, AA_ID, SEAL_IDS };')(num);
  const R = { 6362: 10, 6361: 5, 6360: 3 };
  const srcs = [{ key: 'wh', by: 'Mats', m: { 5575: 100 } }, { key: 'sup', by: 'AgradeWH', m: { 5575: 50, 6361: 40 } }, { key: 'clan', by: 'Mats', m: { 5575: 1000, 6362: 1000 } }];
  let r = P.gsaAaPlan(500, { 5575: 20 }, srcs, R);
  check(r.left === 0 && r.stones === 0 && JSON.stringify(r.take) === JSON.stringify([{ key: 'wh', by: 'Mats', id: 5575, count: 100 }, { key: 'sup', by: 'AgradeWH', id: 5575, count: 50 }, { key: 'clan', by: 'Mats', id: 5575, count: 330 }]), 'AASTONES: Ancient Adena first - my warehouse, the supplier, the clan warehouse (' + JSON.stringify(r.take) + ')');
  r = P.gsaAaPlan(2000, { 5575: 0, 6362: 50 }, srcs, R);
  check(r.left === 0 && r.stones === 850 && JSON.stringify(r.take[3]) === JSON.stringify({ key: 'clan', by: 'Mats', id: 6362, count: 35 }), 'AASTONES: then my own stones (no walk), then the others\' (red first): ' + JSON.stringify(r));
  r = P.gsaAaPlan(487627, { 5575: 0 }, [{ key: 'sup', by: 'Mats', m: { 6362: 39245, 6361: 783055, 6360: 475822 } }], R);
  check(r.left === 0 && r.take[0].id === 6362 && r.take[0].count === 39245 && r.take[1].id === 6361 && r.take[1].count === Math.ceil((487627 - 392450) / 5), 'AASTONES: Mats\' stones for a Sealed Tateossian Ring (487,627 AA): all red + ' + r.take[1].count + ' green');
  r = P.gsaAaPlan(100, { 5575: 0 }, [], R); check(r.left === 100 && !r.take.length, 'AASTONES: nothing anywhere = all of it missing');
  const gu = cut('async function gearUpgrade(', 'function gsaApplyFix(');
  check(/const aaNeed = deep \? gsaAaNeed\(plan\.buys\) : 0;/.test(gu) && gu.indexOf('const aaNeed') < gu.indexOf('const askHs') && /await gsaAaExchange\(need\)/.test(gu) && gu.indexOf('await gsaAaExchange(need)') < gu.indexOf('usUnseal(p.needUnseal)'), 'AASTONES: gear-up asks for the AA / stones with the other items, exchanges the stones before the unseals');
  const sv = cut('async function gsaServe(', '/** STOCK FIRST, part 1');
  check(/for \(const m of \(Array\.isArray\(d\.soft\) \? d\.soft : \[\]\)\)/.test(sv) && /req\.soft \|\| \[\]/.test(cut('function gsaAskStart(', 'async function gsaAskWait(')), 'AASTONES: the supplier gives what he has of it (bag -> warehouse -> clan warehouse), never a refusal');
  const ex = cut('async function gsaAaExchange(', 'function gsaStockSrcs(');
  check(/exchange\\s\+seal\\s\+stones\?/.test(ex) && /measured\[sid\] \? Math\.min\(bagCount\(sid\), Math\.ceil\(want \/ rate\[sid\]\)\) : 1/.test(ex) && /seal_rate\.json/.test(ex) && /no amount box/.test(ex), 'AASTONES: Basics "Exchange Seal Stones": the amount box, 1 stone first (the rate measured), never a blind "all"');
}
console.log(`unseal: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
