/* MaDacrame – veřejný web. Vykresluje stránky z content/*.json. Bez knihoven. */
document.documentElement.classList.add('js');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';
const isIllu = src => /(^|\/)assets\/visuals\//.test(src || '');
const paras = v => Array.isArray(v) ? v.filter(Boolean) : String(v || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
const pHtml = (v, cls = '') => paras(v).map(p => `<p${cls ? ` class="${cls}"` : ''}>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const sm = s => /^uploads\/[^/]+\.(jpe?g|png|webp)$/i.test(s || '') && !/-sm\./.test(s) ? s.replace(/(\.[a-z]+)$/i, '-sm$1') : s;
const pic = s => s || 'assets/visuals/specialni.svg';
const vis = list => (list || []).filter(x => x.visible !== false);

async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Nelze načíst ${path}`);
  return r.json();
}
async function loadAll() {
  const [site, areas, projects, pages] = await Promise.all(['site', 'sections', 'projects', 'pages'].map(n => getJSON(`content/${n}.json`)));
  return { site, areas: vis(areas), projects: vis(projects), pages: vis(pages) };
}

/* ---------- společné části ---------- */
function navLinks(d, active) {
  const l = [['index.html', 'Úvod', 'home'], ['oblast.html', 'Oblasti tvorby', 'areas'], ['projekty.html', 'Projekty', 'projects'], ['o-nas.html', 'O nás', 'about'], ['kontakt.html', 'Kontakt', 'contact']];
  return l.map(([h, t, k]) => `<a class="${active === k ? 'active' : ''}" href="${h}">${t}</a>`).join('') +
    d.pages.map(p => `<a class="${active === 'page:' + p.id ? 'active' : ''}" href="stranka.html?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a>`).join('');
}
const nav = (d, active = '') => `<header class="site-header"><div class="wrap header-inner"><a class="brand" href="index.html">Ma<span>D</span>acrame</a><nav class="nav" aria-label="Hlavní navigace">${navLinks(d, active)}</nav><button class="menu-toggle" aria-label="Otevřít menu" aria-expanded="false" aria-controls="mnav"><span class="bars"><i></i><i></i></span></button></div><nav class="mobile-nav" id="mnav" aria-label="Mobilní navigace">${navLinks(d, active)}</nav><div class="progress" aria-hidden="true"></div></header>`;
const footer = d => {
  const s = d.site, tel = (s.phone || '').replace(/\s/g, '');
  return `<footer class="footer"><div class="wrap"><div class="footer-top"><div class="f-brand"><a class="brand" href="index.html">Ma<span>D</span>acrame</a><p>${esc(s.footer_note || 'Kreativní a technická dílna')}</p></div>
<div class="f-col"><span class="eyebrow">NAVIGACE</span><a href="index.html">Úvod</a><a href="oblast.html">Oblasti tvorby</a><a href="projekty.html">Projekty</a><a href="o-nas.html">O nás</a><a href="kontakt.html">Kontakt</a>${d.pages.map(p => `<a href="stranka.html?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a>`).join('')}</div>
<div class="f-col"><span class="eyebrow">OBLASTI</span>${d.areas.map(a => `<a href="oblast.html?id=${encodeURIComponent(a.id)}">${esc(a.title)}</a>`).join('')}</div>
<div class="f-col"><span class="eyebrow">KONTAKT</span>${s.phone ? `<a href="tel:${esc(tel)}">${esc(s.phone)}</a>` : ''}${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}${s.facebook ? `<a href="${esc(safeUrl(s.facebook))}" target="_blank" rel="noopener">Facebook ↗</a>` : ''}${s.instagram ? `<a href="${esc(safeUrl(s.instagram))}" target="_blank" rel="noopener">Instagram ↗</a>` : ''}</div></div>
<div class="footer-word" aria-hidden="true">MaDacrame</div>
<div class="footer-bottom"><span>© <span id="year"></span> MaDacrame${s.location_note ? ' · ' + esc(s.location_note) : ''}</span><button type="button" class="totop">↑ Nahoru</button></div></div></footer>`;
};
const illu = src => isIllu(src) ? '<span class="illu-badge">Ilustrace</span>' : '';
const cta = (title, text, label = 'Kontaktovat nás') => `<section class="cta"><div class="wrap cta-inner"><div><span class="eyebrow">SPOLUPRÁCE</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div><a class="btn btn-primary" href="kontakt.html">${label} ↗</a></div></section>`;

function areaCard(a, i = 0) {
  return `<a class="area-card" href="oblast.html?id=${encodeURIComponent(a.id)}"><div class="card-image"><img src="${esc(sm(pic(a.image)))}" alt="${esc(a.title)}" loading="lazy">${illu(pic(a.image))}<span class="card-no">${String(i + 1).padStart(2, '0')}</span></div><div class="card-body"><span class="tag">${esc(a.kicker || 'OBLAST TVORBY')}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><span class="card-link">Prozkoumat oblast <span class="arrow">↗</span></span></div></a>`;
}
function projectCard(p, d) {
  const cat = d.areas.find(a => a.id === p.category);
  return `<a class="project" data-cat="${esc(p.category || '')}" href="projekt.html?id=${encodeURIComponent(p.id)}"><div class="project-img"><img src="${esc(sm(pic(p.image)))}" alt="${esc(p.title)}" loading="lazy">${illu(pic(p.image))}</div><div class="project-info"><span class="tag">${esc(cat ? cat.title : p.category || '')}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>${p.placeholder ? '<span class="placeholder-note">Ukázkový obsah · není skutečná realizace</span>' : '<span class="card-link">Číst projekt <span class="arrow">↗</span></span>'}</div></a>`;
}
function gallery(items) {
  items = (items || []).filter(g => g && g.src);
  if (!items.length) return '';
  return `<div class="gallery">${items.map((g, i) => `<figure class="g-item"><button type="button" class="g-btn" data-i="${i}" aria-label="Zvětšit fotografii"><img src="${esc(sm(g.src))}" alt="${esc(g.caption || '')}" loading="lazy"></button>${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`;
}
function pager(prev, next, hrefOf, backHref, backLabel) {
  const cell = (x, dir) => x ? `<a class="pager-link ${dir}" href="${hrefOf(x)}"><span class="small-label">${dir === 'prev' ? '← Předchozí' : 'Další →'}</span><strong>${esc(x.title)}</strong></a>` : '<span></span>';
  return `<nav class="pager wrap" aria-label="Další položky">${cell(prev, 'prev')}<a class="btn btn-ghost" href="${backHref}">${backLabel}</a>${cell(next, 'next')}</nav>`;
}
function setMeta(title, desc) {
  document.title = title ? `${title} — MaDacrame` : 'MaDacrame — kreativní a technická dílna';
  if (desc) {
    let m = $('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = String(desc).slice(0, 200);
  }
}
function setup(galleryItems) {
  document.body.classList.add('ready');
  const b = $('.menu-toggle'), m = $('.mobile-nav');
  if (b && m) {
    const set = o => { m.classList.toggle('open', o); b.classList.toggle('open', o); b.setAttribute('aria-expanded', String(o)); b.setAttribute('aria-label', o ? 'Zavřít menu' : 'Otevřít menu'); };
    b.addEventListener('click', () => set(!m.classList.contains('open')));
    m.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  const t = $('.totop'); if (t) t.addEventListener('click', () => window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }));
  if (galleryItems && galleryItems.length) lightbox(galleryItems.filter(g => g && g.src));
  enhance();
}
function lightbox(items) {
  let i = 0, box = null, opener = null, x0 = null;
  const img = () => $('img', box);
  const show = (dir = 0) => {
    const im = img(), g = items[i];
    box.classList.add('swap'); box.dataset.dir = dir;
    const done = () => { box && box.classList.remove('swap'); };
    im.onload = done; im.onerror = done; im.src = g.src; im.alt = g.caption || '';
    $('.lb-cap', box).textContent = g.caption || '';
    $('.lb-count', box).textContent = items.length > 1 ? `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}` : '';
    [1, -1].forEach(n => { const k = items[(i + n + items.length) % items.length]; if (k) new Image().src = k.src; });
  };
  const close = () => {
    if (!box) return; const bx = box; box = null;
    document.removeEventListener('keydown', key); document.body.classList.remove('lb-open');
    bx.classList.add('closing'); setTimeout(() => bx.remove(), RM ? 0 : 200); if (opener) opener.focus();
  };
  const step = n => { i = (i + n + items.length) % items.length; show(n); };
  const key = e => {
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Tab' && box) { const f = $$('button:not([hidden])', box); const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  };
  $$('.g-btn').forEach(btn => btn.addEventListener('click', () => {
    i = Number(btn.dataset.i); opener = btn;
    box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Galerie fotografií');
    box.innerHTML = '<button class="lb-close" aria-label="Zavřít">✕</button><button class="lb-nav lb-prev" aria-label="Předchozí">‹</button><figure class="lb-fig"><img alt=""><figcaption class="lb-cap"></figcaption></figure><button class="lb-nav lb-next" aria-label="Další">›</button><div class="lb-count"></div>';
    document.body.appendChild(box); document.body.classList.add('lb-open'); show();
    box.addEventListener('click', e => { if (e.target === box || e.target.classList.contains('lb-fig')) close(); });
    box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50 && items.length > 1) step(dx < 0 ? 1 : -1); });
    $('.lb-close', box).onclick = close; $('.lb-prev', box).onclick = () => step(-1); $('.lb-next', box).onclick = () => step(1);
    if (items.length < 2) $$('.lb-nav', box).forEach(n => n.hidden = true);
    document.addEventListener('keydown', key); $('.lb-close', box).focus();
  }));
}
const notFound = (d, label, back, backLabel) => {
  setMeta('Nenalezeno');
  $('#app').innerHTML = nav(d) + `<main class="wrap nf"><div class="nf-art" aria-hidden="true"><span>404</span></div><span class="eyebrow">${label}</span><h1>Tudy cesta nevede.</h1><p>Stránka, kterou hledáte, neexistuje nebo byla přesunuta.</p><a class="btn btn-primary" href="${back}">${backLabel} <span>↗</span></a></main>` + footer(d);
  setup();
};
const qid = () => new URLSearchParams(location.search).get('id');

