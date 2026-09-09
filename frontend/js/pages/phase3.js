(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function inline(anchor,msg,kind='info'){
    let box=anchor?.parentElement?.querySelector(':scope > .hc-inline-status');
    if(!box&&anchor){box=document.createElement('div');box.className='hc-inline-status';box.style.cssText='margin-top:10px;font-size:13px;font-weight:700;line-height:1.7;';anchor.insertAdjacentElement('afterend',box);}
    if(box){box.style.color=kind==='error'?'#c2413b':kind==='success'?'#228b5b':'var(--ink-soft,#64748b)';box.textContent=msg;}
  }
  async function api(url,opt={}){const r=await fetch(url,{credentials:'include',...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر تنفيذ العملية');return d;}
  async function me(){try{return (await api('/api/auth/me')).user}catch(e){return null}}
  function login(){location.href='auth.html?next='+encodeURIComponent(location.pathname+location.search)}
  function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'item'}

  async function events(){
    const cards=[...document.querySelectorAll('.grid-3 .card')]; const chips=[...document.querySelectorAll('.filters .filter-chip')];
    const filters={'الكل':()=>true,'قادمة':c=>!c.textContent.includes('انتهت'),'سابقة':c=>c.textContent.includes('انتهت'),'ورش عمل':c=>c.textContent.includes('ورشة'),'هاكاثونات':c=>c.textContent.includes('هاكاثون'),'لقاءات مفتوحة':c=>c.textContent.includes('لقاء')};
    chips.forEach(ch=>ch.addEventListener('click',()=>{chips.forEach(x=>x.classList.toggle('active',x===ch));cards.forEach(c=>c.style.display=(filters[ch.textContent.trim()]||(()=>true))(c)?'':'none');}));
    cards.forEach((card,i)=>{card.style.cursor='pointer';card.addEventListener('click',()=>{const title=card.querySelector('h3')?.textContent||'';location.hash='detail';const h=document.querySelector('#detail h2');if(h)h.textContent=title;const btn=[...document.querySelectorAll('#detail button')].find(b=>b.textContent.includes('سجّل الآن')||b.dataset.event);if(btn){btn.dataset.event=slug(title);btn.dataset.title=title;btn.disabled=false;btn.textContent='سجّل الآن';btn.scrollIntoView({behavior:'smooth',block:'center'});}})});
    const btn=[...document.querySelectorAll('#detail button')].find(b=>b.textContent.includes('سجّل الآن'));
    const attendance=[...document.querySelectorAll('#detail a.btn')].find(a=>a.textContent.includes('رابط الحضور'));
    if(btn){const user=await me();if(!user){btn.addEventListener('click',login);return;}const id=btn.dataset.event||'hash-ai-2026';try{const st=await api('/api/events/'+encodeURIComponent(id)+'/status');if(st.registered){btn.textContent='أنتِ مسجّلة في الفعالية';btn.disabled=true;attendance?.removeAttribute('href');if(attendance)attendance.textContent='بيانات الحضور محفوظة في تسجيلك';}}catch(e){}
      btn.addEventListener('click',async()=>{try{btn.disabled=true;await api('/api/events/'+encodeURIComponent(btn.dataset.event||'hash-ai-2026')+'/register',{method:'POST'});btn.textContent='أنتِ مسجّلة في الفعالية';if(attendance)attendance.textContent='تم حفظ تسجيلك — تصدر تفاصيل الحضور من إدارة الفعالية';inline(btn,'تم تسجيلك فعليًا وحفظ التسجيل في حسابك.','success');}catch(e){btn.disabled=false;inline(btn,e.message,'error')}});
    }
  }

  async function courses(){
    const cards=[...document.querySelectorAll('[data-panel="courses"] .card')];const chips=[...document.querySelectorAll('[data-panel="courses"] .filter-chip')];
    chips.forEach(ch=>ch.addEventListener('click',()=>{chips.forEach(x=>x.classList.toggle('active',x===ch));const f=ch.textContent.trim();cards.forEach(c=>c.style.display=(f==='الكل'||c.textContent.includes(f))?'':'none');}));
    for(const card of cards){const foot=card.querySelector('.card-foot');if(!foot)continue;const start=[...foot.querySelectorAll('span')].find(x=>x.textContent.includes('ابدأ الدورة'));if(!start)continue;start.style.cursor='pointer';start.setAttribute('role','button');const title=card.querySelector('h3')?.textContent.trim()||'course';const id=slug(title);start.addEventListener('click',async()=>{const user=await me();if(!user)return login();try{await api('/api/courses/'+encodeURIComponent(id)+'/enroll',{method:'POST'});start.textContent='أنتِ مسجّلة ✓';inline(foot,'تم تسجيل الدورة في حسابك فعليًا.','success');}catch(e){inline(foot,e.message,'error')}});}
    const boot=[...document.querySelectorAll('a.btn')].find(a=>a.textContent.includes('سجّل في الدفعة القادمة'));if(boot){boot.href='javascript:void(0)';boot.addEventListener('click',async()=>{const user=await me();if(!user)return login();try{await api('/api/courses/cloud-bootcamp-2026/enroll',{method:'POST'});boot.textContent='تم تسجيل اهتمامك بالدفعة القادمة';inline(boot,'تم حفظ التسجيل في حسابك.','success')}catch(e){inline(boot,e.message,'error')}})}
  }

  async function settings(){
    const user=await me();if(!user)return login();
    let pref;try{pref=(await api('/api/preferences')).preferences}catch(e){return}
    const panels=[...document.querySelectorAll('.tab-panel')];const nav=[...document.querySelectorAll('.settings-nav .tab-btn')];nav.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const id=a.dataset.tab;nav.forEach(x=>x.classList.toggle('active',x===a));panels.forEach(p=>p.classList.toggle('active',p.dataset.panel===id));}));
    const privacy=document.querySelector('[data-panel="privacy"]');const notifications=document.querySelector('[data-panel="notifications"]');const general=document.querySelector('[data-panel="general"]');
    const save=async()=>{const togglesP=privacy?[...privacy.querySelectorAll('.toggle')]:[];const togglesN=notifications?[...notifications.querySelectorAll('.toggle')]:[];const gToggle=general?.querySelector('.toggle');const select=general?.querySelector('select');const data={privacyProfile:togglesP[0]?.classList.contains('on')??true,privacyActivity:togglesP[1]?.classList.contains('on')??true,notifyEmail:togglesN[0]?.classList.contains('on')??true,notifySite:togglesN.slice(1).some(x=>x.classList.contains('on')),language:select?.value==='English'?'en':'ar',theme:gToggle?.classList.contains('on')?'dark':'light'};await api('/api/preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return data};
    const pT=privacy?[...privacy.querySelectorAll('.toggle')]:[];pT[0]?.classList.toggle('on',pref.privacyProfile);pT[1]?.classList.toggle('on',pref.privacyActivity);const nT=notifications?[...notifications.querySelectorAll('.toggle')]:[];nT.forEach((t,i)=>t.classList.toggle('on',i===0?pref.notifyEmail:pref.notifySite));const sel=general?.querySelector('select');if(sel)sel.value=pref.language==='en'?'English':'العربية';const gT=general?.querySelector('.toggle');gT?.classList.toggle('on',pref.theme==='dark');document.documentElement.setAttribute('data-theme',pref.theme||'light');
    [...document.querySelectorAll('.toggle')].forEach(t=>t.addEventListener('click',async()=>{t.classList.toggle('on');try{const data=await save();document.documentElement.setAttribute('data-theme',data.theme)}catch(e){inline(t,e.message,'error')}}));sel?.addEventListener('change',()=>save().catch(e=>inline(sel,e.message,'error')));
    const end=[...document.querySelectorAll('[data-panel="security"] button')].find(b=>b.textContent.includes('إنهاء الجلسة'));end?.addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});location.href='auth.html'}catch(e){inline(end,e.message,'error')}});
    const timeline=document.getElementById('realNotificationsTimeline')||notifications?.querySelector('.timeline');
    const markAll=document.getElementById('markAllNotificationsRead');
    async function loadNotifications(){
      if(!timeline)return;
      try{
        const d=await api('/api/notifications');
        timeline.innerHTML=d.notifications.length?d.notifications.map(n=>`<div class="tl-item" data-notification-id="${esc(n.id)}" style="cursor:pointer;opacity:${n.read?'0.68':'1'}"><span class="time">${new Date(n.createdAt).toLocaleString('ar-SA')}</span><b>${esc(n.text)}</b>${n.read?'':'<span class="pill" style="margin-top:7px;display:inline-block">جديد</span>'}</div>`).join(''):'<div class="tl-item"><b>لا توجد إشعارات حقيقية حتى الآن.</b></div>';
        timeline.querySelectorAll('[data-notification-id]').forEach(item=>item.addEventListener('click',async()=>{
          const id=item.dataset.notificationId;
          try{await api('/api/notifications/'+encodeURIComponent(id)+'/read',{method:'POST'});item.style.opacity='0.68';item.querySelector('.pill')?.remove();}catch(e){inline(item,e.message,'error')}
        }));
      }catch(e){timeline.innerHTML='<div class="tl-item"><b>تعذّر تحميل الإشعارات.</b></div>';}
    }
    markAll?.addEventListener('click',async()=>{try{await api('/api/notifications/read-all',{method:'POST'});await loadNotifications();inline(markAll,'تم تحديث حالة جميع الإشعارات.','success')}catch(e){inline(markAll,e.message,'error')}});
    loadNotifications();
  }

  async function committees(){
    const cards=[...document.querySelectorAll('.grid-4 .card')];const user=await me();cards.forEach(card=>{const title=card.querySelector('h4')?.textContent.trim();if(!title)return;const key=slug(title);const btn=document.createElement('button');btn.className='btn btn-primary sm';btn.style.marginTop='14px';btn.textContent='طلب الانضمام';card.append(btn);btn.addEventListener('click',async()=>{if(!user)return login();try{const d=await api('/api/committees/'+encodeURIComponent(key)+'/join',{method:'POST'});btn.textContent=d.status==='pending'?'طلبك قيد المراجعة':'عضو';btn.disabled=true;inline(btn,'تم حفظ طلب الانضمام فعليًا.','success')}catch(e){inline(btn,e.message,'error')}});});
  }

  async function calendar(){
    document.querySelectorAll('.cal-cell .ev').forEach(ev=>{ev.style.cursor='pointer';ev.addEventListener('click',()=>{const text=ev.textContent.trim();if(text.includes('هاكاثون')||text.includes('ورشة')||text.includes('لقاء'))location.href='events.html#detail';else if(text.includes('دورة'))location.href='courses.html';else if(text.includes('لجنة'))location.href='committees.html';});});
  }

  async function more(){
    const votes=[...document.querySelectorAll('.vote-btn')];votes.forEach((v,i)=>{v.style.cursor='pointer';v.addEventListener('click',async()=>{const user=await me();if(!user)return login();try{const d=await api('/api/suggestions/'+i+'/vote',{method:'POST'});v.textContent='▲ '+d.count;v.classList.toggle('active',d.voted)}catch(e){inline(v,e.message,'error')}})});
    const copy=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('نسخ الرابط'));copy?.addEventListener('click',async()=>{const input=copy.parentElement.querySelector('input');try{await navigator.clipboard.writeText(input.value);inline(copy,'تم نسخ الرابط.','success')}catch(e){input.select();document.execCommand('copy');inline(copy,'تم نسخ الرابط.','success')}});
  }

  async function notificationsHeader(){
    const bell=document.getElementById('notifBtn');const drop=document.getElementById('notifDrop');if(!bell||!drop)return;try{const d=await api('/api/notifications');const list=drop.querySelector('.notif-list')||drop;const title=drop.querySelector('.notif-title');if(title)title.textContent='الإشعارات ('+d.unreadCount+')';const items=d.notifications.slice(0,6).map(n=>`<div class="notif-item" data-id="${esc(n.id)}" style="padding:9px;border-bottom:1px solid var(--line);cursor:pointer">${esc(n.text)}</div>`).join('')||'<div style="padding:10px">لا توجد إشعارات جديدة.</div>';if(list!==drop)list.innerHTML=items;else drop.insertAdjacentHTML('beforeend',items);drop.querySelectorAll('.notif-item[data-id]').forEach(x=>x.addEventListener('click',()=>api('/api/notifications/'+encodeURIComponent(x.dataset.id)+'/read',{method:'POST'}).catch(()=>{})));}catch(e){}
  }

  document.addEventListener('DOMContentLoaded',()=>{if(page==='events.html')events();if(page==='courses.html')courses();if(page==='settings.html')settings();if(page==='committees.html')committees();if(page==='calendar.html')calendar();if(page==='more.html')more();notificationsHeader();});
})();
