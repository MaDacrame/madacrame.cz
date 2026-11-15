/* MaDacrame – administrace (vanilla JS, bez knihoven). Žádné innerHTML s daty → bez XSS. */
'use strict';
const S = { csrf: '', files: {}, dirty: false, view: 'dash', param: null, draft: null, isNew: false };
const root = document.getElementById('root');

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(x => { if (x != null && x !== false) e.append(x.nodeType ? x : document.createTextNode(String(x))); });
  return e;
};
const img = p => (p ? '../' + p : '');
const thumbOf = p => /^uploads\/[^/]+\.(jpe?g|png|webp)$/i.test(p) && !/-sm\./.test(p) ? p.replace(/(\.[a-z]+)$/i, '-sm$1') : p;
const fmtDate = t => new Date(t * 1000).toLocaleString('cs-CZ');
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' kB';
const clone = o => JSON.parse(JSON.stringify(o));
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* ---------- API ---------- */
async function api(action, { method = 'POST', body, form, query = '' } = {}) {
  const opt = { method, headers: { 'X-CSRF-Token': S.csrf }, credentials: 'same-origin' };
  if (form) opt.body = form;
  else if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let r, j;
  try { r = await fetch('api.php?action=' + action + query, opt); j = await r.json(); }
  catch (e) { throw new Error(r ? `Server vrátil neplatnou odpověď (HTTP ${r.status}). Zkontrolujte, zda běží PHP.` : 'Nelze se spojit se serverem.'); }
  if (!j.ok) { const err = new Error(j.error || 'Chyba'); err.status = r.status; if (r.status === 401 && S.auth) { S.auth = false; boot(); } throw err; }
  return j;
}

/* ---------- UI pomůcky ---------- */
let toastTimer;
function toast(msg, kind = 'ok') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg);
  document.body.append(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), kind === 'err' ? 7000 : 2800);
}
function confirmBox(text, okLabel = 'Smazat') {
  return new Promise(res => {
    const close = v => { m.remove(); res(v); };
    const m = h('div', { class: 'modal-bg' }, h('div', { class: 'modal small', role: 'dialog', 'aria-modal': 'true' },
      h('p', {}, text), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => close(false) }, 'Zrušit'), h('button', { class: 'btn danger', onclick: () => close(true) }, okLabel))));
    document.body.append(m);
  });
}
const setDirty = v => { S.dirty = v; const b = document.querySelector('.save-bar'); if (b) b.classList.toggle('on', v); };
window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

async function go(view, param = null) {
  if (S.dirty && !(await confirmBox('Máte neuložené změny. Opravdu odejít bez uložení?', 'Zahodit změny'))) return;
  setDirty(false); S.view = view; S.param = param; S.draft = null; render(); window.scrollTo(0, 0);
}

/* ---------- přihlášení ---------- */
async function boot() {
  let st;
  try { st = await (await fetch('api.php?action=status', { credentials: 'same-origin' })).json(); }
  catch (e) { return root.replaceChildren(h('div', { class: 'login' }, h('h1', {}, 'Administrace nedostupná'), h('p', { class: 'muted' }, 'Server neodpovídá nebo není dostupné PHP.'))); }
  if (!st.ok) return root.replaceChildren(h('div', { class: 'login' }, h('h1', {}, 'Přístup odepřen'), h('p', { class: 'muted' }, st.error || '')));
  S.csrf = st.csrf; S.auth = st.auth;
  if (st.auth) { await loadAll(); return render(); }
  loginScreen(st.setup);
}
function loginScreen(setup) {
  const pw = h('input', { type: 'password', autocomplete: setup ? 'new-password' : 'current-password', required: true, minlength: setup ? 10 : 1, autofocus: true });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const err = h('p', { class: 'err', role: 'alert' });
  const form = h('form', { class: 'login', onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    if (setup && pw.value !== pw2.value) { err.textContent = 'Hesla se neshodují.'; return; }
    try { const r = await api(setup ? 'setup' : 'login', { body: { password: pw.value } }); S.csrf = r.csrf; S.auth = true; await loadAll(); render(); }
    catch (x) { err.textContent = x.message; }
  } },
    h('div', { class: 'brand' }, 'Ma', h('span', {}, 'D'), 'acrame'),
    h('p', { class: 'eyebrow' }, setup ? 'PRVNÍ NASTAVENÍ' : 'ADMINISTRACE'),
    h('h1', {}, setup ? 'Nastavte heslo správce' : 'Přihlášení'),
    setup && h('p', { class: 'muted' }, 'Heslo musí mít alespoň 10 znaků. Ukládá se pouze zahashované.'),
    h('label', {}, 'Heslo', pw), setup && h('label', {}, 'Heslo znovu', pw2),
    err, h('button', { class: 'btn primary', type: 'submit' }, setup ? 'Uložit heslo a vstoupit' : 'Přihlásit'));
  root.replaceChildren(form);
}
async function loadAll() { S.files = (await api('load', { method: 'GET' })).files; }
const D = n => S.files[n].data;

