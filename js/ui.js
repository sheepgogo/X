/* ===========================================================
   通用 UI 工具：标签 / 头像 / 弹窗 / Toast / 转义
   =========================================================== */
window.App = window.App || {};

App.ui = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function avatar(emoji, cls) {
    return '<div class="av ' + (cls || '') + '">' + esc(emoji || '🙂') + '</div>';
  }

  function tags(list, type) {
    if (!list || !list.length) return '';
    const cls = type === 'hobby' ? 'tag-hobby' : (type === 'trait' ? 'tag-trait' : 'tag-pink');
    return '<div class="wrap">' + list.map(t => '<span class="tag ' + cls + '">' + esc(t) + '</span>').join('') + '</div>';
  }

  function toast(msg) {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 320);
    }, 2200);
  }

  // 弹窗：{ title, bodyHTML, actions:[{label, cls, onClick(close)}] }
  function modal(opts) {
    const root = document.getElementById('modalRoot');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal" role="dialog">' +
        (opts.title ? '<h3>' + esc(opts.title) + '</h3>' : '') +
        '<div class="modal-body">' + (opts.bodyHTML || '') + '</div>' +
        '<div class="modal-actions"></div>' +
      '</div>';
    root.appendChild(mask);
    const actionsBox = mask.querySelector('.modal-actions');
    function close() { mask.remove(); }
    (opts.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'btn-ghost');
      b.textContent = a.label;
      b.onclick = () => a.onClick && a.onClick(close);
      actionsBox.appendChild(b);
    });
    mask.addEventListener('click', e => { if (e.target === mask && opts.dismissable !== false) close(); });
    return { close: close, el: mask };
  }

  function confirmDialog(title, bodyHTML, onYes, yesLabel) {
    modal({
      title: title,
      bodyHTML: bodyHTML,
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: c => c() },
        {
          label: yesLabel || '确定', cls: 'btn-primary', onClick: c => {
            c(); onYes && onYes();
          }
        }
      ]
    });
  }

  function timeNow() {
    const d = new Date();
    const p = n => (n < 10 ? '0' + n : '' + n);
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  return { esc, avatar, tags, toast, modal, confirmDialog, timeNow };
})();
