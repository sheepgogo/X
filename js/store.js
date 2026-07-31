/* ===========================================================
   状态管理：基于 localStorage，负责帖子 / 好友请求 / 好友 /
   聊天 / 成就 / 统计 的读写与解锁逻辑。
   =========================================================== */
window.App = window.App || {};

App.store = (function () {
  const KEY = 'xinyu_friend_assistant_v1';

  function defaultState() {
    return {
      me: { name: '我', avatar: '🙂', bio: '一个正在学着交朋友的人。', hobbies: [], traits: [] },
      posts: [],                 // 用户自己发布的帖子
      requests: {},              // userId -> 'pending' | 'accepted'
      friends: [],               // 已通过的好友 userId 列表
      chats: {},                 // userId -> [{from:'me'|'them', text, time}]
      memories: {},              // userId -> [记住的话题 key]，用于聊天"上文呼应"
      achievements: [],          // 已解锁成就 id
      stats: { posts: 0, requests: 0, chats: 0, searches: 0, game: false, gameScore: 0 }
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign(defaultState(), parsed);
      }
    } catch (e) { /* ignore */ }
    return defaultState();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    notify();
  }

  // ---- 轻量订阅，便于侧边栏等同步刷新 ----
  const listeners = [];
  function subscribe(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(fn => fn(state)); }

  // ---------- 我 ----------
  function getMe() { return state.me; }
  function setMe(patch) { state.me = Object.assign({}, state.me, patch); save(); }

  // ---------- 帖子 ----------
  function getUserPosts() {
    // 合并预设帖子 + 用户自己发的帖子（用户帖子在前）
    const mine = state.posts.map(p => Object.assign({ mine: true }, p));
    const preset = App.data.presetPosts.map(p => Object.assign({ mine: false }, p));
    return mine.concat(preset);
  }
  function addPost(post) {
    const p = Object.assign({
      id: 'mine_' + Date.now(),
      userId: 'me',
      time: '刚刚'
    }, post);
    state.posts.unshift(p);
    state.stats.posts++;
    save();
    unlock('first_post');
    return p;
  }

  // ---------- 好友请求 / 好友 ----------
  function getRequestStatus(userId) { return state.requests[userId] || null; }
  function isFriend(userId) { return state.friends.indexOf(userId) !== -1; }

  function sendRequest(userId, message) {
    if (state.requests[userId]) return state.requests[userId];
    state.requests[userId] = 'accepted'; // 演示：对方即时通过
    if (state.friends.indexOf(userId) === -1) state.friends.push(userId);
    state.stats.requests++;
    if (!state.chats[userId]) state.chats[userId] = [];
    if (message) {
      state.chats[userId].push({ from: 'me', text: message, time: now() });
    }
    save();
    unlock('first_request');
    unlock('first_friend');
    if (state.friends.length >= 3) unlock('three_friends');
    return 'accepted';
  }

  function getFriends() {
    return state.friends.map(id => App.data.usersById[id]).filter(Boolean);
  }

  // ---------- 聊天 ----------
  function getChat(userId) { return state.chats[userId] || []; }
  function getMemory(userId) { return state.memories[userId] || []; }
  function rememberTopic(userId, key) {
    if (!state.memories[userId]) state.memories[userId] = [];
    if (state.memories[userId].indexOf(key) === -1) {
      state.memories[userId].push(key);
      save();
    }
  }
  function addMessage(userId, from, text) {
    if (!state.chats[userId]) state.chats[userId] = [];
    state.chats[userId].push({ from: from, text: text, time: now() });
    if (from === 'me') {
      state.stats.chats++;
      unlock('first_chat');
      if (state.stats.chats >= 10) unlock('chatty');
    }
    save();
  }

  // ---------- 成就 ----------
  function hasAchievement(id) { return state.achievements.indexOf(id) !== -1; }
  function unlock(id) {
    if (state.achievements.indexOf(id) === -1) {
      state.achievements.push(id);
      const a = App.data.achievements.find(x => x.id === id);
      if (a) App.ui && App.ui.toast('🏅 解锁成就：' + a.name);
      save();
      return true;
    }
    return false;
  }

  // ---------- 统计 / 搜索 / 游戏 ----------
  function recordSearch() { state.stats.searches++; save(); unlock('explorer'); }
  function recordGame(score) {
    state.stats.game = true;
    state.stats.gameScore = Math.max(state.stats.gameScore, score);
    save();
    unlock('game_master');
  }

  function resetAll() {
    state = defaultState();
    save();
  }

  function now() {
    const d = new Date();
    const p = n => (n < 10 ? '0' + n : '' + n);
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  return {
    subscribe, save,
    getMe, setMe,
    getUserPosts, addPost,
    getRequestStatus, isFriend, sendRequest, getFriends,
    getChat, addMessage, getMemory, rememberTopic,
    hasAchievement, unlock,
    recordSearch, recordGame, resetAll,
    getState: () => state
  };
})();
