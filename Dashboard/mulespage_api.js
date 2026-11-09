// MULES PAGE API (MULES-2026-11-06, owner: "a Mules tab with the Decrease Weight icon: characters I pick there are searched for the needed items
// like the clan warehouse / private warehouse / inventory are at !gearup; show what they hold like Storage -> Clan warehouse").
// The gear-up side already exists in swarm.js (SUPPLY-2026-10-28 gsaSupConf / gsaSuppliers, BESTENCH maxEnchant): it reads
// Scripts/data/gear_suppliers.json { on, mules: [{ name, grades? }], maxEnchant } live (60 s cache). This page only edits that file and shows,
// for every mule, what swarm.js would see: its bag record (Logs/bag_<name>.json) and private warehouse record (Logs/wh_private_<name>.json),
// and WHY a mule is skipped right now (the same rules as gsaSuppliers: in the roster, online, warehouse record not the clan list).
// Loaded by server.js through muleApi() (hot: a changed mulespage_api.js loads without a dashboard restart).
// Public (no secrets): /mulespage.js, /mulespage.css. Key checked inside for /api/mules*.
//   GET  /api/mules              { file, exists, broken, rev, conf, clanLeader, grades, candidates: [...], mules: [{ name, grades, status, adena,
//                                   bagAt, whAt, rows: [{ id, name, icon, count, enchant, src: bag|wh, worn, cat, grade, gear, common, skip }] }] }
//   GET  /api/mules/char?name=   the same block for one character (a preview before it is ticked)
//   POST /api/mules { conf: { on, mules: [{ name, grades }], maxEnchant }, rev, by }  sanitized (names as swarm.js gsaSupConf accepts them, grades
//                                   NONE..S84, 0-9), every other key of the file (_note) kept; lock + rev check (409), history copy
//                                   (Scripts/data/history/gear_suppliers_<time>.json, last 50), atomic write (manual_guard.js), one line in
//                                   Logs/dashboard_commands.log.
// File: Scripts/data/gear_suppliers.json (env SWARM_SUPPLIERS_FILE overrides it: the tests use a scratch copy).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const STATIC = { '/mulespage.js': 'application/javascript; charset=utf-8', '/mulespage.css': 'text/css; charset=utf-8' };
const NAME_RE = /^[A-Za-z0-9_]{2,32}$/;                   // = swarm.js gsaSupConf (a name it would drop is refused here)
const GRADES = ['NONE', 'D', 'C', 'B', 'A', 'S', 'S80', 'S84'];
const GRADE_OF = ['NONE', 'D', 'C', 'B', 'A', 'S', 'S80', 'S84'];   // items.json [3] = client crystal type index
const ONLINE_SEC = 600, BAG_FRESH_MS = 15 * 60000;       // = gsaSuppliers: state < 10 min, or bag record < 15 min
const MAX_MULES = 30, MAX_ENCH_TOP = 9;                   // BESTENCH: never +10 and up
const NOTE = 'SUPPLY + BESTENCH (swarm.js gsaSuppliers / gsaStockEnch), edited on the dashboard Mules tab: characters whose bag + private warehouse a !gearup also uses (after the clan leader, before the clan warehouse), in this order. grades = only gear pieces of these grades (none = all). The mule must be in swarm.config.json (or an alt) and online (state < 10 min or bag record < 15 min old); it takes the pieces out of its warehouse itself and hands them over. A !gearup takes the HIGHEST enchant found anywhere; maxEnchant = the highest enchant taken from anyone (0-9; +10 and up never).';

const isoNow = () => new Date().toISOString();
const sha = (t) => t ? crypto.createHash('sha1').update(t).digest('hex').slice(0, 16) : '';
const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
const rj = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { return d; } };
const fileOf = (ctx) => process.env.SWARM_SUPPLIERS_FILE || path.join(ctx.DATA, 'gear_suppliers.json');
let G = null;
function guard(ctx) { if (!G) G = require(path.join(ctx.ROOT, 'docs', 'plan', 'tools', 'manual_guard.js')); return G; }
const cache = {};
function cached(key, file, fb, map) {
  let st = ''; try { st = String(fs.statSync(file).mtimeMs); } catch (e) { }
  if (!cache[key] || cache[key].st !== st) { let v = rj(file, fb); if (map) v = map(v); cache[key] = { st, v }; }
  return cache[key].v;
}
const itemsDb = (ctx) => cached('items', path.join(ctx.DIR, 'data', 'items.json'), {});
const gearDb = (ctx) => cached('gear', path.join(ctx.DATA, 'gear_items.json'), { items: {} }, v => (v && v.items) || {});
/** the Storage page's categories (weapon, armor, accessory, material, part, recipe, scroll, letter, use, stone, other) */
function catOf(ctx, id, name, it) {
  let S = null; try { S = require('./storagepage_api'); } catch (e) { S = null; }
  if (S && typeof S.itemCat === 'function') { try { return S.itemCat(ctx, id, name, it); } catch (e) { } }
  const t = it && it[2];
  return t === 'Weapon' ? 'weapon' : t === 'Armor' ? (/Necklace|Earring|Ring$|Bracelet|Talisman|Belt$/i.test(name) ? 'accessory' : 'armor') : /^Recipe/i.test(name) ? 'recipe' : /Scroll/i.test(name) ? 'scroll' : 'other';
}

