// MULES page #/mules (MULES-2026-11-06, owner: "add a Mules tab with the Decrease Weight icon: characters I pick there are searched for the
// needed items like the clan warehouse / private warehouse / inventory are at gear-up; show what they hold like Storage -> Clan warehouse").
// Edits Scripts/data/gear_suppliers.json (read live by swarm.js SUPPLY gsaSupConf / gsaSuppliers at every !gearup, 60 s cache): which characters,
// in which order, which gear grades each one gives, the highest enchant taken from anyone, the switch. Shows every mule's bag + private warehouse
// record (search, groups, grade, source) and why the gear-up skips a mule right now (not in Hive's account list / offline / switched off).
// Data: Dashboard/mulespage_api.js (GET/POST /api/mules, GET /api/mules/char?name=). Orders: "!whlook <name>" through /api/command.
// Uses index.html globals: esc, api, iconUrl, stopChar, TAB and uidialog's uiConfirm / uiAlert / uiError / uiList / uiP / uiEm / uiWarn / uiNote.
// Reuses the Storage page's clan warehouse list styles (storagepage.css .stg-cwh*) + Dashboard/mulespage.css. No browser alert / confirm / prompt.
(function () {
  'use strict';
  const SEC = 'tab-mulespage';
  const MP = { open: false, info: null, orig: null, cur: null, rev: '', busy: false, timer: 0, msgT: 0, preview: null, who: '', src: '', q: '', cat: '', grade: '', usable: false, addQ: '' };
  const $id = (i) => document.getElementById(i);
  const h = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ico = (p) => (typeof iconUrl === 'function' ? iconUrl(p) : '/icons/' + p + '.png');
  const clone = (o) => JSON.parse(JSON.stringify(o == null ? {} : o));
  const ICON = 'icon/skill1257';   // Decrease Weight (Elven Elder)
  const GRADES = ['NONE', 'D', 'C', 'B', 'A', 'S', 'S80', 'S84'];
  const gName = (g) => g === 'NONE' ? 'No grade' : g;
  // = storagepage.js CWH_CATS (the same groups and order as Storage -> Clan warehouse)
  const CATS = [['weapon', 'Weapons'], ['armor', 'Armor'], ['accessory', 'Accessories'], ['material', 'Materials'], ['part', 'Crafting parts'], ['recipe', 'Recipes'], ['scroll', 'Scrolls'], ['letter', 'Event letters'], ['use', 'Potions & consumables'], ['stone', 'Life stones & seal stones'], ['other', 'Other']];
  const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - (Date.parse(t) || 0)) / 60000); return m < 2 ? 'just now' : m < 120 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const kmb = (n) => { n = Number(n || 0); return n >= 1e9 ? (n / 1e9).toFixed(2) + ' bn' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n.toLocaleString(); };
  const comparable = (c) => JSON.stringify({ on: !!(c && c.on), maxEnchant: Number(c && c.maxEnchant), mules: ((c && c.mules) || []).map(m => ({ name: m.name, grades: (m.grades || []).slice() })) });
  const dirty = () => MP.cur && MP.orig && comparable(MP.cur) !== comparable(MP.orig);
  const charOf = (n) => ((MP.info && MP.info.candidates) || []).find(c => c.name === n) || null;
  const blockOf = (n) => { const I = MP.info || {}; if (I.leader && I.leader.name === n) return I.leader; return (I.mules || []).find(m => m.name === n) || (MP.preview && MP.preview.name === n ? MP.preview : null); };

  // ============================================================================================ data
  async function load(keepEdits) {
    let d = null;
    try { d = await api('/api/mules'); } catch (e) { flash('The dashboard server has no Mules API yet — restart the dashboard once (PC tab).', true); render(); return; }
    if (!d || d.error) { flash((d && d.error) || 'no answer', true); render(); return; }
    if (d.broken) flash(`gear_suppliers.json does not parse (${d.broken}) — saving is blocked until it is fixed or restored from Scripts/data/history/.`, true);
    MP.info = d;
    if (!keepEdits || !dirty()) { MP.orig = clone(d.conf); MP.cur = clone(d.conf); MP.rev = d.rev; }
    else if (d.rev !== MP.rev) flash('Someone else saved the mule settings meanwhile. Undo your changes to see theirs, or save to overwrite (you will be asked).', true);
    render();
  }
  async function refresh() {
    let d = null; try { d = await api('/api/mules'); } catch (e) { return; }
    if (!d || d.error || !MP.open) return;
    MP.info = d;
    if (!dirty() && d.rev !== MP.rev) { MP.orig = clone(d.conf); MP.cur = clone(d.conf); MP.rev = d.rev; }
    const a = document.activeElement, s = $id(SEC);
    if (a && s && s.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;   // never redraw under the cursor / phone keyboard
    render();
  }

  // ============================================================================================ frame
  function section() {
    let s = $id(SEC); if (s) return s;
    s = document.createElement('section'); s.id = SEC; s.className = 'win cpl fnd stg mul'; s.hidden = true;
    s.innerHTML = `<div class="cpl-headrow fnd-head"><h2><img class="gi" src="${ico(ICON)}" alt=""> Mules</h2>
        <span class="muted cpl-intro">Characters whose bag and private warehouse a gear-up (<code>!gearup</code>, “Better gear now”) also searches for the pieces it needs — before it buys anything. Read live by every bot.</span></div>
      <div class="cpl-msg" id="mulMsg" role="status" hidden></div>
      <details class="box mul-fold" data-mulfold="set"><summary><h3>Search order</h3></summary><div id="mulSet"></div></details>
      <details class="box mul-fold" data-mulfold="list"><summary><h3>Mules</h3></summary><div id="mulList"></div></details>
      <details class="box mul-fold" data-mulfold="add"><summary><h3>Add characters</h3></summary><div id="mulAdd"></div></details>
      <details class="box mul-fold" id="mulHoldBox" data-mulfold="hold"><summary><h3>What they hold</h3></summary><div id="mulHold"></div></details>
      <details class="box cpl-help mul-fold" data-mulfold="help"><summary><h3>How it works</h3></summary><div class="cpl-helpbody">
        <p><b>Order.</b> For every piece its plan wants, a gear-up looks in: its own bag → its own warehouse → the clan leader (bag + warehouse) → the mules here, top first → the clan warehouse → only then it buys. The highest enchant found anywhere wins (a sealed +6 before an unsealed +5; unsealed at the blacksmith keeping the enchant).</p>
        <p><b>The mule hands it over itself.</b> It must be in Hive's account list (Accounts tab) and logged in: it takes the piece out of its own warehouse in Giran and trades it. An offline mule is skipped and the piece is bought or taken from the clan warehouse instead.</p>
        <p><b>Grades.</b> A mule set to “A” gives only A-grade gear pieces (gemstones for an A weapon too). No grade picked = every grade.</p>
        <p><b>Never given:</b> worn pieces, pieces above the highest enchant set here, anything at +10 or higher. Those rows are shown faded with the reason.</p>
        <p><b>Records.</b> The bag list is written by the bot every few minutes while the mule is logged in; the warehouse list only when it opens its warehouse — <i>Look in its warehouse now</i> (<code>!whlook</code>) refreshes it. A warehouse list that is really the clan warehouse list is ignored.</p>
      </div></details>
      <div class="fnd-bar" id="mulBar"></div>`;
    (document.querySelector('main') || document.body).appendChild(s);
    // FOLD-2026-11-06 (owner: "the lists should fold like How it works"): every box folds; open / closed is remembered per browser (How it works starts closed)
    s.querySelectorAll('details[data-mulfold]').forEach(d => { const k = d.dataset.mulfold, v = foldGet(k); d.open = v === null ? k !== 'help' : v; });
    s.addEventListener('toggle', (e) => { const d = e.target; if (d && d.dataset && d.dataset.mulfold) foldSet(d.dataset.mulfold, d.open); }, true);
    s.addEventListener('click', onClick);
    s.addEventListener('change', onChange);
    s.addEventListener('input', (e) => {
      const t = e.target; if (!t || !t.dataset) return;
      if (t.dataset.mulq !== undefined) { MP.q = t.value; renderHoldList(); }
      if (t.dataset.muladdq !== undefined) { MP.addQ = t.value; renderAddList(); }
    });
    return s;
  }
  function foldGet(k) { try { const v = localStorage.getItem('swarm.mules.fold.' + k); return v === null ? null : v === '1'; } catch (e) { return null; } }
  function foldSet(k, open) { try { localStorage.setItem('swarm.mules.fold.' + k, open ? '1' : '0'); } catch (e) { } }
  /** open a folded box before scrolling to it ("Show what it holds", "Show") */
  function unfold(id) { const b = $id(id); if (b && b.tagName === 'DETAILS' && !b.open) b.open = true; return b; }
  function route(kind, arg) {
    if (kind !== 'mules') { close(); return false; }
    if (arg) MP.who = decodeURIComponent(arg);   // #/mules/<name> opens with that mule's list
    open();
    return true;
  }
  function open() {
    const s = section();
    try { stopChar(); } catch (e) { }
    try { TAB = 'mules'; } catch (e) { }
    try { [...$id('tabs').children].forEach(b => b.classList.toggle('on', b.dataset.tab === 'mules')); } catch (e) { }
    document.querySelectorAll('main > section').forEach(x => { if (x.id !== SEC) x.hidden = true; });
    const was = MP.open; s.hidden = false; MP.open = true;
    if (!was) window.scrollTo(0, 0);
    if (!MP.timer) MP.timer = setInterval(() => { if (MP.open && !document.hidden) refresh(); }, 30000);
    render(); load(true);
  }
  function close() { if (!MP.open) return; MP.open = false; clearInterval(MP.timer); MP.timer = 0; const s = $id(SEC); if (s) s.hidden = true; }
  function flash(t, bad) {
    const m = $id('mulMsg'); if (!m) return;
    m.hidden = !t; m.className = 'cpl-msg' + (bad ? ' bad' : ''); m.textContent = t || '';
    clearTimeout(MP.msgT); MP.msgT = setTimeout(() => { const x = $id('mulMsg'); if (x) x.hidden = true; }, bad ? 15000 : 7000);
  }

  // ============================================================================================ render
  function render() { renderSet(); renderList(); renderAdd(); renderHold(); renderBar(); }
  function statusHtml(c, savedMule) {
    if (!c) return '<span class="mul-st bad">no record of this character yet</span>';
    const bits = [];
    bits.push(`<span class="dot ${c.online ? 'on' : ''}"></span>${c.online ? 'online' : 'offline'}`);
    if (c.level) bits.push(`${c.level}${c.cls ? ' ' + h(c.cls) : ''}`);
    bits.push(`bag ${c.bagAt ? ago(c.bagAt) : '—'}`);
    bits.push(c.whClan ? '<span class="bad">warehouse list = the clan list (ignored)</span>' : `warehouse ${c.whAt ? ago(c.whAt) : 'never read'}`);
    if (c.adena) bits.push(`${kmb(c.adena)} adena`);
    const st = !savedMule ? '<span class="mul-st">not saved yet</span>' : c.used ? '<span class="mul-st ok">searched now</span>' : `<span class="mul-st bad">skipped: ${h(c.why.join('; '))}</span>`;
    return `${st}<span class="mul-meta">${bits.join(' · ')}</span>`;
  }
  function renderSet() {
    const el = $id('mulSet'); if (!el) return;
    const C = MP.cur, I = MP.info;
    if (!C) { el.innerHTML = '<div class="muted">Loading…</div>'; return; }
    const CL = (I && I.clanLeader) || '', L = (I && I.leader) || null;
    const steps = ['its own bag', 'its own warehouse', CL ? `${h(CL)} (clan leader)` : 'the clan leader', C.on ? (C.mules.length ? C.mules.map(m => `<b>${h(m.name)}</b>`).join(' → ') : '<i>no mules yet</i>') : '<s>mules</s> (off)', 'the clan warehouse', 'buy'];
    el.innerHTML = `<div class="mul-order">${steps.map((s, i) => `<span class="mul-step">${i + 1}. ${s}</span>`).join('<span class="mul-arr">→</span>')}</div>
      ${L && !L.used ? `<div class="fnd-hint bad">The clan leader ${h(CL)} is skipped too: ${h(L.why.join('; '))}</div>` : ''}
      <div class="mul-setrow">
        <label class="fnd-sw"><input type="checkbox" data-mulset="on" ${C.on ? 'checked' : ''}><span class="tr" aria-hidden="true"></span><span class="lb ${C.on ? 'on' : 'off'}">${C.on ? 'On: the mules are searched at every gear-up' : 'Off: only the clan leader is searched'}</span></label>
        <label class="mul-sel">Highest enchant taken from anyone <select data-mulset="maxEnchant" aria-label="highest enchant">${Array.from({ length: ((I && I.maxEnchTop) || 9) + 1 }, (_, n) => `<option value="${n}" ${Number(C.maxEnchant) === n ? 'selected' : ''}>+${n}</option>`).join('')}</select></label>
      </div>
      <div class="fnd-hint">+10 and higher is never taken from anyone. The clan leader is always searched (also with the mules off).</div>`;
  }
  function renderList() {
    const el = $id('mulList'); if (!el) return;
    const C = MP.cur; if (!C) { el.innerHTML = ''; return; }
    if (!C.mules.length) { el.innerHTML = '<div class="muted">No mules yet. Tick characters under <b>Add characters</b>, then Save.</div>'; return; }
    const saved = new Set(((MP.orig && MP.orig.mules) || []).map(m => m.name));
    el.innerHTML = C.mules.map((m, i) => {
      const c = blockOf(m.name) || charOf(m.name), g = m.grades || [];
      const canLook = c && c.online && c.inRoster;
      return `<div class="mul-row ${c && c.used && saved.has(m.name) ? '' : 'skip'}">
        <div class="mul-top"><span class="mul-n">${i + 1}.</span><b class="mul-name">${h(m.name)}</b>${statusHtml(c, saved.has(m.name))}</div>
        <div class="mul-grades" role="group" aria-label="${h(m.name)} grades"><span class="muted">Gives gear of:</span>
          <button type="button" class="trd-chip fnd-chip ${g.length ? '' : 'on'}" data-mulgr="${i}|*" aria-pressed="${!g.length}">Every grade</button>
          ${GRADES.map(x => `<button type="button" class="trd-chip fnd-chip ${g.includes(x) ? 'on' : ''}" data-mulgr="${i}|${x}" aria-pressed="${g.includes(x)}">${gName(x)}</button>`).join('')}</div>
        <div class="stg-btns">
          <button type="button" data-mulact="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="move ${h(m.name)} up">↑ Earlier</button>
          <button type="button" data-mulact="down" data-i="${i}" ${i < C.mules.length - 1 ? '' : 'disabled'} aria-label="move ${h(m.name)} down">↓ Later</button>
          <button type="button" data-mulact="show" data-n="${h(m.name)}">Show what it holds</button>
          <button type="button" data-mulact="look" data-n="${h(m.name)}" ${canLook ? '' : 'disabled'} title="${canLook ? 'walks to the warehouse keeper in Giran and reads its warehouse (!whlook)' : 'only while it is logged in and in Hive\'s account list'}">🔍 Look in its warehouse now</button>
          <button type="button" class="danger" data-mulact="remove" data-i="${i}">Remove</button>
        </div></div>`;
    }).join('');
  }
  function renderAdd() {
    const el = $id('mulAdd'); if (!el) return;
    if (!el.querySelector('[data-muladdlist]')) el.innerHTML = `<div class="fnd-hint">Every character Hive knows (account list, alts) or has a bag / warehouse record of. Ticked = a mule (added at the end of the list).</div>
      <div class="stg-cwhtools"><input type="search" data-muladdq="" value="${h(MP.addQ)}" placeholder="Search a name…" aria-label="search characters"></div>
      <div class="mul-addlist" data-muladdlist="1"></div>`;
    renderAddList();
  }
  function renderAddList() {
    const el = $id('mulAdd'), L = el && el.querySelector('[data-muladdlist]'); if (!L) return;
    const C = MP.cur, I = MP.info; if (!C || !I) { L.innerHTML = '<div class="muted">Loading…</div>'; return; }
    const sel = new Set(C.mules.map(m => m.name)), q = MP.addQ.trim().toLowerCase();
    const rows = (I.candidates || []).filter(c => !c.isLeader && (!q || c.name.toLowerCase().includes(q)));
    L.innerHTML = rows.length ? rows.map(c => `<label class="mul-cand ${sel.has(c.name) ? 'on' : ''}"><input type="checkbox" data-muladd="${h(c.name)}" ${sel.has(c.name) ? 'checked' : ''}>
        <span class="mul-cmid"><span class="nm"><span class="dot ${c.online ? 'on' : ''}" title="${c.online ? 'online' : 'offline'}"></span><b>${h(c.name)}</b>${c.level ? ` <span class="muted">${c.level}${c.cls ? ' ' + h(c.cls) : ''}</span>` : ''}</span>
        <span class="mul-meta">${c.inRoster ? (c.alt ? 'alt' : 'in Hive') : '<span class="bad">not in Hive\'s account list</span>'} · bag ${c.bagKinds != null ? c.bagKinds + ' kinds, ' + ago(c.bagAt) : '—'} · warehouse ${c.whKinds != null ? c.whKinds + ' kinds, ' + ago(c.whAt) : '—'}</span></span>
        <button type="button" data-mulact="preview" data-n="${h(c.name)}">Show</button></label>`).join('')
      : '<div class="muted">Nobody matches.</div>';
  }
  // ---- what they hold: the Storage -> Clan warehouse list, for every mule (and the clan leader), bag + private warehouse
  function holdSources() {
    const I = MP.info || {}, out = [];
    (I.mules || []).forEach(m => out.push({ name: m.name, b: m, kind: 'mule' }));
    if (MP.preview && !out.some(x => x.name === MP.preview.name) && !(I.leader && I.leader.name === MP.preview.name)) out.push({ name: MP.preview.name, b: MP.preview, kind: 'preview' });
    if (I.leader) out.push({ name: I.leader.name, b: I.leader, kind: 'leader' });
    return out;
  }
  function holdRows() {
    const S = holdSources().filter(x => MP.who ? x.name === MP.who : x.kind === 'mule'), q = MP.q.trim().toLowerCase();
    const rows = []; S.forEach(x => (x.b.rows || []).forEach(r => rows.push(Object.assign({ who: x.name }, r))));
    return rows.filter(r => (!MP.src || r.src === MP.src) && (!q || r.name.toLowerCase().includes(q)) && (!MP.cat || r.cat === MP.cat) && (!MP.grade || (r.grade || 'NONE') === MP.grade) && (!MP.usable || !r.skip));
  }
  function renderHold() {
    const el = $id('mulHold'); if (!el) return;
    if (!MP.info) { el.innerHTML = '<div class="muted">Loading…</div>'; return; }
    const S = holdSources();
    if (MP.who && !S.some(x => x.name === MP.who)) MP.who = '';
    if (!el.querySelector('[data-mullist]')) el.innerHTML = `<div class="mul-who" data-mulwho="1"></div><div class="fnd-hint" data-mulhint="1"></div>
      <div class="stg-cwhtools"><input type="search" data-mulq="" value="${h(MP.q)}" placeholder="Search a name…" aria-label="search what the mules hold">
        <button type="button" class="trd-chip fnd-chip ${MP.usable ? 'on' : ''}" data-mulf="usable" aria-pressed="${MP.usable}">Only what a gear-up can take</button>
        <select data-mulsrc="1" aria-label="bag or warehouse"><option value="">Bag + warehouse</option><option value="bag" ${MP.src === 'bag' ? 'selected' : ''}>Bag only</option><option value="wh" ${MP.src === 'wh' ? 'selected' : ''}>Warehouse only</option></select>
        <select data-mulgrade="1" aria-label="grade"><option value="">Every grade</option>${GRADES.map(g => `<option value="${g}" ${MP.grade === g ? 'selected' : ''}>${g === 'NONE' ? 'No grade' : g + '-grade'}</option>`).join('')}</select></div>
      <div class="stg-cwhcats" data-mulcats="1"></div>
      <div class="stg-cwhlist" data-mullist="1"></div>`;
    renderHoldList();
  }
  function renderHoldList() {
    const el = $id('mulHold'); if (!el) return;
    const L = el.querySelector('[data-mullist]'); if (!L) return;
    const S = holdSources(), I = MP.info || {};
    const W = el.querySelector('[data-mulwho]');
    if (W) W.innerHTML = `<button type="button" class="trd-chip fnd-chip ${!MP.who ? 'on' : ''}" data-mulwho="">All mules <small>${(I.mules || []).length}</small></button>` +
      S.map(x => `<button type="button" class="trd-chip fnd-chip ${MP.who === x.name ? 'on' : ''} ${x.b.used ? '' : 'off'}" data-mulwho="${h(x.name)}"><span class="dot ${x.b.online ? 'on' : ''}"></span>${h(x.name)}${x.kind === 'leader' ? ' <small>clan leader</small>' : x.kind === 'preview' ? ' <small>not a mule</small>' : ''}</button>`).join('');
    const hint = el.querySelector('[data-mulhint]');
    if (hint) {
      const one = MP.who ? S.find(x => x.name === MP.who) : null;
      hint.innerHTML = one ? `${h(one.name)}: bag as the bot last wrote it ${one.b.bagAt ? h(String(one.b.bagAt).slice(0, 16).replace('T', ' ')) + ' UTC' : '— never'} · warehouse ${one.b.whClan ? '<b class="bad">list ignored (it is the clan warehouse list)</b>' : one.b.whAt ? 'as seen ' + h(String(one.b.whAt).slice(0, 16).replace('T', ' ')) + ' UTC' : '<b>never read</b>'}${one.b.adena ? ' · ' + kmb(one.b.adena) + ' adena' : ''}.
          ${one.kind === 'preview' ? ' <b>Not a mule</b> — tick it under Add characters to use it.' : ''}
          ${one.b.online && one.b.inRoster ? ` <button type="button" data-mulact="look" data-n="${h(one.name)}">🔍 Look in its warehouse now</button>` : ''}`
        : (I.mules || []).length ? `Every saved mule's bag and private warehouse together (${(I.mules || []).length}). Pick one above for its own list.
          <button type="button" data-mulact="lookall" title="every logged-in mule walks to the warehouse keeper in Giran and reads its warehouse (!whlook)">🔍 Look in every mule's warehouse now (${(I.mules || []).filter(m => m.online && m.inRoster).length} logged in)</button>` : 'No mules saved yet — the clan leader and a preview are listed above.';
    }
    const all = holdSources().filter(x => MP.who ? x.name === MP.who : x.kind === 'mule').reduce((a, x) => a.concat(x.b.rows || []), []);
    const cc = el.querySelector('[data-mulcats]');
    if (cc) { const cnt = {}; all.forEach(r => { cnt[r.cat] = (cnt[r.cat] || 0) + 1; });
      cc.innerHTML = `<button type="button" class="trd-chip fnd-chip ${!MP.cat ? 'on' : ''}" data-mulcat="">All <small>${all.length}</small></button>` + CATS.filter(([k]) => cnt[k]).map(([k, t]) => `<button type="button" class="trd-chip fnd-chip ${MP.cat === k ? 'on' : ''}" data-mulcat="${k}">${t} <small>${cnt[k]}</small></button>`).join(''); }
    const rows = holdRows(), order = {}; CATS.forEach(([k], i) => { order[k] = i; });
    // = Storage clan warehouse sort: by group, recipes by grade, life stones by level and quality, then by name (numbers in order), then enchant
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    const lsLvl = (r) => { const m = /Life Stone.*?Level\s*(\d+)/i.exec(r.name); return m ? Number(m[1]) : 999; }, lsQ = (r) => /^Top/i.test(r.name) ? 3 : /^High/i.test(r.name) ? 2 : /^Mid/i.test(r.name) ? 1 : 0;
    rows.sort((a, b) => (order[a.cat] ?? 99) - (order[b.cat] ?? 99)
      || (a.cat === 'recipe' ? Math.max(0, GRADES.indexOf(a.grade)) - Math.max(0, GRADES.indexOf(b.grade)) : 0)
      || (a.cat === 'stone' ? lsLvl(a) - lsLvl(b) || lsQ(a) - lsQ(b) : 0)
      || byName(a, b) || (a.enchant || 0) - (b.enchant || 0) || a.who.localeCompare(b.who));
    let lastCat = null; const head = (r) => { if (r.cat === lastCat) return ''; lastCat = r.cat; const t = (CATS.find(([k]) => k === r.cat) || [0, 'Other'])[1]; return `<div class="stg-cwhgrp">${t}</div>`; };
    const many = !MP.who;
    L.innerHTML = rows.length ? rows.slice(0, 1500).map(r => head(r) + `<div class="stg-cwhrow mul-item ${r.skip ? 'skip' : ''}">${r.icon ? `<img class="gi" src="${ico(r.icon)}" alt="">` : '<span class="gi"></span>'}<span class="nm">${r.enchant ? `<b>+${r.enchant}</b> ` : ''}${h(r.name)}${r.grade && r.grade !== 'NONE' ? ` <span class="tag cwhgr">${r.grade}</span>` : ''}</span><span class="ct">${r.count > 1 ? '×' + r.count.toLocaleString() : ''}</span><span class="tag ${r.src === 'wh' ? 'wh' : ''}">${r.src === 'wh' ? 'warehouse' : 'bag'}</span>${many ? `<span class="tag who">${h(r.who)}</span>` : ''}${r.common ? '<span class="tag">Common</span>' : ''}${r.skip ? `<span class="tag warn">${h(r.skip)}</span>` : ''}</div>`).join('') + (rows.length > 1500 ? `<div class="muted">+${rows.length - 1500} more — search to narrow it down.</div>` : '')
      : `<div class="muted">${all.length ? 'Nothing matches.' : MP.who ? 'Nothing recorded for this character yet (bag / warehouse).' : 'Nothing to show yet.'}</div>`;
  }
  function renderBar() {
    const el = $id('mulBar'); if (!el) return;
    const dt = dirty();
    el.innerHTML = `<div class="sum">${!MP.cur ? 'Loading…' : dt ? '<b>Unsaved changes</b>' : 'Saved'}</div>
      <div class="btns"><button data-mulbar="undo" ${dt ? '' : 'disabled'}>Undo changes</button><button data-mulbar="save" class="go" ${dt && !MP.busy ? '' : 'disabled'}>${MP.busy ? 'Saving…' : 'Save'}</button></div>`;
  }

  // ============================================================================================ edits
  function onChange(e) {
    const t = e.target; if (!t || !t.dataset || !MP.cur) return;
    if (t.dataset.mulset === 'on') { MP.cur.on = !!t.checked; renderSet(); renderBar(); return; }
    if (t.dataset.mulset === 'maxEnchant') { MP.cur.maxEnchant = Number(t.value); renderBar(); return; }
    if (t.dataset.muladd !== undefined) {
      const n = t.dataset.muladd, i = MP.cur.mules.findIndex(m => m.name === n);
      if (t.checked && i < 0) MP.cur.mules.push({ name: n, grades: [] }); else if (!t.checked && i >= 0) MP.cur.mules.splice(i, 1);
      renderList(); renderAddList(); renderSet(); renderBar(); return;
    }
    if (t.dataset.mulsrc !== undefined) { MP.src = t.value; renderHoldList(); return; }
    if (t.dataset.mulgrade !== undefined) { MP.grade = t.value; renderHoldList(); return; }
  }
  async function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    const gr = t.closest('[data-mulgr]');
    if (gr && MP.cur) {
      const [i, g] = gr.dataset.mulgr.split('|'), m = MP.cur.mules[Number(i)]; if (!m) return;
      if (g === '*') m.grades = [];
      else { const s = new Set(m.grades || []); if (s.has(g)) s.delete(g); else s.add(g); m.grades = GRADES.filter(x => s.has(x)); if (m.grades.length === GRADES.length) m.grades = []; }
      renderList(); renderBar(); return;
    }
    const wh = t.closest('[data-mulwho]'); if (wh && wh.tagName === 'BUTTON') { MP.who = wh.dataset.mulwho; MP.cat = ''; renderHoldList(); return; }
    const ct = t.closest('[data-mulcat]'); if (ct) { MP.cat = ct.dataset.mulcat; renderHoldList(); return; }
    const f = t.closest('[data-mulf]'); if (f) { MP.usable = !MP.usable; f.classList.toggle('on', MP.usable); f.setAttribute('aria-pressed', String(MP.usable)); renderHoldList(); return; }
    const bar = t.closest('[data-mulbar]');
    if (bar) { if (bar.dataset.mulbar === 'undo') { MP.cur = clone(MP.orig); render(); flash('Changes undone.'); } else save(); return; }
    const a = t.closest('[data-mulact]'); if (!a) return;
    const act = a.dataset.mulact, i = Number(a.dataset.i), n = a.dataset.n;
    if (act === 'up' || act === 'down') { const L = MP.cur.mules, j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; renderList(); renderSet(); renderBar(); return; }
    if (act === 'remove') { MP.cur.mules.splice(i, 1); renderList(); renderAddList(); renderSet(); renderBar(); return; }
    if (act === 'show') { MP.who = n; MP.cat = ''; renderHoldList(); const b = unfold('mulHoldBox'); if (b) b.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (act === 'preview') {
      e.preventDefault();   // the button sits inside the tick label
      if (!blockOf(n)) { let d = null; try { d = await api('/api/mules/char?name=' + encodeURIComponent(n)); } catch (er) { d = null; } if (!d || !d.ok) { await uiError((d && d.error) || 'no answer'); return; } MP.preview = d; }
      MP.who = n; MP.cat = ''; renderHoldList(); const b = unfold('mulHoldBox'); if (b) b.scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
    }
    // LOOKALL-2026-11-06 (owner: "a button on All mules that searches the warehouse of every mule"): !whlook <name> to every saved mule that can go
    // (logged in + in Hive's account list); the others are named with the reason. One order per mule; each goes to Giran by itself.
    if (act === 'lookall') {
      const L = ((MP.info && MP.info.mules) || []), go = L.filter(m => m.online && m.inRoster), no = L.filter(m => !(m.online && m.inRoster));
      if (!go.length) { await uiAlert({ title: 'Nobody can look now', body: [uiP('A mule reads its warehouse itself, so it must be logged in and in Hive\'s account list.'), uiList(no.map(m => `${m.name}: ${m.inRoster ? 'offline' : 'not in Hive\'s account list'}`))] }); return; }
      const body = [uiP('These walk to the warehouse keeper in Giran (travelling there first when elsewhere), open their own warehouse and write the list. Nothing is taken out:'), uiList(go.map(m => m.name)), uiNote('Each stops what it is doing for this. The lists here update within a minute or two after they got there.')];
      if (no.length) body.push(uiWarn('Not asked (they cannot go now):'), uiList(no.map(m => `${m.name}: ${m.inRoster ? 'offline' : 'not in Hive\'s account list'}`)));
      if (!(await uiConfirm({ title: `Look in ${go.length} warehouse${go.length === 1 ? '' : 's'}?`, body, confirmText: 'Look now', cancelText: 'Cancel' }))) return;
      a.disabled = true; const ok = [], bad = [];
      for (const m of go) { if (await send(`!whlook ${m.name}`, m.name)) ok.push(m.name); else bad.push(m.name); }
      a.disabled = false;
      flash(`${ok.length ? 'Looking in the warehouse: ' + ok.join(', ') + '.' : ''}${bad.length ? ' Not sent: ' + bad.join(', ') + '.' : ''}${no.length ? ' Skipped (offline / not in Hive): ' + no.map(m => m.name).join(', ') + '.' : ''}`, !ok.length);
      return;
    }
    if (act === 'look') {
      if (!(await uiConfirm({ title: `${n}: look in its warehouse?`, body: [uiP(uiEm(n), ' walks to the warehouse keeper in Giran (it travels there first when it is elsewhere), opens its own warehouse and writes the list. Nothing is taken out.'), uiNote('It stops what it is doing for this. The list here updates within a minute or two after it got there.')], confirmText: 'Look now', cancelText: 'Cancel' }))) return;
      a.disabled = true; if (await send(`!whlook ${n}`, n)) flash(`${n}: looking in its warehouse — the list updates here once it got there.`); a.disabled = false;
    }
  }
  async function send(cmd, name) {
    try {
      const d = await api('/api/command', { method: 'POST', body: JSON.stringify({ cmd, targets: ['char:' + name] }) });
      if (!d || d.error) { await uiError(`${cmd}: ${(d && d.error) || 'no answer'}`); return false; }
      return true;
    } catch (e) { await uiError(`${cmd}: ${e.message}`); return false; }
  }
  function changes() {
    const a = MP.orig || { mules: [] }, b = MP.cur, out = [];
    const gtxt = (m) => (m.grades || []).length ? m.grades.map(gName).join(', ') : 'every grade';
    if (!!a.on !== !!b.on) out.push(b.on ? 'Mules switched ON' : 'Mules switched OFF (only the clan leader is searched)');
    if (Number(a.maxEnchant) !== Number(b.maxEnchant)) out.push(`Highest enchant taken: +${a.maxEnchant} → +${b.maxEnchant}`);
    const an = a.mules.map(m => m.name), bn = b.mules.map(m => m.name);
    bn.filter(n => !an.includes(n)).forEach(n => out.push(`Add ${n} (${gtxt(b.mules.find(m => m.name === n))})`));
    an.filter(n => !bn.includes(n)).forEach(n => out.push(`Remove ${n}`));
    b.mules.forEach(m => { const o = a.mules.find(x => x.name === m.name); if (o && gtxt(o) !== gtxt(m)) out.push(`${m.name}: ${gtxt(o)} → ${gtxt(m)}`); });
    const keep = an.filter(n => bn.includes(n)), now = bn.filter(n => an.includes(n));
    if (keep.join('|') !== now.join('|')) out.push(`Order: ${bn.join(' → ')}`);
    return out;
  }
  async function save() {
    if (MP.busy || !MP.cur) return;
    const ch = changes(); if (!ch.length) { flash('Nothing changed.'); return; }
    // the new mules the gear-up would skip as things stand (offline / not in Hive's account list) are named before saving
    const warn = MP.cur.on ? MP.cur.mules.map(m => ({ m, c: charOf(m.name) })).filter(x => !x.c || !x.c.inRoster || (!x.c.online && x.c.why.some(w => /offline/.test(w))))
      .map(x => `${x.m.name}: ${!x.c ? 'no record yet' : x.c.why.filter(w => !/switched off/.test(w)).join('; ')}`) : [];
    const body = [uiP(`${ch.length} change${ch.length === 1 ? '' : 's'}:`), uiList(ch.slice(0, 30)), uiP('Every bot uses them at its next gear-up (within a minute, no restart).')];
    if (warn.length) body.push(uiWarn('Skipped until this changes:'), uiList(warn));
    if (!(await uiConfirm({ title: 'Save the mules?', body, confirmText: 'Save', cancelText: 'Cancel' }))) return;
    MP.busy = true; renderBar();
    let d = null;
    try { d = await api('/api/mules', { method: 'POST', body: JSON.stringify({ conf: MP.cur, rev: MP.rev }) }); } catch (e) { d = { error: e.message }; }
    MP.busy = false;
    if (d && d.conflict) {
      if (await uiConfirm({ title: 'Changed meanwhile', body: [uiWarn('Someone else saved the mule settings after this page loaded them.'), uiP('Overwrite them with your version?')], confirmText: 'Overwrite', cancelText: 'Cancel', danger: true })) { MP.rev = d.rev; return save(); }
      renderBar(); return;
    }
    if (!d || d.error || !d.ok) { renderBar(); await uiError((d && d.error) || 'no answer from the dashboard server', 'Not saved'); return; }
    MP.rev = d.rev; MP.orig = clone(d.conf); MP.cur = clone(d.conf);
    flash(`Saved (${ch.length} change${ch.length === 1 ? '' : 's'}).`); load(true);
  }

  window.MulesPage = { route, open, close, _state: MP };
})();
