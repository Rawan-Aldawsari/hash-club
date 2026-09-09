/* Phase 13 — real AI assistant. No canned answers or fake success states. */
(function(){
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='ai.html') return;
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function addBubble(body,text,kind){ const e=document.createElement('div'); e.className='bubble '+kind; e.textContent=text; body.appendChild(e); body.scrollTop=body.scrollHeight; }
  function pageStatus(text,ok=false){ let e=document.getElementById('pageActionStatus'); if(!e){e=document.createElement('div');e.id='pageActionStatus';e.style.cssText='margin:10px 0;padding:12px 14px;border-radius:10px;font-size:13px';document.querySelector('.chat-demo')?.prepend(e)}e.textContent=text;e.style.background=ok?'#edf8f0':'#fff1f1';e.style.color=ok?'#176b3a':'#9c2424'; }
  document.addEventListener('DOMContentLoaded',()=>{
    const body=document.querySelector('.chat-demo .chat-body'),input=document.querySelector('.chat-demo .chat-input input'),send=document.querySelector('.chat-demo .chat-input button');
    if(!body||!input||!send) return;
    // Remove demo conversation so the visible chat only contains real interaction.
    body.innerHTML='<div class="bubble in">أهلًا! اسأليني عن أي موضوع، وسأستخدم خدمة الذكاء الاصطناعي المربوطة بالموقع للإجابة.</div>';
    async function submit(){
      const message=input.value.trim(); if(!message) return;
      addBubble(body,message,'out'); input.value=''; send.disabled=true; send.textContent='جارٍ الإرسال…';
      try{
        const r=await fetch('/api/ai/chat',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});
        const d=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(d.error||'تعذر التواصل مع المساعد');
        addBubble(body,d.answer,'in');
      }catch(e){ pageStatus(e.message,false); }
      finally{send.disabled=false;send.textContent='إرسال';}
    }
    send.addEventListener('click',submit); input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
    fetch('/api/recommendations',{credentials:'include'}).then(r=>r.ok?r.json():null).then(d=>{
      if(!d?.recommendations) return;
      const panel=document.querySelector('.panel.reveal'); if(!panel) return;
      panel.querySelectorAll('.rec-row').forEach(x=>x.remove());
      d.recommendations.forEach(x=>{const row=document.createElement('div');row.className='rec-row';row.innerHTML='<div><b style="font-size:13.5px;color:var(--ink)">'+esc(x.title)+'</b><br><span style="font-size:11.5px;color:var(--ink-soft)">'+esc(x.detail)+'</span></div>';panel.appendChild(row);});
    }).catch(()=>{});
  });
})();
