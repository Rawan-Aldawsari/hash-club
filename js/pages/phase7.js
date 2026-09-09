/* Phase 7: real navigation and non-popup feedback audit. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html');
  function api(url,opt={}){return fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر تنفيذ العملية');return d;});}
  function status(text,ok=true){let box=document.getElementById('pageActionStatus');if(!box){box=document.createElement('div');box.id='pageActionStatus';box.setAttribute('role','status');box.style.cssText='margin:16px auto;max-width:1100px;padding:12px 16px;border-radius:10px;display:none';const main=document.querySelector('main,section')||document.body;main.prepend(box);}box.textContent=text;box.style.display='block';box.style.background=ok?'#edf8f0':'#fff1f1';box.style.color=ok?'#176b3a':'#9c2424';box.scrollIntoView({behavior:'smooth',block:'nearest'});}
  // Never leave an unconfigured # link inert.
  document.querySelectorAll('a[href="#"]').forEach(a=>{
    if(a.dataset.tabsGoto || a.classList.contains('tab-btn')) return;
    const txt=a.textContent.trim();
    if(txt.includes('تحدّث مع فريق النادي')) { a.href='pages/messages.html'; return; }
    if(txt.includes('سجّل في الدفعة القادمة')) { a.href='courses.html#bootcamps'; return; }
    if(txt.includes('استكشف كل المجموعات')) { a.href='committees.html'; return; }
    if(txt.includes('رابط الحضور')) { a.href='events.html#detail'; return; }
    if(['X','in','D','▶'].includes(txt)){const map={X:'https://x.com/',in:'https://www.linkedin.com/',D:'https://discord.com/','▶':'https://www.youtube.com/'};a.href=map[txt];a.target='_blank';a.rel='noopener';return;}
    a.href= page==='index.html' ? 'pages/search.html' : 'search.html';
  });
  // Event attendance is an actual server action, not a popup or fake link.
  if(page==='events.html'){
    const attendance=[...document.querySelectorAll('a,button')].find(x=>x.textContent.includes('رابط الحضور'));
    if(attendance) attendance.addEventListener('click',async e=>{e.preventDefault();try{await api('/api/events/hash-ai-hackathon/check-in',{method:'POST'});attendance.textContent='تم تسجيل حضورك ✓';attendance.removeAttribute('href');attendance.style.pointerEvents='none';status('تم تسجيل حضورك فعليًا في النظام.');}catch(err){if(err.message.includes('تسجيل الدخول')) location.href='auth.html';else status(err.message,false);}});
    document.querySelectorAll('.post-asset').forEach((asset,i)=>asset.addEventListener('click',()=>{location.href='resources.html?event=hash-ai-hackathon&asset='+i;}));
  }
  // Project placeholders remain honest: no fake GitHub/Demo destination.
  if(page==='projects.html') document.querySelectorAll('a').forEach(a=>{if(['GitHub','Demo'].includes(a.textContent.trim()) && a.getAttribute('href')==='#'){a.removeAttribute('href');a.style.opacity='.55';a.style.cursor='not-allowed';a.title='لم يتم إضافة رابط حقيقي لهذا المشروع بعد';}});
  // Make visible detail labels on course cards open the relevant course section.
  if(page==='courses.html') document.querySelectorAll('.card-foot span:first-child').forEach(x=>{if(x.textContent.includes('التفاصيل')){x.style.cursor='pointer';x.addEventListener('click',()=>location.hash='courses');}});
})();