// ------------------------------------------------------------------------------------------------------------------- the file
function readConf(ctx) {
  const F = fileOf(ctx);
  let raw = ''; try { raw = fs.readFileSync(F, 'utf8'); } catch (e) { }
  let data = null; try { data = raw ? JSON.parse(raw.replace(/^﻿/, '')) : {}; } catch (e) { return { raw, rev: sha(raw), data: null, broken: e.message, exists: true }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  return { raw, rev: sha(raw), data, exists: !!raw };
}
/** what swarm.js gsaSupConf makes of the file -> { on, maxEnchant, mules: [{ name, grades: [] (= every grade) }] } */
function effConf(data) {
  const j = obj(data);
  const mules = (Array.isArray(j.mules) ? j.mules : []).map(x => typeof x === 'string' ? { name: x, grades: [] } : { name: String((x && x.name) || ''), grades: Array.isArray(x && x.grades) ? x.grades.map(g => String(g).toUpperCase()) : [] })
    .filter(x => NAME_RE.test(x.name));
  const me = Number(j.maxEnchant);
  return { on: j.on !== false, maxEnchant: Number.isFinite(me) ? Math.min(MAX_ENCH_TOP, Math.max(0, Math.floor(me))) : MAX_ENCH_TOP, mules };
}
/** the posted settings -> { ok, conf } | { ok: false, errors }. conf is written over the file's own keys (_note and unknown keys are kept). */
function sanitize(input, clanLeader) {
  const errors = [], c = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!c) return { ok: false, errors: ['settings must be an object'] };
  const out = {};
  if (c.on !== undefined && typeof c.on !== 'boolean') errors.push('on: true or false'); else out.on = c.on !== false;
  if (c.maxEnchant === undefined || c.maxEnchant === null || c.maxEnchant === '') out.maxEnchant = MAX_ENCH_TOP;
  else { const n = Number(c.maxEnchant); if (!Number.isInteger(n) || n < 0 || n > MAX_ENCH_TOP) errors.push(`highest enchant: a whole number 0 to ${MAX_ENCH_TOP} (+10 and up are never taken)`); else out.maxEnchant = n; }
  const L = c.mules === undefined ? [] : c.mules;
  if (!Array.isArray(L)) errors.push('mules: a list');
  else if (L.length > MAX_MULES) errors.push(`mules: at most ${MAX_MULES}`);
  else {
    const seen = new Set(); out.mules = [];
    L.forEach(x => {
      const name = String(typeof x === 'string' ? x : (x && x.name) || '').trim();
      if (!NAME_RE.test(name)) { errors.push(`"${name.slice(0, 40)}" is not a character name (2-32 letters, digits, _)`); return; }
      if (seen.has(name.toLowerCase())) { errors.push(`${name} is in the list twice`); return; }
      seen.add(name.toLowerCase());
      if (clanLeader && name === clanLeader) { errors.push(`${name} is the clan leader — always searched first, no need to add him`); return; }
      const gr = x && typeof x === 'object' && x.grades !== undefined ? x.grades : [];
      if (!Array.isArray(gr)) { errors.push(`${name} grades: a list`); return; }
      const g = [];
      gr.forEach(v => { const s = String(v).toUpperCase(); if (!GRADES.includes(s)) errors.push(`${name} grade "${String(v).slice(0, 10)}": one of ${GRADES.join(', ')}`); else if (!g.includes(s)) g.push(s); });
      const e = { name }; if (g.length && g.length < GRADES.length) e.grades = GRADES.filter(k => g.includes(k));   // every grade = no filter (the key left out)
      out.mules.push(e);
    });
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, conf: out };
}

