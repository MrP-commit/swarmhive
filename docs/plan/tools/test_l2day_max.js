// test_l2day_max.js - guard for L2DAYMAX-2026-11-09 ('!l2day max': the exact best split, x10 / x5 / x1 per click, every click measured;
// the L2Day page's "Use maximum amount of letters." line + "Collect letters in Giran" + the one toggle). Sandbox only.
//   node docs/plan/tools/test_l2day_max.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.L2DAY_ROOT || path.join(__dirname, '..', '..', '..');
const SWARM = process.env.L2DAY_SWARM || path.join(ROOT, 'Scripts_dev', 'swarm.js');
const PAGE = process.env.L2DAY_PAGE || path.join(ROOT, 'Dashboard', 'l2daypage.js');
let ok = 0, fail = 0;
const t = (good, msg, extra) => { if (good) { ok++; console.log('ok   ' + msg); } else { fail++; console.log('FAIL ' + msg + (extra ? ' - ' + extra : '')); } };
const SRC = fs.readFileSync(SWARM, 'utf8'), PG = fs.readFileSync(PAGE, 'utf8');
const fnSrc = (S, name) => { const i = S.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = S.indexOf('{', i); for (; j < S.length; j++) { if (S[j] === '{') d++; else if (S[j] === '}' && --d === 0) break; } return (S.slice(Math.max(0, i - 6), i) === 'async ' ? 'async ' : '') + S.slice(i, j + 1); };
const a = SRC.indexOf('// L2DAY-PURE ('), b = SRC.indexOf('// L2DAY-PURE-END');
const PURE = `const npcString = (id) => String(id);\n${fnSrc(SRC, 'cleanBypass')}\n${fnSrc(SRC, 'htmlText')}\n${fnSrc(SRC, 'npcLinks')}\n${SRC.slice(a, b)}`;
const P = new Function(`${PURE}\nreturn { L2DAY_LETTER, L2DAY_WORDS, L2DAY_MULT, l2dayNeed, l2dayPossible, l2dayLink, l2dayBest, l2dayMultFor, l2daySetsGone, l2dayClicks, npcLinks };`)();
const L = P.L2DAY_LETTER, W = Object.keys(P.L2DAY_WORDS);
const st = (o) => { const s = {}; Object.keys(o).forEach(k => { s[L[k]] = o[k]; }); return s; };

// --- R1 the plan is the exact optimum (brute force on small stocks, any weights)
t(typeof P.l2dayBest === 'function', 'swarm.js L2DAY-PURE has l2dayBest');
const valOf = (x, wt) => W.reduce((s, w, i) => s + x[i] * ((wt ? wt[w] : 1) * 1000 + P.L2DAY_WORDS[w].length), 0);
let mism = 0, over = 0;
for (let k = 0; k < 250; k++) {
  const s = {}; Object.values(L).forEach(id => { s[id] = Math.floor(Math.random() * 22); });
  const wt = k % 3 ? null : Object.fromEntries(W.map(w => [w, 1 + Math.floor(Math.random() * 3)]));
  const r = P.l2dayBest(s, wt), x = W.map(w => r.counts[w]);
  const used = {}; W.forEach((w, i) => { const n = P.l2dayNeed(w, x[i]); Object.keys(n).forEach(id => { used[id] = (used[id] || 0) + n[id]; }); });
  if (Object.keys(used).some(id => used[id] > (s[id] || 0))) over++;
  let best = -1; const ub = W.map(w => P.l2dayPossible(s, w));
  for (let p = 0; p <= ub[0]; p++) for (let q = 0; q <= ub[1]; q++) for (let u = 0; u <= ub[2]; u++) for (let v = 0; v <= ub[3]; v++) {
    const y = [p, q, u, v], need = {}; W.forEach((w, i) => { const n = P.l2dayNeed(w, y[i]); Object.keys(n).forEach(id => { need[id] = (need[id] || 0) + n[id]; }); });
    if (Object.keys(need).some(id => need[id] > (s[id] || 0))) continue; const val = valOf(y, wt); if (val > best) best = val; }
  if (valOf(x, wt) !== best) mism++;
}
t(mism === 0 && over === 0, 'l2dayBest = brute-force optimum on 250 random stocks (incl. weights), never a letter over-used', `mismatch ${mism}, over ${over}`);
// the real stock of the v1.4 run (2026-10-24): 690 words, 4594 letters, 74 clicks
const run24 = st({ II: 260, A: 168, C: 153, E: 592, F: 184, G: 411, H: 330, I: 145, L: 399, N: 575, O: 697, R: 349, S: 177, T: 636 });
const t0 = Date.now(), p24 = P.l2dayBest(run24), ms = Date.now() - t0;
t(p24.counts.LineageII === 55 && p24.counts.LIIToggle === 172 && p24.counts.NCSoft === 153 && p24.counts.Throne === 310 && p24.words === 690 && p24.letters === 4594, 'the 2026-10-24 stock: LineageII 55, LIIToggle 172, NCSoft 153, Throne 310 = 690 words (v1.4 result)', JSON.stringify(p24));
t(P.l2dayClicks(p24.counts) === 74, '690 words = 74 clicks with x10 / x5 / x1');
const big = st({ L: 1220, O: 1263, G: 1198, I: 403, C: 370, E: 1531, T: 1224, A: 421, R: 440, S: 399, II: 809, F: 416, N: 1174, H: 451 });
const t1 = Date.now(), pb = P.l2dayBest(big), msb = Date.now() - t1;
t(pb.words === 1562 && pb.letters === 10908, 'a big stock (2026-10-18): 1562 words, 10908 letters', JSON.stringify(pb));
t(msb < 5000, `fast enough for swarm.js (big stock ${msb} ms, small ${ms} ms)`);
t(P.l2dayBest({}).words === 0, 'no letters = 0 words');

