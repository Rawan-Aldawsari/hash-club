// frontend/js/pages/blog.js — يتصل بخادم حقيقي، بدون بيانات وهمية
(function(){
  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function formatDate(iso){
    return new Date(iso).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
  }
  function readMinutes(body){
    return Math.max(1, Math.round((body || '').split(/\s+/).length / 180));
  }

  let me = null;
  let allPosts = [];
  let activeCat = 'الكل';

  const GRADIENTS = [
    'linear-gradient(135deg,#6e83f5,#2d3365)',
    'linear-gradient(135deg,#2d3365,#6e83f5)',
    'linear-gradient(135deg,#8a9bf7,#2d3365)',
    'linear-gradient(135deg,#2d3365,#1b1f42)'
  ];

  async function loadMe(){
    try{
      const res = await fetch('/api/auth/me', { credentials:'include' });
      if(res.ok){ const data = await res.json(); me = data.user; }
    }catch(e){}
  }

  function renderList(){
    const grid = document.getElementById('blogGrid');
    const empty = document.getElementById('blogEmpty');
    const filtered = activeCat === 'الكل' ? allPosts : allPosts.filter(p => p.category === activeCat);

    if(filtered.length === 0){
      empty.style.display = 'block';
      grid.innerHTML = '';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = filtered.map((p, i) => `
      <article class="card reveal in js-open-article" data-id="${esc(p.id)}" style="cursor:pointer;">
        <div class="card-media" style="background:${GRADIENTS[i % GRADIENTS.length]};"><span class="card-tag">${esc(p.category)}</span></div>
        <div class="card-body">
          <div class="card-meta">✍️ ${esc(p.authorName)} · ${formatDate(p.createdAt)}</div>
          <h3>${esc(p.title)}</h3>
          <p>${esc((p.body || '').slice(0, 110))}${p.body && p.body.length > 110 ? '...' : ''}</p>
          <div class="card-foot"><span>اقرأ المقال ←</span><span>${readMinutes(p.body)} دقائق</span></div>
        </div>
      </article>
    `).join('');
  }

  async function loadPosts(){
    const loading = document.getElementById('blogLoading');
    try{
      const res = await fetch('/api/blog');
      const data = await res.json();
      loading.style.display = 'none';
      allPosts = data.posts || [];
      renderList();
    }catch(e){
      loading.textContent = 'تعذّر تحميل المقالات — تأكدي إن الخادم شغّال (npm start)';
    }
  }

  function openArticle(id){
    const post = allPosts.find(p => p.id === id);
    if(!post) return;
    document.getElementById('blogGrid').style.display = 'none';
    document.getElementById('categoryFilters').style.display = 'none';
    document.getElementById('blogEmpty').style.display = 'none';
    document.getElementById('articleView').style.display = 'block';
    document.getElementById('articleTitle').textContent = post.title;
    document.getElementById('articleMeta').textContent = `✍️ ${post.authorName} · ${formatDate(post.createdAt)} · ${post.category}`;
    document.getElementById('articleBody').textContent = post.body;
    window.scrollTo({ top: document.getElementById('articleView').offsetTop - 100, behavior:'smooth' });
  }

  function closeArticle(){
    document.getElementById('articleView').style.display = 'none';
    document.getElementById('blogGrid').style.display = '';
    document.getElementById('categoryFilters').style.display = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadMe().then(loadPosts);

    const addBtn = document.getElementById('addPostBtn');
    const form = document.getElementById('addPostForm');
    addBtn.addEventListener('click', () => {
      if(!me){ location.href = 'auth.html'; return; }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('cancelPostBtn').addEventListener('click', () => { form.style.display = 'none'; });

    document.getElementById('submitPostBtn').addEventListener('click', async () => {
      const errBox = document.getElementById('addPostError');
      const showErr = (msg) => { errBox.textContent = msg; errBox.style.display = 'block'; };
      errBox.style.display = 'none';

      const title = document.getElementById('bTitle').value.trim();
      const category = document.getElementById('bCategory').value;
      const body = document.getElementById('bBody').value.trim();
      if(!title || !body){ showErr('العنوان والمحتوى مطلوبان'); return; }

      try{
        const res = await fetch('/api/blog', {
          method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ title, category, body })
        });
        if(res.ok){
          document.getElementById('bTitle').value = '';
          document.getElementById('bBody').value = '';
          form.style.display = 'none';
          await loadPosts();
        } else {
          const data = await res.json().catch(()=>({}));
          showErr(data.error || 'تعذّر نشر المقال');
        }
      }catch(e){
        showErr('تعذّر الاتصال بالخادم');
      }
    });

    document.getElementById('categoryFilters').addEventListener('click', (e) => {
      const btn = e.target.closest('.js-filter');
      if(!btn) return;
      document.querySelectorAll('.js-filter').forEach(b => {
        b.classList.remove('active');
        b.style.background = '#fff'; b.style.color = '';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--navy)'; btn.style.color = '#fff';
      activeCat = btn.getAttribute('data-cat');
      renderList();
    });

    document.getElementById('blogGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.js-open-article');
      if(card) openArticle(card.getAttribute('data-id'));
    });
    document.getElementById('closeArticleBtn').addEventListener('click', closeArticle);
  });
})();
