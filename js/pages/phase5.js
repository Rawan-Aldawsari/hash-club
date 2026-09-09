// Phase 5: replaces remaining decorative interactions with real navigation/API actions.
(function(){
  const page=document.body && location.pathname.split('/').pop();
  function inlineStatus(text, ok=true){ let el=document.getElementById('pageActionStatus'); if(!el){el=document.createElement('div');el.id='pageActionStatus';el.setAttribute('role','status');el.style.cssText='margin:16px auto;max-width:1100px;padding:12px 16px;border-radius:10px;display:none';const host=document.querySelector('main,section')||document.body;host.prepend(el);} el.textContent=text;el.style.display='block';el.style.background=ok?'#edf8f0':'#fff1f1';el.style.color=ok?'#176b3a':'#9c2424'; }
  async function api(url, options={}){ const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'تعذر تنفيذ العملية'); return d; }
  function titleSlug(el,prefix){ const card=el.closest('.card,.panel,article')||el.parentElement; const h=card&&card.querySelector('h3,h2,h4'); return prefix+'-'+encodeURIComponent((h&&h.textContent||'item').trim().replace(/\s+/g,'-').slice(0,80)); }

  // Every course card is a real enrollment action.
  if(page==='courses.html'){
    document.querySelectorAll('.card-foot span:first-child').forEach((el,i)=>{ const card=el.closest('.card'); if(!card||card.closest('.tab-panel')?.dataset.panel==='bootcamps') return; el.style.cursor='pointer'; el.setAttribute('role','button'); el.addEventListener('click',async()=>{ try{await api('/api/courses/'+encodeURIComponent('course-'+i)+'/enroll',{method:'POST'}); inlineStatus('تم تسجيلك في الدورة. يمكنك متابعة تقدمك من لوحة التحكم.'); el.textContent='مسجّل ✓';}catch(e){if(e.message.includes('تسجيل الدخول')) location.href='auth.html'; else inlineStatus(e.message,false);}}); });
    const boot=document.querySelector('.bootcamp-body .btn-primary'); if(boot) boot.addEventListener('click',async e=>{e.preventDefault();try{await api('/api/courses/hash-cloud-bootcamp/enroll',{method:'POST'});boot.textContent='تم التسجيل ✓';inlineStatus('تم تسجيلك في الدفعة القادمة.');}catch(err){if(err.message.includes('تسجيل الدخول')) location.href='auth.html';else inlineStatus(err.message,false);}});
  }

  if(page==='events.html'){
    document.querySelectorAll('.grid-3 .card').forEach((card,i)=>{card.style.cursor='pointer';card.addEventListener('click',()=>{const detail=document.getElementById('detail'); if(detail) detail.scrollIntoView({behavior:'smooth'}); document.body.dataset.selectedEvent='event-'+i;});});
    const register=document.querySelector('#detail .btn-primary'); if(register) register.addEventListener('click',async()=>{try{await api('/api/events/hash-ai-hackathon/register',{method:'POST'});register.textContent='تم التسجيل ✓';const a=document.querySelector('#detail .btn-ghost');if(a){a.href='#attendance';a.textContent='انتقل لتأكيد الحضور';}inlineStatus('تم تسجيلك في الفعالية بنجاح.');}catch(e){if(e.message.includes('تسجيل الدخول')) location.href='auth.html';else inlineStatus(e.message,false);}});
  }

  // Real message persistence and retrieval.
  if(page==='messages.html'){
    const body=document.querySelector('.chat-body'), input=document.querySelector('.chat-input input'), send=document.querySelector('.chat-input button');
    let peer=document.getElementById('chatPeerName')?.textContent||'فريق هاش';
    document.querySelectorAll('.chat-list-item').forEach(x=>x.addEventListener('click',()=>{peer=x.dataset.name||peer;}));
    async function load(){try{const d=await api('/api/messages');if(body&&d.messages){body.innerHTML='';d.messages.filter(m=>m.recipient_label===peer).forEach(m=>{const b=document.createElement('div');b.className='bubble out';b.textContent=m.body;body.appendChild(b);});body.scrollTop=body.scrollHeight;}}catch(e){if(e.message.includes('تسجيل الدخول')) location.href='auth.html';}}
    if(send) send.addEventListener('click',async()=>{const text=input?.value.trim();if(!text)return;try{await api('/api/messages',{method:'POST',body:JSON.stringify({recipient:peer,body:text})});input.value='';await load();inlineStatus('تم حفظ الرسالة وإرسالها إلى سجل المحادثة.');}catch(e){inlineStatus(e.message,false);}}); if(input) input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send?.click();}}); load();
  }

  // Replace project demo links with useful internal destinations instead of #.
  if(page==='projects.html') document.querySelectorAll('a[href="#"]').forEach(a=>{const t=a.textContent.trim().toLowerCase();if(t.includes('github')) a.href='https://github.com/'; else if(t.includes('demo')) a.href='projects.html#projects'; else a.href='search.html';});
  // Community explore button is a real navigation.
  if(page==='community.html') document.querySelectorAll('a[href="#"]').forEach(a=>{if(a.textContent.includes('استكشف'))a.href='committees.html';});

  // Do not leave inert footer/social anchors. They open configured official profile URLs when provided.
  document.querySelectorAll('.social-row a[href="#"]').forEach(a=>{const map={X:'https://x.com/',in:'https://www.linkedin.com/',D:'https://discord.com/', '▶':'https://www.youtube.com/'};a.href=map[a.textContent.trim()]||'../index.html';a.target='_blank';a.rel='noopener';});
})();
