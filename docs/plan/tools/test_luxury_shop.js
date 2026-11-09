// OFFLINE TEST: LUXURYSHOP-2026-10-25 (owner: "while trying to buy gear for Mei selected in gear plan, Mei reported that shops in Giran stop on
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
].join('\n');
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
  const fn = new Function('Me', 'state', 'CONFIG', 'File', '__SCRIPTS__', 'Inventory', 'hostSnap', 'now', 'num', 'logError', 'teamOf', 'soulTarget', 'myCrystals', 'soulReady', 'fileStamp', 'isHealerRole', 'rtFlag',
    code + '\nreturn { planUpgrades, giranLuxuryIndex, luxuryShopMode };');
  const num = (v) => typeof v === 'bigint' ? Number(v) : (Number(v) || 0);
  return fn(env.Me, env.state, env.CONFIG, File, '__S__', { forEach: (f) => inv.forEach(f) }, { inv: () => inv }, () => Date.now(), num,
    (w, e) => { throw new Error(w + ': ' + (e && e.message)); }, () => 'P', () => null, () => [], () => false, () => '1',
    () => /bishop|shilliensaint|healer/.test(o.role), (name, d) => (name === 'luxuryShop' && o.flag !== undefined ? o.flag : d));
}
const plan = (o) => harness(o).planUpgrades(o.budget === undefined ? 40000000 : o.budget);
const lux = (r) => (r.buys || []).filter(p => p.offer && p.offer.market);

