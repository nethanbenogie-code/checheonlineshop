/* ============================================================
   Cheche Cabalida Online Shop — app logic
   ============================================================ */
(function () {
  'use strict';

  var DRAFT_KEY = 'cheche_shop_draft_v1';
  var FB_VERSION = 'v25.0';

  var state = {
    shop: null,
    posts: [],
    filter: 'all',
    query: '',
    editingId: null
  };

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function toast(msg) {
    var host = el('toasts');
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  }

  /* Pull a clean Facebook post URL out of either a plain link
     or a full <iframe> embed snippet that the user pasted. */
  function extractHref(raw) {
    raw = (raw || '').trim();
    if (!raw) return '';
    var m = raw.match(/[?&]href=([^&"'\s>]+)/i);
    if (m) {
      var decoded;
      try { decoded = decodeURIComponent(m[1]); } catch (e) { decoded = m[1]; }
      if (/facebook\.com/i.test(decoded)) return decoded;
    }
    // plain URL — strip wrapping quotes/whitespace
    return raw.replace(/^["'\s]+|["'\s]+$/g, '');
  }

  function categoryById(id) {
    var cats = (state.shop && state.shop.categories) || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i];
    return { id: 'uncat', label: 'Other', color: '#6B4A57' };
  }

  /* ---------- data load / save ---------- */
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  }

  /* Shop settings always come fresh from posts.json, so hand-edits to the
     Messenger link / page URL / info show up right away. Only the post LIST
     is taken from a saved local draft (your unpublished work in progress). */
  function loadData() {
    return fetch('posts.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.shop = data.shop || fallbackShop();
        var draft = readDraft();
        if (draft && Array.isArray(draft.posts)) { state.posts = draft.posts.slice(); setDirty(true); }
        else { state.posts = Array.isArray(data.posts) ? data.posts.slice() : []; }
      })
      .catch(function () {
        var draft = readDraft();
        state.shop = (draft && draft.shop) || fallbackShop();
        state.posts = (draft && draft.posts) || [];
        if (draft && draft.posts) setDirty(true);
        toast('Offline or posts.json missing — showing saved data.');
      });
  }

  function fallbackShop() {
    return {
      name: 'Cheche Cabalida', subtitle: 'Online Shop', tagline: '',
      location: '', hours: '', payment: '', messenger: '#', pageUrl: '#',
      categories: [
        { id: 'home', label: 'Home Accessories', color: '#C77D4A' },
        { id: 'beauty', label: 'Beauty Products', color: '#B4456B' }
      ]
    };
  }

  function apply(data) {
    state.shop = data.shop || fallbackShop();
    state.posts = Array.isArray(data.posts) ? data.posts.slice() : [];
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ shop: state.shop, posts: state.posts }));
    } catch (e) {}
    setDirty(true);
  }

  function setDirty(on) {
    el('dirtyBanner').classList.toggle('is-on', !!on);
  }

  /* ---------- render: shop chrome ---------- */
  function renderShop() {
    var s = state.shop;
    document.title = s.name + ' ' + (s.subtitle || '') + ' — Home Accessories & Beauty';
    if (s.location) el('heroEyebrow').textContent = s.location + ' · ' + (s.subtitle || 'Online Shop');
    el('heroTagline').textContent = s.tagline || '';
    el('metaLocation').textContent = s.location || '';
    el('metaPayment').textContent = s.payment || '';
    el('metaHours').textContent = s.hours || '';

    var mUrl = s.messenger || '#';
    ['msgHeader', 'msgHero', 'fab', 'footMsg'].forEach(function (id) { el(id).href = mUrl; });
    el('footPage').href = s.pageUrl || '#';

    el('footName').textContent = s.name || '';
    el('footTagline').textContent = s.tagline || '';
    el('footLocation').textContent = s.location || '';
    el('footPayment').textContent = s.payment || '';
    el('footHours').textContent = s.hours || '';
    el('year').textContent = new Date().getFullYear();

    renderChips();
    renderCatSelect();
  }

  function renderChips() {
    var chips = el('chips');
    var cats = state.shop.categories || [];
    var html = '<button class="chip" data-cat="all"><span class="swatch" style="background:var(--berry-deep)"></span>All</button>';
    cats.forEach(function (c) {
      html += '<button class="chip" data-cat="' + esc(c.id) + '"><span class="swatch" style="background:' + esc(c.color) + '"></span>' + esc(c.label) + '</button>';
    });
    chips.innerHTML = html;
    Array.prototype.forEach.call(chips.querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function () { setFilter(b.getAttribute('data-cat')); });
    });
    syncChips();
  }

  function renderCatSelect() {
    var sel = el('postCat');
    sel.innerHTML = (state.shop.categories || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>';
    }).join('');
  }

  function syncChips() {
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-cat') === state.filter);
    });
  }

  /* ---------- render: post grid ---------- */
  function postCard(p) {
    var cat = categoryById(p.category);
    var url = extractHref(p.url);
    var mUrl = state.shop.messenger || '#';
    return '' +
      '<article class="card" data-cat="' + esc(cat.id) + '" data-id="' + esc(p.id) + '" data-cap="' + esc((p.caption || '') + ' ' + url) + '">' +
        '<div class="card-ribbon">' +
          esc(cat.label) +
          '<span class="order-edit">' +
            '<button class="mini" data-act="edit" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
            '<button class="mini" data-act="del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>' +
          '</span>' +
        '</div>' +
        '<div class="embed-host">' +
          '<div class="fb-post" data-href="' + esc(url) + '" data-width="360" data-show-text="true"></div>' +
          '<div class="embed-fallback" style="display:none">Couldn\u2019t load the live post. <a href="' + esc(url) + '" target="_blank" rel="noopener">Open on Facebook ↗</a></div>' +
        '</div>' +
        (p.caption ? '<p class="card-caption">' + esc(p.caption) + '</p>' : '') +
        '<div class="card-actions">' +
          '<a class="btn btn-primary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">Order this ↗</a>' +
          '<a class="btn btn-msg btn-sm" href="' + esc(mUrl) + '" target="_blank" rel="noopener" title="Message us on Messenger">Message ↗</a>' +
        '</div>' +
      '</article>';
  }

  function renderGrid() {
    var grid = el('grid');
    grid.innerHTML = state.posts.map(postCard).join('');
    bindCardActions();
    applyFilter();
    parseEmbeds(grid);
  }

  function bindCardActions() {
    Array.prototype.forEach.call(el('grid').querySelectorAll('[data-act]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var card = btn.closest('.card');
        var id = card.getAttribute('data-id');
        if (btn.getAttribute('data-act') === 'del') deletePost(id);
        else startEdit(id);
      });
    });
  }

  /* ---------- filtering ---------- */
  function setFilter(cat) { state.filter = cat; syncChips(); applyFilter(); }

  function applyFilter() {
    var q = state.query.trim().toLowerCase();
    var shown = 0;
    Array.prototype.forEach.call(el('grid').querySelectorAll('.card'), function (card) {
      var okCat = state.filter === 'all' || card.getAttribute('data-cat') === state.filter;
      var okQ = !q || (card.getAttribute('data-cap') || '').toLowerCase().indexOf(q) !== -1;
      var show = okCat && okQ;
      card.classList.toggle('is-hidden', !show);
      if (show) shown++;
    });
    el('empty').classList.toggle('is-hidden', shown !== 0 || state.posts.length === 0);
    if (state.posts.length === 0) {
      el('empty').classList.remove('is-hidden');
      $('#empty h3').textContent = 'No posts yet';
      $('#empty p').textContent = 'Open “Manage shop” at the bottom of the page to add your first Facebook post.';
    }
    var total = state.posts.length;
    el('count').textContent = total ? (shown + ' of ' + total + ' shown') : '';
  }

  /* ---------- Facebook embeds ---------- */
  function parseEmbeds(root) {
    var tries = 0;
    (function wait() {
      if (window.FB && window.FB.XFBML) {
        try { window.FB.XFBML.parse(root); } catch (e) {}
        return;
      }
      if (tries++ > 60) return; // ~12s
      setTimeout(wait, 200);
    })();
  }

  /* ---------- manage: add / edit / delete / reorder ---------- */
  function addOrSavePost() {
    var raw = el('postUrl').value;
    var url = extractHref(raw);
    if (!/facebook\.com/i.test(url)) { toast('Please paste a valid Facebook post link or embed.'); return; }
    var cat = el('postCat').value;
    var cap = el('postCap').value.trim();

    if (state.editingId) {
      state.posts = state.posts.map(function (p) {
        if (p.id === state.editingId) return { id: p.id, url: url, category: cat, caption: cap, addedAt: p.addedAt };
        return p;
      });
      toast('Post updated.');
      state.editingId = null;
      el('addBtn').textContent = 'Add post';
    } else {
      state.posts.unshift({ id: uid(), url: url, category: cat, caption: cap, addedAt: new Date().toISOString() });
      toast('Post added.');
    }
    el('postUrl').value = ''; el('postCap').value = '';
    saveDraft();
    renderGrid();
    renderManageList();
  }

  function startEdit(id) {
    var p = state.posts.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    state.editingId = id;
    el('postUrl').value = p.url;
    el('postCat').value = p.category;
    el('postCap').value = p.caption || '';
    el('addBtn').textContent = 'Save changes';
    openModalToManage();
    el('postUrl').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function deletePost(id) {
    if (!confirm('Remove this post from the shop?')) return;
    state.posts = state.posts.filter(function (x) { return x.id !== id; });
    saveDraft();
    renderGrid();
    renderManageList();
    toast('Post removed.');
  }

  function movePost(id, dir) {
    var i = state.posts.findIndex(function (x) { return x.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= state.posts.length) return;
    var tmp = state.posts[i]; state.posts[i] = state.posts[j]; state.posts[j] = tmp;
    saveDraft();
    renderGrid();
    renderManageList();
  }

  function renderManageList() {
    var list = el('manageList');
    el('manageCount').textContent = '(' + state.posts.length + ')';
    if (!state.posts.length) { list.innerHTML = '<p style="color:var(--ink-faint);font-size:.88rem">No posts yet. Add one above.</p>'; return; }
    list.innerHTML = state.posts.map(function (p, i) {
      var cat = categoryById(p.category);
      var cap = p.caption || '(no caption)';
      return '<div class="manage-item" data-cat="' + esc(cat.id) + '" data-id="' + esc(p.id) + '">' +
        '<span class="tag">' + esc(cat.label.split(' ')[0]) + '</span>' +
        '<span class="meta"><span class="cap">' + esc(cap) + '</span><span class="u">' + esc(extractHref(p.url)) + '</span></span>' +
        '<span class="acts">' +
          '<button class="icon-btn" data-m="up" title="Move up"' + (i === 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>' +
          '<button class="icon-btn" data-m="down" title="Move down"' + (i === state.posts.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
          '<button class="icon-btn" data-m="edit" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
          '<button class="icon-btn" data-m="del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>' +
        '</span>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('[data-m]'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.closest('.manage-item').getAttribute('data-id');
        var m = btn.getAttribute('data-m');
        if (m === 'up') movePost(id, -1);
        else if (m === 'down') movePost(id, 1);
        else if (m === 'edit') startEdit(id);
        else if (m === 'del') deletePost(id);
      });
    });
  }

  /* ---------- publish: download / copy / import ---------- */
  function buildJSON() {
    return JSON.stringify({ shop: state.shop, posts: state.posts }, null, 2);
  }
  function downloadJSON() {
    var blob = new Blob([buildJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'posts.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
    toast('posts.json downloaded — commit it to GitHub to publish.');
  }
  function copyJSON() {
    navigator.clipboard.writeText(buildJSON())
      .then(function () { toast('JSON copied to clipboard.'); })
      .catch(function () { toast('Copy failed — use Download instead.'); });
  }
  function importJSON() {
    var txt = el('importBox').value.trim();
    if (!txt) { toast('Paste a posts.json first.'); return; }
    try {
      var data = JSON.parse(txt);
      if (!data || !Array.isArray(data.posts)) throw new Error('no posts');
      apply(data);
      saveDraft();
      renderShop(); renderGrid(); renderManageList();
      el('importBox').value = '';
      toast('Imported ' + state.posts.length + ' posts.');
    } catch (e) { toast('That doesn’t look like a valid posts.json.'); }
  }
  function discardDraft() {
    if (!confirm('Discard local changes and reload the published posts.json?')) return;
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
  }

  /* ---------- modal ---------- */
  function openModal() { el('modal').classList.add('is-open'); }
  function closeModal() { el('modal').classList.remove('is-open'); }
  function openModalToManage() { openModal(); unlock(true); }

  function unlock(skipCheck) {
    var s = state.shop || {};
    var code = (s.manage && s.manage.passcode) || 'cheche2026';
    if (!skipCheck) {
      if (el('pass').value !== code) { toast('Wrong passcode.'); return; }
    }
    el('lockView').hidden = true;
    el('manageView').hidden = false;
    document.body.classList.add('is-managing');
    renderManageList();
  }

  /* ---------- PWA: install + service worker ---------- */
  var deferredPrompt = null;
  function setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      el('installBtn').classList.add('is-ready');
    });
    el('installBtn').addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
          el('installBtn').classList.remove('is-ready');
        });
      } else {
        var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        toast(iOS ? 'Tap the Share button, then “Add to Home Screen”.'
                  : 'Use your browser menu → “Install app” / “Add to Home screen”.');
      }
    });
    window.addEventListener('appinstalled', function () {
      el('installBtn').classList.remove('is-ready');
      toast('Installed! Find Cheche Shop on your home screen.');
    });
  }

  /* ---------- wire up events ---------- */
  function bindEvents() {
    var s = el('searchInput');
    s.addEventListener('input', function () { state.query = s.value; applyFilter(); });

    el('manageOpen').addEventListener('click', openModal);
    el('modalClose').addEventListener('click', closeModal);
    el('modal').addEventListener('click', function (e) { if (e.target === el('modal')) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    el('unlockBtn').addEventListener('click', function () { unlock(false); });
    el('pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(false); });
    el('addBtn').addEventListener('click', addOrSavePost);
    el('downloadBtn').addEventListener('click', downloadJSON);
    el('copyBtn').addEventListener('click', copyJSON);
    el('importBtn').addEventListener('click', importJSON);
    el('discardBtn').addEventListener('click', discardDraft);
  }

  /* ---------- boot ---------- */
  loadData().then(function () {
    renderShop();
    renderGrid();
    bindEvents();
    setupPWA();
  });
})();
