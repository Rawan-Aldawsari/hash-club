// frontend/js/pages/index.js — يعرض أحدث 3 مقالات حقيقية من المدونة (بدون بيانات وهمية)
(function(){
  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  const GRADIENTS = ['linear-gradient(135deg,#6e83f5,#2d3365)','linear-gradient(135deg,#2d3365,#6e83f5)','linear-gradient(135deg,#8a9bf7,#2d3365)'];

  document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('homeBlogGrid');
    const empty = document.getElementById('homeBlogEmpty');
    if(!grid) return;
    try{
      const res = await fetch('/api/blog');
      const data = await res.json();
      const posts = (data.posts || []).slice(0, 3);
      if(posts.length === 0){
        empty.style.display = 'block';
        return;
      }
      grid.innerHTML = posts.map((p, i) => `
        <article class="card reveal in">
          <div class="card-media" style="background:${GRADIENTS[i % GRADIENTS.length]};"><span class="card-tag">${esc(p.category)}</span></div>
          <div class="card-body">
            <div class="card-meta">✍️ ${esc(p.authorName)}</div>
            <h3>${esc(p.title)}</h3>
            <p>${esc((p.body || '').slice(0, 90))}${p.body && p.body.length > 90 ? '...' : ''}</p>
            <div class="card-foot"><a href="pages/blog.html" style="color:var(--periwinkle);">اقرأ المقال ←</a></div>
          </div>
        </article>
      `).join('');
    }catch(e){
      // الخادم غير متاح — لا داعي لإظهار خطأ على الصفحة الرئيسية، فقط لا نعرض شيئًا
      empty.style.display = 'block';
    }
  });
})();