// ---- 1) the luxury index
{
  const L = harness({ classId: 117, level: 80, role: 'melee' }).giranLuxuryIndex();
  const o = (L[idOf('Majestic Plate Armor')] || [])[0];
  check(!!o && o.npc === 'Alexandria' && o.price === 8804000 && o.kind === 'exchange' && o.listId === 5001 && o.entry > 0 && o.market && !o.route && o.x && o.y,
    `Majestic Plate Armor: Alexandria multisell 5001 for 8,804,000 adena (${JSON.stringify(o)})`);
  const w = (L[idOf("Sirra's Blade")] || [])[0];
  check(!!w && w.npc === 'Galladucci' && w.price === 26968400, `Sirra's Blade: Galladucci for 26,968,400 (${w && w.npc} ${w && w.price})`);
  check(!L[8830], 'Shadow Item: Katana (Graham, timed item) is not a luxury offer');
  check(!L[4647], 'Green Soul Crystal - Stage 7 (costs crystals, no gear) is not a luxury offer');
  check(Object.values(L).every(a => a.every(x => x.npc === 'Alexandria' || x.npc === 'Galladucci')), `only Alexandria / Galladucci (${[...new Set([].concat(...Object.values(L)).map(x => x.npc))].join(', ')})`);
  check(Object.keys(harness({ classId: 117, level: 80, role: 'melee', flag: false }).giranLuxuryIndex()).length === 0, 'runtime flag luxuryShop false -> empty index');
}
// ---- 2) Mei: Fortune Seeker (117), level 80, her real gear plan (gear_prefs.json _class 117 S80)
{
  const worn = ['Full Plate Armor', 'Full Plate Helmet'];
  const r = plan({ classId: 117, level: 80, role: 'melee', worn, budget: 40000000 });
  const L = lux(r), names = L.map(p => p.info.n);
  console.log('     Mei buys:', (r.buys || []).map(p => `${p.info.n} ${p.offer.price} @${p.offer.npc}${p.offer.market ? ' (luxury)' : ''}`).join(' | '));
  console.log('     Mei notes:', (r.notes || []).join(' || '));
  check(names.includes('Tallum Helm') && names.includes('Tallum Plate Armor'), `Tallum Helm + Tallum Plate Armor bought at the luxury shop (${names.join(', ')})`);
  check(names.filter(n => n === 'Sealed Majestic Earring').length === 2, `2x Sealed Majestic Earring (earring + earring2 of the plan): ${names.filter(n => n === 'Sealed Majestic Earring').length}`);
  check(L.every(p => p.offer.npc === 'Alexandria' && p.offer.listId === 5001), 'all of them at Alexandria, list 5001');
  check(!(r.buys || []).some(p => /^Sealed Tallum (Gloves|Boots)$/.test(p.info.n)), 'the Sealed Tallum Gloves / Boots (other items than the plan\'s "- Heavy Armor" pieces) are never bought instead');
  const rowG = (r.prefs || []).find(x => x.slot === 'gloves');
  check(rowG && rowG.status === 'manual', `gloves row stays manual (Tallum Gloves - Heavy Armor is not sold for adena): ${rowG && rowG.status}`);
  check((r.notes || []).some(n => /^S80-grade: no NPC shop sells S80 gear \(Giran's merchants stop at C, the luxury shop at A\)/.test(n)), 'S80 note names the luxury shop limit');
  check(!(r.notes || []).some(n => /Giran stops at C\)/.test(n)), 'the old "Giran stops at C" note is gone while the luxury shop is known');
  // budget: 2M buys no 5.8M Tallum Plate Armor
  const poor = plan({ classId: 117, level: 80, role: 'melee', worn, budget: 2000000 });
  check(!lux(poor).some(p => p.info.n === 'Tallum Plate Armor') && (poor.skipped || []).some(t => /Tallum Plate Armor/.test(t)), `2M adena: Tallum Plate Armor skipped, not bought (${(poor.skipped || []).filter(t => /Tallum/.test(t)).join('; ')})`);
  // flag off: nothing from the luxury shop, the old note
  const off = plan({ classId: 117, level: 80, role: 'melee', worn, flag: false });
  check(lux(off).length === 0, `luxuryShop false: nothing bought at the luxury shop (${lux(off).map(p => p.info.n).join(', ')})`);
}
// ---- 3) recommendations (no plan entry): not with 'plan', yes with 'all'
{
  const base = { classId: 5, level: 71, role: 'tank', worn: ['Common Item - Samurai Long Sword', 'Composite Armor'], budget: 130000000, prefs: {} };
  // LUXARMOR-2026-10-25: default 'armor' = the recommended armor / shield / jewels too, a recommended WEAPON only from the plan
  const r = plan(base);
  check(lux(r).length > 0 && lux(r).every(p => p.slot !== 'weapon'), `lvl 71 tank, recommendations only, default 'armor': recommended armor bought, no weapon (${lux(r).map(p => p.info.n).join(', ')})`);
  check((r.notes || []).some(n => /^A-grade: Giran's merchants stop at C; the luxury shop \(Alexandria \/ Galladucci\) sells B \/ A — only pieces named in the gear plan \(\+ the recommended armor \/ jewels\) are bought there/.test(n)), `A-grade note: ${(r.notes || []).find(n => /grade/.test(n))}`);
  const pl = plan(Object.assign({}, base, { flag: 'plan' }));
  check(lux(pl).length === 0, `flag 'plan': no recommendation bought at the luxury shop (${lux(pl).map(p => p.info.n).join(', ')})`);
  const all = plan(Object.assign({}, base, { flag: 'all' }));
  console.log('     tank (all) luxury buys:', lux(all).map(p => `${p.info.n} ${p.offer.price}`).join(' | '));
  check(lux(all).length > 0 && lux(all).every(p => ITEMS[p.id].g === 'A' || ITEMS[p.id].g === 'B'), `flag 'all': recommended B / A pieces bought at the luxury shop (${lux(all).length})`);
}
// ---- 3b) TOPHALF: a two-piece top over a worn one-piece armor only together with its legs (Arthrun, Paladin 53, Common Full Plate Armor)
{
  const worn = ['Common Item - Full Plate Armor', 'Common Item - Full Plate Helmet', 'Common Item - Samurai Long Sword'];
  const poor = plan({ classId: 5, level: 53, role: 'tank', worn, budget: 3000000 });
  const pn = (poor.buys || []).map(p => p.info.n);
  check(!pn.includes('Blue Wolf Breastplate') && !pn.includes('Blue Wolf Gaiters'), `3M: no Blue Wolf Breastplate without its Gaiters (bought: ${pn.join(', ')})`);
  check((poor.skipped || []).some(t => /Blue Wolf Gaiters .*top \+ legs only together/.test(t)), 'the skip says why (top + legs only together)');
  const rich = plan({ classId: 5, level: 53, role: 'tank', worn, budget: 5000000 });
  const rn = (rich.buys || []).map(p => p.info.n);
  check(rn.includes('Blue Wolf Breastplate') && rn.includes('Blue Wolf Gaiters'), `5M: Breastplate + Gaiters bought together (${rn.join(', ')})`);
}
// ---- 3c) TOPHALF-2026-10-25b: Mei (Swordsinger 21, lvl 53) in a one-piece Common Full Plate Armor: the recommended Blue Wolf Breastplate (166) is
//      judged WITH the Gaiters (104) against the Full Plate (239) -> Breastplate + Gaiters + Helmet at Alexandria; with 3M only none of the pair
{
  const worn = ['Common Item - Full Plate Armor', 'Common Item - Full Plate Helmet', 'Common Item - Full Plate Gauntlet', 'Common Item - Full Plate Boots'];
  const m = plan({ classId: 21, level: 53, role: 'melee', worn, budget: 40000000 });
  const mn = lux(m).map(p => p.info.n);
  check(mn.includes('Blue Wolf Breastplate') && mn.includes('Blue Wolf Gaiters') && mn.includes('Blue Wolf Helmet'), `Mei: Blue Wolf Breastplate + Gaiters + Helmet at Alexandria (${mn.join(', ')})`);
  check(!(m.buys || []).some(p => p.slot === 'weapon' && p.offer.market), 'Mei: no recommended weapon from the luxury shop');
  const m3 = plan({ classId: 21, level: 53, role: 'melee', worn, budget: 3000000 });
  check(!lux(m3).some(p => /Breastplate|Gaiters/.test(p.info.n)), `Mei with 3M: no top without its legs (${lux(m3).map(p => p.info.n).join(', ')})`);
}
// ---- 4) wiring
{
  const bg = cut('async function buyGearPicks(', '/** How many copies of an item');   // incl. buyGearGroup
  check(/if \(G\.offer\.market\) \{[\s\S]{0,700}ijBuyAt\((?:G\.offer|MK), (?:p\.id|buyId), 1, /.test(bg), 'buyGearPicks: a luxury group is bought by ijBuyAt (one piece per call)');
  check(/gsaTourOrder\(/.test(bg) && /buyGearGroup\(G, res\)/.test(bg), 'buyGearPicks (TOUR-2026-10-25): one stop per NPC, nearest first');
  const ij = cut('function ijStatus(', '/** get me (and my party) to Giran');
  check(/if \(!id\) \{[\s\S]{0,300}return; \}/.test(ij) && ij.indexOf('if (!id)') < ij.indexOf('IJ.dir()'), 'ijStatus without a job id writes no job file');
  const pu = cut('function planUpgrades(', 'async function buyGearPicks(');
  check(/for \(const id of Object\.keys\(idx\)\)/.test(pu) && !/Object\.keys\(lux\)\)\s*\{/.test(pu), 'step b (automatic Common picks) still only walks the route-merchant index');
}
console.log(`luxury shop: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
