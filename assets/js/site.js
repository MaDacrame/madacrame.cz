/* MaDacrame – veřejný web. Vykresluje stránky z content/*.json. Bez knihoven. */
const $ = (s, r = document) => r.querySelector(s);
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
const nav = (d, active = '') => `<header class="site-header"><div class="wrap header-inner"><a class="brand" href="index.html">Ma<span>D</span>acrame</a><nav class="nav" aria-label="Hlavní navigace">${navLinks(d, active)}</nav><button class="menu-toggle" aria-label="Otevřít menu" aria-expanded="false">MENU</button></div><nav class="mobile-nav" aria-label="Mobilní navigace">${navLinks(d, active)}</nav></header>`;
const footer = s => `<footer class="footer"><div class="wrap footer-inner"><a class="brand" href="index.html">Ma<span style="color:var(--orange)">D</span>acrame</a><span>${esc(s.footer_note || 'Kreativní a technická dílna')} · ${esc(s.location_note || '')}</span><span>© <span id="year"></span> MaDacrame</span></div></footer>`;
const illu = src => isIllu(src) ? '<span class="illu-badge">Ilustrace</span>' : '';
const cta = (title, text, label = 'Kontaktovat nás') => `<section class="cta"><div class="wrap cta-inner"><div><span class="eyebrow">SPOLUPRÁCE</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div><a class="btn btn-primary" href="kontakt.html">${label} ↗</a></div></section>`;

function areaCard(a) {
  return `<a class="area-card" href="oblast.html?id=${encodeURIComponent(a.id)}"><div class="card-image"><img src="${esc(sm(pic(a.image)))}" alt="${esc(a.title)}" loading="lazy">${illu(pic(a.image))}</div><div class="card-body"><span class="tag">${esc(a.kicker || 'OBLAST TVORBY')}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><span class="card-link">Prozkoumat oblast <span class="arrow">↗</span></span></div></a>`;
}
function projectCard(p, d) {
  const cat = d.areas.find(a => a.id === p.category);
  return `<a class="project" href="projekt.html?id=${encodeURIComponent(p.id)}"><div class="project-img"><img src="${esc(sm(pic(p.image)))}" alt="${esc(p.title)}" loading="lazy">${illu(pic(p.image))}</div><div class="project-info"><span class="tag">${esc(cat ? cat.title : p.category || '')}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>${p.placeholder ? '<span class="placeholder-note">Ukázkový obsah · není skutečná realizace</span>' : '<span class="card-link">Číst projekt <span class="arrow">↗</span></span>'}</div></a>`;
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
  const b = $('.menu-toggle'), m = $('.mobile-nav');
  if (b && m) b.addEventListener('click', () => { const o = m.classList.toggle('open'); b.setAttribute('aria-expanded', String(o)); });
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  if (galleryItems && galleryItems.length) lightbox(galleryItems.filter(g => g && g.src));
}
function lightbox(items) {
  let i = 0, box = null;
  const show = () => { $('img', box).src = items[i].src; $('img', box).alt = items[i].caption || ''; $('.lb-cap', box).textContent = items[i].caption || ''; };
  const close = () => { if (box) { box.remove(); box = null; document.removeEventListener('keydown', key); } };
  const step = n => { i = (i + n + items.length) % items.length; show(); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); };
  document.querySelectorAll('.g-btn').forEach(btn => btn.addEventListener('click', () => {
    i = Number(btn.dataset.i);
    box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button class="lb-close" aria-label="Zavřít">✕</button><button class="lb-nav lb-prev" aria-label="Předchozí">‹</button><img alt=""><button class="lb-nav lb-next" aria-label="Další">›</button><p class="lb-cap"></p>';
    document.body.appendChild(box); show();
    box.addEventListener('click', e => { if (e.target === box) close(); });
    $('.lb-close', box).onclick = close; $('.lb-prev', box).onclick = () => step(-1); $('.lb-next', box).onclick = () => step(1);
    if (items.length < 2) box.querySelectorAll('.lb-nav').forEach(n => n.hidden = true);
    document.addEventListener('keydown', key);
  }));
}
const notFound = (d, label, back, backLabel) => {
  setMeta('Nenalezeno');
  $('#app').innerHTML = nav(d) + `<main class="wrap not-found"><span class="eyebrow">404 · ${label}</span><h1>Tudy cesta nevede.</h1><a class="btn btn-primary" href="${back}">${backLabel}</a></main>` + footer(d.site);
  setup();
};
const qid = () => new URLSearchParams(location.search).get('id');

