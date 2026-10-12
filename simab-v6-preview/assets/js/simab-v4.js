/* SIMAB V4 – progressive UI enhancements only.
 * No changes to legacy Telegram authentication, wallet balance, game rules or awards.
 * Favorites & recent game history stay strictly in this device's localStorage.
 */
(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const safeRead = (key, fallback = null) => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  };
  const jsonArray = key => {
    try { const result = JSON.parse(safeRead(key, '[]')); return Array.isArray(result) ? result : []; }
    catch { return []; }
  };
  const stableIds = new Set(['1','2','3','4','5','6','7','8','9','10','11']);
  const knownGames = [
    { id:'1', title:'پوکر تگزاس', category:'cards', active:true, icon:'🃏', link:'games/poker/index.html' },
    { id:'2', title:'رول', category:'chance', active:true, icon:'🎰', link:'games/slot/index.html' },
    { id:'3', title:'تخته نرد', category:'classic', active:true, icon:'🎲', link:'games/backgammon/index.html' },
    { id:'4', title:'ورق حکم', category:'cards', active:false },
    { id:'5', title:'ورق ۲۱', category:'cards', active:false },
    { id:'6', title:'۷ خبیث', category:'cards', active:false },
    { id:'7', title:'جرأت حقیقت', category:'future', active:false },
    { id:'8', title:'۳ به ۳', category:'classic', active:false },
    { id:'9', title:'دبلنا', category:'classic', active:false },
    { id:'10', title:'منچ آنلاین', category:'classic', active:false },
    { id:'11', title:'مار و پله', category:'classic', active:false },
  ];
  const gameById = new Map(knownGames.map(g => [g.id,g]));
  const FAVORITES_KEY = 'simab_v4_favorite_games';
  const RECENT_KEY = 'simab_v4_recent_games';
  const favorites = new Set(jsonArray(FAVORITES_KEY).map(String).filter(id => stableIds.has(id)));

  // Keep one single tab controller, preserving legacy behavior for three tabs.
  const news = byId('tab-news-content');
  const original = typeof window.switchNavTab === 'function' ? window.switchNavTab : null;
  if (original && news) {
    window.switchNavTab = function(tab) {
      if (!['home','games','tasks','news'].includes(tab)) tab = 'home';
      if (tab === 'news') {
        ['home','games','tasks'].forEach(name => { const el=byId('tab-'+name+'-content'); if (el) el.style.display='none'; });
        news.style.display='block';
        document.querySelectorAll('.nav-btn-box').forEach(button => button.classList.toggle('active',button.id==='tab-btn-news'));
        safeWrite('simab_active_tab','news');
        try { window.scrollTo({top:0,behavior:'instant'}); } catch { window.scrollTo(0,0); }
      } else {
        news.style.display='none';
        original(tab);
      }
      document.querySelectorAll('.nav-btn-box').forEach(button => {
        if (button.classList.contains('active')) button.setAttribute('aria-current','page');
        else button.removeAttribute('aria-current');
      });
    };
    const lastTab = safeRead('simab_active_tab', 'home');
    if (lastTab === 'news') window.switchNavTab('news');
  }

  // Unified vector nav icons, consistent across all tabs. Text labels remain available.
  const svg = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const icons = {
    home:svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>'),
    games:svg('<path d="M6 12h4M8 10v4"/><circle cx="16" cy="10" r="1"/><circle cx="18" cy="14" r="1"/><path d="M6 6h12a4 4 0 0 1 4 4l-1 6a3 3 0 0 1-5 2l-2-2h-4l-2 2a3 3 0 0 1-5-2l-1-6a4 4 0 0 1 4-4z"/>'),
    tasks:svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m12 12 8-8"/>'),
    news:svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3m3 0h2"/>'),
  };
  Object.keys(icons).forEach(key => {
    const btn = byId('tab-btn-'+key);
    const target=btn?.querySelector('.tab-icon');
    if (target) { target.innerHTML=icons[key]; btn.setAttribute('aria-label',btn.querySelector('.tab-title')?.textContent?.trim() || key); }
  });

  // Categorize original cards without changing the authoritative legacy games array.
  const container = byId('games-container');
  const cards = [...(container?.querySelectorAll('.game-card') || [])];
  const tiles = [];
  cards.forEach((card,index) => {
    const id=String(index+1);
    const game=gameById.get(id);
    if (!game) { card.remove(); return; } // Drop 3 generic unnamed placeholder cards, keep named upcoming titles.
    const holder = document.createElement('div');
    holder.className='v4-game-tile';
    holder.dataset.gameId=id;
    card.dataset.gameId=id;
    card.dataset.category=game.category;
    card.dataset.active=String(game.active);
    card.parentElement.insertBefore(holder,card);
    holder.appendChild(card);
    const star = document.createElement('button');
    star.className='v4-fav';
    star.type='button';
    star.dataset.favorite=id;
    const updateStar=() => {
      const isOn=favorites.has(id);
      star.textContent = isOn ? '★' : '☆';
      star.setAttribute('aria-label',(isOn?'حذف از علاقه‌مندی‌ها: ':'افزودن به علاقه‌مندی‌ها: ')+game.title);
      star.setAttribute('aria-pressed',String(isOn));
      star.title=isOn?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها';
    };
    updateStar();
    star.addEventListener('click', () => {
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      safeWrite(FAVORITES_KEY,JSON.stringify([...favorites]));
      document.querySelectorAll('.v4-fav').forEach(b => {
        const g=gameById.get(b.dataset.favorite); const selected=favorites.has(b.dataset.favorite);
        b.textContent=selected?'★':'☆';b.setAttribute('aria-pressed',String(selected));
        b.setAttribute('aria-label',(selected?'حذف از علاقه‌مندی‌ها: ':'افزودن به علاقه‌مندی‌ها: ')+(g?.title || 'بازی'));
      });
      refresh();
    });
    holder.appendChild(star);
    tiles.push({holder,game,card});
  });

  // Search and categories can be combined; every control has an actual effect.
  let activeFilter = 'all';
  const search=byId('v4-game-search');
  const filters=[...document.querySelectorAll('#v3-game-filters button')];
  function normalize(text) {
    return String(text||'').toLocaleLowerCase('fa').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').replace(/\s+/g,' ').trim();
  }
  function refresh() {
    const needle=normalize(search?.value);
    let visible=0;
    tiles.forEach(({holder,game}) => {
      const matchFilter=activeFilter==='all'||
        (activeFilter==='favorites' && favorites.has(game.id))||
        (activeFilter==='future' && !game.active)||
        (activeFilter===game.category);
      const matchesText=!needle || normalize(game.title).includes(needle) || normalize(game.category).includes(needle);
      holder.hidden=!(matchFilter && matchesText);
      if (!holder.hidden) visible++;
    });
    const count=byId('v4-games-count');
    if (count) count.textContent=`${visible} بازی از ${tiles.length}`;
    const empty=byId('v4-games-empty');
    if (empty) empty.hidden=visible>0;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    activeFilter=button.dataset.filter || 'all';
    filters.forEach(b => {const current=b===button;b.classList.toggle('selected',current);b.setAttribute('aria-pressed',String(current));});
    refresh();
  }));
  search?.addEventListener('input',refresh);
  byId('v4-reset-filters')?.addEventListener('click', () => {
    activeFilter='all';if(search)search.value='';
    filters.forEach(b => {const selected=b.dataset.filter==='all';b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    refresh(); search?.focus();
  });
  refresh();

  // Recently played is a local convenience; it is NOT a win/loss or time-tracking system.
  const recentWrap=byId('v4-recent');
  const recentList=byId('v4-recent-list');
  function renderRecent() {
    const ids=jsonArray(RECENT_KEY).map(String).filter(id=>gameById.get(id)?.active).slice(0,3);
    if (!recentWrap||!recentList) return;
    recentList.replaceChildren();
    recentWrap.hidden=ids.length===0;
    ids.forEach(id=>{
      const game=gameById.get(id);
      const link=document.createElement('a');link.href=game.link;link.textContent=game.icon+' '+game.title+' ←';
      recentList.appendChild(link);
    });
  }
  renderRecent();
  document.addEventListener('click',(event)=>{
    const link=event.target.closest('a[href]');
    if(!link)return;
    const dest=new URL(link.href,location.href);
    const game=knownGames.find(g=>g.active && new URL(g.link,location.href).pathname===dest.pathname);
    if(!game)return;
    const unique=[game.id,...jsonArray(RECENT_KEY).map(String).filter(id=>id!==game.id)].slice(0,3);
    safeWrite(RECENT_KEY,JSON.stringify(unique));
  });

  // Clipboard fallback for local file:// preview; failure should never crash the app.
  if (typeof window.copyText === 'function') {
    window.copyText = async function(elementId) {
      const el=byId(elementId);
      if(!el)return;
      const value=el.textContent.trim();
      let ok=false;
      if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);ok=true;}catch{}}
      if(!ok){
        const input=document.createElement('textarea');input.value=value;
        input.style.position='fixed';input.style.opacity='0';input.style.top='-999px';
        document.body.appendChild(input);input.select();
        try{ok=document.execCommand('copy');}catch{}input.remove();
      }
      if(typeof window.showToast==='function')window.showToast(ok?'کپی شد!':'لطفاً شناسه را دستی کپی کن');
    };
  }
})();
