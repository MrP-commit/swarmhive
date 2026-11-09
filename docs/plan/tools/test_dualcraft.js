// OFFLINE TEST: DUALCRAFT-2026-10-25 (owner, Kerrigan: "it should be 1st sword, 2nd sword, then the items needed to make duals (crystals or Stone of
// Purity or something else) - the clan leader should have it and retrieve it from the warehouse"; owner choice: a B dual = the character goes ALONE to Aden).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const src = fs.readFileSync(process.env.SWARM_SRC || path.join(ROOT, 'Scripts_dev', 'swarm.js'), 'utf8');
let pass = 0, fail = 0; const check = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('marker not found: ' + (i < 0 ? a : b)); return src.slice(i, j); };
const P = new Function(cut('// ==== GEARSA-PURE begin', '// ==== GEARSA-PURE end') + '\nreturn { gdlRecipe, gdlNeed, gdlPickLink };')();
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'Scripts', 'data', 'dual_craft_h5.json'), 'utf8')).rows;
// ---- the data
{
  const r = P.gdlRecipe(D, 2626, ['Giran', 'Aden']);
  check(r && r.a === 135 && r.b === 135 && r.town === 'Aden' && r.npc === 'Wilbert' && r.mats.length === 1 && r.mats[0].id === 1875 && r.mats[0].count === 450, `Samurai Long Sword*Samurai Long Sword = 2x Samurai Longsword + 450 Stone of Purity at Wilbert in Aden (${JSON.stringify(r)})`);
  const k = P.gdlRecipe(D, 2582, ['Giran', 'Aden']);
  check(k && k.town === 'Giran' && k.npc === 'Pushkin' && k.mats[0].id === 1458, 'Katana*Katana (C) = Pushkin in Giran, Crystal (D-Grade)');
  const a = P.gdlRecipe(D, 5706, ['Giran', 'Aden']);
  check(a && a.town === 'Giran' && a.mats.some(m => m.id === 5126) && a.mats.some(m => m.id === 5575), 'Damascus*Damascus (A) = Pushkin, Dualsword Craft Stamp + Ancient Adena');
  check(!D.some(x => x.g === 'B' && x.town === 'Giran'), 'no B dual is made in Giran (census: Pushkin\'s dual list has D / C only)');
}
// ---- what it needs
{
  const r = P.gdlRecipe(D, 2626, ['Giran', 'Aden']);
  const n0 = P.gdlNeed(r, { bag: {}, wh: {}, clan: { 1875: 5009 } }, { 135: 5444092 });
  check(n0.swords.length === 2 && n0.swords.every(s => s.from === 'buy' && s.price === 5444092) && n0.mats[0].clan === 450 && n0.mats[0].rest === 0 && !n0.why, 'Kerrigan: both swords bought (Graham), 450 Stone of Purity from the clan warehouse');
  check(n0.adena === Math.ceil(1350000 * 1.2) + 2 * Math.ceil(5444092 * 1.25), `adena set aside: 2 swords x1.25 + the craft fee x1.2 (${n0.adena})`);
  const n1 = P.gdlNeed(r, { bag: { 135: 1 }, wh: { 135: 1 }, clan: {} }, { 135: 5444092 });
  check(n1.swords[0].from === 'bag' && n1.swords[1].from === 'wh' && n1.adena === Math.ceil(1350000 * 1.2), 'stock first: one sword from the bag, the other from my warehouse, none bought');
  check(P.gdlNeed(r, { bag: {}, wh: {}, clan: {} }, {}).why !== '', 'no seller and no stock: said why');
  check(P.gdlNeed(r, { bag: { 1875: 100 }, wh: { 1875: 50 }, clan: { 1875: 200 } }, { 135: 1 }).mats[0].rest === 100, 'materials: bag 100 + my warehouse 50 + clan 200 -> 100 still missing (the clan leader\'s own records next)');
}
// ---- the blacksmith links (Pushkin's live pages: census giran_market.json)
{
  const main = ['Craft a Dualsword.', 'Bestow a special ability on a weapon.', 'Craft an item.', 'Unseal armor and accessories.', 'Smelt an item.', 'Quest', 'Manufacture an S-grade sword', 'Bestow the special S-grade weapon some abilities', 'Manufacture an A-grade sword', 'Release the A-grade armor seal'];
  check(main[P.gdlPickLink(main, 'C')] === 'Craft a Dualsword.', 'C dual -> "Craft a Dualsword."');
  const sub = ['View the list.', 'Manufacture an S-grade sword', 'Purchase consumable items'];
  check(sub[P.gdlPickLink(sub, 'C')] === 'View the list.', 'its page -> "View the list." (never the consumables / S list)');
  const mainNoCraft = main.filter(t => t !== 'Craft a Dualsword.');
  check(mainNoCraft[P.gdlPickLink(mainNoCraft, 'A')] === 'Manufacture an A-grade sword', 'A dual, 2nd try -> "Manufacture an A-grade sword"');
  check(P.gdlPickLink(['Bestow a special ability on a weapon.', 'Release the A-grade armor seal', 'Quest'], 'B') < 0, 'never a seal / special ability link');
}
// ---- wiring
{
  const gu = cut('async function gearUpgrade(', '// ===== GEARSA (2026-10-25;');
  const iP = gu.indexOf('du = gearDualPlanMine()'), iPl = gu.indexOf('const plan = planUpgrades('), iAsk = gu.indexOf('gsaAskStart(q, nm)'), iTour = gu.indexOf('await buyGearPicks(plan.buys.filter(p => !p.bought && !(p.offer && p.offer.stock))'), iC = gu.indexOf('await gearDualCraft(du)'), iE = gu.indexOf('equipPiece(duObj');
  check(iP > 0 && iPl > iP && iAsk > iPl && iTour > iAsk && iC > iTour && iE > iC, 'gearUpgrade: dual plan -> plan without the weapon -> ask the clan leader (materials) -> tour (swords) -> craft -> put on');
  check(/- \(du \? du\.need\.adena : 0\)/.test(gu) && /du \? \{ noWeapon: `dual craft: \$\{du\.name\}` \}/.test(gu), 'the dual\'s adena is set aside, the weapon slot locked');
  check(/req\.mats\.push\(\{ id: m\.id, count: left - fromWh, name: m\.name \}\)/.test(gu), 'the materials my bag / warehouse do not have are asked from the clan leader');
  const sv = cut('async function gsaServe(', 'function gsaServeQueued(');
  check(/for \(const m of \(Array\.isArray\(d\.mats\)/.test(sv) && /gsaWhTake\('private'[\s\S]{0,200}gsaWhTake\('clan'/.test(sv.slice(sv.indexOf('d.mats'))), 'the clan leader: materials from his bag -> his warehouse -> the clan warehouse, or he reports it');
  const cr = cut('async function gearDualCraft(', '// UNSEAL-2026-10-25: the table');
  check(/orderTownTrip\(`!gearup \$\{Me\.Name\}: \$\{pname\}`, r\.town, \{ solo: true \}\)/.test(cr) && /scoutAway\(true\)/.test(cr) && /orderTownTrip\(`!gearup \$\{Me\.Name\}: back`, 'Giran', \{ solo: true \}\)/.test(cr) && /scoutAway\(false\)/.test(cr), 'a dual made in another town: alone there (away from the party) and back to Giran');
  check(/e\.ings\.every\(g => okIds\.has\(num\(g\.id\)\)\)/.test(cr) && /parsed\.some\(x => !x\)/.test(cr), 'only the exact entry (two swords + its materials + adena); an unreadable list = nothing exchanged');
  check(/a party leader does not go there alone/.test(cut('function gearDualPlanMine(', '/** the dual\'s tour stops')), 'a party leader is never sent alone to another town');
  check(/d2 = gearDualPlanMine\(\)/.test(cut('function purseInfoMine(', '/** swarm_state.purse')), 'the purse counts the dual craft too');
}
console.log(`dualcraft: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