/* ---------- stránky ---------- */
async function home() {
  const d = await loadAll(), s = d.site;
  setMeta('', s.intro);
  $('#app').innerHTML = nav(d, 'home') + `<main><section class="wrap hero"><div class="hero-copy"><span class="eyebrow">${esc(s.eyebrow)}</span><h1>${esc(s.headline).replace('skutečnost', '<em>skutečnost</em>')}</h1><p class="lead">${esc(s.intro)}</p><div class="hero-actions"><a class="btn btn-primary" href="#oblasti">Vybrat oblast tvorby <span>↘</span></a><a class="btn btn-ghost" href="o-nas.html">Poznat MaDacrame</a></div></div><div class="hero-art"><img src="${esc(s.hero_image)}" alt="Vizuální identita dílny MaDacrame"><span class="hero-index">01 / MA DACRAME</span><span class="art-label">KREATIVNÍ A TECHNICKÁ DÍLNA</span>${illu(s.hero_image)}</div></section>
<section class="directory section" id="oblasti"><div class="wrap"><div class="section-head"><div><span class="eyebrow">ROZCESTNÍK</span><h2>${esc(s.manifesto_title)}</h2></div><p>${esc(s.manifesto_text)}</p></div><div class="cards">${d.areas.map(areaCard).join('')}</div></div></section>
<section class="section"><div class="wrap manifesto"><div><span class="eyebrow">KDO JSME</span><h2>${esc(s.about_title)}</h2></div><div><p class="manifesto-copy">${esc(s.about_text)}</p><div class="stat-line"><div class="stat"><strong>01</strong><span>Společná značka</span></div><div class="stat"><strong>${String(d.areas.length).padStart(2, '0')}</strong><span>Oblasti tvorby</span></div><div class="stat"><strong>∞</strong><span>Nápady k realizaci</span></div></div><div class="hero-actions"><a class="btn btn-ghost" href="o-nas.html">Více o naší dílně ↗</a></div></div></div></section>
<section class="projects section" id="projekty"><div class="wrap"><div class="section-head"><div><span class="eyebrow">VÝBĚR Z PORTFOLIA</span><h2>${esc(s.projects_title || 'Od nápadu k realizaci.')}</h2></div><p>${esc(s.projects_text || '')}</p></div>${d.projects.length ? `<div class="project-grid">${d.projects.slice(0, 6).map(p => projectCard(p, d)).join('')}</div><div class="hero-actions"><a class="btn btn-ghost" href="projekty.html">Všechny projekty ↗</a></div>` : '<p class="muted">Projekty brzy doplníme.</p>'}</div></section>
${cta(s.contact_title, s.contact_text, 'Kontaktovat MaDacrame')}</main>` + footer(s);
  setup();
}

