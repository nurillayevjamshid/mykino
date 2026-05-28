/* ============================================================
 * Frame demo page — MOCK only.
 * Mini app bilan hech qanday aloqa yo'q: API chaqirilmaydi,
 * localStorage o'qilmaydi, Telegram SDK ishlatilmaydi.
 * ============================================================ */

const GENRES = [
  'Barchasi','Boyevik','Drama','Komediya','Triller','Fantastika',
  'Detektiv','Romantik','Sarguzasht','Multfilm','Qo\'rqinchli','Tarixiy',
  'Hujjatli','Sport','Harbiy','Vestern'
];

const TITLES = [
  'Yulduzlar urushi','Cho\'lqironi','Qora ko\'zgu','Oxirgi qahramon',
  'Tundagi yorug\'lik','Cheksiz osmon','Shahar qonunlari','Soya o\'yini',
  'Yashirin xona','Kelajak elchisi','Sovuq qish','Olov ostida',
  'Daryo bo\'yidagi sir','Yerning so\'nggi kuni','Olmos halqa','Qora suv',
  'Mash\'um nigoh','Yulduzli kecha','Tog\'lar ortidagi shahar','Tilsim',
  'Yo\'qolgan kalit','Oltin asr','Cheksiz tush','Quyosh tutilishi',
  'Shamol shahzodasi','Yer ostidagi olam','Mavhum chiziq','Oxirgi nafas',
  'Yorug\'lik manbai','Qora paypoq','Soat mexanizmi','Tunda safar',
  'Yulduzli yo\'l','Kosmos chaqiriqlari','Tomir urishi','Sirli xat'
];

const GRADIENTS = [
  ['#ff3366','#9933ff'],['#1d4f8b','#4f1d8b'],['#ff6b35','#f7c548'],
  ['#06ffa5','#0066ff'],['#ff006e','#3a0ca3'],['#8338ec','#3a86ff'],
  ['#fb5607','#ffbe0b'],['#02c39a','#028090'],['#ef476f','#06d6a0'],
  ['#264653','#2a9d8f'],['#e63946','#f1faee'],['#a8dadc','#457b9d'],
  ['#bc4749','#386641'],['#7209b7','#560bad'],['#003049','#d62828'],
];

function rand(max){return Math.floor(Math.random()*max)}
function pickGrad(i){return GRADIENTS[i%GRADIENTS.length]}

/* generate mock movies */
const MOVIES = TITLES.map((t,i)=>{
  const [c1,c2] = pickGrad(i);
  const badges = [];
  if(Math.random()>.3) badges.push('hd');
  if(Math.random()>.7) badges.push('4k');
  if(Math.random()>.6) badges.push('new');
  if(Math.random()>.5) badges.push('dub');
  return {
    id:i+1,
    title:t,
    year:2018+rand(8),
    rating:(6+Math.random()*4).toFixed(1),
    genre:GENRES[1+rand(GENRES.length-1)],
    type:Math.random()>.7?'series':'film',
    badges,
    grad:`linear-gradient(135deg,${c1},${c2})`,
    duration:80+rand(80),
    desc:'Bu filmda qahramon mo\'jizaviy hodisalar va kutilmagan burilishlar bilan to\'lib-toshgan g\'ayrioddiy sayohatni boshdan kechiradi. Har bir kadr — yangi sirning kaliti.',
  };
});

const TV_CHANNELS = [
  {name:'Frame 1',cat:'Asosiy'},{name:'Frame Kino',cat:'Kino'},
  {name:'Frame Sport',cat:'Sport'},{name:'Frame Bolalar',cat:'Bolalar'},
  {name:'Frame News',cat:'Yangiliklar'},{name:'Frame Music',cat:'Musiqa'},
  {name:'Frame HD',cat:'HD'},{name:'Frame Dublyaj',cat:'Dublyaj'},
  {name:'Frame Comedy',cat:'Komediya'},{name:'Frame Action',cat:'Boyevik'},
  {name:'Frame Drama',cat:'Drama'},{name:'Frame Family',cat:'Oilaviy'},
];

/* ============ RENDER ============ */
function cardHTML(m){
  const badges = m.badges.map(b=>{
    const label = {hd:'HD','4k':'4K',new:'YANGI',dub:'DUB'}[b];
    return `<span class="badge b-${b}">${label}</span>`;
  }).join('');
  return `
    <div class="card" data-id="${m.id}">
      <div class="card-poster" style="background:${m.grad}">
        <div class="card-badges">${badges}</div>
        <div class="card-rating">
          <svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.9L22 10l-5.5 5.4L18 23l-6-3.3L6 23l1.5-7.6L2 10l7.1-1.1z"/></svg>
          ${m.rating}
        </div>
      </div>
      <div class="card-title">${m.title}</div>
      <div class="card-meta">${m.year} • ${m.genre}</div>
    </div>`;
}

function rowHTML(title,movies){
  return `
    <div class="row-head">
      <div class="row-title">${title}</div>
      <a href="#" class="row-more">Barchasi →</a>
    </div>
    <div class="row-track">${movies.map(cardHTML).join('')}</div>
  `;
}

