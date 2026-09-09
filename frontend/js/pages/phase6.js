(()=>{
  const page=location.pathname.split('/').pop()||'index.html';
  const api=(url,opt={})=>fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذّر تنفيذ العملية');return d;});
  function status(el,msg,ok=true){let n=el.parentElement?.querySelector('.phase6-status');if(!n){n=document.createElement('div');n.className='phase6-status';n.style.cssText='margin-top:8px;font-size:13px;font-weight:700;';el.insertAdjacentElement('afterend',n);}n.style.color=ok?'#16803c':'#b42318';n.textContent=msg;}

  // Make the attendance action real: check in through the backend, not a dummy hash link.
  if(page==='events.html'){
    const attendance=[...document.querySelectorAll('a,button')].find(x=>x.textContent.includes('رابط الحضور'));
    if(attendance){attendance.href='javascript:void(0)';attendance.addEventListener('click',async e=>{e.preventDefault();try{const d=await api('/api/events/hash-ai-hackathon/check-in',{method:'POST'});attendance.textContent=d.alreadyCheckedIn?'تم تسجيل حضورك ✓':'تم تسجيل الحضور ✓';attendance.classList.add('btn-primary');status(attendance,'تم تسجيل حضورك فعليًا في حسابك.');}catch(err){if(err.message.includes('تسجيل الدخول'))location.href='auth.html';else status(attendance,err.message,false);}});}
  }

  // Dashboard link should navigate instead of being an inert # link.
  if(page==='dashboards.html') document.querySelectorAll('a[href="#"]').forEach(a=>{if(a.textContent.includes('لوحة التحكم'))a.href='dashboards.html';});

  // Profile social pills use the real links stored in the user's profile. Missing links are disabled truthfully.
  if(page==='profile.html'){
    fetch('/api/auth/me',{credentials:'include'}).then(r=>r.ok?r.json():null).then(d=>{
      const social=d?.user?.social||{};
      document.querySelectorAll('.pill').forEach(a=>{
        const text=a.textContent.trim().toLowerCase();
        const key=text.includes('linkedin')?'linkedin':text.includes('github')?'github':text==='x'||text.includes('twitter')?'twitter':null;
        if(!key)return;
        const url=social[key];
        if(url && /^https?:\/\//i.test(url)){a.href=url;a.target='_blank';a.rel='noopener';}
        else {a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.style.opacity='.55';a.style.cursor='not-allowed';a.title='لم تتم إضافة رابط حساب حقيقي بعد';}
      });
    }).catch(()=>{});
  }

  // Any remaining empty hash link that is not handled by its own page script is never silently ignored.
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href="#"]');
    if(!a||e.defaultPrevented)return;
    const txt=a.textContent.trim();
    if(a.closest('.settings-nav')||a.dataset.tabsGoto)return;
    e.preventDefault();
    status(a,'هذه الوجهة تحتاج بيانات حقيقية قبل تفعيلها، لذلك لم يتم تنفيذ إجراء وهمي.',false);
  });
})();