async function saveFile(name, data) {
  const r = await api('save', { body: { file: name, data, rev: S.files[name].rev } });
  S.files[name] = { data: r.data, rev: r.rev };
  return r;
}

/* ---------- kostra ---------- */
const NAV = [['dash', 'Přehled'], ['sections', 'Kategorie'], ['projects', 'Projekty'], ['pages', 'Stránky'], ['site', 'Texty webu'], ['media', 'Fotografie'], ['backups', 'Zálohy'], ['system', 'Systém a heslo']];
function render() {
  const view = ({ dash, sections: () => listView('sections'), projects: () => listView('projects'), pages: () => listView('pages'), site: siteView, media: mediaView, backups: backupsView, system: systemView })[S.view]();
  const main = h('main', { class: 'main' }, view);
  root.replaceChildren(h('div', { class: 'shell' },
    h('aside', { class: 'side' }, h('div', { class: 'brand' }, 'Ma', h('span', {}, 'D'), 'acrame', h('small', {}, 'administrace')),
      h('nav', {}, NAV.map(([k, t]) => h('button', { class: 'navbtn' + (S.view === k || (S.param && S.view === k) ? ' active' : ''), onclick: () => go(k) }, t))),
      h('div', { class: 'side-foot' }, h('a', { href: '../', target: '_blank', rel: 'noopener' }, 'Zobrazit web ↗'),
        h('button', { class: 'linkbtn', onclick: async () => { if (S.dirty && !(await confirmBox('Máte neuložené změny. Odhlásit se?', 'Odhlásit'))) return; setDirty(false); try { await api('logout'); } catch (e) {} S.auth = false; boot(); } }, 'Odhlásit'))),
    main));
}
const pageHead = (eyebrow, title, ...actions) => h('div', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow' }, eyebrow), h('h1', {}, title)), h('div', { class: 'row' }, actions));

/* ---------- přehled ---------- */
function dash() {
  const sec = D('sections'), pr = D('projects'), pg = D('pages');
  const todo = [];
  const noImg = pr.filter(p => !p.image); if (noImg.length) todo.push(`${noImg.length}× projekt bez hlavní fotografie`);
  const ph = pr.filter(p => p.placeholder); if (ph.length) todo.push(`${ph.length}× ukázkový projekt (označen na webu jako neskutečná realizace) – nahraďte vlastním`);
  const ill = sec.filter(s => /^assets\/visuals\//.test(s.image)); if (ill.length) todo.push(`${ill.length}× kategorie používá ilustrační grafiku místo fotografie`);
  const stat = (n, l, v) => h('button', { class: 'stat', onclick: () => go(v) }, h('strong', {}, n), h('span', {}, l));
  return h('div', {}, pageHead('PŘEHLED', 'Vítejte v administraci'),
    h('div', { class: 'stats' }, stat(sec.length, 'Kategorie', 'sections'), stat(pr.length, 'Projekty', 'projects'), stat(pg.length, 'Další stránky', 'pages'),
      stat([...sec, ...pr, ...pg].filter(x => x.visible === false).length, 'Skryté položky', 'projects')),
    h('div', { class: 'card' }, h('h2', {}, 'Co doplnit'), todo.length ? h('ul', { class: 'todo' }, todo.map(t => h('li', {}, t))) : h('p', { class: 'muted' }, 'Vše vypadá hotově.')),
    h('div', { class: 'card' }, h('h2', {}, 'Rychlé akce'), h('div', { class: 'row wrap' },
      h('button', { class: 'btn primary', onclick: () => newItem('projects') }, '+ Nový projekt'),
      h('button', { class: 'btn', onclick: () => newItem('sections') }, '+ Nová kategorie'),
      h('button', { class: 'btn', onclick: () => newItem('pages') }, '+ Nová stránka'),
      h('button', { class: 'btn', onclick: () => go('media') }, 'Nahrát fotografie'))));
}

/* ---------- kolekce: seznam ---------- */
const COL = {
  sections: { title: 'Kategorie', one: 'Kategorie', eyebrow: 'OBLASTI TVORBY', url: id => `../oblast.html?id=${encodeURIComponent(id)}`,
    blank: () => ({ id: '', title: 'Nová kategorie', kicker: 'OBLAST TVORBY', description: '', intro: '', body: [], image: '', gallery: [], owner: '', visible: false, features: [] }) },
  projects: { title: 'Projekty', one: 'Projekt', eyebrow: 'OD NÁPADU K REALIZACI', url: id => `../projekt.html?id=${encodeURIComponent(id)}`,
    blank: () => ({ id: '', title: 'Nový projekt', category: (D('sections')[0] || {}).id || '', description: '', image: '', paragraphs: [], gallery: [], visible: false, placeholder: false }) },
  pages: { title: 'Další stránky', one: 'Stránka', eyebrow: 'NOVINKY, NÁVODY, AKCE…', url: id => `../stranka.html?id=${encodeURIComponent(id)}`,
    blank: () => ({ id: '', title: 'Nová stránka', kicker: '', intro: '', image: '', body: [], gallery: [], visible: false }) },
};
function newItem(kind) { S.view = kind; S.param = '__new__'; S.draft = COL[kind].blank(); S.isNew = true; setDirty(true); render(); window.scrollTo(0, 0); }

function listView(kind) {
  if (S.param) return editView(kind);
  const c = COL[kind], list = D(kind);
  const persist = async (arr, okMsg) => { try { await saveFile(kind, arr); toast(okMsg); render(); } catch (e) { toast(e.message, 'err'); if (e.status === 409) { await loadAll(); render(); } } };
  const catName = id => (D('sections').find(s => s.id === id) || {}).title || '—';
  const rows = list.map((it, i) => h('div', { class: 'item' + (it.visible === false ? ' hidden' : '') },
    h('div', { class: 'thumb' }, it.image ? h('img', { src: img(thumbOf(it.image)), alt: '', loading: 'lazy' }) : h('span', {}, 'bez fotografie')),
    h('div', { class: 'item-main' }, h('strong', {}, it.title || '(bez názvu)'), h('small', {}, kind === 'projects' ? catName(it.category) : (it.kicker || it.id)), it.placeholder && h('small', { class: 'warn' }, 'ukázkový obsah')),
    h('button', { class: 'chip ' + (it.visible === false ? 'off' : 'on'), title: 'Přepnout viditelnost', onclick: () => { const a = clone(list); a[i].visible = a[i].visible === false; persist(a, a[i].visible ? 'Zveřejněno.' : 'Skryto.'); } }, it.visible === false ? 'Skryto' : 'Zveřejněno'),
    h('div', { class: 'row tight' },
      h('button', { class: 'icon', title: 'Nahoru', disabled: i === 0, onclick: () => { const a = clone(list); [a[i - 1], a[i]] = [a[i], a[i - 1]]; persist(a, 'Pořadí uloženo.'); } }, '↑'),
      h('button', { class: 'icon', title: 'Dolů', disabled: i === list.length - 1, onclick: () => { const a = clone(list); [a[i + 1], a[i]] = [a[i], a[i + 1]]; persist(a, 'Pořadí uloženo.'); } }, '↓'),
      h('button', { class: 'btn', onclick: () => { S.param = it.id; S.draft = clone(it); S.isNew = false; render(); window.scrollTo(0, 0); } }, 'Upravit'),
      h('button', { class: 'btn danger-o', onclick: async () => {
        let msg = `Opravdu smazat „${it.title}“? Akci lze vrátit pouze ze zálohy.`;
        if (kind === 'sections') { const n = D('projects').filter(p => p.category === it.id).length; if (n) msg += ` Pozor: ${n} projekt(ů) je k této kategorii přiřazeno a zůstane bez kategorie.`; }
        if (await confirmBox(msg)) persist(list.filter((_, j) => j !== i), 'Smazáno.');
      } }, 'Smazat'))));
  return h('div', {}, pageHead(c.eyebrow, c.title, h('button', { class: 'btn primary', onclick: () => newItem(kind) }, '+ Přidat')),
    h('p', { class: 'muted' }, 'Pořadí zde odpovídá pořadí na webu. Změna viditelnosti, pořadí i smazání se projeví na webu okamžitě.'),
    list.length ? h('div', { class: 'items' }, rows) : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Zatím tu nic není.')));
}

/* ---------- pole formuláře ---------- */
const mark = () => setDirty(true);
function field(label, input, hint) { return h('label', { class: 'f' }, h('span', {}, label), input, hint && h('small', {}, hint)); }
function txt(label, o, k, { area, rows = 3, max, hint, type = 'text' } = {}) {
  const el = area ? h('textarea', { rows, maxlength: max }) : h('input', { type, maxlength: max });
  el.value = o[k] || '';
  el.addEventListener('input', () => { o[k] = el.value; mark(); });
  return field(label, el, hint);
}
function visibleBox(o) {
  const cb = h('input', { type: 'checkbox', checked: o.visible !== false });
  cb.addEventListener('change', () => { o.visible = cb.checked; mark(); });
  return h('label', { class: 'check' }, cb, h('span', {}, 'Zveřejněno na webu'), h('small', {}, ' (nezaškrtnuté položky návštěvníci neuvidí)'));
}
function reorder(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
function paraList(label, o, k, redraw, ph = 'Text odstavce…') {
  o[k] = o[k] || [];
  return h('div', { class: 'f' }, h('span', {}, label),
    o[k].map((t, i) => { const ta = h('textarea', { rows: 4, placeholder: ph }); ta.value = t; ta.addEventListener('input', () => { o[k][i] = ta.value; mark(); });
      return h('div', { class: 'para' }, ta, h('div', { class: 'col tight' },
        h('button', { type: 'button', class: 'icon', disabled: i === 0, onclick: () => { reorder(o[k], i, -1); mark(); redraw(); } }, '↑'),
        h('button', { type: 'button', class: 'icon', disabled: i === o[k].length - 1, onclick: () => { reorder(o[k], i, 1); mark(); redraw(); } }, '↓'),
        h('button', { type: 'button', class: 'icon danger-o', onclick: () => { o[k].splice(i, 1); mark(); redraw(); } }, '✕'))); }),
    h('button', { type: 'button', class: 'btn', onclick: () => { o[k].push(''); mark(); redraw(); } }, '+ Přidat odstavec'));
}
function strList(label, o, k, redraw, ph = 'Položka') {
  o[k] = o[k] || [];
  return h('div', { class: 'f' }, h('span', {}, label),
    o[k].map((t, i) => { const inp = h('input', { type: 'text', placeholder: ph, maxlength: 200 }); inp.value = t; inp.addEventListener('input', () => { o[k][i] = inp.value; mark(); });
      return h('div', { class: 'row tight' }, inp,
        h('button', { type: 'button', class: 'icon', disabled: i === 0, onclick: () => { reorder(o[k], i, -1); mark(); redraw(); } }, '↑'),
        h('button', { type: 'button', class: 'icon', disabled: i === o[k].length - 1, onclick: () => { reorder(o[k], i, 1); mark(); redraw(); } }, '↓'),
        h('button', { type: 'button', class: 'icon danger-o', onclick: () => { o[k].splice(i, 1); mark(); redraw(); } }, '✕')); }),
    h('button', { type: 'button', class: 'btn', onclick: () => { o[k].push(''); mark(); redraw(); } }, '+ Přidat položku'));
}
function imgField(label, o, k, redraw, hint) {
  return h('div', { class: 'f' }, h('span', {}, label),
    h('div', { class: 'imgfield' }, h('div', { class: 'thumb big' }, o[k] ? h('img', { src: img(thumbOf(o[k])), alt: '' }) : h('span', {}, 'žádná')),
      h('div', { class: 'col' }, h('button', { type: 'button', class: 'btn', onclick: async () => { const p = await picker(false); if (p && p[0]) { o[k] = p[0]; mark(); redraw(); } } }, 'Vybrat nebo nahrát…'),
        o[k] && h('button', { type: 'button', class: 'btn danger-o', onclick: () => { o[k] = ''; mark(); redraw(); } }, 'Odebrat'),
        o[k] && /^assets\/visuals\//.test(o[k]) && h('small', { class: 'warn' }, 'Ilustrační grafika – na webu je označena jako ilustrace.'))), hint && h('small', {}, hint));
}
function galleryField(o, redraw, mainKey) {
  o.gallery = o.gallery || [];
  return h('div', { class: 'f' }, h('span', {}, 'Galerie fotografií'),
    h('div', { class: 'gal' }, o.gallery.map((g, i) => { const cap = h('input', { type: 'text', placeholder: 'Popisek (nepovinný)', maxlength: 200 }); cap.value = g.caption || ''; cap.addEventListener('input', () => { g.caption = cap.value; mark(); });
      return h('div', { class: 'tile' }, h('img', { src: img(thumbOf(g.src)), alt: '', loading: 'lazy' }), cap,
        h('div', { class: 'row tight' },
          h('button', { type: 'button', class: 'icon', title: 'Posunout dříve', disabled: i === 0, onclick: () => { reorder(o.gallery, i, -1); mark(); redraw(); } }, '←'),
          h('button', { type: 'button', class: 'icon', title: 'Posunout později', disabled: i === o.gallery.length - 1, onclick: () => { reorder(o.gallery, i, 1); mark(); redraw(); } }, '→'),
          mainKey && h('button', { type: 'button', class: 'icon', title: 'Nastavit jako hlavní fotografii', onclick: () => { const old = o[mainKey]; o[mainKey] = g.src; o.gallery.splice(i, 1); if (old) o.gallery.unshift({ src: old, caption: '' }); mark(); redraw(); toast('Hlavní fotografie změněna (po uložení).'); } }, '★'),
          h('button', { type: 'button', class: 'icon danger-o', title: 'Odebrat z galerie', onclick: () => { o.gallery.splice(i, 1); mark(); redraw(); } }, '✕'))); })),
    h('button', { type: 'button', class: 'btn', onclick: async () => { const p = await picker(true); if (p && p.length) { p.forEach(s => o.gallery.push({ src: s, caption: '' })); mark(); redraw(); } } }, '+ Přidat fotografie'),
    mainKey && h('small', {}, '★ = nastaví fotografii jako hlavní (dosavadní hlavní se přesune do galerie).'));
}

/* ---------- editor položky ---------- */
function editView(kind) {
  const c = COL[kind], d = S.draft, wrap = h('div', {}), host = h('div', {});
  const redraw = () => { const y = window.scrollY; host.replaceChildren(form()); window.scrollTo(0, y); };
  const save = async () => {
    if (!d.title.trim()) return toast('Vyplňte název.', 'err');
    const list = clone(D(kind));
    if (S.isNew) { d.id = slug(d.title) || 'polozka'; list.push(d); }
    else list[list.findIndex(x => x.id === S.param)] = d;
    try {
      const r = await saveFile(kind, list);
      S.isNew = false; S.param = S.param === '__new__' ? (r.data[r.data.length - 1] || {}).id : S.param;
      S.draft = clone(r.data.find(x => x.id === (d.id)) || r.data[r.data.length - 1]); S.param = S.draft.id;
      setDirty(false); toast('Uloženo' + (S.draft.visible === false ? ' (položka je skrytá).' : ' a zveřejněno.')); render();
    } catch (e) { toast(e.message, 'err'); if (e.status === 409) { await loadAll(); } }
  };
  function form() {
    const f = h('div', {});
    f.append(h('div', { class: 'card' }, h('h2', {}, 'Základ'), txt('Název', d, 'title', { max: 160 }), visibleBox(d),
      kind === 'projects' && field('Kategorie', (() => { const s = h('select', {}, h('option', { value: '' }, '— bez kategorie —'), D('sections').map(x => h('option', { value: x.id }, x.title))); s.value = d.category || ''; s.addEventListener('change', () => { d.category = s.value; mark(); }); return s; })()),
      kind !== 'pages' ? txt('Krátký popis (karta na webu)', d, 'description', { area: true, rows: 2, max: 600 }) : null,
      kind === 'sections' && txt('Nadpis nad názvem (např. RUČNÍ TVORBA)', d, 'kicker', { max: 60 }),
      kind === 'pages' && txt('Nadpis nad názvem (např. NOVINKY)', d, 'kicker', { max: 60 }),
      kind === 'sections' && txt('Úvodní text', d, 'intro', { area: true, rows: 3, max: 1500 }),
      kind === 'pages' && txt('Úvodní text', d, 'intro', { area: true, rows: 3, max: 800 }),
      kind === 'sections' && txt('Kdo za tvorbou stojí (nepovinné)', d, 'owner', { max: 80 }),
      kind === 'projects' && h('label', { class: 'check' }, (() => { const cb = h('input', { type: 'checkbox', checked: !!d.placeholder }); cb.addEventListener('change', () => { d.placeholder = cb.checked; mark(); }); return cb; })(), h('span', {}, 'Ukázkový obsah (na webu bude označen jako neskutečná realizace)'))));
    f.append(h('div', { class: 'card' }, h('h2', {}, 'Fotografie'), imgField('Hlavní fotografie', d, 'image', redraw), galleryField(d, redraw, 'image')));
    const bodyKey = kind === 'projects' ? 'paragraphs' : 'body';
    f.append(h('div', { class: 'card' }, h('h2', {}, kind === 'sections' ? 'Podrobnější popis' : 'Text článku'), paraList('Odstavce', d, bodyKey, redraw)));
    if (kind === 'sections') f.append(h('div', { class: 'card' }, h('h2', {}, 'Služby a možnosti'), strList('Seznam', d, 'features', redraw, 'např. FDM tisk')));
    return f;
  }
  wrap.append(h('div', { class: 'crumb' }, h('button', { class: 'linkbtn', onclick: () => go(kind) }, '← ' + c.title)),
    pageHead(S.isNew ? 'NOVÁ POLOŽKA' : 'ÚPRAVA', d.title || c.one, !S.isNew && d.visible !== false && h('a', { class: 'btn', href: c.url(d.id), target: '_blank', rel: 'noopener' }, 'Zobrazit na webu ↗')),
    host,
    h('div', { class: 'save-bar' + (S.dirty ? ' on' : '') }, h('span', {}, 'Neuložené změny'), h('button', { class: 'btn', onclick: () => go(kind) }, 'Zahodit'), h('button', { class: 'btn primary', onclick: save }, 'Uložit')));
  host.append(form());
  return wrap;
}

/* ---------- texty webu ---------- */
function siteView() {
  const d = S.draft || (S.draft = clone(D('site'))), wrap = h('div', {}), host = h('div', {});
  const redraw = () => { const y = window.scrollY; host.replaceChildren(body()); window.scrollTo(0, y); };
  function body() {
    return h('div', {},
      h('div', { class: 'card' }, h('h2', {}, 'Úvodní stránka'), txt('Malý nadpis nad titulkem', d, 'eyebrow', { max: 200 }), txt('Hlavní nadpis', d, 'headline', { max: 200, hint: 'Slovo „skutečnost“ se na webu automaticky zvýrazní oranžově.' }),
        txt('Úvodní představení', d, 'intro', { area: true, max: 1500 }), imgField('Úvodní obrázek', d, 'hero_image', redraw)),
      h('div', { class: 'card' }, h('h2', {}, 'Rozcestník a představení'), txt('Nadpis rozcestníku', d, 'manifesto_title'), txt('Text rozcestníku', d, 'manifesto_text', { area: true }),
        txt('Nadpis „Kdo jsme“', d, 'about_title'), txt('Text „Kdo jsme“', d, 'about_text', { area: true, rows: 5 })),
      h('div', { class: 'card' }, h('h2', {}, 'Od nápadu k realizaci'), txt('Nadpis', d, 'projects_title'), txt('Úvodní text', d, 'projects_text', { area: true, rows: 2 })),
      h('div', { class: 'card' }, h('h2', {}, 'Stránka O nás'), txt('Nadpis', d, 'about_page_title'), paraList('Odstavce', d, 'about_page_body', redraw)),
      h('div', { class: 'card' }, h('h2', {}, 'Kontakt'), txt('Nadpis', d, 'contact_title'), txt('Text', d, 'contact_text', { area: true }), txt('Telefon', d, 'phone', { type: 'tel' }), txt('E-mail', d, 'email', { type: 'email' }),
        txt('Facebook (adresa)', d, 'facebook', { type: 'url' }), txt('Instagram (adresa)', d, 'instagram', { type: 'url' }), txt('Kde působíme', d, 'location_note'), txt('Text v patičce', d, 'footer_note')));
  }
  host.append(body());
  wrap.append(pageHead('NASTAVENÍ OBSAHU', 'Texty webu'), host, h('div', { class: 'save-bar' + (S.dirty ? ' on' : '') }, h('span', {}, 'Neuložené změny'),
    h('button', { class: 'btn', onclick: () => go('site') }, 'Zahodit'),
    h('button', { class: 'btn primary', onclick: async () => { try { await saveFile('site', d); S.draft = null; setDirty(false); toast('Uloženo a zveřejněno.'); render(); } catch (e) { toast(e.message, 'err'); } } }, 'Uložit')));
  return wrap;
}

/* ---------- fotografie ---------- */
async function uploadFiles(fileList) {
  const fd = new FormData(); [...fileList].forEach(f => fd.append('files[]', f));
  const r = await api('upload', { form: fd });
  (r.errors || []).forEach(e => toast(e, 'err'));
  if (r.paths.length) toast(`Nahráno: ${r.paths.length}`);
  return r.paths;
}
function uploader(onDone) {
  const inp = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr' });
  const run = async files => { if (!files.length) return; drop.classList.add('busy'); try { onDone(await uploadFiles(files)); } catch (e) { toast(e.message, 'err'); } drop.classList.remove('busy'); };
  inp.addEventListener('change', () => run(inp.files));
  const drop = h('div', { class: 'drop', onclick: () => inp.click(), ondragover: e => { e.preventDefault(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'), ondrop: e => { e.preventDefault(); drop.classList.remove('over'); run(e.dataTransfer.files); } },
    inp, h('strong', {}, 'Přetáhněte fotografie sem nebo klikněte pro výběr'), h('small', {}, 'JPG, PNG, WEBP · více souborů najednou · automaticky se optimalizují pro web'));
  return drop;
}
function mediaView() {
  const grid = h('div', { class: 'mgrid' }); const info = h('p', { class: 'muted' }, 'Načítám…');
  const load = async () => {
    try {
      const m = (await api('media', { method: 'GET' })).media; info.textContent = `${m.length} fotografií`;
      grid.replaceChildren(...m.map(x => h('div', { class: 'mtile' }, h('img', { src: img(x.thumb), alt: '', loading: 'lazy' }), h('small', {}, `${x.w}×${x.h} · ${fmtSize(x.size)}`),
        h('div', { class: 'row tight' }, h('span', { class: 'chip ' + (x.used ? 'on' : 'off') }, x.used ? 'Používá se' : 'Nepoužito'),
          h('button', { class: 'btn danger-o', disabled: x.used, title: x.used ? 'Nejprve odeberte z obsahu' : '', onclick: async () => { if (await confirmBox('Trvale smazat tuto fotografii?')) { try { await api('media_delete', { body: { path: x.path } }); toast('Smazáno.'); load(); } catch (e) { toast(e.message, 'err'); } } } }, 'Smazat')))));
    } catch (e) { info.textContent = e.message; }
  };
  load();
  return h('div', {}, pageHead('KNIHOVNA', 'Fotografie'), uploader(() => load()), info, grid);
}
function picker(multi) {
  return new Promise(async res => {
    const sel = new Set(); const grid = h('div', { class: 'mgrid sm' });
    const close = v => { m.remove(); res(v); };
    const draw = list => grid.replaceChildren(...list.map(x => { const t = h('button', { type: 'button', class: 'mtile pick' + (sel.has(x.path) ? ' sel' : ''), onclick: () => { if (!multi) { sel.clear(); } sel.has(x.path) ? sel.delete(x.path) : sel.add(x.path); if (!multi) return close([...sel]); t.classList.toggle('sel'); count.textContent = sel.size; } }, h('img', { src: img(x.thumb), alt: '', loading: 'lazy' })); return t; }));
    const count = h('b', {}, '0');
    const reload = async (newPaths = []) => { const l = (await api('media', { method: 'GET' })).media; if (multi) newPaths.forEach(p => sel.add(p)); draw(l); count.textContent = sel.size; return l; };
    const m = h('div', { class: 'modal-bg' }, h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'row between' }, h('h2', {}, multi ? 'Vyberte fotografie' : 'Vyberte fotografii'), h('button', { class: 'icon', onclick: () => close(null), 'aria-label': 'Zavřít' }, '✕')),
      uploader(async paths => { if (!multi && paths.length) return close(paths.slice(0, 1)); await reload(paths); }), grid,
      multi && h('div', { class: 'row end' }, h('span', { class: 'muted' }, 'Vybráno: ', count), h('button', { class: 'btn primary', onclick: () => close([...sel]) }, 'Přidat vybrané'))));
    document.body.append(m);
    try { await reload(); } catch (e) { toast(e.message, 'err'); }
  });
}

/* ---------- zálohy ---------- */
function backupsView() {
  const names = { site: 'Texty webu', sections: 'Kategorie', projects: 'Projekty', pages: 'Další stránky' };
  const list = h('div', { class: 'items' }); const sel = h('select', {}, Object.entries(names).map(([k, v]) => h('option', { value: k }, v)));
  const load = async () => {
    try {
      const b = (await api('backups', { method: 'GET', query: '&file=' + sel.value })).backups;
      list.replaceChildren(...(b.length ? b.map(x => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('strong', {}, fmtDate(x.time)), h('small', {}, `${x.version} · ${fmtSize(x.size)}`)),
        h('button', { class: 'btn', onclick: async () => { if (await confirmBox('Obnovit tuto verzi? Současný stav se předtím automaticky zazálohuje.', 'Obnovit')) { try { await api('restore', { body: { file: sel.value, version: x.version } }); await loadAll(); toast('Verze obnovena a zveřejněna.'); load(); } catch (e) { toast(e.message, 'err'); } } } }, 'Obnovit'))) : [h('p', { class: 'muted' }, 'Zatím žádné zálohy. Vzniknou při prvním uložení změn.')]));
    } catch (e) { list.replaceChildren(h('p', { class: 'err' }, e.message)); }
  };
  sel.addEventListener('change', load); load();
  return h('div', {}, pageHead('VERZE', 'Zálohy a obnovení'), h('p', { class: 'muted' }, 'Před každým uložením se předchozí verze automaticky zazálohuje (uchovává se posledních 40 verzí). Fotografie se zálohují zvlášť na úrovni NASu.'), field('Obsah', sel), list);
}

/* ---------- systém ---------- */
function systemView() {
  const d = h('div', { class: 'card' }, h('h2', {}, 'Diagnostika serveru'), h('p', { class: 'muted' }, 'Načítám…'));
  api('diag', { method: 'GET' }).then(({ diag: x }) => {
    const row = (ok, t, extra) => h('li', { class: ok ? 'ok' : 'bad' }, (ok ? '✓ ' : '✗ ') + t, extra && h('small', {}, ' ' + extra));
    d.replaceChildren(h('h2', {}, 'Diagnostika serveru'), h('ul', { class: 'diag' },
      row(x.php_ok, 'PHP ' + x.php, 'minimum 7.4'), row(x.gd, 'Rozšíření GD (optimalizace fotografií)', x.gd ? (x.webp ? '' : '– bez podpory WEBP') : '– fotografie se uloží bez zmenšení'),
      row(x.finfo, 'Rozšíření fileinfo (kontrola souborů)'), row(x.mbstring, 'Rozšíření mbstring'), row(x.private_writable, 'Soukromá složka zapisovatelná', x.private_dir),
      row(!x.private_in_webroot, 'Soukromá složka je mimo webroot'), row(x.content_writable, 'Složka content zapisovatelná'), row(x.uploads_writable, 'Složka uploads zapisovatelná'),
      row(x.https, 'Spojení je šifrované (HTTPS)', x.https ? '' : '– přes LAN/Tailscale po HTTP je to přijatelné'), row(!x.allow_public, 'Administrace omezena na LAN/Tailscale', 'vaše IP: ' + x.ip),
      h('li', {}, `Limity PHP: upload ${x.upload_max}, post ${x.post_max}, paměť ${x.memory}`)));
  }).catch(e => d.append(h('p', { class: 'err' }, e.message)));
  const cur = h('input', { type: 'password', autocomplete: 'current-password' }), nw = h('input', { type: 'password', autocomplete: 'new-password', minlength: 10 });
  return h('div', {}, pageHead('SYSTÉM', 'Systém a heslo'), d,
    h('form', { class: 'card', onsubmit: async e => { e.preventDefault(); try { await api('password', { body: { current: cur.value, new: nw.value } }); cur.value = nw.value = ''; toast('Heslo změněno.'); } catch (x) { toast(x.message, 'err'); } } },
      h('h2', {}, 'Změna hesla'), field('Současné heslo', cur), field('Nové heslo (min. 10 znaků)', nw), h('button', { class: 'btn primary', type: 'submit' }, 'Změnit heslo')));
}

boot();