function renderHome(){
  // chips
  const chips = document.getElementById('genreChips');
  chips.innerHTML = GENRES.map((g,i)=>
    `<div class="chip ${i===0?'active':''}">${g}</div>`
  ).join('');
  chips.querySelectorAll('.chip').forEach(el=>{
    el.addEventListener('click',()=>{
      chips.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      el.classList.add('active');
    });
  });

  // rows
  const rows = {
    trend:{title:'Trenddagi filmlar',items:MOVIES.slice(0,12)},
    dub:{title:'Frame Dublyaj — eksklyuziv',items:MOVIES.filter(m=>m.badges.includes('dub')).slice(0,12)},
    new:{title:'Yangi qo\'shilganlar',items:MOVIES.filter(m=>m.badges.includes('new')).slice(0,12)},
    series:{title:'Mashhur seriallar',items:MOVIES.filter(m=>m.type==='series').slice(0,12)},
  };
  document.querySelectorAll('.row').forEach(r=>{
    const data = rows[r.dataset.row];
    if(data) r.innerHTML = rowHTML(data.title,data.items);
  });
}

let catalogVisible = 12;
let catalogFilter = 'all';
let catalogSort = 'date';

function renderCatalog(){
  let list = MOVIES.slice();
  if(catalogFilter==='film')      list = list.filter(m=>m.type==='film');
  else if(catalogFilter==='series') list = list.filter(m=>m.type==='series');
  else if(catalogFilter==='dub')    list = list.filter(m=>m.badges.includes('dub'));
  else if(catalogFilter==='new')    list = list.filter(m=>m.badges.includes('new'));

  if(catalogSort==='rating')      list.sort((a,b)=>b.rating-a.rating);
  else if(catalogSort==='name')   list.sort((a,b)=>a.title.localeCompare(b.title));
  else if(catalogSort==='year')   list.sort((a,b)=>b.year-a.year);

  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = list.slice(0,catalogVisible).map(cardHTML).join('');

  const more = document.getElementById('loadMore');
  more.style.display = catalogVisible>=list.length ? 'none' : '';
}

function renderTV(){
  const grid = document.getElementById('tvGrid');
  grid.innerHTML = TV_CHANNELS.map(ch=>`
    <div class="tv-card">
      <div class="tv-logo">${ch.name.split(' ')[1]?.[0]||'F'}</div>
      <div>
        <div class="tv-name">${ch.name}</div>
        <div class="tv-live">LIVE • ${ch.cat}</div>
      </div>
    </div>
  `).join('');
}

/* ============ NAV ============ */
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>{
    p.classList.toggle('active', p.dataset.page===name);
  });
  document.querySelectorAll('.nav-link').forEach(a=>{
    a.classList.toggle('active', a.dataset.page===name);
  });
  window.scrollTo({top:0,behavior:'instant'});
}

document.querySelectorAll('.nav-link').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    showPage(a.dataset.page);
  });
});

/* ============ FILTER ============ */
document.querySelectorAll('.filter-chip').forEach(c=>{
  c.addEventListener('click',()=>{
    document.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
    catalogFilter = c.dataset.filter;
    catalogVisible = 12;
    renderCatalog();
  });
});
document.getElementById('sortSelect').addEventListener('change',e=>{
  catalogSort = e.target.value;
  renderCatalog();
});
document.getElementById('loadMore').addEventListener('click',()=>{
  catalogVisible += 12;
  renderCatalog();
});

/* ============ SEARCH ============ */
const overlay = document.getElementById('searchOverlay');
document.getElementById('searchBtn').addEventListener('click',()=>{
  overlay.classList.add('open');
  setTimeout(()=>document.getElementById('searchInput').focus(),100);
});
document.getElementById('closeSearch').addEventListener('click',()=>{
  overlay.classList.remove('open');
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') overlay.classList.remove('open');
});

/* ============ MODAL ============ */
const modal = document.getElementById('movieModal');
function openMovie(id){
  const m = MOVIES.find(x=>x.id===+id);
  if(!m) return;
  document.getElementById('modalHero').style.background = m.grad;
  document.getElementById('modalBody').innerHTML = `
    <h2 class="modal-title">${m.title}</h2>
    <div class="modal-meta">
      <span>⭐ ${m.rating}</span>
      <span>${m.year}</span>
      <span>${m.genre}</span>
      <span>${m.duration} daqiqa</span>
      <span>${m.type==='series'?'Serial':'Film'}</span>
    </div>
    <p class="modal-desc">${m.desc}</p>
    <div class="modal-actions">
      <button class="btn-primary">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Tomosha qilish
      </button>
      <button class="btn-ghost">+ Sevimlilarga</button>
      <button class="btn-ghost">Treyler</button>
    </div>
  `;
  modal.classList.add('open');
  document.body.style.overflow='hidden';
}
modal.addEventListener('click',e=>{
  if(e.target.dataset.close!==undefined){
    modal.classList.remove('open');
    document.body.style.overflow='';
  }
});

/* card click delegation */
document.addEventListener('click',e=>{
  const card = e.target.closest('.card');
  if(card) openMovie(card.dataset.id);
});

/* ============ INIT ============ */
renderHome();
renderCatalog();
renderTV();