/* ---------- stránky ---------- */
const heroWords = h => esc(h).split(' ').map((w, i) => `<span class="w"><span style="--i:${i}">${/skutečnost/i.test(w) ? `<em>${w}</em>` : w}</span></span>`).join(' ');
const HUD = '<svg class="hud" viewBox="0 0 200 200" aria-hidden="true"><g class="hud-spin"><circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" stroke-width=".6" stroke-dasharray="2 5"/></g><g class="hud-spin rev"><circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" stroke-width=".8"/><circle cx="152" cy="100" r="3" fill="currentColor"/></g><path d="M100 8v34M100 158v34M8 100h34M158 100h34" stroke="currentColor" stroke-width=".8"/><circle class="hud-pulse" cx="100" cy="100" r="4" fill="currentColor"/></svg>';
const SHAPES = '<svg class="shapes" viewBox="0 0 1200 700" aria-hidden="true"><g class="sh s1" data-depth="26"><polygon points="0,-34 30,-17 30,17 0,34 -30,17 -30,-17" transform="translate(1010 140)" fill="none" stroke="currentColor" stroke-width="1.2"/></g><g class="sh s2" data-depth="-18"><path d="M-12 0h24M0 -12v24" transform="translate(120 520)" stroke="currentColor" stroke-width="1.4"/></g><g class="sh s3" data-depth="40"><circle cx="1090" cy="560" r="46" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 6"/></g><g class="sh s4" data-depth="-30"><rect x="560" y="70" width="26" height="26" transform="rotate(20 573 83)" fill="none" stroke="currentColor" stroke-width="1.2"/></g><g class="sh s5" data-depth="22"><path d="M-12 0h24M0 -12v24" transform="translate(300 90)" stroke="currentColor" stroke-width="1.4"/></g></svg>';
async function home() {
  const d = await loadAll(), s = d.site;
  setMeta('', s.intro);
  const names = d.areas.map(a => esc(a.title)).join('<i>◆</i>');
  $('#app').innerHTML = nav(d, 'home') + `<main><section class="hero-section" data-hero><div class="hero-bg" aria-hidden="true"><div class="hero-grid"></div><div class="hero-glow"></div><div class="hero-glow g2"></div>${SHAPES}</div>
<div class="wrap hero"><div class="hero-copy"><span class="eyebrow hero-in" style="--d:.05s">${esc(s.eyebrow)}</span><h1>${heroWords(s.headline)}</h1><p class="lead hero-in" style="--d:.7s">${esc(s.intro)}</p><div class="hero-actions hero-in" style="--d:.85s"><a class="btn btn-primary" href="#oblasti">Vybrat oblast tvorby <span>↘</span></a><a class="btn btn-ghost" href="o-nas.html">Poznat MaDacrame</a></div></div>
<div class="hero-art hero-art-in"><img src="${esc(s.hero_image)}" alt="Vizuální identita dílny MaDacrame" fetchpriority="high">${HUD}<span class="hero-index">01 / MA DACRAME</span><span class="art-label">KREATIVNÍ A TECHNICKÁ DÍLNA</span><span class="coords" data-coords>X 000.0 · Y 000.0</span><i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br brr"></i>${illu(s.hero_image)}</div></div>
<a class="scroll-cue hero-in" style="--d:1.2s" href="#oblasti" aria-label="Pokračovat dolů"><span>SCROLL</span><i></i></a></section>
${names ? `<div class="ticker" aria-hidden="true"><div class="ticker-track"><span>${names}<i>◆</i></span><span>${names}<i>◆</i></span></div></div>` : ''}
<section class="directory section" id="oblasti"><div class="wrap"><div class="section-head"><div><span class="eyebrow">01 — ROZCESTNÍK</span><h2>${esc(s.manifesto_title)}</h2></div><p>${esc(s.manifesto_text)}</p></div><div class="cards">${d.areas.map((a, i) => areaCard(a, i)).join('')}</div></div></section>
<section class="section"><div class="wrap manifesto"><div><span class="eyebrow">02 — KDO JSME</span><h2>${esc(s.about_title)}</h2></div><div><p class="manifesto-copy">${esc(s.about_text)}</p><div class="stat-line"><div class="stat"><strong>01</strong><span>Společná značka</span></div><div class="stat"><strong>${String(d.areas.length).padStart(2, '0')}</strong><span>Oblasti tvorby</span></div><div class="stat"><strong>∞</strong><span>Nápady k realizaci</span></div></div><div class="hero-actions"><a class="btn btn-ghost" href="o-nas.html">Více o naší dílně ↗</a></div></div></div></section>
<section class="projects section" id="projekty"><div class="wrap"><div class="section-head"><div><span class="eyebrow">03 — VÝBĚR Z PORTFOLIA</span><h2>${esc(s.projects_title || 'Od nápadu k realizaci.')}</h2></div><p>${esc(s.projects_text || '')}</p></div>${d.projects.length ? `<div class="project-grid">${d.projects.slice(0, 6).map(p => projectCard(p, d)).join('')}</div><div class="hero-actions"><a class="btn btn-ghost" href="projekty.html">Všechny projekty ↗</a></div>` : emptyState('Projekty brzy doplníme.')}</div></section>
${cta(s.contact_title, s.contact_text, 'Kontaktovat MaDacrame')}</main>` + footer(d);
  setup();
  initHero();
}
const emptyState = t => `<div class="empty"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 4"/><path d="M16 24h16M24 16v16" stroke="currentColor" stroke-width="1.5"/></svg><p>${esc(t)}</p></div>`;