// --- R2 the button and the measurement
t(P.l2dayMultFor(55, 60) === 'x10' && P.l2dayMultFor(5, 60) === 'x5' && P.l2dayMultFor(4, 60) === 'x1' && P.l2dayMultFor(55, 7) === 'x5' && P.l2dayMultFor(3, 0) === null, 'biggest button that fits what is left AND the sets in the bag');
const bb = { [L.T]: 20, [L.H]: 10, [L.R]: 10, [L.O]: 10, [L.N]: 10, [L.E]: 10 }, ba = { [L.T]: 10, [L.H]: 0, [L.R]: 0, [L.O]: 0, [L.N]: 0, [L.E]: 0 };
t(P.l2daySetsGone(bb, ba, 'Throne') === 10 && P.l2daySetsGone(bb, bb, 'Throne') === 0 && P.l2daySetsGone(bb, Object.assign({}, bb, { [L.T]: 19 }), 'Throne') === 0, 'a click counts the WHOLE words that left the bag');

// --- R3 the run (mocked game): plan over bag + clan warehouse, warehouse first, then x10/x5/x1, page rows like Louie's
function sim(opts) {
  opts = opts || {};
  const bag = {}, names = {}; Object.keys(L).forEach(k => { names[L[k]] = 'L2Day - ' + k; });
  Object.entries(opts.bag || {}).forEach(([id, n]) => { bag[id] = n; });
  const wh = Object.assign({}, opts.wh || {});
  const log = [], files = {}, notes = [], clicks = [];
  let codes = {}, open = false, tNow = 0, errand = null;
  const page = () => { codes = {}; let i = 0; const c = () => { const k = (i++).toString(16).padStart(2, '0'); return k; };
    const rows = W.map(w => { const a1 = c(), a5 = c(), a10 = c(); codes[a1] = [w, 1]; codes[a5] = [w, 5]; codes[a10] = [w, 10];
      return `<tr><td><a action="bypass -h ${a1}">${w}</a></td><td><a action="bypass -h ${a5}">x5</a></td><td><a action="bypass -h ${a10}">x10</a></td></tr>`; });
    return `<html><body>Louie the Cat:<br>The longer the word, the better the reward!<table>${rows.join('')}</table></body></html>`; };
  const env = {
    SWARM_ROOT: 'E:\\L2Swarm', L2DAY: { busy: true, pending: [] }, HOV: { busy: false, host: { ctl: false } }, tradeState: null, lastSysMsg: null,
    Me: { Name: 'Mats', IsDead: false }, Options: { ActiveFollow: true },
    now: () => tNow, sleep: async (ms) => { tNow += ms; }, num: (v) => Number(v) || 0,
    note: (m) => notes.push(m), logError: (w, e) => notes.push('ERR ' + w + ' ' + e),
    File: { WriteAllText: (p, s) => { files[p] = s; }, ReadAllText: (p) => { if (/clan_state/.test(p)) return JSON.stringify({ warehouse: { items: Object.entries(wh).map(([id, count]) => ({ id: Number(id), count })) } }); throw new Error('no ' + p); } },
    appendShared: (p, s) => log.push(JSON.parse(s)),
    orderReplaced: (seq) => !!opts.replaceAfter && clicks.length >= opts.replaceAfter,
    ijInGiran: () => opts.giran !== false,
    errandStart: (k) => { errand = k; }, errandEnd: (k) => { if (errand === k) errand = null; },
    bagCounts: () => { const c = {}; Object.keys(bag).forEach(id => { if (bag[id] > 0) { c[id] = bag[id]; c['n' + id] = names[id] || 'item ' + id; } }); return c; },
    whTake: async (kind, miss) => { miss.forEach(m => { const n = Math.min(m.count, wh[m.id] || 0); wh[m.id] = (wh[m.id] || 0) - n; bag[m.id] = (bag[m.id] || 0) + n; }); return { ok: true, msg: 'took' }; },
    snapNpcs: () => [{ Name: 'Louie the Cat', ref: { objId: 7 } }], giranPlaceNear: () => null, ijGiranGo: async () => { },
    openNpc: async () => { open = true; return page(); },
    Send: { ReqBypassToServer: (cmd) => {
      clicks.push(cmd); if (!open || !codes[cmd]) { env.lastSysMsg = { at: tNow, text: 'refused' }; return; }
      open = false;                                                    // L2Toggle: an exchange closes the window
      let [w, m] = codes[cmd]; if (opts.lie) m = 1;                    // a server whose x10 only exchanges one word
      if (opts.refuse) return;
      const need = P.l2dayNeed(w, m); if (Object.keys(need).some(id => (bag[id] || 0) < need[id])) return;
      Object.keys(need).forEach(id => { bag[id] -= need[id]; }); bag[9000] = (bag[9000] || 0) + m; names[9000] = 'Prize';
    } },
  };
  const names2 = Object.keys(env);
  const fn = new Function(...names2, `${PURE}\n${fnSrc(SRC, 'l2dayBagLetters')}\n${fnSrc(SRC, 'l2dayClanWh')}\n${fnSrc(SRC, 'l2dayPlanText')}\n${fnSrc(SRC, 'l2dayMaxRun')}\nreturn l2dayMaxRun;`);
  const run = fn(...names2.map(k => env[k]));
  return { run, bag, wh, log, files, notes, clicks, env, get errand() { return errand; } };
}
(async () => {
  {
    const s = sim({ bag: { [L.L]: 100, [L.I]: 145, [L.N]: 575, [L.E]: 592, [L.A]: 168, [L.G]: 411, [L.II]: 260, [L.C]: 153, [L.S]: 177, [L.O]: 697, [L.F]: 184, [L.T]: 636, [L.H]: 330, [L.R]: 349 }, wh: { [L.L]: 299 } });
    const r = await s.run(1);
    const stf = JSON.parse(Object.entries(s.files).find(([k]) => /l2day_state\.json$/.test(k))[1]);
    t(/690\/690 words/.test(r) && stf.state === 'done' && stf.done === 690 && stf.clicks === 74, 'the 2026-10-24 stock (L partly in the clan warehouse): 690 words in 74 clicks, state done', r + ' ' + JSON.stringify({ done: stf.done, clicks: stf.clicks }));
    t((s.wh[L.L] || 0) === 0 && s.bag[L.L] === 0, 'the letters the bag lacked came out of the clan warehouse first');
    t(s.log.length === 74 && s.log.every(x => x.run === 'max' && x.words >= 1 && /^x(1|5|10)$/.test(x.mult)) && s.log.reduce((a, x) => a + x.words, 0) === 690, 'every click logged (run max, words, mult) - 690 words in Logs/l2day_rewards.log');
    t(s.log.filter(x => x.mult === 'x10').length === 68 && s.log.filter(x => x.mult === 'x5').length === 1, 'x10 wherever it fits (68 x10, 1 x5, 5 x1)');
    t(s.log.every(x => x.rewards.some(g => g.id === 9000)), 'the rewards of each click are recorded');
    t(s.errand === null && s.env.Options.ActiveFollow === false, 'errand l2day held during the run (follow off), ended after it');
  }
  {
    const s = sim({ bag: { [L.T]: 23, [L.H]: 23, [L.R]: 23, [L.O]: 23, [L.N]: 23, [L.E]: 23 }, lie: true });
    const r = await s.run(1);
    t(/23\/23 words/.test(r) && s.log.every(x => x.words === 1), 'a button that exchanges fewer words than it says: measured, still everything (23 words)', r);
  }
  {
    const s = sim({ bag: { [L.T]: 23, [L.H]: 23, [L.R]: 23, [L.O]: 23, [L.N]: 23, [L.E]: 23 }, refuse: true });
    const r = await s.run(1);
    t(/no letters left the bag 3 times/.test(r) && s.clicks.length === 3, 'no letters leave the bag 3 times: the run stops (3 clicks)', r);
  }
  {
    const s = sim({ bag: { [L.T]: 50, [L.H]: 50, [L.R]: 50, [L.O]: 50, [L.N]: 50, [L.E]: 50 }, replaceAfter: 2 });
    const r = await s.run(1);
    t(/a newer order came/.test(r) && s.clicks.length === 2, 'a newer owner order stops it', r);
  }
  {
    const s = sim({ bag: { [L.T]: 5 }, giran: false });
    t(/not in Giran/.test(await s.run(1)), 'only in Giran');
  }
  {
    const s = sim({ bag: { [L.T]: 1 } });
    t(/not enough letters for one word/.test(await s.run(1)), 'too few letters: says so, clicks nothing');
  }

  // --- R4 dispatch: '!l2day max' joins the same queue as the word orders, only the collector runs it
  const hs = SRC.slice(SRC.indexOf("if (cmd === '!l2day')"), SRC.indexOf("if (cmd === '!l2day')") + 2000);
  t(/=== 'max'\) L2DAY\.pending\.push\(\{ max: true/.test(hs) && /j\.max \? await l2dayMaxRun\(j\.seq\)/.test(hs) && /stashLetterReceiver/.test(hs), "'!l2day max' -> l2dayMaxRun, queued like the word orders, collector only");
  const mr = fnSrc(SRC, 'l2dayMaxRun');
  t(/errandStart\('l2day'/.test(mr) && /errandEnd\('l2day'\)/.test(mr) && /HOV\.busy \|\| HOV\.host\.ctl \|\| tradeState/.test(mr), 'the run holds an errand (no follow) and waits for a letters hand-over to end');
  t(/\$\{SWARM_ROOT\}\\\\Logs\\\\l2day_/.test(mr), 'Logs paths keep their double backslashes');

  // --- R5 the page: the same plan, the top line, the toggle closed by default, the two orders
  const bp = fnSrc(PG, 'bestPlan');
  t(!!bp, 'the page has bestPlan');
  const BP = new Function(bp + '\nreturn bestPlan;')();
  const words = W.map(w => ({ word: w, cost: P.l2dayNeed(w, 1) }));
  let diff = 0;
  for (let k = 0; k < 200; k++) { const s = {}; Object.values(L).forEach(id => { s[id] = Math.floor(Math.random() * (k % 2 ? 40 : 400)); });
    const x = P.l2dayBest(s), y = BP(s, words); if (W.some(w => x.counts[w] !== y.counts[w])) diff++; }
  t(diff === 0, 'the page shows exactly the split swarm.js will exchange (200 random stocks)', diff + ' differ');
  t(/Use maximum amount of letters\./.test(PG), 'the page says "Use maximum amount of letters."');
  t(/cmd: '!l2day max', targets: \['char:' \+ d\.collector\]/.test(PG) && /\/api\/autoqueue/.test(PG), "the button queues '!l2day max' to the collector (autoqueue)");
  t(/cmd: '!letters', targets: \['chars:' \+ giv\.map/.test(PG) && /inGiran\(c\)/.test(PG) && /ageSec\) <= 60/.test(PG), "collect = '!letters' to the characters reporting from Giran that hold letters");
  t(/S\.more \? '' : ' hidden'/.test(PG) && /more: false/.test(PG) && /localStorage\.getItem\(MORE_KEY\) === '1'/.test(PG), 'the old sections sit behind one toggle, closed by default');
  t(/uiConfirm/.test(PG) && !/window\.confirm\(|alert\(/.test(PG), 'both buttons ask first (uiConfirm), never a browser alert');
  console.log(`\nl2day max: ${ok} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
