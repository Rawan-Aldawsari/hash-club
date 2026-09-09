// frontend/js/pages/community.js — يتصل بخادم حقيقي، بدون بيانات وهمية
(function(){
  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function timeAgo(iso){
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if(mins < 1) return 'الآن';
    if(mins < 60) return 'قبل ' + mins + ' دقيقة';
    const hrs = Math.floor(mins / 60);
    if(hrs < 24) return 'قبل ' + hrs + ' ساعة';
    const days = Math.floor(hrs / 24);
    return 'قبل ' + days + ' يوم';
  }
  function initials(name){
    const parts = (name || '').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }

  let me = null;

  async function loadMe(){
    try{
      const res = await fetch('/api/auth/me', { credentials:'include' });
      if(res.ok){ const data = await res.json(); me = data.user; }
    }catch(e){}

    const avatarEl = document.getElementById('miniAvatar');
    const nameEl = document.getElementById('miniName');
    const subEl = document.getElementById('miniSub');
    const linkEl = document.getElementById('miniProfileLink');
    const composeAvatar = document.getElementById('composeAvatar');

    if(me){
      const initial = initials(me.firstName + ' ' + me.lastName);
      if(avatarEl) avatarEl.textContent = initial;
      if(composeAvatar) composeAvatar.textContent = initial;
      if(nameEl) nameEl.textContent = me.firstName + ' ' + me.lastName;
      if(subEl) subEl.textContent = me.email;
      if(linkEl) linkEl.textContent = 'عرض ملفي';
    } else {
      if(linkEl){ linkEl.textContent = 'تسجيل الدخول'; linkEl.setAttribute('href', 'auth.html'); }
    }
  }

  function renderPost(p){
    const commentsHtml = (p.comments || []).map(c => `
      <div style="display:flex;gap:8px;margin-top:10px;">
        <div class="avatar sm">${esc(initials(c.authorName))}</div>
        <div style="background:var(--tint);border-radius:12px;padding:8px 12px;flex:1;">
          <b style="font-size:12.5px;color:var(--ink);">${esc(c.authorName)}</b>
          <p style="font-size:13px;color:var(--ink);margin-top:2px;">${esc(c.text)}</p>
        </div>
      </div>
    `).join('');

    const tagsHtml = (p.tags || []).map(t => `<span class="pill">#${esc(t)}</span>`).join('');

    return `
      <article class="panel post reveal in" data-post-id="${esc(p.id)}">
        <div class="post-head"><div class="avatar">${esc(initials(p.authorName))}</div><div><b>${esc(p.authorName)}</b><span>${timeAgo(p.createdAt)}</span></div></div>
        <p class="body-text">${esc(p.text)}</p>
        ${tagsHtml ? `<div class="post-tags">${tagsHtml}</div>` : ''}
        <div class="post-actions">
          <span class="js-like" style="${p.likedByMe ? 'color:var(--periwinkle);' : ''}">❤️ <span class="like-count">${p.likesCount}</span> إعجاب</span>
          <span class="js-comment-toggle">💬 ${p.comments.length} تعليق</span>
        </div>
        <div class="js-comments" style="margin-top:10px;${p.comments.length ? '' : 'display:none;'}">${commentsHtml}</div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <input class="input js-comment-input" placeholder="${me ? 'اكتبي تعليقًا...' : 'سجّلي دخولك للتعليق'}" ${me ? '' : 'disabled'} style="font-size:13px;padding:9px 12px;">
          <button class="btn btn-ghost sm js-comment-send" ${me ? '' : 'disabled'}>إرسال</button>
        </div>
      </article>
    `;
  }

  async function loadFeed(){
    const feed = document.getElementById('postsFeed');
    const empty = document.getElementById('feedEmpty');
    const loading = document.getElementById('feedLoading');
    try{
      const res = await fetch('/api/posts');
      const data = await res.json();
      loading.style.display = 'none';
      if(!data.posts || data.posts.length === 0){
        empty.style.display = 'block';
        feed.innerHTML = '';
        return;
      }
      empty.style.display = 'none';
      feed.innerHTML = data.posts.map(renderPost).join('');
    }catch(e){
      loading.textContent = 'تعذّر تحميل المنشورات — تأكدي إن الخادم شغّال (npm start)';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadMe().then(loadFeed);

    const publishBtn = document.getElementById('publishBtn');
    if(publishBtn){
      publishBtn.addEventListener('click', async () => {
        if(!me){ location.href='auth.html'; return; }
        const textarea = document.getElementById('composeText');
        const text = textarea.value.trim();
        if(!text) return;
        publishBtn.disabled = true;
        try{
          const res = await fetch('/api/posts', {
            method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ text })
          });
          if(res.ok){
            textarea.value = '';
            await loadFeed();
          } else {
            const data = await res.json().catch(()=>({}));
          }
        }catch(e){
        }
        publishBtn.disabled = false;
      });
    }

    // delegated handlers for like / comment (works on dynamically-rendered posts)
    document.getElementById('postsFeed').addEventListener('click', async (e) => {
      const postEl = e.target.closest('[data-post-id]');
      if(!postEl) return;
      const postId = postEl.getAttribute('data-post-id');

      if(e.target.closest('.js-like')){
        if(!me){ location.href='auth.html'; return; }
        const res = await fetch(`/api/posts/${postId}/like`, { method:'POST', credentials:'include' });
        if(res.ok){
          const data = await res.json();
          const likeSpan = postEl.querySelector('.js-like');
          likeSpan.querySelector('.like-count').textContent = data.likesCount;
          likeSpan.style.color = data.likedByMe ? 'var(--periwinkle)' : '';
        }
        return;
      }

      if(e.target.closest('.js-comment-toggle')){
        postEl.querySelector('.js-comments').style.display = postEl.querySelector('.js-comments').style.display === 'none' ? 'block' : 'none';
        return;
      }

      if(e.target.closest('.js-comment-send')){
        if(!me){ location.href='auth.html'; return; }
        const input = postEl.querySelector('.js-comment-input');
        const text = input.value.trim();
        if(!text) return;
        const res = await fetch(`/api/posts/${postId}/comments`, {
          method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ text })
        });
        if(res.ok){
          input.value = '';
          await loadFeed();
        }
      }
    });
  });
})();
