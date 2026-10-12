/* SIMAB V3: presentation-only extension. No auth, wallet, or game economics changes. */
(() => {
  'use strict';
  const news = document.getElementById('tab-news-content');
  const originalSwitchTab = window.switchNavTab;
  if (typeof originalSwitchTab === 'function' && news) {
    window.switchNavTab = function(tab) {
      news.style.display = 'none';
      if (tab === 'news') {
        ['home', 'games', 'tasks'].forEach(name => {
          const section = document.getElementById('tab-' + name + '-content');
          if (section) section.style.display = 'none';
        });
        document.querySelectorAll('.nav-btn-box').forEach(btn => btn.classList.remove('active'));
        const btn = document.getElementById('tab-btn-news');
        if (btn) btn.classList.add('active');
        news.style.display = 'block';
        try { localStorage.setItem('simab_active_tab','news'); } catch (_) {}
        window.scrollTo(0,0);
        return;
      }
      return originalSwitchTab(tab);
    };
    try { if (localStorage.getItem('simab_active_tab') === 'news') window.switchNavTab('news'); } catch (_) {}
  }
  // Categorize the existing DOM game cards without modifying the existing games database.
  const cats = {1:'cards',2:'chance',3:'classic',4:'cards',5:'cards',6:'cards',7:'future',8:'classic',9:'classic',10:'classic',11:'classic'};
  const cards = [...document.querySelectorAll('#games-container .game-card')];
  cards.forEach((card, index) => {
    const id = index + 1;
    card.dataset.gameId = String(id);
    card.dataset.category = cats[id] || 'future';
    card.dataset.active = ['1','2','3'].includes(card.dataset.gameId) ? 'true' : 'false';
  });
  const buttons = [...document.querySelectorAll('#v3-game-filters button')];
  buttons.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    buttons.forEach(b => { const selected=b === button; b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',String(selected)); });
    cards.forEach(card => { const matching=filter==='all'||(filter==='future' ? card.dataset.active==='false' : card.dataset.category===filter); card.style.display=matching?'':'none'; });
  }));
})();
