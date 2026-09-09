/* Phase 17 — final interaction audit fixes: no browser popups, live certificates and real More-page forms. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function status(host,text,ok){let n=host.querySelector?.('.hc17-status');if(!n){n=document.createElement('div');n.className='hc17-status';n.style.cssText='margin-top:10px;font-size:13px;font-weight:700';host.appendChild(n)}n.textContent=text;n.style.color=ok?'#16784a':'#b42318'}
  async function json(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'تعذر تنفيذ العملية');return d}
  function certificates(){
    const grid=document.querySelector('.cert-grid, .grid-3, .certificates-grid'); if(!grid)return;
    json('/api/certificates/my').then(d=>{const list=d.certificates||[];if(!list.length){grid.innerHTML='<div class="panel"><h4 style="color:var(--ink)">لا توجد شهادات حتى الآن</h4><p style="color:var(--ink-soft);margin-top:8px">ستظهر شهاداتك هنا عند إصدارها لك.</p></div>';return}
      grid.innerHTML=list.map(c=>`<article class="panel cert-card" data-code="${esc(c.code)}"><div style="font-size:28px">🏆</div><h4 style="color:var(--ink);margin-top:10px">${esc(c.title)}</h4><p style="color:var(--ink-soft);font-size:13px">${esc(c.certificate_type||'شهادة')}</p><p style="color:var(--ink-soft);font-size:12px">${new Date(c.issued_at).toLocaleDateString('ar-SA')}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-ghost sm hc17-pdf">تحميل PDF</button><button class="btn btn-primary sm hc17-share">مشاركة على LinkedIn</button></div></article>`).join('');
      grid.querySelectorAll('.hc17-pdf').forEach(b=>b.onclick=()=>{location.href='/api/certificates/'+encodeURIComponent(b.closest('[data-code]').dataset.code)+'/document'});
      grid.querySelectorAll('.hc17-share').forEach(b=>b.onclick=()=>{const code=b.closest('[data-code]').dataset.code;const url=location.origin+'/api/certificates/'+encodeURIComponent(code)+'/document';location.href='https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(url)});
    }).catch(()=>{});
  }
  function more(){
    const buttons=[...document.querySelectorAll('button')];
    const feedback=buttons.find(b=>b.textContent.trim()==='إرسال التقييم');
    if(feedback)feedback.onclick=async()=>{const host=feedback.closest('.panel')||feedback.parentElement;const inputs=[...host.querySelectorAll('input,textarea')];const rating=host.querySelector('.rating, [data-rating]')?.dataset.rating||'';try{await json('/api/feedback',{method:'POST',body:JSON.stringify({rating,comment:(inputs.find(x=>x.tagName==='TEXTAREA')||{}).value||''})});status(host,'تم حفظ تقييمك بنجاح.',true)}catch(e){status(host,e.message,false)}};
    const subscribe=buttons.find(b=>b.textContent.trim()==='اشترك');
    if(subscribe){const host=subscribe.parentElement;subscribe.onclick=async()=>{const email=host.querySelector('input')?.value.trim();if(!email)return status(host,'أدخلي بريدك الإلكتروني أولًا.',false);try{await json('/api/newsletter/subscribe',{method:'POST',body:JSON.stringify({email})});status(host,'تم اشتراك بريدك في النشرة.',true)}catch(e){status(host,e.message,false)}}}
    const copy=buttons.find(b=>b.textContent.trim()==='نسخ الرابط');
    if(copy)copy.onclick=async()=>{const input=copy.parentElement.querySelector('input');try{await navigator.clipboard.writeText(input.value);status(copy.parentElement,'تم نسخ الرابط.',true)}catch{input.select();document.execCommand('copy');status(copy.parentElement,'تم نسخ الرابط.',true)}};
  }
  document.addEventListener('DOMContentLoaded',()=>{if(page==='certificates.html')certificates();if(page==='more.html')more()});
})();