async function areas() {
  const d = await loadAll(), id = qid();
  if (!id) {
    setMeta('Oblasti tvorby');
    $('#app').innerHTML = nav(d, 'areas') + `<main><section class="wrap page-hero single"><div><span class="eyebrow">ROZCESTNÍK</span><h1>Oblasti tvorby</h1><p>${esc(d.site.manifesto_text)}</p></div></section><section class="wrap section"><div class="cards">${d.areas.map(areaCard).join('')}</div></section>${cta(d.site.contact_title, d.site.contact_text)}</main>` + footer(d.site);
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
${pager(d.areas[i - 1], d.areas[i + 1], x => `oblast.html?id=${encodeURIComponent(x.id)}`, 'oblast.html', 'Všechny oblasti')}</main>` + footer(d.site);
  setup(a.gallery);
}

async function projects() {
  const d = await loadAll();
  const cur = new URLSearchParams(location.search).get('kat') || '';
  const used = d.areas.filter(a => d.projects.some(p => p.category === a.id));
  const list = d.projects.filter(p => !cur || p.category === cur);
  setMeta(d.site.projects_title || 'Projekty', d.site.projects_text);
  $('#app').innerHTML = nav(d, 'projects') + `<main><section class="wrap page-hero single"><div><span class="eyebrow">PORTFOLIO</span><h1>${esc(d.site.projects_title || 'Od nápadu k realizaci.')}</h1><p>${esc(d.site.projects_text || '')}</p></div></section><section class="wrap section tight">${used.length > 1 ? `<div class="chips"><a class="chip ${cur ? '' : 'on'}" href="projekty.html">Vše</a>${used.map(a => `<a class="chip ${cur === a.id ? 'on' : ''}" href="projekty.html?kat=${encodeURIComponent(a.id)}">${esc(a.title)}</a>`).join('')}</div>` : ''}${list.length ? `<div class="project-grid">${list.map(p => projectCard(p, d)).join('')}</div>` : '<p class="muted">V této kategorii zatím nejsou žádné projekty.</p>'}</section>${cta(d.site.contact_title, d.site.contact_text)}</main>` + footer(d.site);
  setup();
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
${pager(d.projects[i - 1], d.projects[i + 1], x => `projekt.html?id=${encodeURIComponent(x.id)}`, 'projekty.html', 'Zpět na projekty')}</main>` + footer(d.site);
  setup(p.gallery);
}

async function about() {
  const d = await loadAll(), s = d.site;
  setMeta('O nás', s.about_text);
  $('#app').innerHTML = nav(d, 'about') + `<main><section class="wrap page-hero"><div><span class="eyebrow">ZA ZNAČKOU MADACRAME</span><h1>${esc(s.about_page_title || 'O nás')}</h1><p>${esc(s.about_text)}</p></div><div class="page-image"><img src="${esc(s.hero_image)}" alt="MaDacrame – kreativní a technická dílna">${illu(s.hero_image)}</div></section><section class="wrap section about-grid"><div><span class="eyebrow">NÁŠ PŘÍSTUP</span><h2 class="section-title">Tvoříme, zkoušíme, hledáme řešení.</h2></div><div>${pHtml(s.about_page_body)}<a class="btn btn-ghost" href="oblast.html">Prohlédnout oblasti tvorby ↗</a></div></section></main>` + footer(s);
  setup();
}

async function contact() {
  const d = await loadAll(), s = d.site;
  setMeta('Kontakt', s.contact_text);
  $('#app').innerHTML = nav(d, 'contact') + `<main><section class="wrap page-hero"><div><span class="eyebrow">OZVĚTE SE NÁM</span><h1>${esc(s.contact_title)}</h1><p>${esc(s.contact_text)}</p></div><div class="page-image"><img src="${esc(s.hero_image)}" alt="MaDacrame">${illu(s.hero_image)}</div></section>
<section class="wrap section"><dl class="contact-list"><div><dt class="eyebrow">TELEFON</dt><dd><a href="tel:${esc((s.phone || '').replace(/\s/g, ''))}">${esc(s.phone)}</a></dd></div><div><dt class="eyebrow">E-MAIL</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd></div>${s.location_note ? `<div><dt class="eyebrow">KDE PŮSOBÍME</dt><dd>${esc(s.location_note)}</dd></div>` : ''}</dl>
<div class="social"><span class="eyebrow">SLEDUJTE NÁS</span><div class="hero-actions">${s.facebook ? `<a class="btn btn-ghost" href="${esc(safeUrl(s.facebook))}" target="_blank" rel="noopener">Facebook ↗</a>` : ''}${s.instagram ? `<a class="btn btn-ghost" href="${esc(safeUrl(s.instagram))}" target="_blank" rel="noopener">Instagram ↗</a>` : ''}</div></div></section></main>` + footer(s);
  setup();
}

async function customPage() {
  const d = await loadAll(), id = qid();
  const i = d.pages.findIndex(x => x.id === id), p = d.pages[i];
  if (!p) return notFound(d, 'STRÁNKA NENALEZENA', 'index.html', 'Zpět na úvod');
  setMeta(p.title, p.intro);
  $('#app').innerHTML = nav(d, 'page:' + p.id) + `<main><div class="wrap breadcrumb"><a href="index.html">Úvod</a> / ${esc(p.title)}</div><section class="wrap page-hero${p.image ? '' : ' single'}"><div><span class="eyebrow">${esc(p.kicker || 'MADACRAME')}</span><h1 class="h1-md">${esc(p.title)}</h1><p>${esc(p.intro || '')}</p></div>${p.image ? `<div class="page-image"><img src="${esc(pic(p.image))}" alt="${esc(p.title)}">${illu(pic(p.image))}</div>` : ''}</section><section class="wrap section tight"><div class="prose">${pHtml(p.body)}</div></section>${(p.gallery || []).length ? `<section class="wrap section tight">${gallery(p.gallery)}</section>` : ''}</main>` + footer(d.site);
  setup(p.gallery);
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'home';
  ({ home, area: areas, areas, projects, project, about, contact, customPage }[page] || home)().catch(err => {
    console.error(err);
    $('#app').innerHTML = '<main class="wrap not-found"><h1>Obsah se nepodařilo načíst.</h1><p>Zkuste stránku obnovit. Pokud potíže přetrvají, zkontrolujte, zda je složka content nahraná společně s webem.</p></main>';
  });
});
