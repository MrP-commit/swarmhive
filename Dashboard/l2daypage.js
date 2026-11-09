// L2DAY page #/l2day (L2DAY-2026-10-31; owner: "I need a Way for Me to deliver the letters for the npc i giran town square ... x1, x5, x10 ...
// Queue x amount of deliveries for the npc based on how many we have. It's important that everyone deliver the letters to the collector in town.
// I want to see the rewards for delivering the letters nicely like look from raidboss etc.").
// Data: GET /api/l2day (Dashboard/l2day_api.js). Queue: POST /api/autoqueue { cmd: '!l2day <word> <n> <x1|x5|x10>', targets: ['char:<collector>'] }
// (the collector walks to Louie the Cat on the Giran square; swarm.js l2dayRun logs every reward). index.html globals: api, esc, iconUrl, uiConfirm.
// L2DAYMAX-2026-11-09 (owner): above the old sections one line - "Use maximum amount of letters." + one button ('!l2day max' to the collector:
// swarm.js l2dayMaxRun, exact best split, x10 / x5 / x1 chosen per click, every click checked by the letters that left the bag) and a button that
// sends '!letters' to every character in Giran that still holds letters (the normal letters hand-over to the collector). The old sections sit
// behind ONE toggle, closed by default (remembered per browser). Characters' positions: the dashboard's own STATE (/api/state).
(function () {
  'use strict';
  const SEC = 'tab-l2daypage';
  const S = { open: false, d: null, timer: 0, form: {}, tab: 'all', more: false, busy: false };
  const MORE_KEY = 'swarm.l2day.more';
  try { S.more = localStorage.getItem(MORE_KEY) === '1'; } catch (e) { }
  const $id = (i) => document.getElementById(i);
  const h = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ico = (p) => (typeof iconUrl === 'function' ? iconUrl(p) : '/icons/' + p + '.png');
  const itemIco = (g) => ico(g && g.icon);   // the API sends each reward's icon (Dashboard/data/items.json)
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const MULT = { x1: 1, x5: 5, x10: 10 };
  function flash(t, bad) { const m = $id('l2dMsg'); if (!m) return; m.hidden = false; m.className = 'l2d-msg' + (bad ? ' bad' : ''); m.textContent = t; clearTimeout(S.mt); S.mt = setTimeout(() => { m.hidden = true; }, bad ? 12000 : 7000); }
  async function load() {
    let d = null; try { d = await api('/api/l2day'); } catch (e) { d = { error: e.message }; }
    if (!d || d.error) { S.d = null; render(d && d.error ? 'The dashboard has no L2Day API yet (it needs a restart): ' + d.error : 'no answer'); return; }
    S.d = d; render();
  }
  const L = () => (S.d && S.d.letters) || [];
  const letterChip = (id, n, have) => { const l = L().find(x => x.id === Number(id)) || {}; return `<span class="l2d-lc${have != null && have < n ? ' short' : ''}" title="${h(l.name)}${have != null ? ' — have ' + fmt(have) : ''}"><img src="${ico(l.icon)}" alt="">${h(l.key)}${n > 1 ? '<b>×' + n + '</b>' : ''}</span>`; };

  function wordCards() {
    const d = S.d; return d.words.map(w => {
      const f = S.form[w.word] || (S.form[w.word] = { n: 1, mult: 'x1' }), m = MULT[f.mult] || 1, max = Math.floor(w.possible / m);
      const cost = Object.entries(w.cost).map(([id, n]) => letterChip(id, n * Math.max(1, f.n) * m, d.stock.total[id])).join('');
      return `<div class="l2d-word">
        <div class="l2d-wh"><b>${w.rank ? w.rank + '. ' : ''}${h(w.word)}</b><span class="l2d-can ${w.possible ? 'ok' : 'none'}" title="Counted in your order (best word first): the letters the better words use are not counted again${w.alone != null && w.alone !== w.possible ? ` - made alone: ${fmt(w.alone)}` : ''}">${w.possible ? `${fmt(w.possible)} possible` : 'not enough letters'}${w.alone != null && w.alone !== w.possible ? ` <small>(alone ${fmt(w.alone)})</small>` : ''}</span></div>
        <div class="l2d-cost">${cost}</div>
        <div class="l2d-form"><label>Times <input type="number" min="1" max="${Math.max(1, max)}" value="${f.n}" data-l2dn="${h(w.word)}" inputmode="numeric"></label>
          <div class="l2d-seg" role="group" aria-label="multiplier">${Object.keys(MULT).map(k => `<button type="button" class="${f.mult === k ? 'on' : ''}" data-l2dm="${h(w.word)}|${k}"${Math.floor(w.possible / MULT[k]) < 1 ? ' disabled' : ''}>${k}</button>`).join('')}</div>
          <button type="button" class="uk-btn l2d-go" data-l2dq="${h(w.word)}"${max < 1 || f.n > max ? ' disabled' : ''}>Queue ${f.n}× ${h(f.mult)}</button></div>
        <div class="l2d-sub">${max >= 1 ? `max ${fmt(max)}× at ${h(f.mult)} · ${fmt(f.n * m)} word${f.n * m === 1 ? '' : 's'}` : 'too few letters for this multiplier'}</div></div>`;
    }).join('');
  }
  function letterGrid() {
    const d = S.d; return `<div class="l2d-letters">${L().map(l => `<div class="l2d-let"><img src="${ico(l.icon)}" alt=""><b>${h(l.key)}</b><span class="t">${fmt(d.stock.total[l.id])}</span><span class="s">bag ${fmt(d.stock.bag[l.id] || 0)} · clan ${fmt(d.stock.clanWh[l.id] || 0)}</span></div>`).join('')}</div>
      <div class="l2d-note">${h(d.collector)}'s bag + the clan warehouse${d.stock.whAt ? ' (read ' + new Date(d.stock.whAt).toLocaleString() + ')' : ''}. Letters missing in his bag come out of the clan warehouse before the exchange.</div>`;
  }
  function members() {
    const m = S.d.members; if (!m.length) return '<div class="l2d-note ok">Everyone has handed their letters to the collector.</div>';
    return `<div class="l2d-mem">${m.map(x => `<a class="l2d-mr" href="#/char/${encodeURIComponent(x.name)}"><b>${h(x.name)}</b><span class="n">${fmt(x.total)}</span><span class="c">${Object.entries(x.letters).map(([id, n]) => letterChip(id, n)).join('')}</span></a>`).join('')}</div>
      <div class="l2d-note">They hand them to ${h(S.d.collector)} the next time they stand in Giran with him (letters hand-over; a party on a long hunt comes to Giran when its 12 h session ends).</div>`;
  }
  function queueBox() {
    const d = S.d, st0 = d.state, stale = st0 && st0.state === 'running' && Date.now() - Date.parse(st0.at || 0) > 10 * 60000;   // a reload / restart cut it off
    const st = stale ? Object.assign({}, st0, { state: 'cut off', msg: 'no news for 10 min (swarm.js reload / restart?) - queue the rest again' }) : st0, q =d.queue.filter(x => !/^(done|failed|cancelled|replaced|timeout)/.test(String(x.state)));
    const run = st && st.state === 'running' ? `<div class="l2d-run"><span class="dot"></span><b>${h(st.word)} ${h(st.mult)}</b> ${fmt(st.done)} / ${fmt(st.times)} · ${h(st.msg || 'exchanging')}</div>`
      : st ? `<div class="l2d-run last">Last run: <b>${h(st.word)} ${h(st.mult)}</b> ${fmt(st.done)} / ${fmt(st.times)} — ${h(st.state)}${st.msg ? ': ' + h(st.msg) : ''}</div>` : '';
    const pend = st && st.state === 'running' && Array.isArray(st.pending) && st.pending.length ? `<div class="l2d-q">${st.pending.map(p => `<div class="l2d-qi"><span>${h(p)}</span><span class="st">waiting at ${h(d.collector)}</span></div>`).join('')}</div>` : '';
    return `${run}${pend}${q.length ?`<div class="l2d-q">${q.map(x => `<div class="l2d-qi"><span>${h(x.cmd.replace(/^!l2day\s+/i, ''))}</span><span class="st">${h(x.state || 'waiting')}</span></div>`).join('')}</div>` : (run ? '' : '<div class="l2d-note">Nothing queued.</div>')}`;
  }
  function rewardsBox() {
    const R = S.d.rewards; if (!R.exchanges) return '<div class="l2d-note">No exchange yet — the rewards appear here after the first one (every item that arrived in the bag).</div>';
    const words = Object.keys(R.byWord), tab = words.includes(S.tab) ? S.tab : 'all';
    const list = tab === 'all' ? R.total : R.byWord[tab].items, ex = tab === 'all' ? R.exchanges : R.byWord[tab].exchanges;
    const rows = list.map(it => { const pct = Math.min(100, Math.round(it.times / Math.max(1, ex) * 100));
      return `<div class="rpb-it l2d-it"><img loading="lazy" src="${itemIco(it)}" alt=""><span class="n" title="${h(it.name)}">${h(it.name)}</span><span class="c"><b>${fmt(it.count)}</b> · ${fmt(it.times)}× (${pct}%)</span><span class="rpb-chance"><i style="--w:${Math.max(2, pct)}%"></i></span></div>`; }).join('');
    const hist = R.history.filter(r => tab === 'all' || r.word === tab).slice(0, 25).map(r => `<div class="l2d-hr"><span class="w">${h(r.word)} ${h(r.mult)}</span><span class="g">${(r.rewards || []).filter(g => !(g.id >= 3875 && g.id <= 3888)).map(g => `<span class="l2d-g" title="${h(g.name)}"><img src="${itemIco(g)}" alt="">${g.count > 1 ? fmt(g.count) : ''}</span>`).join('') || '<span class="muted">nothing</span>'}</span><span class="t">${new Date(r.at).toLocaleString()}</span></div>`).join('');
    return `<div class="l2d-tabs">${['all'].concat(words).map(w => `<button type="button" class="${tab === w ? 'on' : ''}" data-l2dt="${h(w)}">${w === 'all' ? 'All words' : h(w)} <small>${w === 'all' ? R.exchanges : R.byWord[w].exchanges}</small></button>`).join('')}</div>
      <div class="l2d-rw"><div class="rpb-dg"><div class="gh"><span>Rewards (${fmt(ex)} exchange${ex === 1 ? '' : 's'})</span><span class="muted">total · how often · share of exchanges</span></div>${rows || '<div class="l2d-note">nothing yet</div>'}</div>
        <div class="rpb-dg"><div class="gh"><span>Latest exchanges</span></div><div class="l2d-hist">${hist}</div></div></div>`;
  }
  // ---- L2DAYMAX: the exact best split (same algorithm as swarm.js l2dayBest; test_l2day_max.js checks they agree)
  /** stock { id: n }, words [{ word, cost: { id: n } }] -> { counts: { word: n }, words, letters } (most words, tie: most letters) */
  function bestPlan(stock, words) {
    const ids = [...new Set(words.flatMap(w => Object.keys(w.cost)))], K = ids.length, m = words.length;
    const need = new Int32Array(m * K), nz = [], val = new Float64Array(m), len = new Int32Array(m), rem = new Int32Array(K);
    words.forEach((w, i) => { ids.forEach((id, l) => { need[i * K + l] = Number(w.cost[id]) || 0; }); nz.push(ids.map((_, l) => l).filter(l => need[i * K + l] > 0));
      len[i] = Object.values(w.cost).reduce((a, b) => a + Number(b), 0); val[i] = 1000 + len[i]; });
    ids.forEach((id, l) => { rem[l] = Math.max(0, Math.floor(Number((stock || {})[id]) || 0)); });
    const bound = (i) => { const z = nz[i]; if (!z.length) return 0; let b = 2147483647; for (let t = 0; t < z.length; t++) { const q = (rem[z[t]] / need[i * K + z[t]]) | 0; if (q < b) b = q; } return b; };
    const order = words.map((_, i) => i).sort((a, b) => bound(a) - bound(b));
    const x = new Int32Array(m), bestX = new Int32Array(m); let best = -1;
    const rec = (d, acc) => {
      const i = order[d];
      if (d === order.length - 1) { const b = bound(i), v = acc + b * val[i]; if (v > best) { best = v; x[i] = b; bestX.set(x); x[i] = 0; } return; }
      const ub = bound(i), z = nz[i], oi = i * K;
      if (d === order.length - 2) {
        const j = order[d + 1], zj = nz[j], oj = j * K;
        for (let n = 0; n <= ub; n++) { let b = 2147483647; for (let t = 0; t < zj.length; t++) { const l = zj[t], q = ((rem[l] - n * need[oi + l]) / need[oj + l]) | 0; if (q < b) b = q; }
          const v = acc + n * val[i] + b * val[j]; if (v > best) { best = v; x[i] = n; x[j] = b; bestX.set(x); x[j] = 0; } }
        x[i] = 0; return;
      }
      for (let n = 0; n <= ub; n++) { x[i] = n; rec(d + 1, acc + n * val[i]); for (let t = 0; t < z.length; t++) rem[z[t]] -= need[oi + z[t]]; }
      for (let t = 0; t < z.length; t++) rem[z[t]] += need[oi + z[t]] * (ub + 1);
      x[i] = 0;
    };
    if (m) rec(0, 0);
    const counts = {}; let nw = 0, nl = 0; words.forEach((w, i) => { counts[w.word] = bestX[i]; nw += bestX[i]; nl += bestX[i] * len[i]; });
    return { counts, words: nw, letters: nl };
  }
  const clicksOf = (counts) => Object.values(counts).reduce((t, n) => t + Math.floor(n / 10) + Math.floor((n % 10) / 5) + (n % 5), 0);
  // Giran = swarm.js ijInGiran's box (town square + streets)
  const inGiran = (c) => c && Number(c.x) >= 75900 && Number(c.x) <= 85100 && Number(c.y) >= 144800 && Number(c.y) <= 152400;
  const liveChars = () => { try { return (typeof STATE !== 'undefined' && STATE && Array.isArray(STATE.chars)) ? STATE.chars : []; } catch (e) { return []; } };
  /** characters (not the collector) that report from Giran right now and hold letters: [{ name, total }] */
  function giverList() {
    const d = S.d, live = liveChars(), byName = {}; live.forEach(c => { byName[String(c.name).toLowerCase()] = c; });
    return d.members.filter(m => { const c = byName[String(m.name).toLowerCase()]; return c && Number(c.ageSec) <= 60 && inGiran(c); }).map(m => ({ name: m.name, total: m.total }));
  }
  function runningNow() {
    const st = S.d.state, fresh = st && st.state === 'running' && Date.now() - Date.parse(st.at || 0) <= 10 * 60000;
    const queued = S.d.queue.some(x => !/^(done|failed|cancelled|replaced|timeout)/.test(String(x.state)));
    return fresh ? 'an exchange is running' : queued ? 'an exchange is queued' : '';
  }
  function topLine() {
    const d = S.d, p = bestPlan(d.stock.total, d.words), busy = runningNow();
    const col = liveChars().find(c => String(c.name).toLowerCase() === String(d.collector).toLowerCase());
    const colWhere = !col ? 'not reporting' : Number(col.ageSec) > 60 ? 'not reporting' : inGiran(col) ? '' : 'not in Giran';
    const plan = p.words ? Object.keys(p.counts).filter(w => p.counts[w]).map(w => `${h(w)} <b>${fmt(p.counts[w])}</b>`).join(' · ') + ` = <b>${fmt(p.words)}</b> words, ${fmt(p.letters)} letters, ~${fmt(clicksOf(p.counts))} clicks` : 'not enough letters for one word';
    const maxWhy = !p.words ? 'not enough letters' : busy ? busy : '';
    const giv = giverList(), gl = giv.reduce((a, g) => a + g.total, 0);
    const gWhy = colWhere ? `${d.collector} is ${colWhere}` : !giv.length ? 'nobody in Giran holds letters' : '';
    S.plan = p; S.givers = giv;
    return `<div class="box l2d-top">
      <div class="l2d-maxl"><div class="l2d-maxt"><b>Use maximum amount of letters.</b><span class="muted">${plan}</span>${maxWhy && p.words ? `<span class="muted">${h(maxWhy)}</span>` : ''}</div>
        <button type="button" class="uk-btn l2d-maxgo" data-l2dmax="1"${maxWhy || S.busy ? ' disabled' : ''} title="${h(maxWhy || `${d.collector} exchanges everything: the best split, x10 / x5 / x1 chosen per click`)}">Exchange all${p.words ? ' (' + fmt(p.words) + ')' : ''}</button></div>
      <div class="l2d-gath"><button type="button" class="uk-btn" data-l2dgather="1"${gWhy || S.busy ? ' disabled' : ''} title="${h(gWhy || giv.map(g => g.name + ' ' + fmt(g.total)).join(', '))}">Collect letters in Giran${giv.length ? ` (${giv.length} char${giv.length === 1 ? '' : 's'} · ${fmt(gl)} letters)` : ''}</button>
        <span class="muted">${h(gWhy || 'to ' + d.collector + ': ' + giv.map(g => g.name).join(', '))}</span></div>
    </div>`;
  }

  function section() {
    let s = $id(SEC); if (s) return s;
    s = document.createElement('section'); s.id = SEC; s.className = 'win l2d'; s.hidden = true;
    s.innerHTML = `<div class="l2d-head"><h2>L2Day letters</h2><span class="muted">Louie the Cat (Event Manager) on the Giran square: the longer the word, the better the reward.</span></div><div class="l2d-msg" id="l2dMsg" hidden></div><div id="l2dBody"></div>`;
    (document.querySelector('main') || document.body).appendChild(s);
    s.addEventListener('click', onClick); s.addEventListener('input', onInput);
    return s;
  }
  function render(err) {
    section(); const b = $id('l2dBody'); if (!b) return;
    if (!S.d) { b.innerHTML = `<div class="box l2d-note">${h(err || 'Loading…')}</div>`; return; }
    b.innerHTML = `${topLine()}
      <button type="button" class="l2d-more" data-l2dmore="1" aria-expanded="${S.more ? 'true' : 'false'}"><span class="ar">${S.more ? '▾' : '▸'}</span>${S.more ? 'Hide' : 'Show'} exchange by word, queue, rewards and letters</button>
      <div class="l2d-grid"${S.more ? '' : ' hidden'}>
      <div class="box l2d-ex"><h3>Exchange <span class="muted">by ${h(S.d.collector)}, one run at a time (queue)</span></h3><div class="l2d-words">${wordCards()}</div></div>
      <div class="box l2d-qbox"><h3>Queue</h3>${queueBox()}</div>
      <div class="box l2d-rbox"><h3>Rewards</h3>${rewardsBox()}</div>
      <div class="box"><h3>Letters</h3>${letterGrid()}</div>
      <div class="box"><h3>Not delivered yet <span class="muted">${S.d.members.length ? fmt(S.d.members.reduce((a, m) => a + m.total, 0)) + ' letters' : ''}</span></h3>${members()}</div></div>`;
  }
  function onInput(ev) { const t = ev.target; if (t.dataset.l2dn === undefined) return; const f = S.form[t.dataset.l2dn]; if (!f) return; f.n = Math.max(1, Math.floor(Number(t.value) || 1)); const pos = t.selectionStart; render(); const n = document.querySelector(`[data-l2dn="${t.dataset.l2dn}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }
  async function onClick(ev) {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.l2dt) { S.tab = t.dataset.l2dt; render(); return; }
    if (t.dataset.l2dmore) { S.more = !S.more; try { localStorage.setItem(MORE_KEY, S.more ? '1' : '0'); } catch (e) { } render(); return; }
    if (t.dataset.l2dmax) { await queueMax(); return; }
    if (t.dataset.l2dgather) { await gather(); return; }
    if (t.dataset.l2dm) { const [w, m] = t.dataset.l2dm.split('|'); S.form[w].mult = m; render(); return; }
    if (t.dataset.l2dq) {
      const w = t.dataset.l2dq, f = S.form[w], word = S.d.words.find(x => x.word === w), m = MULT[f.mult];
      if (!word || f.n * m > word.possible) { flash('Not enough letters for that many.', true); return; }
      const confirmFn = window.uiConfirm || (window.UIDialog && window.UIDialog.confirm);
      const ok = confirmFn ? await confirmFn({ title: `Queue ${f.n}× ${w} ${f.mult}?`, body: `${S.d.collector} takes the letters out of the clan warehouse if needed, walks to Louie the Cat on the Giran square and claims ${w} ${f.mult} ${f.n} time${f.n === 1 ? '' : 's'} (${f.n * m} words). Every reward is recorded here.`, confirmText: 'Queue it' }) : (flash('The confirm dialog is missing (uidialog.js) - nothing queued.', true), false);
      if (!ok) return;
      try { const r = await api('/api/autoqueue', { method: 'POST', body: JSON.stringify({ cmd: `!l2day ${w} ${f.n} ${f.mult}`, targets: ['char:' + S.d.collector], by: 'dashboard L2Day page (owner)' }) });
        if (!r || !r.ok) { flash('Not queued: ' + ((r && r.error) || 'no answer'), true); return; }
        flash(`Queued: ${w} ${f.mult} × ${f.n}${r.position ? ' (place ' + r.position + ')' : ''}.`); load();
      } catch (e) { flash('Not queued: ' + e.message, true); }
    }
  }
  const confirmFn = () => window.uiConfirm || (window.UIDialog && window.UIDialog.confirm);
  async function queueMax() {
    const d = S.d, p = S.plan; if (!p || !p.words) { flash('Not enough letters for one word.', true); return; }
    const cf = confirmFn(); if (!cf) { flash('The confirm dialog is missing (uidialog.js) - nothing queued.', true); return; }
    const split = Object.keys(p.counts).filter(w => p.counts[w]).map(w => `${w} ${p.counts[w]}`).join(', ');
    if (!await cf({ title: `Exchange all letters (${fmt(p.words)} words)?`, body: `${d.collector} takes what his bag lacks out of the clan warehouse, walks to Louie the Cat and exchanges ${split} - each click with the biggest button that fits (x10 / x5 / x1), about ${fmt(clicksOf(p.counts))} clicks. Every click is checked by the letters that leave the bag and every reward is recorded here.`, confirmText: 'Exchange all' })) return;
    S.busy = true; render();
    try { const r = await api('/api/autoqueue', { method: 'POST', body: JSON.stringify({ cmd: '!l2day max', targets: ['char:' + d.collector], by: 'dashboard L2Day page (owner): maximum' }) });
      if (!r || !r.ok) flash('Not queued: ' + ((r && r.error) || 'no answer'), true); else flash(`Queued: exchange all (${fmt(p.words)} words)${r.position ? ' (place ' + r.position + ')' : ''}.`);
    } catch (e) { flash('Not queued: ' + e.message, true); }
    S.busy = false; load();
  }
  async function gather() {
    const d = S.d, giv = S.givers || []; if (!giv.length) { flash('Nobody in Giran holds letters.', true); return; }
    const cf = confirmFn(); if (!cf) { flash('The confirm dialog is missing (uidialog.js) - nothing sent.', true); return; }
    if (!await cf({ title: `Collect letters from ${giv.length} character${giv.length === 1 ? '' : 's'}?`, body: `${giv.map(g => `${g.name} (${fmt(g.total)})`).join(', ')} walk over to ${d.collector} in Giran and trade him their letters (the letters hand-over). Wait until they are done before you exchange.`, confirmText: 'Collect' })) return;
    S.busy = true; render();
    try { const r = await api('/api/command', { method: 'POST', body: JSON.stringify({ cmd: '!letters', targets: ['chars:' + giv.map(g => g.name).join(',')], by: 'dashboard L2Day page (owner): collect in Giran' }) });
      if (!r || r.error) flash('Not sent: ' + ((r && r.error) || 'no answer'), true); else flash(`Sent to ${giv.map(g => g.name).join(', ')}: hand the letters to ${d.collector}.`);
    } catch (e) { flash('Not sent: ' + e.message, true); }
    S.busy = false; load();
  }
  function open() { S.open = true; section().hidden = false; load(); clearInterval(S.timer); S.timer = setInterval(() => { if (S.open && !document.hidden && !document.activeElement.matches('[data-l2dn]')) load(); }, 10000); }
  function close() { if (!S.open) return; S.open = false; clearInterval(S.timer); const s = $id(SEC); if (s) s.hidden = true; }
  function route(kind) {
    if (kind !== 'l2day') { close(); return false; }
    try { document.querySelectorAll('main > section').forEach(x => { if (x.id !== SEC) x.hidden = true; }); } catch (e) { }
    try { TAB = 'l2day'; } catch (e) { }
    try { const T = document.getElementById('tabs'); if (T) [...T.children].forEach(b => b.classList.toggle('on', b.dataset.tab === 'l2day')); } catch (e) { }
    open(); return true;
  }
  window.L2DayPage = { route, open, close, _state: S };
})();
