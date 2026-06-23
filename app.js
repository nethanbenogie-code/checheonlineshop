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

  /* Turn whatever was pasted into a SAFE, absolute Facebook URL.
     Returns '' if it isn't a recognizable Facebook link, so a bad value
     can never become a relative link that navigates back into the site. */
  function normalizeFbUrl(raw) {
    var u = extractHref(raw);
    if (!u) return '';
    u = u.replace(/\s+/g, '');
    if (/^https?:\/\//i.test(u)) {
      // already absolute — accept only if it points at Facebook
      return /facebook\.com|fb\.(com|watch|me)|^https?:\/\/m\.me/i.test(u) ? u : '';
    }
    if (/^\/\//.test(u)) return 'https:' + u;
    if (/^(www\.|m\.|web\.|mbasic\.)?facebook\.com/i.test(u) ||
        /^fb\.(com|watch|me)/i.test(u) || /^m\.me/i.test(u)) {
      return 'https://' + u;
    }
    return '';
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

  /* The local draft is your full unpublished working copy (shop + posts).
     Hand-edits to posts.json show up after you Discard the draft. */
  function loadData() {
    return fetch('posts.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var draft = readDraft();
        if (draft && draft.shop && Array.isArray(draft.posts)) {
          state.shop = withDefaults(draft.shop);
          state.posts = draft.posts.slice();
          setDirty(true);
        } else {
          state.shop = withDefaults(data.shop);
          state.posts = Array.isArray(data.posts) ? data.posts.slice() : [];
        }
      })
      .catch(function () {
        var draft = readDraft();
        state.shop = withDefaults((draft && draft.shop) || null);
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

  /* Ensure newer fields exist even if an older posts.json/draft lacks them. */
  function withDefaults(shop) {
    var s = shop || fallbackShop();
    if (!s.categories) s.categories = fallbackShop().categories;
    if (!s.promo) s.promo = { on: false, text: '', link: '' };
    if (!Array.isArray(s.howToOrder)) s.howToOrder = [];
    if (!Array.isArray(s.faqs)) s.faqs = [];
    if (!s.analytics) s.analytics = { goatcounter: '' };
    return s;
  }

  function apply(data) {
    state.shop = withDefaults(data.shop);
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
    ['msgHeader', 'msgHero', 'msgInfo', 'fab', 'footMsg'].forEach(function (id) { var e = el(id); if (e) e.href = mUrl; });
    el('footPage').href = s.pageUrl || '#';

    el('footName').textContent = s.name || '';
    el('footTagline').textContent = s.tagline || '';
    el('footLocation').textContent = s.location || '';
    el('footPayment').textContent = s.payment || '';
    el('footHours').textContent = s.hours || '';
    el('year').textContent = new Date().getFullYear();

    renderChips();
    renderCatSelect();
    renderPromo();
    renderInfo();
  }

  /* ---------- promo bar ---------- */
  var PROMO_DISMISS_KEY = 'cheche_promo_dismissed_v1';
  function renderPromo() {
    var p = state.shop.promo || {};
    var bar = el('promoBar');
    var dismissed = '';
    try { dismissed = localStorage.getItem(PROMO_DISMISS_KEY) || ''; } catch (e) {}
    var show = p.on && p.text && dismissed !== p.text;
    if (show) {
      el('promoText').textContent = p.text;
      var link = normalizeAnyUrl(p.link);
      var a = el('promoLinkWrap');
      if (link) { a.href = link; a.style.display = ''; el('promoText').style.display = 'none'; el('promoLinkText').textContent = p.text; }
      else { a.style.display = 'none'; el('promoText').style.display = ''; }
      bar.classList.add('is-on');
      document.body.classList.add('has-promo');
    } else {
      bar.classList.remove('is-on');
      document.body.classList.remove('has-promo');
    }
  }
  function dismissPromo() {
    try { localStorage.setItem(PROMO_DISMISS_KEY, (state.shop.promo || {}).text || '1'); } catch (e) {}
    renderPromo();
  }

  /* ---------- how-to-order + FAQ ---------- */
  function renderInfo() {
    var steps = state.shop.howToOrder || [];
    var faqs = state.shop.faqs || [];
    var section = el('infoSection');
    if (!steps.length && !faqs.length) { section.style.display = 'none'; return; }
    section.style.display = '';

    el('howToList').innerHTML = steps.map(function (s, i) {
      return '<li><span class="step-n">' + (i + 1) + '</span><span>' + esc(s) + '</span></li>';
    }).join('');
    el('howToWrap').style.display = steps.length ? '' : 'none';

    el('faqList').innerHTML = faqs.map(function (f) {
      return '<details class="faq"><summary>' + esc(f.q || '') +
        '<span class="chev">⌄</span></summary><div class="faq-a">' + esc(f.a || '') + '</div></details>';
    }).join('');
    el('faqWrap').style.display = faqs.length ? '' : 'none';
  }

  /* Accept any http(s) link for the promo bar (Facebook, external, or in-page #anchor). */
  function normalizeAnyUrl(raw) {
    var u = (raw || '').trim();
    if (!u) return '';
    if (/^#/.test(u)) return u;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/\//.test(u)) return 'https:' + u;
    if (/\./.test(u)) return 'https://' + u;
    return '';
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
    var url = normalizeFbUrl(p.url);
    var mUrl = state.shop.messenger || '#';
    var orderHref = url || state.shop.pageUrl || mUrl || '#';
    return '' +
      '<article class="card" data-cat="' + esc(cat.id) + '" data-id="' + esc(p.id) + '" data-cap="' + esc((p.caption || '') + ' ' + url) + '">' +
        '<div class="card-ribbon">' +
          esc(cat.label) +
          '<span class="order-edit">' +
            '<button class="mini" data-act="edit" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
            '<button class="mini" data-act="del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>' +
          '</span>' +
        '</div>' +
        '<div class="embed-host"' + (url ? ' data-href="' + esc(url) + '"' : '') + '>' +
          (url ? '<div class="embed-skeleton"><span class="sk-spin"></span><span>Loading post…</span></div>' : '') +
          '<div class="embed-fallback"' + (url ? ' style="display:none"' : '') + '>' +
            (url ? 'Couldn\u2019t load the live post. <a href="' + esc(url) + '" target="_blank" rel="noopener">Open on Facebook ↗</a>'
                 : 'This post is missing its Facebook link. Open <b>Manage shop</b> and edit it.') +
          '</div>' +
        '</div>' +
        (p.caption ? '<p class="card-caption">' + esc(p.caption) + '</p>' : '') +
        '<div class="card-actions">' +
          '<a class="btn btn-primary btn-sm" href="' + esc(orderHref) + '" target="_blank" rel="noopener">Order this ↗</a>' +
          '<a class="btn btn-msg btn-sm" href="' + esc(mUrl) + '" target="_blank" rel="noopener" title="Message us on Messenger">Message ↗</a>' +
        '</div>' +
      '</article>';
  }

  function renderGrid() {
    var grid = el('grid');
    if (embedObserver) embedObserver.disconnect();
    grid.innerHTML = state.posts.map(postCard).join('');
    bindCardActions();
    applyFilter();
    observeEmbeds();
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

  /* ---------- Facebook embeds (lazy-loaded) ---------- */
  function whenFBReady(cb) {
    var t = 0;
    (function w() {
      if (window.FB && window.FB.XFBML) { cb(); return; }
      if (t++ > 60) return; // ~12s
      setTimeout(w, 200);
    })();
  }

  var embedObserver = null;
  function observeEmbeds() {
    var hosts = el('grid').querySelectorAll('.embed-host[data-href]:not([data-loaded])');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(hosts, loadEmbed); // no IO support → just load all
      return;
    }
    if (!embedObserver) {
      embedObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { loadEmbed(e.target); embedObserver.unobserve(e.target); }
        });
      }, { root: null, rootMargin: '500px 0px', threshold: 0 });
    }
    Array.prototype.forEach.call(hosts, function (h) { embedObserver.observe(h); });
  }

  function loadEmbed(host) {
    if (host.getAttribute('data-loaded')) return;
    host.setAttribute('data-loaded', '1');
    var href = host.getAttribute('data-href');
    var post = document.createElement('div');
    post.className = 'fb-post';
    post.setAttribute('data-href', href);
    post.setAttribute('data-width', '360');
    post.setAttribute('data-show-text', 'true');
    host.appendChild(post);
    whenFBReady(function () { try { window.FB.XFBML.parse(host); } catch (e) {} });

    // hide the skeleton once the iframe appears; show fallback if it never does
    var sk = host.querySelector('.embed-skeleton');
    var tries = 0;
    (function check() {
      if (host.querySelector('iframe')) { if (sk) sk.style.display = 'none'; return; }
      if (tries++ > 50) {
        if (sk) sk.style.display = 'none';
        var fb = host.querySelector('.embed-fallback');
        if (fb) fb.style.display = 'block';
        return;
      }
      setTimeout(check, 200);
    })();
  }

  /* ---------- manage: add / edit / delete / reorder ---------- */
  function addOrSavePost() {
    var raw = el('postUrl').value;
    var url = normalizeFbUrl(raw);
    if (!url) { toast('That doesn’t look like a Facebook post link. Copy the post’s link, or its ••• → Embed code.'); return; }
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
        '<span class="meta"><span class="cap">' + esc(cap) + '</span><span class="u">' + esc(normalizeFbUrl(p.url) || '⚠ missing or invalid link — tap edit to fix') + '</span></span>' +
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
    bindManageForms();
  }

  /* ---------- manage: shop details / promo / how-to / FAQ / analytics ---------- */
  function bindManageForms() {
    ['name', 'subtitle', 'tagline', 'location', 'hours', 'payment', 'messenger', 'pageUrl'].forEach(function (f) {
      var inp = el('f_' + f);
      if (!inp) return;
      inp.value = state.shop[f] || '';
      inp.oninput = function () { state.shop[f] = inp.value; saveDraft(); renderShop(); };
    });

    var promo = state.shop.promo || (state.shop.promo = { on: false, text: '', link: '' });
    var pon = el('f_promo_on'), ptext = el('f_promo_text'), plink = el('f_promo_link');
    pon.checked = !!promo.on; ptext.value = promo.text || ''; plink.value = promo.link || '';
    function promoChanged() {
      promo.on = pon.checked; promo.text = ptext.value; promo.link = plink.value;
      try { localStorage.removeItem(PROMO_DISMISS_KEY); } catch (e) {} // owner should see their change
      saveDraft(); renderPromo();
    }
    pon.onchange = promoChanged; ptext.oninput = promoChanged; plink.oninput = promoChanged;

    var hto = el('f_howto');
    hto.value = (state.shop.howToOrder || []).join('\n');
    hto.oninput = function () {
      state.shop.howToOrder = hto.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      saveDraft(); renderInfo();
    };

    var ga = el('f_ga');
    ga.value = (state.shop.analytics && state.shop.analytics.goatcounter) || '';
    ga.oninput = function () {
      if (!state.shop.analytics) state.shop.analytics = {};
      state.shop.analytics.goatcounter = ga.value.trim();
      saveDraft();
    };

    renderFaqEditor();
  }

  function renderFaqEditor() {
    var wrap = el('faqEditor');
    var faqs = state.shop.faqs || (state.shop.faqs = []);
    if (!faqs.length) { wrap.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem">No FAQs yet — add one below.</p>'; return; }
    wrap.innerHTML = faqs.map(function (f, i) {
      return '<div class="faq-edit" data-i="' + i + '">' +
        '<input class="fq" placeholder="Question" value="' + esc(f.q || '') + '">' +
        '<button class="icon-btn fdel" title="Remove">✕</button>' +
        '<textarea class="fa" placeholder="Answer">' + esc(f.a || '') + '</textarea>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('.faq-edit'), function (row) {
      var i = +row.getAttribute('data-i');
      row.querySelector('.fq').oninput = function (e) { faqs[i].q = e.target.value; saveDraft(); renderInfo(); };
      row.querySelector('.fa').oninput = function (e) { faqs[i].a = e.target.value; saveDraft(); renderInfo(); };
      row.querySelector('.fdel').onclick = function () { faqs.splice(i, 1); saveDraft(); renderFaqEditor(); renderInfo(); };
    });
  }
  function addFaq() {
    (state.shop.faqs || (state.shop.faqs = [])).push({ q: '', a: '' });
    saveDraft(); renderFaqEditor(); renderInfo();
  }

  /* ---------- privacy-friendly analytics (GoatCounter, optional) ---------- */
  function setupAnalytics() {
    var code = ((state.shop.analytics && state.shop.analytics.goatcounter) || '').trim();
    if (!code) return;
    var endpoint;
    if (/goatcounter\.com/i.test(code)) {
      endpoint = /^https?:\/\//i.test(code) ? code : 'https://' + code;
      if (!/\/count\/?$/.test(endpoint)) endpoint = endpoint.replace(/\/+$/, '') + '/count';
    } else {
      endpoint = 'https://' + code.replace(/[^a-z0-9-]/gi, '') + '.goatcounter.com/count';
    }
    var sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://gc.zgo.at/count.js';
    sc.setAttribute('data-goatcounter', endpoint);
    document.body.appendChild(sc);
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
    el('addFaqBtn').addEventListener('click', addFaq);
    el('promoClose').addEventListener('click', dismissPromo);
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
    setupAnalytics();
  });
})();
