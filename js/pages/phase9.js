/* Phase 9 — final interaction guard: no dead placeholder controls and no fake success. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  function status(msg,ok=false){
    let el=document.getElementById('pageActionStatus');
    if(!el){el=document.createElement('div');el.id='pageActionStatus';el.setAttribute('role','status');el.style.cssText='margin:14px auto;max-width:1100px;padding:12px 16px;border-radius:10px;line-height:1.7';(document.querySelector('main')||document.body).prepend(el)}
    el.textContent=msg;el.style.background=ok?'#edf8f0':'#fff1f1';el.style.color=ok?'#176b3a':'#9c2424';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    // A leftover javascript:void(0) must never silently swallow a click.
    document.querySelectorAll('a[href="javascript:void(0)"]').forEach(a=>{
      if(a.dataset.realBound)return;
      a.addEventListener('click',e=>{
        if(e.defaultPrevented)return;
        e.preventDefault();
        status('هذه الوظيفة لم تُربط بخدمة مستقلة بعد، لذلك لم يتم تنفيذ أي إجراء أو عرض نتيجة وهمية.',false);
      });
    });
    // Mark external project links that have no configured URL as unavailable rather than opening a random website.
    if(page==='projects.html'){
      document.querySelectorAll('.project-links a, .card a').forEach(a=>{
        const label=(a.textContent||'').trim().toLowerCase();
        if((label.includes('github')||label.includes('demo')) && (!a.href || a.getAttribute('href')==='javascript:void(0)')){
          a.setAttribute('aria-disabled','true');a.classList.add('disabled-link');
          a.addEventListener('click',e=>{e.preventDefault();status('لا يوجد رابط حقيقي مضاف لهذا المشروع بعد.',false);});
        }
      });
    }
  });
})();
