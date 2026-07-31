/* ===========================================================
   应用入口：路由 / 导航高亮 / 侧边栏"我" / 初始化
   =========================================================== */
window.App = window.App || {};

App.app = (function () {
  const S = App.store;
  const TITLES = { posts: '交友帖子', search: '找朋友', game: '交友小游戏', profile: '我的数据', chat: '聊天' };

  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'posts', param: parts[1] || null };
  }

  function go(route) {
    if (('#/' + route) === location.hash) { render(); }
    else location.hash = '#/' + route;
  }

  function render() {
    const { name, param } = parseHash();
    const content = document.getElementById('content');
    const topTitle = document.getElementById('topTitle');

    let html = '', mount = null;
    if (name === 'search') { html = App.pages.search.render(); mount = App.pages.search.mount; }
    else if (name === 'game') { html = App.pages.game.render(); mount = App.pages.game.mount; }
    else if (name === 'profile') { html = App.pages.profile.render(); mount = App.pages.profile.mount; }
    else if (name === 'chat') {
      topTitle.textContent = '聊天';
      html = App.pages.chat.render(param);
      content.innerHTML = html;
      if (param) App.pages.chat.mount(param);
      setNav('chat');
      return;
    }
    else { html = App.pages.posts.render(); mount = App.pages.posts.mount; }

    content.innerHTML = html;
    topTitle.textContent = TITLES[name] || '交友帖子';
    if (mount) mount();
    setNav(name);
    window.scrollTo(0, 0);
  }

  function setNav(name) {
    document.querySelectorAll('#nav .nav-item').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === name);
    });
  }

  function renderMeCard() {
    const me = S.getMe();
    const el = document.getElementById('meCard');
    if (!el) return;
    el.innerHTML = App.ui.avatar(me.avatar) +
      '<div><div class="mc-name">' + App.ui.esc(me.name) + '</div>' +
      '<div class="mc-sub">已交 ' + S.getFriends().length + ' 位朋友</div></div>';
  }

  function refresh() { renderMeCard(); render(); }

  function bindNav() {
    document.querySelectorAll('#nav .nav-item').forEach(a => {
      a.onclick = () => go(a.getAttribute('data-route'));
    });
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    if (menuBtn && sidebar) {
      menuBtn.onclick = () => sidebar.classList.toggle('open');
      document.addEventListener('click', e => {
        if (window.innerWidth <= 820 && !sidebar.contains(e.target) && e.target !== menuBtn) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  function init() {
    bindNav();
    S.subscribe(renderMeCard);
    renderMeCard();
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/posts';
    else render();
  }

  return { go, refresh, init };
})();

document.addEventListener('DOMContentLoaded', App.app.init);
