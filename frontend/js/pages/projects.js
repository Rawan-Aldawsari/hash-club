// frontend/js/pages/projects.js — يتصل بخادم حقيقي، بدون بيانات وهمية
(function(){
  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  let me = null;

  async function loadMe(){
    try{
      const res = await fetch('/api/auth/me', { credentials:'include' });
      if(res.ok){ const data = await res.json(); me = data.user; }
    }catch(e){}
  }

  const GRADIENTS = [
    'linear-gradient(135deg,#6e83f5,#2d3365)',
    'linear-gradient(135deg,#2d3365,#6e83f5)',
    'linear-gradient(135deg,#8a9bf7,#1b1f42)',
    'linear-gradient(135deg,#2d3365,#8a9bf7)'
  ];

  function renderProject(p, i){
    const techHtml = (p.tech || []).map(t => `<span class="tech-chip">${esc(t)}</span>`).join('');
    const links = [
      p.github ? `<a href="${esc(p.github)}" target="_blank" rel="noopener" style="color:var(--periwinkle);">GitHub</a>` : '',
      p.demo ? `<a href="${esc(p.demo)}" target="_blank" rel="noopener" style="color:var(--periwinkle);">Demo</a>` : ''
    ].filter(Boolean).join(' · ') || `<span style="color:var(--ink-soft);font-size:12.5px;">لا توجد روابط</span>`;

    return `
      <article class="card reveal in" data-project-id="${esc(p.id)}">
        <div class="card-media" style="background:${GRADIENTS[i % GRADIENTS.length]};"><span class="card-tag">${esc(p.ownerName)}</span></div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          ${techHtml ? `<div class="project-tech">${techHtml}</div>` : ''}
          <div class="card-foot">
            <div style="display:flex;gap:10px;">${links}</div>
            <button class="vote-btn js-vote-btn" style="${p.votedByMe ? 'border-color:var(--periwinkle);color:var(--periwinkle);' : ''}">▲ <span class="vote-count">${p.votesCount}</span></button>
          </div>
        </div>
      </article>
    `;
  }

  async function loadProjects(){
    const grid = document.getElementById('projectsGrid');
    const empty = document.getElementById('projectsEmpty');
    const loading = document.getElementById('projectsLoading');
    try{
      const res = await fetch('/api/projects');
      const data = await res.json();
      loading.style.display = 'none';
      if(!data.projects || data.projects.length === 0){
        empty.style.display = 'block';
        grid.innerHTML = '';
        return;
      }
      empty.style.display = 'none';
      grid.innerHTML = data.projects.map(renderProject).join('');
    }catch(e){
      loading.textContent = 'تعذّر تحميل المشاريع — تأكدي إن الخادم شغّال (npm start)';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadMe().then(loadProjects);

    const addBtn = document.getElementById('addProjectBtn');
    const form = document.getElementById('addProjectForm');
    const cancelBtn = document.getElementById('cancelProjectBtn');
    const submitBtn = document.getElementById('submitProjectBtn');

    addBtn.addEventListener('click', () => {
      if(!me){ location.href = 'auth.html'; return; }
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

    submitBtn.addEventListener('click', async () => {
      const errBox = document.getElementById('addProjectError');
      const showErr = (msg) => { errBox.textContent = msg; errBox.style.display = 'block'; };
      errBox.style.display = 'none';

      const name = document.getElementById('pName').value.trim();
      const description = document.getElementById('pDesc').value.trim();
      const github = document.getElementById('pGithub').value.trim();
      const demo = document.getElementById('pDemo').value.trim();
      const tech = document.getElementById('pTech').value.split(',').map(s => s.trim()).filter(Boolean);

      if(!name || !description){ showErr('الاسم والوصف مطلوبان'); return; }

      submitBtn.disabled = true;
      try{
        const res = await fetch('/api/projects', {
          method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name, description, github, demo, tech })
        });
        if(res.ok){
          document.getElementById('pName').value = '';
          document.getElementById('pDesc').value = '';
          document.getElementById('pGithub').value = '';
          document.getElementById('pDemo').value = '';
          document.getElementById('pTech').value = '';
          form.style.display = 'none';
          await loadProjects();
        } else {
          const data = await res.json().catch(()=>({}));
          showErr(data.error || 'تعذّر نشر المشروع');
        }
      }catch(e){
        showErr('تعذّر الاتصال بالخادم');
      }
      submitBtn.disabled = false;
    });

    document.getElementById('projectsGrid').addEventListener('click', async (e) => {
      const voteBtn = e.target.closest('.js-vote-btn');
      if(!voteBtn) return;
      if(!me){ location.href = 'auth.html'; return; }
      const card = voteBtn.closest('[data-project-id]');
      const id = card.getAttribute('data-project-id');
      const res = await fetch(`/api/projects/${id}/vote`, { method:'POST', credentials:'include' });
      if(res.ok){
        const data = await res.json();
        voteBtn.querySelector('.vote-count').textContent = data.votesCount;
        voteBtn.style.borderColor = data.votedByMe ? 'var(--periwinkle)' : '';
        voteBtn.style.color = data.votedByMe ? 'var(--periwinkle)' : '';
      }
    });
  });
})();
