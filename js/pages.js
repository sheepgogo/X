/* ===========================================================
   页面渲染与交互：posts / search / game / profile / chat
   每个页面导出 { render(), mount() }。
   =========================================================== */
window.App = window.App || {};

App.pages = (function () {
  const S = App.store, D = App.data, UI = App.ui;

  const HOBBY_OPTIONS = ['阅读', '绘画', '猫咪', '徒步', '摄影', '咖啡', '音乐', '吉他',
    '电影', '烘焙', '手账', '拼图', '篮球', '旅行', '美食', '游戏', '科幻', '动漫',
    '瑜伽', '植物', '茶道', '写作', '志愿者', '书法', '围棋', '茶'];
  const TRAIT_OPTIONS = ['内向', '温柔', '细腻', '随和', '开朗', '爱自然', '文艺', '慢热',
    '真诚', '安静', '细心', '治愈', '热情', '直爽', '行动派', '宅', '幽默', '脑洞',
    '平和', '专注', '善良', '敏感', '有爱', '沉稳', '耐心', '传统'];

  // 帖子信息流的"刷新"：用 seed 打乱顺序，并让在线状态随机变化，制造"换一批"的真实感
  let feedSeed = 1;
  function shuffle(arr, seed) {
    const a = arr.slice();
    let s = (seed * 2654435761) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function onlineFor(u, seed) {
    let h = 0; const str = u.id + ':' + seed;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return (h % 10) < 6;
  }

  // 刷新时偶尔生成一条"刚刚发布"的随机帖子，让信息流更像活人社区
  let genCounter = 0;
  const generatedIds = [];
  const GEN_NAMES = ['初七', '阿白', '糖糖', '炭炭', '小樱', '阿橙', '默默', '栗子', '阿蓝', '七七', '布丁', '咕咕'];
  const GEN_AVATARS = ['🐰', '🐻', '🍓', '🐼', '🌸', '🦊', '🐧', '🐨', '🐯', '🐹', '🍡', '🐙'];
  const GEN_BIOS = [
    '平时话不多，但想找个能慢慢相处的人。',
    '最近想走出舒适圈，认识些新朋友～',
    '一个人久了，也想有人分享日常。',
    '喜欢简单的生活，想找同频的人。',
    '有点社恐但很真诚，愿意慢慢了解你。',
    '希望遇到能互相陪伴、不慌不忙的朋友。'
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function maybeGeneratePost() {
    if (Math.random() < 0.6) return false; // 偶尔才生成
    genCounter++;
    const id = 'g' + genCounter;
    const hobbies = shuffle(HOBBY_OPTIONS, genCounter).slice(0, 2 + (genCounter % 2));
    const traits = shuffle(TRAIT_OPTIONS, genCounter + 7).slice(0, 2);
    const u = {
      id: id, name: pick(GEN_NAMES), avatar: pick(GEN_AVATARS),
      bio: pick(GEN_BIOS), hobbies: hobbies, traits: traits, online: true,
      replies: ['你好呀～', '很高兴认识你！', '今天过得怎么样？', '最近在尝试新东西～']
    };
    D.users.push(u); D.usersById[id] = u;
    D.presetPosts.unshift({ id: 'p_' + id, userId: id, text: u.bio, hobbies: u.hobbies, traits: u.traits, time: '刚刚' });
    generatedIds.push(id);
    if (generatedIds.length > 6) { // 最多保留 6 条生成帖，避免无限增长
      const old = generatedIds.shift();
      D.users = D.users.filter(x => x.id !== old);
      delete D.usersById[old];
      D.presetPosts = D.presetPosts.filter(p => p.userId !== old);
    }
    return true;
  }

  // 聊天：根据对方说的话，生成每次略有不同的回复（并避免连续重复）
  const lastReply = {};
  function catFor(text) {
    for (const r of D.replyKeywords) {
      for (const k of r.keys) if (text.indexOf(k) !== -1) return r.cat;
    }
    return 'default';
  }
  function chooseReply(pool, userId) {
    let pool2 = pool.slice();
    const last = lastReply[userId];
    if (last && pool2.length > 1) pool2 = pool2.filter(x => x !== last);
    const r = pool2[Math.floor(Math.random() * pool2.length)];
    lastReply[userId] = r;
    return r;
  }
  // 给回复"加料"：随机表情或句尾语气词，让语气更鲜活、每次略不同
  function addFlair(text) {
    if (Math.random() < 0.55) {
      const e = D.flairEmojis[Math.floor(Math.random() * D.flairEmojis.length)];
      return text + e;
    }
    if (Math.random() < 0.5) {
      const last = text.charAt(text.length - 1);
      if (/[一-龥a-zA-Z0-9]/.test(last)) { // 仅在以汉字/字母/数字结尾时加语气词，避免标点叠加
        const p = D.flairParticles[Math.floor(Math.random() * D.flairParticles.length)];
        return text + p;
      }
    }
    return text;
  }
  function generateReply(userId, text) {
    // 约 35% 概率"上文呼应"：记得你之前说过的话题，主动提起
    if (Math.random() < 0.35) {
      const r = recallReply(userId, text);
      if (r) return addFlair(r);
    }
    const u = D.usersById[userId];
    const cat = catFor(text || '');
    const own = (u && u.replies) ? u.replies : [];
    const bank = D.replyBank[cat] || D.replyBank.default;
    const pool = bank.concat(own, D.replyBank.default); // 语境 + 个人风格 + 兜底，提升多样性
    return addFlair(chooseReply(pool, userId));
  }
  // 检测一句话里提到了哪些"可记忆"的话题
  function detectTopics(text) {
    const out = [];
    for (const t of D.recallTopics) {
      for (const k of t.keys) { if (text.indexOf(k) !== -1) { out.push(t.key); break; } }
    }
    return out;
  }
  // 从对方记住的话题里，挑一个"之前说过、但不是这句刚提的"来回想
  const lastRecallTopic = {};
  function recallReply(userId, text) {
    const mem = S.getMemory(userId);
    if (!mem.length) return null;
    const cur = detectTopics(text || '');
    const cands = mem.filter(k => cur.indexOf(k) === -1); // 不重复当前这句刚说的
    if (!cands.length) return null;
    let pool = cands.slice();
    const last = lastRecallTopic[userId];
    if (last && pool.length > 1) pool = pool.filter(k => k !== last);
    const key = pool[Math.floor(Math.random() * pool.length)];
    lastRecallTopic[userId] = key;
    const topic = D.recallTopics.find(t => t.key === key);
    if (!topic) return null;
    return chooseReply(topic.recalls, userId + '_recall');
  }
  function generateGreeting(user) {
    const pool = D.replyBank.greet.concat((user.replies && user.replies.slice(0, 2)) || []);
    return addFlair(chooseReply(pool, user.id));
  }

  function go(route) { App.app.go(route); }

  /* =======================================================
     1) 交友帖子
     ======================================================= */
  const posts = {
    render() {
      const mine = S.getUserPosts().filter(p => p.mine);
      const preset = shuffle(D.presetPosts, feedSeed);
      const display = mine.concat(preset);

      const grid = display.map(p => {
        const user = p.mine ? S.getMe() : D.usersById[p.userId];
        const av = UI.avatar(user.avatar, 'av-lg');
        const online = p.mine ? true : onlineFor(user, feedSeed);
        const meta = p.mine
          ? '我的帖子 · ' + UI.esc(p.time || '')
          : ((online ? '<span class="online-dot"></span>在线' : '<span class="offline-dot"></span>离线') + ' · ' + UI.esc(p.time || ''));
        return '' +
          '<div class="card post-card" data-post="' + p.id + '">' +
            '<div class="pc-top">' + av +
              '<div>' +
                '<div class="pc-name">' + UI.esc(user.name) + (p.mine ? ' <span class="tag tag-pink">我的</span>' : '') + '</div>' +
                '<div class="pc-meta">' + meta + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="pc-text">' + UI.esc(p.text) + '</div>' +
            UI.tags(p.hobbies, 'hobby') +
            UI.tags(p.traits, 'trait') +
            (p.mine ? '' : '<div class="pc-foot"><button class="btn btn-sm btn-primary" data-act="request" data-user="' + p.userId + '">发好友请求</button>' +
              (S.isFriend(p.userId) ? '<button class="btn btn-sm btn-mint" data-act="chat" data-user="' + p.userId + '">去聊天</button>' : '') + '</div>') +
          '</div>';
      }).join('');

      return '' +
        // 欢迎横幅（拥抱图 + 温暖文案）
        '<div class="hero-banner">' +
          '<div class="hero-text">' +
            '<div class="hero-title">在这里，找到懂你的朋友 ✨</div>' +
            '<div class="hero-sub">不用刻意改变自己，真诚就是最好的名片。<br/>慢慢来，总有人会喜欢真实的你。</div>' +
          '</div>' +
          '<div class="hero-img-wrap"><img class="hero-img" src="assets/hero-friends.webp" alt="好朋友" /></div>' +
        '</div>' +
        '<div class="section-head">' +
          '<h2>📮 交友帖子</h2>' +
          '<span class="sub">看看大家都在找什么样的朋友</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn btn-ghost" id="refreshPosts" title="换一批帖子">🔄 刷新</button>' +
          '<button class="btn btn-primary" id="newPostBtn">✏️ 发布我的帖子</button>' +
        '</div>' +
        (display.length ? '<div class="posts-grid">' + grid + '</div>'
          : '<div class="empty"><div class="em-ico">📭</div><div class="em-title">还没有帖子</div><div>成为第一个勇敢发帖的人吧～</div></div>') +
        // 底部装饰插画（聊天场景）
        '<div class="page-illo"><img src="assets/chat-scene.webp" alt="一起聊天" /></div>';
    },
    mount() {
      const content = document.getElementById('content');
      const newBtn = content.querySelector('#newPostBtn');
      if (newBtn) newBtn.onclick = openPostForm;

      const refreshBtn = content.querySelector('#refreshPosts');
      if (refreshBtn) refreshBtn.onclick = () => {
        feedSeed++;
        const made = maybeGeneratePost();
        App.app.refresh();
        UI.toast(made ? '有位新朋友刚刚发了帖子 ✨' : '已为你换了一批新帖子 ✨');
      };

      content.querySelectorAll('[data-act="request"]').forEach(b => {
        b.onclick = e => { e.stopPropagation(); openRequestForm(b.getAttribute('data-user')); };
      });
      content.querySelectorAll('[data-act="chat"]').forEach(b => {
        b.onclick = e => { e.stopPropagation(); go('chat/' + b.getAttribute('data-user')); };
      });
      content.querySelectorAll('.post-card[data-post]').forEach(c => {
        c.onclick = () => {
          const id = c.getAttribute('data-post');
          const post = S.getUserPosts().find(p => p.id === id);
          if (post && !post.mine) openPostDetail(post.userId);
        };
      });
    }
  };

  function openPostDetail(userId) {
    const u = D.usersById[userId];
    const body =
      '<div class="row" style="margin-bottom:14px">' + UI.avatar(u.avatar, 'av-lg') +
        '<div><div style="font-weight:800;font-size:18px">' + UI.esc(u.name) + '</div>' +
        '<div style="color:var(--muted);font-size:13px">' + (u.online ? '🟢 在线' : '⚪ 离线') + '</div></div>' +
      '</div>' +
      '<p style="font-size:14.5px;color:#5b5560;line-height:1.7;margin-bottom:12px">' + UI.esc(u.bio) + '</p>' +
      '<div style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--muted)">兴趣爱好</div>' +
      UI.tags(u.hobbies, 'hobby') +
      '<div style="margin:12px 0 8px;font-size:13px;font-weight:700;color:var(--muted)">性格特征</div>' +
      UI.tags(u.traits, 'trait');

    const actions = S.isFriend(userId)
      ? [
          { label: '💬 去聊天', cls: 'btn-mint', onClick: c => { c(); go('chat/' + userId); } },
          { label: '关闭', cls: 'btn-ghost', onClick: c => c() }
        ]
      : [
          { label: '🤝 发好友请求', cls: 'btn-primary', onClick: c => { c(); openRequestForm(userId); } },
          { label: '关闭', cls: 'btn-ghost', onClick: c => c() }
        ];
    UI.modal({ title: '📮 好友帖子', bodyHTML: body, actions });
  }

  function openRequestForm(userId) {
    const u = D.usersById[userId];
    if (S.isFriend(userId)) { UI.toast('你们已经是朋友啦 🤝'); go('chat/' + userId); return; }
    const presets = D.requestPrompts.map((t, i) =>
      '<div class="opt' + (i === 0 ? ' on' : '') + '" data-p="' + i + '">' + UI.esc(t) + '</div>').join('');
    const body =
      '<p style="color:var(--muted);font-size:14px;margin-bottom:12px">向 <b>' + UI.esc(u.name) + '</b> 说点什么吧，真诚最重要～</p>' +
      '<div class="chip-pick" id="presetMsgs" style="margin-bottom:12px">' + presets + '</div>' +
      '<div class="field"><label>留言（可修改）</label><textarea id="reqMsg"></textarea></div>';

    const m = UI.modal({
      title: '🤝 发送好友请求',
      bodyHTML: body,
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: c => c() },
        {
          label: '发送', cls: 'btn-primary', onClick: c => {
            const msg = (m.el.querySelector('#reqMsg').value || '').trim() || D.requestPrompts[0];
            S.sendRequest(userId, msg);
            c();
            UI.toast('🎉 ' + u.name + ' 已通过你的好友请求！');
            go('chat/' + userId);
          }
        }
      ]
    });
    m.el.querySelector('#reqMsg').value = D.requestPrompts[0];
    m.el.querySelectorAll('#presetMsgs .opt').forEach(o => {
      o.onclick = () => {
        m.el.querySelectorAll('#presetMsgs .opt').forEach(x => x.classList.remove('on'));
        o.classList.add('on');
        m.el.querySelector('#reqMsg').value = D.requestPrompts[+o.getAttribute('data-p')];
      };
    });
  }

  function openPostForm() {
    const me = S.getMe();
    const selH = new Set(me.hobbies), selT = new Set(me.traits);
    const chipHtml = (list, sel, key) => list.map(t =>
      '<div class="opt' + (sel.has(t) ? ' on' : '') + '" data-k="' + key + '" data-v="' + UI.esc(t) + '">' + UI.esc(t) + '</div>').join('');

    const body =
      '<div class="field"><label>自我介绍（一句话就好）</label><textarea id="postText" placeholder="例如：喜欢安静地画画，想找个能一起待着不说话也很舒服的人">'
        + UI.esc(me.bio) + '</textarea></div>' +
      '<div class="field"><label>兴趣爱好（点击选择）</label><div class="chip-pick" id="pHobbies">' + chipHtml(HOBBY_OPTIONS, selH, 'h') + '</div></div>' +
      '<div class="field"><label>性格特征（点击选择）</label><div class="chip-pick" id="pTraits">' + chipHtml(TRAIT_OPTIONS, selT, 't') + '</div></div>';

    const m = UI.modal({
      title: '✏️ 发布我的交友帖子',
      bodyHTML: body,
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: c => c() },
        {
          label: '发布', cls: 'btn-primary', onClick: c => {
            const text = (m.el.querySelector('#postText').value || '').trim();
            if (!text) { UI.toast('写点自我介绍吧～'); return; }
            S.addPost({ text: text, hobbies: [...selH], traits: [...selT] });
            S.setMe({ bio: text, hobbies: [...selH], traits: [...selT] });
            c();
            UI.toast('🌱 帖子已发布，勇敢的第一步！');
            App.app.refresh();
          }
        }
      ]
    });
    m.el.querySelectorAll('#pHobbies .opt, #pTraits .opt').forEach(o => {
      o.onclick = () => {
        const key = o.getAttribute('data-k'), v = o.getAttribute('data-v');
        const set = key === 'h' ? selH : selT;
        if (set.has(v)) { set.delete(v); o.classList.remove('on'); }
        else { set.add(v); o.classList.add('on'); }
      };
    });
  }

  /* =======================================================
     2) 搜索：预设提示词 + 文本，按相似度推送
     ======================================================= */
  const search = {
    render() {
      const presets = D.searchPresets.map((p, i) =>
        '<button class="preset-chip" data-i="' + i + '">' + UI.esc(p.label) + '</button>').join('');
      return '' +
        '<div class="section-head"><h2>🔍 找朋友</h2>' +
          '<span class="sub">选一个类型，或描述你想交的朋友</span></div>' +
        '<div class="illo"><img src="assets/group-friends.webp" alt="找到志同道合的朋友" /></div>' +
        '<div class="search-bar">' +
          '<input id="searchInput" placeholder="例如：喜欢看书、安静、温柔的人…" />' +
          '<button class="btn btn-primary" id="searchBtn">找一找</button>' +
        '</div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:8px">或者，挑一个想交的朋友类型：</div>' +
        '<div class="preset-row" id="presetRow">' + presets + '</div>' +
        '<div id="matchArea"></div>';
    },
    mount() {
      const content = document.getElementById('content');
      const input = content.querySelector('#searchInput');
      const doSearch = (tags, keywords) => runSearch(tags, keywords);

      content.querySelector('#searchBtn').onclick = () => {
        const kw = input.value.trim();
        if (!kw) { UI.toast('先描述一下想找的朋友吧～'); return; }
        doSearch([], kw);
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') content.querySelector('#searchBtn').click(); });

      content.querySelectorAll('#presetRow .preset-chip').forEach(c => {
        c.onclick = () => {
          content.querySelectorAll('#presetRow .preset-chip').forEach(x => x.classList.remove('active'));
          c.classList.add('active');
          const p = D.searchPresets[+c.getAttribute('data-i')];
          input.value = p.label.replace(/^[^ ]+ /, '');
          runSearch(p.tags, '');
        };
      });
    }
  };

  function scoreUser(u, tags, keywords) {
    let score = 0;
    const pool = (u.hobbies || []).concat(u.traits || []);
    tags.forEach(t => { if (pool.indexOf(t) !== -1) score += 2; });
    if (keywords) {
      keywords.split(/[\s,，、]+/).filter(Boolean).forEach(k => {
        if (pool.indexOf(k) !== -1) score += 2;
        if (u.bio && u.bio.indexOf(k) !== -1) score += 1;
        if (u.name.indexOf(k) !== -1) score += 1;
      });
    }
    return score;
  }

  function runSearch(tags, keywords) {
    S.recordSearch();
    const matches = D.users.map(u => ({ u, score: scoreUser(u, tags, keywords) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
    const area = document.getElementById('matchArea');
    if (!matches.length) {
      area.innerHTML = '<div class="empty"><div class="em-ico">🤔</div><div class="em-title">暂时没找到特别匹配的</div><div>换个描述，或试试上面的类型标签吧～</div></div>';
      return;
    }
    const max = matches[0].score;
    area.innerHTML = '<div style="font-size:13px;color:var(--muted);margin:6px 0 4px">为你找到 ' + matches.length + ' 位相近的朋友：</div>' +
      '<div class="match-list">' + matches.map(m => {
        const u = m.u;
        const pct = Math.round((m.score / max) * 100);
        const friend = S.isFriend(u.id);
        return '' +
          '<div class="card match-card">' +
            '<div class="mc-top">' + UI.avatar(u.avatar, 'av-lg') +
              '<div><div class="mc-name">' + UI.esc(u.name) + '</div>' +
              '<div style="font-size:12px;color:var(--muted)">' + (u.online ? '🟢 在线' : '⚪ 离线') + '</div></div>' +
              '<span class="mc-score">匹配 ' + pct + '%</span>' +
            '</div>' +
            '<div style="font-size:13.5px;color:#5b5560;line-height:1.6">' + UI.esc(u.bio) + '</div>' +
            UI.tags(u.hobbies, 'hobby') +
            UI.tags(u.traits, 'trait') +
            '<div class="mc-actions">' +
              (friend
                ? '<button class="btn btn-sm btn-mint" data-chat="' + u.id + '">💬 聊天</button>'
                : '<button class="btn btn-sm btn-primary" data-req="' + u.id + '">🤝 交个朋友</button>') +
              '<button class="btn btn-sm btn-ghost" data-view="' + u.id + '">看帖子</button>' +
            '</div>' +
          '</div>';
      }).join('') + '</div>';

    area.querySelectorAll('[data-req]').forEach(b => b.onclick = () => openRequestForm(b.getAttribute('data-req')));
    area.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => go('chat/' + b.getAttribute('data-chat')));
    area.querySelectorAll('[data-view]').forEach(b => b.onclick = () => openPostDetail(b.getAttribute('data-view')));
  }

  /* =======================================================
     3) 交友小游戏：如何真心对待朋友
     ======================================================= */
  const game = {
    render() {
      const played = S.getState().stats.game;
      return '' +
        '<div class="section-head"><h2>🎮 交友小游戏</h2>' +
          '<span class="sub">用情景选择题，练习如何真心对待朋友</span></div>' +
        '<div class="card game-stage" id="gameStage">' +
          '<div class="illo"><img src="assets/chat-scene.webp" alt="和朋友真诚相处" /></div>' +
          '<div class="empty">' +
            '<div class="em-ico">💞</div>' +
            '<div class="em-title">真心朋友修炼营</div>' +
            '<div style="margin:10px 0 18px;max-width:460px;margin-left:auto;margin-right:auto">5 个生活小情景，选出你最舒服的做法。' +
              (played ? '（你之前的最佳得分：' + S.getState().stats.gameScore + ' 分）' : '') + '</div>' +
            '<button class="btn btn-primary" id="startGame">开始游戏 ▶</button>' +
          '</div>' +
        '</div>';
    },
    mount() {
      const content = document.getElementById('content');
      const start = content.querySelector('#startGame');
      if (start) start.onclick = () => startGame();
    }
  };

  function startGame() {
    const stage = document.getElementById('gameStage');
    let idx = 0, score = 0;
    const sc = D.gameScenarios;

    function renderScenario() {
      const s = sc[idx];
      const pct = Math.round(((idx) / sc.length) * 100);
      stage.innerHTML =
        '<div class="game-progress"><i style="width:' + pct + '%"></i></div>' +
        '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">第 ' + (idx + 1) + ' / ' + sc.length + ' 题</div>' +
        '<div class="scenario-q">' + UI.esc(s.q) + '</div>' +
        '<div class="scenario-hint">' + UI.esc(s.hint) + '</div>' +
        '<div id="opts">' + s.options.map((o, i) =>
          '<button class="option" data-i="' + i + '">' + UI.esc(o.t) + '</button>').join('') + '</div>';

      stage.querySelectorAll('.option').forEach(b => {
        b.onclick = () => {
          const opt = s.options[+b.getAttribute('data-i')];
          score += opt.score;
          stage.querySelectorAll('.option').forEach(x => x.disabled = true);
          // 标记正确项
          const correctIdx = s.options.reduce((bi, o, i) => o.score > s.options[bi].score ? i : bi, 0);
          stage.querySelectorAll('.option').forEach((x, i) => {
            if (i === correctIdx) x.classList.add('correct');
            else if (i === +b.getAttribute('data-i')) x.classList.add('wrong');
          });
          const tip = document.createElement('div');
          tip.className = 'tip-box';
          tip.innerHTML = '💡 ' + UI.esc(opt.tip);
          stage.querySelector('#opts').after(tip);

          const next = document.createElement('button');
          next.className = 'btn btn-primary';
          next.style.marginTop = '16px';
          next.textContent = (idx + 1 < sc.length) ? '下一题 →' : '查看结果 ✨';
          next.onclick = () => { idx++; idx < sc.length ? renderScenario() : renderResult(); };
          tip.after(next);
        };
      });
    }

    function renderResult() {
      const total = sc.length * 20;
      const heart = score >= total * 0.8 ? '💖 真心指数：超高！你是天生的好朋友'
        : score >= total * 0.5 ? '💛 真心指数：不错，再多一些真诚就更好啦'
        : '🤍 真心指数：慢慢来，友情需要练习';
      S.recordGame(score);
      stage.innerHTML =
        '<div class="game-result">' +
          '<div style="font-size:46px">🎉</div>' +
          '<div class="score-badge">' + score + ' 分</div>' +
          '<div class="heart-index">' + heart + '</div>' +
          '<p style="color:var(--muted);font-size:14px;max-width:420px;margin:0 auto 20px;line-height:1.7">' +
            '真正的朋友，不是从不犯错，而是愿意真诚地对待彼此。你已经在路上了。🙂</p>' +
          '<button class="btn btn-ghost" id="replay">再玩一次</button>' +
        '</div>';
      stage.querySelector('#replay').onclick = () => startGame();
    }

    renderScenario();
  }

  /* =======================================================
     4) 我的数据
     ======================================================= */
  const profile = {
    render() {
      const me = S.getMe();
      const st = S.getState().stats;
      const friends = S.getFriends();
      const ach = D.achievements.map(a => {
        const got = S.hasAchievement(a.id);
        return '' +
          '<div class="ach ' + (got ? '' : 'locked') + '">' +
            '<div class="ach-ico">' + (got ? a.icon : '🔒') + '</div>' +
            '<div class="ach-name">' + UI.esc(a.name) + '</div>' +
            '<div class="ach-desc">' + UI.esc(a.desc) + '</div>' +
            '<div class="ach-state">' + (got ? '已解锁' : '未解锁') + '</div>' +
          '</div>';
      }).join('');

      return '' +
        '<div class="section-head"><h2>🌟 我的数据</h2>' +
          '<span class="sub">记录你每一步的小小成长</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn btn-ghost" id="editMe">✏️ 编辑资料</button>' +
        '</div>' +
        // 一群朋友的装饰插画
        '<div class="profile-illo"><img src="assets/group-friends.webp" alt="朋友在一起" /></div>' +
        '<div class="card profile-head">' +
          UI.avatar(me.avatar, 'av-lg') +
          '<div><div class="ph-name">' + UI.esc(me.name) + '</div>' +
          '<div class="ph-bio">' + UI.esc(me.bio || '还没有填写自我介绍～') + '</div>' +
          (me.hobbies.length ? UI.tags(me.hobbies, 'hobby') : '') +
          (me.traits.length ? UI.tags(me.traits, 'trait') : '') +
          '</div>' +
        '</div>' +
        '<div class="stat-grid">' +
          statBox(friends.length, '已交到朋友') +
          statBox(st.posts, '发布帖子') +
          statBox(st.requests, '发送请求') +
          statBox(st.chats, '聊天消息') +
          statBox(st.game ? st.gameScore : '—', '游戏最佳分') +
        '</div>' +
        '<div style="font-size:15px;font-weight:800;margin:6px 0 14px">🏅 成就（' + S.getState().achievements.length + '/' + D.achievements.length + '）</div>' +
        '<div class="ach-grid">' + ach + '</div>' +
        '<div style="margin-top:26px;text-align:center">' +
          '<button class="btn btn-ghost" id="resetBtn" style="color:#d65b5b">清空我的数据</button>' +
        '</div>';
    },
    mount() {
      const content = document.getElementById('content');
      content.querySelector('#editMe').onclick = openEditMe;
      content.querySelector('#resetBtn').onclick = () => {
        UI.confirmDialog('清空数据', '确定要清空所有帖子、好友和成就吗？此操作不可恢复。', () => {
          S.resetAll();
          UI.toast('已清空，重新开始吧～');
          App.app.refresh();
        }, '清空');
      };
    }
  };

  function statBox(num, lbl) {
    return '<div class="card stat-box"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
  }

  function openEditMe() {
    const me = S.getMe();
    const selH = new Set(me.hobbies), selT = new Set(me.traits);
    const chipHtml = (list, sel, key) => list.map(t =>
      '<div class="opt' + (sel.has(t) ? ' on' : '') + '" data-k="' + key + '" data-v="' + UI.esc(t) + '">' + UI.esc(t) + '</div>').join('');
    const avatars = ['🙂', '😊', '🐱', '🌸', '🌟', '🍀', '🐰', '🦊', '🌈', '🍰'];
    const avHtml = avatars.map(a => '<div class="opt' + (a === me.avatar ? ' on' : '') + '" data-av="' + a + '">' + a + '</div>').join('');

    const body =
      '<div class="field"><label>头像</label><div class="chip-pick" id="eAv">' + avHtml + '</div></div>' +
      '<div class="field"><label>昵称</label><input id="eName" value="' + UI.esc(me.name) + '" maxlength="12" /></div>' +
      '<div class="field"><label>自我介绍</label><textarea id="eBio" maxlength="80">' + UI.esc(me.bio) + '</textarea></div>' +
      '<div class="field"><label>兴趣爱好</label><div class="chip-pick" id="eHobbies">' + chipHtml(HOBBY_OPTIONS, selH, 'h') + '</div></div>' +
      '<div class="field"><label>性格特征</label><div class="chip-pick" id="eTraits">' + chipHtml(TRAIT_OPTIONS, selT, 't') + '</div></div>';

    let pickAv = me.avatar;
    const m = UI.modal({
      title: '✏️ 编辑我的资料',
      bodyHTML: body,
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: c => c() },
        {
          label: '保存', cls: 'btn-primary', onClick: c => {
            const name = (m.el.querySelector('#eName').value || '').trim() || '我';
            const bio = (m.el.querySelector('#eBio').value || '').trim();
            S.setMe({ name, bio, avatar: pickAv, hobbies: [...selH], traits: [...selT] });
            c();
            UI.toast('资料已更新 🌟');
            App.app.refresh();
          }
        }
      ]
    });
    m.el.querySelectorAll('#eAv .opt').forEach(o => o.onclick = () => {
      m.el.querySelectorAll('#eAv .opt').forEach(x => x.classList.remove('on'));
      o.classList.add('on'); pickAv = o.getAttribute('data-av');
    });
    m.el.querySelectorAll('#eHobbies .opt, #eTraits .opt').forEach(o => {
      o.onclick = () => {
        const key = o.getAttribute('data-k'), v = o.getAttribute('data-v');
        const set = key === 'h' ? selH : selT;
        if (set.has(v)) { set.delete(v); o.classList.remove('on'); }
        else { set.add(v); o.classList.add('on'); }
      };
    });
  }

  /* =======================================================
     5) 聊天
     ======================================================= */
  const chat = {
    render(userId) {
      const u = D.usersById[userId];
      if (!u) return '<div class="empty"><div class="em-ico">🙈</div><div>没有找到这位朋友</div></div>';
      const list = S.getChat(userId);
      const msgs = list.map(m => msgHtml(m, u)).join('') ||
        '<div class="typing">和 ' + UI.esc(u.name) + ' 打个招呼吧～</div>';
      return '' +
        '<div class="chat-illo"><img src="assets/chat-scene.webp" alt="聊天" /></div>' +
        '<div class="card chat-wrap">' +
          '<div class="chat-head">' +
            '<button class="back" id="chatBack">←</button>' +
            UI.avatar(u.avatar) +
            '<div><div style="font-weight:800">' + UI.esc(u.name) + '</div>' +
            '<div style="font-size:12px;color:var(--muted)">' + (u.online ? '🟢 在线' : '⚪ 离线') + '</div></div>' +
          '</div>' +
          '<div class="chat-body" id="chatBody">' + msgs + '</div>' +
          '<div class="chat-input">' +
            '<input id="chatInput" placeholder="说点什么…（Enter 发送）" />' +
            '<button class="btn btn-primary" id="chatSend">发送</button>' +
          '</div>' +
        '</div>';
    },
    mount(userId) {
      const u = D.usersById[userId];
      const content = document.getElementById('content');
      content.querySelector('#chatBack').onclick = () => go('posts');

      // 首次进入自动送一句对方的问候（随机，每次进入略有不同）
      const chat0 = S.getChat(userId);
      if (!chat0.length) {
        S.addMessage(userId, 'them', generateGreeting(u));
      }

      renderMessages(userId);

      const input = content.querySelector('#chatInput');
      const send = () => {
        const text = input.value.trim();
        if (!text) return;
        S.addMessage(userId, 'me', text);
        detectTopics(text).forEach(k => S.rememberTopic(userId, k)); // 记住你提过的话题
        input.value = '';
        renderMessages(userId);
        // 模拟对方正在输入 + 回复
        const body = document.getElementById('chatBody');
        const typing = document.createElement('div');
        typing.className = 'typing'; typing.textContent = u.name + ' 正在输入…';
        body.appendChild(typing); body.scrollTop = body.scrollHeight;
        setTimeout(() => {
          const reply = generateReply(userId, text); // 按你说的话生成各不相同的新回复
          typing.remove();
          S.addMessage(userId, 'them', reply);
          renderMessages(userId);
        }, 1200 + Math.random() * 800);
      };
      content.querySelector('#chatSend').onclick = send;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    }
  };

  function msgHtml(m, u) {
    const cls = m.from === 'me' ? 'msg-me' : 'msg-them';
    const who = m.from === 'me' ? '我' : u.name;
    return '<div class="msg ' + cls + '">' + UI.esc(m.text) +
      '<div class="msg-time">' + who + ' · ' + UI.esc(m.time || '') + '</div></div>';
  }

  function renderMessages(userId) {
    const body = document.getElementById('chatBody');
    if (!body) return;
    body.innerHTML = S.getChat(userId).map(m => msgHtml(m, D.usersById[userId])).join('') ||
      '<div class="typing">和 ' + UI.esc(D.usersById[userId].name) + ' 打个招呼吧～</div>';
    body.scrollTop = body.scrollHeight;
  }

  return { posts, search, game, profile, chat };
})();
