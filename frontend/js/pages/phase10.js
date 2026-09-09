/* Phase 10 — runtime interaction audit and real navigation repair. */
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  function showStatus(message, ok){
    let el=document.getElementById('pageActionStatus');
    if(!el){el=document.createElement('div');el.id='pageActionStatus';el.setAttribute('role','status');el.style.cssText='margin:14px auto;max-width:1100px;padding:12px 16px;border-radius:10px;line-height:1.7';(document.querySelector('main')||document.body).prepend(el);}
    el.textContent=message;el.style.background=ok?'#edf8f0':'#fff1f1';el.style.color=ok?'#176b3a':'#9c2424';
  }
  function go(href){ location.href=href; }
  document.addEventListener('DOMContentLoaded',()=>{
    // Known placeholder controls are given deterministic, meaningful destinations.
    document.querySelectorAll('a[href="#"]').forEach(a=>{
      const text=(a.textContent||'').trim();
      if(a.classList.contains('tab-btn') || a.dataset.tab || a.dataset.tabsGoto) return;
      if(a.closest('.social-row')){
        const map={X:'https://x.com/',in:'https://www.linkedin.com/',D:'https://discord.com/','▶':'https://www.youtube.com/'};
        const u=map[text]; if(u){a.href=u;a.target='_blank';a.rel='noopener noreferrer';return;}
      }
      if(/سجّل في الدفعة القادمة/.test(text)){a.href='courses.html#courses';return;}
      if(/رابط الحضور/.test(text)){a.href='events.html#events';return;}
      if(/استكشف كل المجموعات/.test(text)){a.href='committees.html';return;}
      if(/لوحة التحكم/.test(text)){a.href='dashboards.html';return;}
      // Project/profile external links without a configured destination are disabled honestly.
      if(/^(GitHub|Demo|LinkedIn)$/.test(text)){
        a.href='javascript:void(0)';a.setAttribute('aria-disabled','true');
        a.addEventListener('click',e=>{e.preventDefault();showStatus('لا يوجد رابط حقيقي مضاف لهذه الوجهة بعد.',false);});return;
      }
      a.setAttribute('aria-disabled','true'); a.classList.add('is-unavailable');
    });
    // Native buttons with no type/action must not fail silently.
    document.querySelectorAll('button').forEach(btn=>{
      if(btn.dataset.phase10Checked) return; btn.dataset.phase10Checked='1';
      const onclick=btn.getAttribute('onclick');
      const form=btn.closest('form');
      if(onclick || form || btn.dataset.action || btn.dataset.courseId || btn.dataset.eventId || btn.type==='submit') return;
      btn.disabled=true; btn.setAttribute('aria-disabled','true'); btn.title='هذه الوظيفة غير متاحة حتى يتم ربطها بخدمة حقيقية.';
    });
  });
})();
