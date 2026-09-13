// frontend/js/pages/profile.js — بيانات حقيقية فقط من الجلسة الحالية، بدون شخصية وهمية
(function(){
  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function initials(name){
    const parts = (name || '').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }
  function timeAgo(iso){
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if(mins < 1) return 'الآن';
    if(mins < 60) return 'قبل ' + mins + ' دقيقة';
    const hrs = Math.floor(mins / 60);
    if(hrs < 24) return 'قبل ' + hrs + ' ساعة';
    return 'قبل ' + Math.floor(hrs / 24) + ' يوم';
  }

  let me = null;

  function renderProfile(){
    const avatarEl = document.getElementById('pAvatar');
    avatarEl.textContent = '';
    avatarEl.style.backgroundImage = me.avatarData ? `url("${me.avatarData}")` : '';
    avatarEl.classList.toggle('has-image', !!me.avatarData);
    if(!me.avatarData) avatarEl.textContent = initials(me.firstName + ' ' + me.lastName);
    document.getElementById('pName').textContent = me.firstName + ' ' + me.lastName;
    const metaParts = [me.email];
    if(me.university) metaParts.push(me.university);
    if(me.major) metaParts.push(me.major);
    document.getElementById('pMeta').textContent = metaParts.join(' · ');

    document.getElementById('pBio').textContent = me.bio || 'لم تتم إضافة نبذة بعد — اضغطي "تعديل" لإضافة واحدة.';

    const skillsEl = document.getElementById('pSkills');
    skillsEl.innerHTML = (me.skills && me.skills.length)
      ? me.skills.map(s => `<span class="skill-chip">${esc(s)}</span>`).join('')
      : '<span style="font-size:12.5px;color:var(--ink-soft);">لم تتم إضافة مهارات بعد</span>';

    const socialEl = document.getElementById('pSocial');
    const links = [];
    if(me.social && me.social.linkedin) links.push(`<a href="${esc(me.social.linkedin)}" target="_blank" rel="noopener" class="pill">LinkedIn</a>`);
    if(me.social && me.social.github) links.push(`<a href="${esc(me.social.github)}" target="_blank" rel="noopener" class="pill">GitHub</a>`);
    socialEl.innerHTML = links.length ? links.join('') : '<span style="font-size:12.5px;color:var(--ink-soft);">لا توجد روابط تواصل مضافة</span>';

    // pre-fill edit form
    document.getElementById('fUniversity').value = me.university || '';
    document.getElementById('fMajor').value = me.major || '';
    document.getElementById('fBio').value = me.bio || '';
    document.getElementById('fSkills').value = (me.skills || []).join(', ');
    document.getElementById('fLinkedin').value = (me.social || {}).linkedin || '';
    document.getElementById('fGithub').value = (me.social || {}).github || '';
  }

  async function loadMe(){
    const res = await fetch('/api/auth/me', { credentials:'include' });
    if(!res.ok){ return; } // main.js already redirects data-auth="required" pages
    const data = await res.json();
    me = data.user;
    renderProfile();
  }

  async function loadActivity(){
    const [postsRes, projectsRes, blogRes] = await Promise.all([
      fetch('/api/posts'), fetch('/api/projects'), fetch('/api/blog')
    ]);
    const posts = (await postsRes.json()).posts || [];
    const projects = (await projectsRes.json()).projects || [];
    const blog = (await blogRes.json()).posts || [];

    document.getElementById('statPosts').textContent = posts.filter(p => p.isMine).length;
    document.getElementById('statProjects').textContent = projects.filter(p => p.isMine).length;
    document.getElementById('statBlog').textContent = blog.filter(p => p.isMine).length;

    const items = []
      .concat(posts.filter(p => p.isMine).map(p => ({ type:'منشور', title: p.text.slice(0, 60), createdAt: p.createdAt })))
      .concat(projects.filter(p => p.isMine).map(p => ({ type:'مشروع', title: p.name, createdAt: p.createdAt })))
      .concat(blog.filter(p => p.isMine).map(p => ({ type:'مقال', title: p.title, createdAt: p.createdAt })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const timeline = document.getElementById('activityTimeline');
    const empty = document.getElementById('activityEmpty');
    if(items.length === 0){
      empty.style.display = 'block';
      timeline.innerHTML = '';
      return;
    }
    empty.style.display = 'none';
    timeline.innerHTML = items.map(it => `
      <div class="tl-item"><span class="time">${timeAgo(it.createdAt)}</span><b>${esc(it.type)}: ${esc(it.title)}</b></div>
    `).join('');
  }

  async function prepareAvatar(file){
    if(!file) return '';
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('صيغة الصورة غير مدعومة');
    if(file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب أن يكون أقل من 5MB');
    const url = URL.createObjectURL(file);
    try{
      const img = await new Promise((resolve,reject)=>{
        const i = new Image();
        i.onload = ()=>resolve(i); i.onerror = reject; i.src = url;
      });
      const size = 512;
      const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg', .86);
    } finally { URL.revokeObjectURL(url); }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadMe();
    if(me) await loadActivity();

    const avatarInput = document.getElementById('avatarInput');
    if(avatarInput){
      avatarInput.addEventListener('change', async () => {
        const file = avatarInput.files && avatarInput.files[0];
        if(!file || !me) return;
        try{
          const avatarData = await prepareAvatar(file);
          const res = await fetch('/api/auth/profile', {
            method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              university: me.university || '', major: me.major || '', bio: me.bio || '',
              skills: me.skills || [], social: me.social || {}, avatarData
            })
          });
          if(!res.ok) throw new Error('تعذّر حفظ الصورة الشخصية');
          const data = await res.json();
          me = data.user;
          renderProfile();
          if(typeof hcToast === 'function') hcToast('تم تحديث الصورة الشخصية بنجاح');
        }catch(err){
          if(typeof hcToast === 'function') hcToast(err.message || 'تعذّر تجهيز الصورة');
          avatarInput.value = '';
        }
      });
    }

    const editBtn = document.getElementById('editProfileBtn');
    const view = document.getElementById('profileView');
    const form = document.getElementById('profileEditForm');
    editBtn.addEventListener('click', () => {
      const showing = form.style.display !== 'none';
      form.style.display = showing ? 'none' : 'block';
      view.style.display = showing ? 'block' : 'none';
    });
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      form.style.display = 'none'; view.style.display = 'block';
    });

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const body = {
        university: document.getElementById('fUniversity').value.trim(),
        major: document.getElementById('fMajor').value.trim(),
        bio: document.getElementById('fBio').value.trim(),
        skills: document.getElementById('fSkills').value.split(',').map(s => s.trim()).filter(Boolean),
        social: {
          linkedin: document.getElementById('fLinkedin').value.trim(),
          github: document.getElementById('fGithub').value.trim()
        },
        avatarData: me && me.avatarData ? me.avatarData : ''
      };
      const res = await fetch('/api/auth/profile', {
        method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      if(res.ok){
        const data = await res.json();
        me = data.user;
        renderProfile();
        form.style.display = 'none'; view.style.display = 'block';
      } else {
        const e = document.getElementById('profileError');
        if(e){ e.textContent = 'تعذّر الحفظ، حاولي مرة أخرى'; e.style.display = 'block'; }
      }
    });
  });
})();