// ------------------------------------------------------------------------------------------------------------------- characters
function swarmCfg(ctx) { return rj(path.join(ctx.ROOT, 'swarm.config.json'), {}) || {}; }
function clanLeader(ctx, cfg) {
  const cq = rj(path.join(ctx.DATA, 'clan_quests.json'), null), cs = rj(path.join(ctx.LOGS, 'clan_state.json'), null);
  return (cq && cq.clan && cq.clan.leader) || (cfg && cfg.clanLeader) || (cs && cs.leader) || '';
}
/** = swarm.js CONFIG.roster: enabled accounts with a character AND a role, plus the alts (Scripts/data/alts.json) */
function roster(ctx, cfg) {
  const R = {};
  (cfg.accounts || []).forEach(a => { if (a && a.character) R[a.character] = { account: String(a.login || ''), party: String(a.party || a.character), inRoster: a.enabled !== false && !!a.role, why: a.enabled === false ? 'its account is switched off in the account list' : !a.role ? 'its account has no role' : '' }; });
  const AJ = rj(path.join(ctx.DATA, 'alts.json'), {}) || {};
  (AJ.alts || []).forEach(x => { const n = String((x && x.name) || ''); if (NAME_RE.test(n) && !R[n]) R[n] = { account: String(x.login || ''), party: n, inRoster: true, alt: true, why: '' }; });
  return R;
}
/** every name that has a bag / warehouse record */
function recordNames(ctx) {
  const out = new Set();
  try { fs.readdirSync(ctx.LOGS).forEach(f => { const m = /^(?:bag|wh_private)_(.+)\.json$/.exec(f); if (m && NAME_RE.test(m[1])) out.add(m[1]); }); } catch (e) { }
  return out;
}
const enchOf = (x) => Number(x && x.enchant) || Number((/^\+(\d+)\s/.exec(String((x && x.name) || '')) || [0, 0])[1]) || 0;
/** = swarm.js gsaWhIsClan: a warehouse record that is (nearly) the clan warehouse list was read from the clan warehouse window */
function whIsClan(whRows, clanRows) {
  const k = (x) => Number(x.id) + ':' + Number(x.count), C = new Set((clanRows || []).map(k)), W = whRows || [];
  if (W.length < 10 || !C.size) return false;
  return W.filter(x => C.has(k(x))).length >= 0.8 * W.length;
}
/** a bag / warehouse record -> rows (one per item id + enchant + worn), the Storage clan warehouse row shape plus src / worn / skip */
function rowsOf(ctx, list, src, grades, maxE) {
  const I = itemsDb(ctx), GI = gearDb(ctx), by = {};
  (list || []).forEach(i => {
    const id = Number(i && i.id); if (!id || id === 57 || (i.q || i.quest)) return;     // adena: shown on the head line; quest items never move
    const en = enchOf(i), worn = !!(i.eq || i.equipped), k = `${src}|${id}+${en}${worn ? 'w' : ''}`;
    const it = I[id], gi = GI[id];
    const nm = String((gi && gi.n) || (it && it[0]) || String(i.name || '').replace(/^\+\d+\s+/, '') || 'item ' + id);
    const gc = gi && gi.g ? gi.g : (it && it[3] !== '' && it[3] != null && GRADE_OF[Number(it[3])]) || '';
    const r = by[k] = by[k] || { id, name: nm, icon: (it && it[1]) || '', count: 0, enchant: en, src, worn, cat: catOf(ctx, id, nm, it), grade: gc && gc !== 'NONE' ? gc : (gc === 'NONE' ? 'NONE' : ''), gear: !!gi, common: /^Common Item - /i.test(nm), skip: '' };
    r.count += Math.max(1, Number(i.count) || 1);
  });
  return Object.keys(by).map(k => by[k]).map(r => {
    // what the gear-up would never take from this mule (gsaSuppliers / gsaEnchMap / gsaSupFor): worn, +10 and up / above maxEnchant, a grade it is not used for
    r.skip = r.worn ? 'worn' : r.enchant >= 10 ? '+10 and up: never' : r.enchant > maxE ? `above +${maxE}` : r.gear && grades && grades.length && !grades.includes(String(r.grade || 'NONE').toUpperCase()) ? 'grade not used' : '';
    return r;
  }).sort((a, b) => a.name.localeCompare(b.name) || a.enchant - b.enchant);
}
function charBlock(ctx, name, o) {
  const st = o.states[name] || null, R = o.roster[name] || null, C = o.conf, isLeader = !!o.leader && name === o.leader;
  const bag = rj(path.join(ctx.LOGS, `bag_${name}.json`), null), wh = rj(path.join(ctx.LOGS, `wh_private_${name}.json`), null);
  const m = C.mules.find(x => x.name === name), grades = m && m.grades && m.grades.length ? m.grades : null;
  const bagAt = (bag && bag.at) || null, whAt = (wh && (wh.seenAt || wh.at)) || null;
  const ageSec = st && st.ageSec != null ? Number(st.ageSec) : null;
  const online = ageSec != null && ageSec <= ONLINE_SEC, bagFresh = !!bagAt && Date.now() - (Date.parse(bagAt) || 0) <= BAG_FRESH_MS;
  const clanRows = o.clanRows, whRows = (wh && Array.isArray(wh.items)) ? wh.items : [], whClan = whIsClan(whRows, clanRows);
  let adena = 0; ((bag && bag.items) || []).forEach(i => { if (Number(i.id) === 57) adena += Number(i.count) || 0; });
  // why the gear-up skips this mule right now (the order of the checks = gsaSuppliers)
  // (the clan leader: always asked, also with the mules off; only the roster check applies to him)
  const why = [];
  if (!isLeader && !C.on) why.push('mules are switched off');
  if (!R || !R.inRoster) why.push(R ? `not in Hive's roster (${R.why})` : "not in Hive's account list (swarm.config.json) — Hive never runs it");
  if (!isLeader && !online && !bagFresh) why.push('offline — log it in: it hands the items over itself');
  return {
    name, isLeader, level: st && st.level != null ? Number(st.level) : null, cls: (st && st.cls) || '', online, ageSec, account: R ? R.account : '', inRoster: !!(R && R.inRoster), alt: !!(R && R.alt), party: R ? R.party : '',
    adena, bagAt, whAt, bagKinds: bag && Array.isArray(bag.items) ? bag.items.length : null, whKinds: wh && Array.isArray(wh.items) ? wh.items.length : null, whClan,
    used: why.length === 0, why,
    rows: o.rows ? rowsOf(ctx, (bag && bag.items) || [], 'bag', grades, C.maxEnchant).concat(whClan ? [] : rowsOf(ctx, whRows, 'wh', grades, C.maxEnchant)) : undefined
  };
}
// ENGINECHECK-2026-11-09 (SwarmHive 1.14.0 replaced swarm.js: the SUPPLY change that reads gear_suppliers.json was gone): does the RUNNING
// swarm.js (Scripts/swarm.js) read this list at all? -> { reads, version, dist: upstream gear_sources.json distributors.names }; cached by mtime
let ENG = { sig: '', v: null };
function engine(ctx) {
  const f = path.join(ctx.ROOT, 'Scripts', 'swarm.js'); let sig = '';
  try { const st = fs.statSync(f); sig = st.mtimeMs + ':' + st.size; } catch (e) { return { reads: null, version: '', dist: [] }; }
  if (!ENG.v || ENG.sig !== sig) { let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { } ENG = { sig, v: { reads: t ? t.includes('gear_suppliers.json') : null } }; }
  let version = ''; try { version = fs.readFileSync(path.join(ctx.ROOT, 'VERSION'), 'utf8').trim(); } catch (e) { }
  const gs = rj(path.join(ctx.DATA, 'gear_sources.json'), {}) || {}, d = obj(gs.distributors);
  return Object.assign({ version, dist: d.on === false ? [] : (Array.isArray(d.names) ? d.names.map(String) : []) }, ENG.v);
}
function ctxOf(ctx, conf) {
  const cfg = swarmCfg(ctx), states = {};
  (ctx.readStates ? ctx.readStates() : []).forEach(s => { if (s && s.name) states[s.name] = s; });
  const cs = rj(path.join(ctx.LOGS, 'clan_state.json'), {}) || {};
  return { cfg, states, roster: roster(ctx, cfg), leader: clanLeader(ctx, cfg), conf, clanRows: (cs.warehouse && cs.warehouse.items) || [] };
}
function info(ctx) {
  const R = readConf(ctx), conf = effConf(R.data || {}), o = ctxOf(ctx, conf);
  const names = new Set(Object.keys(o.roster)); recordNames(ctx).forEach(n => names.add(n)); conf.mules.forEach(m => names.add(m.name));
  if (o.leader) names.add(o.leader);
  const candidates = [...names].filter(n => !/^(Zariche|Akamanah)$/.test(n)).map(n => charBlock(ctx, n, Object.assign({}, o, { rows: false })))
    .sort((a, b) => (b.isLeader - a.isLeader) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const lead = o.leader ? [Object.assign(charBlock(ctx, o.leader, Object.assign({}, o, { rows: true })), { grades: [] })] : [];
  const mules = conf.mules.map(m => Object.assign(charBlock(ctx, m.name, Object.assign({}, o, { rows: true })), { grades: m.grades }));
  return { ok: true, file: path.basename(fileOf(ctx)), exists: R.exists, broken: R.broken || null, rev: R.rev, conf, clanLeader: o.leader, grades: GRADES, maxEnchTop: MAX_ENCH_TOP,
    candidates, mules, leader: lead[0] || null, engine: engine(ctx), at: isoNow() };
}
function charInfo(ctx, name) {
  if (!NAME_RE.test(String(name || ''))) return { code: 400, error: 'name?' };
  const R = readConf(ctx), conf = effConf(R.data || {}), o = ctxOf(ctx, conf);
  const m = conf.mules.find(x => x.name === name);
  return Object.assign({ code: 200, ok: true }, charBlock(ctx, name, Object.assign({}, o, { rows: true })), { grades: m ? m.grades : [] });
}

// ------------------------------------------------------------------------------------------------------------------- write
function bad(code, error, extra) { return Object.assign({ code, error }, extra || {}); }
function post(ctx, b) {
  if (!b || typeof b !== 'object') return bad(400, 'bad body');
  const F = fileOf(ctx), Gd = guard(ctx), by = String(b.by || 'dashboard').slice(0, 40);
  fs.mkdirSync(path.dirname(F), { recursive: true });
  let result = null;
  try {
    Gd.withLock(F, () => {
      const R = readConf(ctx);
      if (R.broken) { result = bad(500, `${path.basename(F)} does not parse (${R.broken}) — fix it or restore it from history/ first`); return; }
      if (b.rev !== undefined && b.rev !== null && String(b.rev) !== R.rev) { result = bad(409, 'the mule settings were changed meanwhile — reload and try again', { rev: R.rev, conflict: true }); return; }
      const s = sanitize(b.conf, clanLeader(ctx, swarmCfg(ctx)));
      if (!s.ok) { result = bad(400, s.errors.join('; '), { errors: s.errors }); return; }
      const prev = effConf(R.data || {});
      const out = Object.assign({ _note: NOTE }, obj(R.data), s.conf, { _note: NOTE, _updated: isoNow() });
      const hist = R.exists ? Gd.saveHistory(F, path.dirname(F), 50) : null;
      const txt = JSON.stringify(out, null, 1) + '\n';
      Gd.atomicWrite(F, txt);
      const f = (c) => `${c.on ? 'on' : 'OFF'} max +${c.maxEnchant} [${c.mules.map(m => m.name + (m.grades && m.grades.length ? '(' + m.grades.join('/') + ')' : '')).join(', ')}]`;
      try { fs.appendFileSync(path.join(ctx.LOGS, 'dashboard_commands.log'), `${isoNow()}\tmules\tsave\t${by}: ${f(prev)} -> ${f(effConf(out))}\r\n`); } catch (e) { }
      result = { code: 200, ok: true, rev: sha(txt), conf: effConf(out), history: hist ? path.basename(hist) : null };
    }, { who: 'mules save' });
  } catch (e) { return bad(500, e.message); }
  return result;
}
async function handle(req, res, url, ctx) {
  const p = url.pathname;
  if (STATIC[p]) {
    res.writeHead(200, { 'Content-Type': STATIC[p], 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(path.join(ctx.DIR || __dirname, path.basename(p))));
    return true;
  }
  if (p !== '/api/mules' && p !== '/api/mules/char') return false;
  if (!ctx.allowed(req, url)) { ctx.send(res, 401, 'text/plain; charset=utf-8', 'Access denied'); return true; }
  if (p === '/api/mules/char') { const r = charInfo(ctx, url.searchParams.get('name')); const code = r.code; delete r.code; ctx.json(res, code, r); return true; }
  if (req.method === 'GET') { try { ctx.json(res, 200, info(ctx)); } catch (e) { ctx.json(res, 500, { error: e.message }); } return true; }
  if (req.method !== 'POST') { ctx.json(res, 405, { error: 'GET or POST' }); return true; }
  let b = {}; try { let t = ''; for await (const c of req) t += c; b = JSON.parse(t || '{}'); } catch (e) { ctx.json(res, 400, { error: 'bad JSON' }); return true; }
  try { const r = post(ctx, b) || bad(500, 'no result'); const code = r.code || 200; delete r.code; ctx.json(res, code, r); } catch (e) { ctx.json(res, 500, { error: e.message }); }
  return true;
}
module.exports = { handle, info, charInfo, post, sanitize, effConf, readConf, rowsOf, whIsClan, roster, fileOf, GRADES, NAME_RE };