async function areas() {
  const d = await loadAll(), id = qid();
  if (!id) {
    setMeta('Oblasti tvorby');
    $('#app').innerHTML = nav(d, 'areas') + `<main><section class="wrap page-hero single"><div><span class="eyebrow">ROZCESTNÍK</span><h1>Oblasti tvorby</h1><p>${esc(d.site.manifesto_text)}</p></div></section><section class="wrap section"><div class="cards">${d.areas.map((a, i) => areaCard(a, i)).join('')}</div></section>${cta(d.site.contact_title, d.site.contact_text)}</main>` + footer(d);
    return setup();
  }
  const i = d.areas.findIndex(x => x.id === id), a = d.areas[i];
  if (!a) return notFound(d, 'OBLAST NENALEZENA', 'oblast.html', 'Zpět na oblasti tvorby');
  const related = d.projects.filter(p => p.category === a.id);
  setMeta(a.title, a.description);
  $('#app').innerHTML = nav(d, 'areas') + `<main><div class="wrap breadcrumb"><a href="index.html">Úvod</a> / <a href="oblast.html">Oblasti tvorby</a> / ${esc(a.title)}</div>
<section class="wrap page-hero"><div><span class="eyebrow">${esc(a.kicker || 'OBLAST TVORBY')}</span><h1>${esc(a.title)}</h1><p>${esc(a.intro)}</p>${a.owner ? `<span class="placeholder-note">Za tvorbou: ${esc(a.owner)}</span>` : ''}</div><div class="page-image"><img src="${esc(pic(a.image))}" alt="${esc(a.title)}">${illu(pic(a.image))}</div></section>
${paras(a.body).length ? `<section class="wrap section tight"><div class="prose">${pHtml(a.body)}</div></section>` : ''}
${(a.features || []).length ? `<section class="wrap section tight"><span class="eyebrow">CO TATO OBLAST ZAHRNUJE</span><h2 class="section-title">Možnosti a zaměření</h2><div class="feature-list">${a.features.map(f => `<div class="feature">${esc(f)}</div>`).join('')}</div></section>` : ''}
${(a.gallery || []).length ? `<section class="wrap section tight"><span class="eyebrow">GALERIE</span><h2 class="section-title">Z naší tvorby</h2>${gallery(a.gallery)}</section>` : ''}
${related.length ? `<section class="wrap section tight"><span class="eyebrow">SOUVISEJÍCÍ PROJEKTY</span><h2 class="section-title">Od nápadu k realizaci</h2><div class="project-grid">${related.map(p => projectCard(p, d)).join('')}</div></section>` : ''}
${cta('Máte konkrétní představu?', 'Ozvěte se nám. Rádi se podíváme na vaše zadání a společně probereme možnosti.')}
${pager(d.areas[i - 1], d.areas[i + 1], x => `oblast.html?id=${encodeURIComponent(x.id)}`, 'oblast.html', 'Všechny oblasti')}</main>` + footer(d);
  setup(a.gallery);
}

