/* Phase 15 — replace remaining static resource/certificate interactions with real API data. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function inline(el,msg,ok){let x=el.parentElement.querySelector('.hc-inline-status');if(!x){x=document.createElement('div');x.className='hc-inline-status';x.style.cssText='margin-top:12px;font-size:13px;font-weight:700';el.parentElement.appendChild(x)}x.textContent=msg;x.style.color=ok?'#16784a':'#b42318';}
  document.addEventListener('DOMContentLoaded',()=>{
    if(page==='resources.html'){
      const panel=document.querySelector('.panel'); const input=document.querySelector('.search-hero input'); const searchBtn=document.querySelector('.search-hero button'); const chips=[...document.querySelectorAll('.filter-chip')]; let category='الكل';
      const icon={"ملفات PDF":"📄","كتب":"📚","عروض تقديمية":"📊","أكواد وقوالب":"💻","تسجيلات":"🎥","روابط":"🔗"};
      async function load(){
        const p=new URLSearchParams(); if(input.value.trim())p.set('q',input.value.trim()); if(category!=='الكل')p.set('category',category);
        try{const r=await fetch('/api/resources?'+p);const d=await r.json(); if(!r.ok)throw 0; const items=d.resources||[];
          panel.innerHTML=items.length?items.map(item=>`<div class="res-row" data-id="${esc(item.id)}"><div class="res-icon">${icon[item.category]||'📦'}</div><div style="flex:1;"><h6>${esc(item.title)}</h6><span>${esc(item.category)} · ${esc(item.description||'')}</span></div><button class="btn btn-ghost sm">${item.action_type==='download'?'تحميل':item.action_type==='watch'?'مشاهدة':'فتح'}</button></div>`).join(''):'<p style="padding:20px;color:var(--ink-soft)">لا توجد موارد مطابقة للبحث.</p>';
          panel.querySelectorAll('.res-row button').forEach(btn=>btn.addEventListener('click',async()=>{const row=btn.closest('.res-row');const id=row.dataset.id; const action=btn.textContent.trim(); if(action==='تحميل'){location.href='/api/resources/'+encodeURIComponent(id)+'/download';return;} try{const rr=await fetch('/api/resources/'+encodeURIComponent(id)+'/open');const dd=await rr.json();if(rr.ok&&dd.url)window.open(dd.url,'_blank','noopener');else inline(btn,dd.error||'تعذّر فتح المورد.',false)}catch(e){inline(btn,'تعذّر الاتصال بالخادم.',false)}}));
        }catch(e){panel.innerHTML='<p style="padding:20px;color:#b42318">تعذّر تحميل الموارد من الخادم.</p>';}
      }
      chips.forEach(c=>c.addEventListener('click',()=>{category=c.textContent.trim();chips.forEach(x=>{x.classList.toggle('active',x===c);x.style.background=x===c?'var(--navy)':'#fff';x.style.color=x===c?'#fff':'var(--ink)';});load();}));
      searchBtn.addEventListener('click',load); input.addEventListener('keydown',e=>{if(e.key==='Enter')load();}); load();
    }
    if(page==='certificates.html'){
      const verifyBtn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='تحقق'); const field=verifyBtn?.parentElement?.querySelector('input');
      if(verifyBtn&&field)verifyBtn.addEventListener('click',async()=>{const code=field.value.trim();if(!code)return inline(verifyBtn,'أدخلي رمز التحقق أولًا.',false);try{const r=await fetch('/api/certificates/verify/'+encodeURIComponent(code));const d=await r.json();if(r.ok&&d.certificate){const c=d.certificate;inline(verifyBtn,`الشهادة صحيحة: ${c.title} — المستفيد: ${c.recipient}`,true);}else inline(verifyBtn,d.error||'لم يتم العثور على الشهادة.',false)}catch(e){inline(verifyBtn,'تعذّر الاتصال بالخادم.',false)}});
    }
  });
})();
