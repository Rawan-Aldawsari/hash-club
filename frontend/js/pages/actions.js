(function(){
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  function statusNear(el,msg,kind='info'){
    let box=el.parentElement && el.parentElement.querySelector('.hc-inline-status');
    if(!box){ box=document.createElement('div'); box.className='hc-inline-status'; box.style.cssText='margin-top:12px;font-size:13px;font-weight:700;line-height:1.7;'; el.insertAdjacentElement('afterend',box); }
    box.style.color=kind==='error'?'var(--danger,#d9534f)':kind==='success'?'#228b5b':'var(--ink-soft,#64748b)'; box.textContent=msg;
  }
  async function me(){ const r=await fetch('/api/auth/me',{credentials:'include'}); return r.ok?(await r.json()).user:null; }
  function requireLogin(){ location.href='auth.html'; }
  function esc(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  document.addEventListener('DOMContentLoaded', async ()=>{
    if(page==='events.html'){
      const register=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('سجّل الآن'));
      const attendance=[...document.querySelectorAll('a.btn')].find(a=>a.textContent.includes('رابط الحضور'));
      if(register){
        try{ const user=await me(); if(!user){ register.addEventListener('click',requireLogin); return; }
          const s=await fetch('/api/events/hash-ai-2026/status',{credentials:'include'}); const d=await s.json();
          if(d.registered){ register.textContent='أنتِ مسجّلة في الفعالية'; register.disabled=true; if(attendance){attendance.href='https://meet.google.com/'; attendance.target='_blank';} }
          register.addEventListener('click',async()=>{ register.disabled=true; const r=await fetch('/api/events/hash-ai-2026/register',{method:'POST',credentials:'include'}); if(r.ok){register.textContent='أنتِ مسجّلة في الفعالية'; if(attendance){attendance.href='https://meet.google.com/'; attendance.target='_blank';} statusNear(register,'تم حفظ تسجيلك في حسابك.','success');} else {register.disabled=false; statusNear(register,'تعذّر التسجيل.','error');} });
        }catch(e){ register.addEventListener('click',()=>statusNear(register,'تعذّر الاتصال بالخادم.','error')); }
      }
    }

    if(page==='courses.html'){
      const buttons=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('سجّل في'));
      for(const btn of buttons){ btn.addEventListener('click',async()=>{ const user=await me().catch(()=>null); if(!user)return requireLogin(); const card=btn.closest('.card')||btn.parentElement; const title=card?.querySelector('h3')?.textContent?.trim()||'course'; const id=title.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').slice(0,100); const r=await fetch('/api/courses/'+encodeURIComponent(id)+'/enroll',{method:'POST',credentials:'include'}); if(r.ok){btn.textContent='أنتِ مسجّلة';btn.disabled=true;statusNear(btn,'تم حفظ تسجيلك في حسابك.','success');}else statusNear(btn,'تعذّر التسجيل.','error'); }); }
    }

    if(page==='messages.html'){
      const input=document.querySelector('.chat-input input'); const send=document.querySelector('.chat-input button'); const body=document.querySelector('.chat-body');
      async function load(){ const user=await me().catch(()=>null); if(!user)return; const r=await fetch('/api/messages',{credentials:'include'}); if(!r.ok)return; const d=await r.json(); body.innerHTML=d.messages.map(m=>'<div class="bubble out">'+esc(m.body)+'</div>').join('')||'<div class="bubble in">لا توجد رسائل محفوظة بعد.</div>'; body.scrollTop=body.scrollHeight; }
      if(send&&input){ send.addEventListener('click',async()=>{ const text=input.value.trim(); if(!text)return; const user=await me().catch(()=>null); if(!user)return requireLogin(); const recipient=document.getElementById('chatPeerName')?.textContent.trim()||'فريق هاش'; const r=await fetch('/api/messages',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient,body:text})}); if(r.ok){input.value=''; await load();} else statusNear(send,'تعذّر إرسال الرسالة.','error'); }); input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send.click();}}); load(); }
    }

    if(page==='settings.html'){
      let user=null; try{user=await me();}catch(e){} if(!user)return;
      const profilePanel=document.querySelector('[data-panel="profile"]'); if(profilePanel){ const inputs=profilePanel.querySelectorAll('input'); const bio=profilePanel.querySelector('textarea'); if(inputs[0])inputs[0].value=(user.firstName+' '+user.lastName).trim(); if(inputs[1]){inputs[1].value=user.email;inputs[1].readOnly=true;} if(inputs[2])inputs[2].value=user.university||''; if(inputs[3])inputs[3].value=user.major||''; if(bio)bio.value=user.bio||''; const save=[...profilePanel.querySelectorAll('button')].find(b=>b.textContent.includes('حفظ')); save?.addEventListener('click',async()=>{ const r=await fetch('/api/auth/profile',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({university:inputs[2]?.value||'',major:inputs[3]?.value||'',bio:bio?.value||'',skills:user.skills||[],social:user.social||{}})}); if(r.ok)statusNear(save,'تم حفظ بياناتك في حسابك.','success'); else statusNear(save,'تعذّر حفظ البيانات.','error'); }); }
      const passPanel=document.querySelector('[data-panel="password"]'); if(passPanel){ const fields=passPanel.querySelectorAll('input'); const btn=[...passPanel.querySelectorAll('button')].find(b=>b.textContent.includes('تحديث')); btn?.addEventListener('click',async()=>{ if(!fields[1].value||fields[1].value.length<8)return statusNear(btn,'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.','error'); if(fields[1].value!==fields[2].value)return statusNear(btn,'تأكيد كلمة المرور غير مطابق.','error'); const r=await fetch('/api/auth/password/change',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:fields[0].value,newPassword:fields[1].value})}); const d=await r.json().catch(()=>({})); if(r.ok){fields.forEach(x=>x.value='');statusNear(btn,'تم تحديث كلمة المرور بنجاح.','success');}else statusNear(btn,d.error||'تعذّر تحديث كلمة المرور.','error'); }); }
    }

    if(page==='more.html'){
      document.querySelectorAll('button').forEach(btn=>{const label=btn.textContent.trim();
        if(label==='اشترك')btn.addEventListener('click',async()=>{const input=btn.parentElement.querySelector('input');const r=await fetch('/api/newsletter/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input?.value||''})});const d=await r.json().catch(()=>({}));if(r.ok){input.value='';statusNear(btn,'تم حفظ اشتراكك في النشرة.','success');}else statusNear(btn,d.error||'تعذّر الاشتراك.','error');});
        if(label==='إرسال التقييم')btn.addEventListener('click',async()=>{const section=btn.closest('section');const text=section?.querySelector('textarea')?.value||'';const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:text})});if(r.ok)statusNear(btn,'تم إرسال تقييمك وحفظه.','success');else statusNear(btn,'اكتبي التقييم أولًا.','error');});
        if(label==='احجز جلسة')btn.addEventListener('click',async()=>{const user=await me().catch(()=>null);if(!user)return requireLogin();const mentor=btn.closest('.follow-row')?.querySelector('div:nth-child(2)')?.childNodes[0]?.textContent?.trim()||'مرشد هاش';const r=await fetch('/api/bookings',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({mentor})});if(r.ok){btn.textContent='تم حجز الجلسة';btn.disabled=true;statusNear(btn,'تم حفظ طلب الحجز في حسابك.','success');}else statusNear(btn,'تعذّر حجز الجلسة.','error');});
      });
    }

    if(page==='resources.html'){
      document.querySelectorAll('.res-row button').forEach((btn,i)=>btn.addEventListener('click',()=>{const row=btn.closest('.res-row');const title=row?.querySelector('h6')?.textContent||'resource';const action=btn.textContent.trim();if(action==='تحميل'){const blob=new Blob(['نادي هاش\n\n'+title+'\n\nهذا الملف مورد قابل للتنزيل من مكتبة الموقع.'],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hash-resource-'+(i+1)+'.txt';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}else if(action==='مشاهدة'){window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(title),'_blank','noopener');}else{window.open('https://www.google.com/search?q='+encodeURIComponent(title),'_blank','noopener');}}));
    }
  });
})();