async function projects() {
  const d = await loadAll();
  const cur = new URLSearchParams(location.search).get('kat') || '';
  const used = d.areas.filter(a => d.projects.some(p => p.category === a.id));
  setMeta(d.site.projects_title || 'Projekty', d.site.projects_text);
  $('#app').innerHTML = nav(d, 'projects') + `<main><section class="wrap page-hero single"><div><span class="eyebrow">PORTFOLIO</span><h1>${esc(d.site.projects_title || 'Od nápadu k realizaci.')}</h1><p>${esc(d.site.projects_text || '')}</p></div></section><section class="wrap section tight">${used.length > 1 ? `<div class="chips" role="group" aria-label="Filtr podle oblasti"><a class="chip ${cur ? '' : 'on'}" data-cat="" href="projekty.html">Vše</a>${used.map(a => `<a class="chip ${cur === a.id ? 'on' : ''}" data-cat="${esc(a.id)}" href="projekty.html?kat=${encodeURIComponent(a.id)}">${esc(a.title)}</a>`).join('')}</div>` : ''}<p class="count mono" aria-live="polite"></p>${d.projects.length ? `<div class="project-grid" id="pgrid">${d.projects.map(p => projectCard(p, d)).join('')}</div>` : emptyState('Projekty brzy doplníme.')}</section>${cta(d.site.contact_title, d.site.contact_text)}</main>` + footer(d);
  setup();
  const grid = $('#pgrid'); if (!grid) return;
  const cards = $$('.project', grid), count = $('.count');
  let timer;
  const apply = (cat, animate) => {
    clearTimeout(timer);
    const show = cards.filter(c => !cat || c.dataset.cat === cat), hide = cards.filter(c => !show.includes(c));
    count.textContent = cat ? `Zobrazeno ${show.length} z ${cards.length}` : `${cards.length} ${cards.length === 1 ? 'projekt' : cards.length < 5 ? 'projekty' : 'projektů'}`;
    const swap = () => { hide.forEach(c => { c.hidden = true; c.classList.remove('is-out'); }); show.forEach((c, i) => { c.hidden = false; c.classList.remove('is-out'); if (animate) { c.removeAttribute('data-rv'); c.classList.remove('in'); } if (animate && !RM) { c.style.setProperty('--d', Math.min(i, 8) * 50 + 'ms'); c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in'); } }); };
    if (animate && !RM) { hide.forEach(c => c.classList.add('is-out')); cards.forEach(c => { if (!c.hidden) c.classList.add('is-out'); }); timer = setTimeout(swap, 200); } else swap();
  };
  apply(cur, false);
  $$('.chip').forEach(ch => ch.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); $$('.chip').forEach(x => x.classList.toggle('on', x === ch));
    history.replaceState(null, '', ch.getAttribute('href')); apply(ch.dataset.cat, true);
  }));
}

async function project() {
  const d = await loadAll(), id = qid();
  const i = d.projects.findIndex(x => x.id === id), p = d.projects[i];
  if (!p) return notFound(d, 'PROJEKT NENALEZEN', 'projekty.html', 'Zpět na projekty');
  const cat = d.areas.find(a => a.id === p.category);
  setMeta(p.title, p.description);
  $('#app').innerHTML = nav(d, 'projects') + `<main><div class="wrap breadcrumb"><a href="index.html">Úvod</a> / <a href="projekty.html">Projekty</a> / ${esc(p.title)}</div>
<article><section class="wrap page-hero"><div><span class="eyebrow">${cat ? `<a href="oblast.html?id=${encodeURIComponent(cat.id)}">${esc(cat.title)}</a>` : esc(p.category || 'PROJEKT')}</span><h1 class="h1-md">${esc(p.title)}</h1><p>${esc(p.description)}</p>${p.placeholder ? '<span class="placeholder-note">Ukázkový obsah · není skutečná realizace</span>' : ''}</div><div class="page-image"><img src="${esc(pic(p.image))}" alt="${esc(p.title)}">${illu(pic(p.image))}</div></section>
${paras(p.paragraphs).length ? `<section class="wrap section tight"><div class="prose">${pHtml(p.paragraphs)}</div></section>` : ''}
${(p.gallery || []).length ? `<section class="wrap section tight"><span class="eyebrow">GALERIE</span>${gallery(p.gallery)}</section>` : ''}</article>
${pager(d.projects[i - 1], d.projects[i + 1], x => `projekt.html?id=${encodeURIComponent(x.id)}`, 'projekty.html', 'Zpět na projekty')}</main>` + footer(d);
  setup(p.gallery);
}

async function about() {
  const d = await loadAll(), s = d.site;
  setMeta('O nás', s.about_text);
  $('#app').innerHTML = nav(d, 'about') + `<main><section class="wrap page-hero"><div><span class="eyebrow">ZA ZNAČKOU MADACRAME</span><h1>${esc(s.about_page_title || 'O nás')}</h1><p>${esc(s.about_text)}</p></div><div class="page-image"><img src="${esc(s.hero_image)}" alt="MaDacrame – kreativní a technická dílna">${illu(s.hero_image)}</div></section><section class="wrap section about-grid"><div><span class="eyebrow">NÁŠ PŘÍSTUP</span><h2 class="section-title">Tvoříme, zkoušíme, hledáme řešení.</h2></div><div>${pHtml(s.about_page_body)}<a class="btn btn-ghost" href="oblast.html">Prohlédnout oblasti tvorby ↗</a></div></section></main>` + footer(d);
  setup();
}

async function contact() {
  const d = await loadAll(), s = d.site;
  setMeta('Kontakt', s.contact_text);
  $('#app').innerHTML = nav(d, 'contact') + `<main><section class="wrap page-hero"><div><span class="eyebrow">OZVĚTE SE NÁM</span><h1>${esc(s.contact_title)}</h1><p>${esc(s.contact_text)}</p></div><div class="page-image"><img src="${esc(s.hero_image)}" alt="MaDacrame">${illu(s.hero_image)}</div></section>
<section class="wrap section"><dl class="contact-list"><div><dt class="eyebrow">TELEFON</dt><dd><a href="tel:${esc((s.phone || '').replace(/\s/g, ''))}">${esc(s.phone)}</a></dd></div><div><dt class="eyebrow">E-MAIL</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd></div>${s.location_note ? `<div><dt class="eyebrow">KDE PŮSOBÍME</dt><dd>${esc(s.location_note)}</dd></div>` : ''}</dl>
<div class="social"><span class="eyebrow">SLEDUJTE NÁS</span><div class="hero-actions">${s.facebook ? `<a class="btn btn-ghost" href="${esc(safeUrl(s.facebook))}" target="_blank" rel="noopener">Facebook ↗</a>` : ''}${s.instagram ? `<a class="btn btn-ghost" href="${esc(safeUrl(s.instagram))}" target="_blank" rel="noopener">Instagram ↗</a>` : ''}</div></div></section></main>` + footer(d);
  setup();
}

async function customPage() {
  const d = await loadAll(), id = qid();
  const i = d.pages.findIndex(x => x.id === id), p = d.pages[i];
  if (!p) return notFound(d, 'STRÁNKA NENALEZENA', 'index.html', 'Zpět na úvod');
  setMeta(p.title, p.intro);
  $('#app').innerHTML = nav(d, 'page:' + p.id) + `<main><div class="wrap breadcrumb"><a href="index.html">Úvod</a> / ${esc(p.title)}</div><section class="wrap page-hero${p.image ? '' : ' single'}"><div><span class="eyebrow">${esc(p.kicker || 'MADACRAME')}</span><h1 class="h1-md">${esc(p.title)}</h1><p>${esc(p.intro || '')}</p></div>${p.image ? `<div class="page-image"><img src="${esc(pic(p.image))}" alt="${esc(p.title)}">${illu(pic(p.image))}</div>` : ''}</section><section class="wrap section tight"><div class="prose">${pHtml(p.body)}</div></section>${(p.gallery || []).length ? `<section class="wrap section tight">${gallery(p.gallery)}</section>` : ''}</main>` + footer(d);
  setup(p.gallery);
}

/* ---------- animační systém (jeden sdílený: IntersectionObserver + CSS) ---------- */
const REVEAL = [
  ['.breadcrumb', 'fade'], ['.page-hero > div:first-child > *', 'up'], ['.page-image', 'clip'], ['.section-head > *', 'up'], ['.section-title', 'up'],
  ['.cards > *', 'up'], ['.project-grid > *', 'up'], ['.prose > *', 'up'], ['.feature', 'up'], ['.manifesto > *', 'up'], ['.stat', 'up'], ['.about-grid > *', 'up'],
  ['.contact-list > div', 'up'], ['.social', 'up'], ['.chips', 'up'], ['.g-item', 'scale'], ['.cta-inner > *', 'up'], ['.pager > *', 'up'], ['.empty', 'up'], ['.nf > *', 'up'],
  ['.ticker', 'fade'], ['.f-brand, .f-col', 'up'], ['.footer-word', 'fade'],
];
function enhance() {
  if (RM || !('IntersectionObserver' in window)) { $$('.stat strong').forEach(() => 0); return; }
  const seen = new Set(), els = [];
  REVEAL.forEach(([sel, kind]) => $$(sel).forEach(el => {
    if (seen.has(el) || el.closest('.hero-section')) return; seen.add(el);
    const sib = el.parentElement ? [...el.parentElement.children].filter(c => seen.has(c)) : [el];
    el.dataset.rv = kind; el.style.setProperty('--d', Math.min(sib.indexOf(el), 6) * 70 + 'ms'); els.push(el);
  }));
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting && en.boundingClientRect.top > 0) return;
    const el = en.target; io.unobserve(el); el.classList.add('in');
    const strong = el.matches('.stat') ? $('strong', el) : null; if (strong) countUp(strong);
    const done = ev => { if (ev.propertyName === 'transform' || ev.propertyName === 'clip-path') { el.removeEventListener('transitionend', done); el.removeAttribute('data-rv'); el.classList.remove('in'); el.style.removeProperty('--d'); } };
    el.addEventListener('transitionend', done);
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => io.observe(el));
  // parallax obrázků v hlavičkách stránek (jen viditelné)
  const pars = $$('.page-image img'); if (pars.length) { pars.forEach(i => i.classList.add('par')); onScroll.fns.push(() => pars.forEach(im => { const r = im.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; im.style.transform = `translate3d(0,${((r.top + r.height / 2 - innerHeight / 2) * -0.06).toFixed(1)}px,0) scale(1.12)`; })); }
}
function countUp(el) {
  const raw = el.textContent.trim(); if (!/^\d+$/.test(raw)) return;
  const n = parseInt(raw, 10), len = raw.length, t0 = performance.now(), dur = 900;
  const tick = t => { const k = Math.min(1, (t - t0) / dur), v = Math.round(n * (1 - Math.pow(1 - k, 3))); el.textContent = String(v).padStart(len, '0'); if (k < 1) requestAnimationFrame(tick); };
  el.textContent = '0'.padStart(len, '0'); requestAnimationFrame(tick);
}

