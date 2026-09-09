/* Phase 11 — connect remaining visible controls to existing real APIs. No popups. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const rel=(p)=>page==='index.html'?p:'../pages/'+p;
  function status(el,msg,ok){let b=el?.parentElement?.querySelector('.hc-inline-status');if(!b){b=document.createElement('div');b.className='hc-inline-status';b.style.cssText='margin-top:10px;font-size:13px;font-weight:700;line-height:1.7';el?.insertAdjacentElement('afterend',b);}b.textContent=msg;b.style.color=ok?'#16784a':'#b42318';}
  async function user(){const r=await fetch('/api/auth/me',{credentials:'include'});return r.ok?(await r.json()).user:null;}
  function login(){location.href='auth.html';}
  function esc(x){return String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  document.addEventListener('DOMContentLoaded',async()=>{
    if(page==='resources.html'){
      try{const r=await fetch('/api/resources');const d=await r.json();const rows=[...document.querySelectorAll('.res-row')];
        rows.forEach((row,i)=>{const item=d.resources?.[i];if(!item)return;const btn=row.querySelector('button');if(!btn)return;btn.onclick=null;btn.addEventListener('click',()=>{const action=btn.textContent.trim();if(action.includes('تحميل'))location.href='/api/resources/'+encodeURIComponent(item.id)+'/download';else if(action.includes('فتح')||action.includes('مشاهدة'))window.open('/api/resources/'+encodeURIComponent(item.id)+'/open','_blank','noopener');});});
      }catch(e){}
    }
    if(page==='certificates.html'){
      let u;try{u=await user();}catch(e){} if(!u){document.querySelectorAll('button').forEach(b=>{if(/تحميل|مشاركة|تحقق/.test(b.textContent))b.addEventListener('click',login);});return;}
      try{const r=await fetch('/api/certificates/my',{credentials:'include'});const d=await r.json();const certs=d.certificates||[];let n=0;document.querySelectorAll('button').forEach(btn=>{const txt=btn.textContent.trim();if(/تحميل PDF/.test(txt)){const c=certs[n++]||certs[0];if(c)btn.addEventListener('click',()=>window.open('/api/certificates/'+encodeURIComponent(c.code)+'/document','_blank'));}else if(/مشاركة على LinkedIn/.test(txt)){const c=certs[Math.max(0,n-1)]||certs[0];if(c)btn.addEventListener('click',()=>{const url=location.origin+'/api/certificates/verify/'+encodeURIComponent(c.code);window.open('https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(url),'_blank','noopener');});}});}catch(e){}
    }
    if(page==='dashboards.html'){
      // Real membership approval buttons
      try{const u=await user();if(!u)return;const r=await fetch('/api/admin/membership-applications',{credentials:'include'});if(r.ok){const d=await r.json();const ids=d.applications||[];let i=0;document.querySelectorAll('button').forEach(btn=>{if(btn.textContent.trim()==='قبول'){const app=ids[i++];if(!app)return;btn.addEventListener('click',async()=>{btn.disabled=true;const rr=await fetch('/api/admin/membership/'+encodeURIComponent(app.id)+'/accept',{method:'POST',credentials:'include'});if(rr.ok){btn.textContent='تم القبول';status(btn,'تم قبول الطلب وحفظ التغيير في قاعدة البيانات.',true);}else{btn.disabled=false;status(btn,'تعذّر قبول الطلب.',false);}});}})}}catch(e){}
      document.querySelectorAll('button').forEach(btn=>{const t=btn.textContent.trim();if(t.includes('إنشاء دورة'))btn.addEventListener('click',()=>location.href='courses.html');if(t.includes('إضافة عضو'))btn.addEventListener('click',()=>location.href='join.html');if(t==='إدارة')btn.addEventListener('click',()=>location.href='committees.html');});
    }
    if(page==='my-tasks.html'){
      try{const u=await user();if(!u){login();return;}const r=await fetch('/api/tasks',{credentials:'include'});if(!r.ok)return;const d=await r.json();const main=document.querySelector('main');if(main&&d.tasks?.length){const old=main.querySelector('.phase11-tasks');old?.remove();const box=document.createElement('section');box.className='phase11-tasks';box.innerHTML='<h3>مهامي الفعلية</h3>'+d.tasks.map(t=>'<article class="task-card"><strong>'+esc(t.title)+'</strong><p>'+esc(t.assignee||'')+'</p><button data-task="'+esc(t.id)+'">تغيير الحالة</button></article>').join('');main.appendChild(box);box.querySelectorAll('button[data-task]').forEach(b=>b.addEventListener('click',async()=>{const rr=await fetch('/api/tasks/'+encodeURIComponent(b.dataset.task),{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done'})});if(rr.ok){b.textContent='مكتملة';b.disabled=true;}}));}}catch(e){}
    }
  });
})();
