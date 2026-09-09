/* Phase 8 — runtime audit: visible controls must navigate, submit, or explain inline. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html');
  function status(text, ok=true){
    let el=document.getElementById('pageActionStatus');
    if(!el){ el=document.createElement('div'); el.id='pageActionStatus'; el.setAttribute('role','status'); el.style.cssText='margin:16px auto;max-width:1100px;padding:12px 16px;border-radius:10px;line-height:1.7'; (document.querySelector('main,section')||document.body).prepend(el); }
    el.textContent=text; el.style.background=ok?'#edf8f0':'#fff1f1'; el.style.color=ok?'#176b3a':'#9c2424';
  }
  function go(url){ location.href=url; }
  function authPage(){ return page==='index.html'?'pages/auth.html':'auth.html'; }
  function requireLogin(next){ fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>{if(r.ok) next(); else go(authPage());}).catch(()=>status('تعذر الاتصال بالخادم. شغّلي الموقع عبر http://localhost:3000.',false)); }

  document.addEventListener('DOMContentLoaded',()=>{
    // Any button with a meaningful label but no handler gets a real, predictable destination instead of silently doing nothing.
    const routeMap=[
      [/إنشاء دورة|رفع درس|متابعة الإعداد/, 'courses.html'],
      [/إضافة عضو|إدارة أعضاء اللجنة|إدارة$/, 'committees.html'],
      [/إصدار شهادة|إصدار$/, 'certificates.html'],
      [/إنشاء المهمة|مهمة جديدة/, 'my-tasks.html'],
      [/عرض كل الإشعارات/, 'settings.html#notifications'],
      [/عرض|التفاصيل|اعرف المزيد/, 'search.html'],
      [/تواصل|رسالة|راسل/, 'messages.html'],
      [/حساب جديد|تسجيل الدخول/, 'auth.html']
    ];
    document.querySelectorAll('button').forEach(btn=>{
      if(btn.dataset.phase8Bound || btn.disabled || btn.closest('.menu-toggle')) return;
      const txt=(btn.textContent||'').trim().replace(/\s+/g,' ');
      if(!txt || btn.type==='submit' || btn.id || btn.classList.contains('filter-chip') || btn.classList.contains('tab-btn') || btn.classList.contains('social-btn') || btn.classList.contains('vote-btn')) return;
      const found=routeMap.find(([re])=>re.test(txt));
      if(found){ btn.dataset.phase8Bound='1'; btn.addEventListener('click',()=>go(found[1])); }
    });

    // Generic form fallback: prevent a dead form submit and keep feedback inside the page.
    document.querySelectorAll('form').forEach(form=>{
      if(form.dataset.phase8Bound) return;
      const action=form.getAttribute('action');
      if(!action || action==='#'){
        form.dataset.phase8Bound='1';
        form.addEventListener('submit',e=>{e.preventDefault();status('هذا النموذج يحتاج ربطًا بواجهة الخادم المخصصة له، ولم يتم إرسال بيانات وهمية.',false);});
      }
    });

    // Dashboard is protected and should not expose fake admin actions to anonymous users.
    if(page==='dashboards.html'){
      requireLogin(()=>{
        document.querySelectorAll('button').forEach(b=>{
          const t=b.textContent.trim();
          if(/قبول/.test(t)){ b.addEventListener('click',()=>status('استخدمي قسم طلبات العضوية المرتبط بحساب المدير لقبول الطلبات فعليًا.')); }
        });
      });
    }

    // Improve the event detail flow: register, then attendance remains an API action handled by earlier phase scripts.
    if(page==='events.html'){
      const detail=document.getElementById('detail');
      document.querySelectorAll('.grid-3 .card').forEach(card=>card.addEventListener('click',()=>detail?.scrollIntoView({behavior:'smooth'})));
    }
  });
})();