/* hero: pohyb za kurzorem, souřadnice, scroll cue */
function initHero() {
  const hero = $('[data-hero]'); if (!hero || RM) return;
  const art = $('.hero-art', hero), co = $('[data-coords]', hero); let raf = 0, px = 0, py = 0, mx = 0, my = 0, cx = 0, cy = 0;
  if (FINE) {
    const paint = () => { raf = 0; hero.style.setProperty('--px', px.toFixed(3)); hero.style.setProperty('--py', py.toFixed(3)); hero.style.setProperty('--mx', mx + 'px'); hero.style.setProperty('--my', my + 'px'); if (co) co.textContent = `X ${cx.toFixed(1).padStart(5, '0')} · Y ${cy.toFixed(1).padStart(5, '0')}`; };
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; px = mx / r.width - .5; py = my / r.height - .5;
      if (art) { const a = art.getBoundingClientRect(); cx = Math.max(0, Math.min(100, (e.clientX - a.left) / a.width * 100)); cy = Math.max(0, Math.min(100, (e.clientY - a.top) / a.height * 100)); }
      if (!raf) raf = requestAnimationFrame(paint);
    });
    hero.addEventListener('pointerleave', () => { px = py = 0; if (!raf) raf = requestAnimationFrame(paint); });
  }
  const cue = $('.scroll-cue', hero), bg = $('.hero-bg', hero);
  onScroll.fns.push(y => { if (cue) cue.classList.toggle('gone', y > 80); if (bg && y < innerHeight) bg.style.transform = `translate3d(0,${(y * 0.18).toFixed(1)}px,0)`; });
}

/* globální: navigace při scrollu, progress, přechody mezi stránkami, spotlight karet */
const onScroll = { fns: [], last: 0, raf: 0 };
function initGlobal() {
  const run = () => {
    onScroll.raf = 0; const y = window.scrollY, hd = $('.site-header');
    if (hd) {
      const open = $('.mobile-nav.open'); hd.classList.toggle('scrolled', y > 8);
      const dy = y - onScroll.last;
      if (open || y < 420 || dy < -4) hd.classList.remove('hide'); else if (dy > 4) hd.classList.add('hide');
      const pr = $('.progress', hd), max = document.documentElement.scrollHeight - innerHeight; if (pr) pr.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    }
    if (Math.abs(y - onScroll.last) > 4 || y < 420) onScroll.last = y;
    onScroll.fns.forEach(f => f(y));
  };
  window.addEventListener('scroll', () => { if (!onScroll.raf) onScroll.raf = requestAnimationFrame(run); }, { passive: true });
  window.addEventListener('resize', () => { if (!onScroll.raf) onScroll.raf = requestAnimationFrame(run); });
  run();
  if (FINE && !RM) document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.area-card, .project'); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty('--sx', (e.clientX - r.left) + 'px'); c.style.setProperty('--sy', (e.clientY - r.top) + 'px');
  }, { passive: true });
  if (!RM) document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || u.pathname === location.pathname && (u.hash || u.search === location.search)) return;
    e.preventDefault(); document.body.classList.add('leaving'); setTimeout(() => { location.href = u.href; }, 190);
  });
  window.addEventListener('pageshow', e => { if (e.persisted) document.body.classList.remove('leaving'); });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'home';
  initGlobal();
  ({ home, area: areas, areas, projects, project, about, contact, customPage }[page] || home)().catch(err => {
    console.error(err);
    $('#app').innerHTML = '<main class="wrap not-found"><h1>Obsah se nepodařilo načíst.</h1><p>Zkuste stránku obnovit. Pokud potíže přetrvají, zkontrolujte, zda je složka content nahraná společně s webem.</p></main>';
  });
});
