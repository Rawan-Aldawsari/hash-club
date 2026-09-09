// frontend/js/pages/join.js — طلب انضمام حقيقي يُحفظ بالخادم، بدون رسائل وهمية
(function(){
  async function loadStatus(){
    const meRes = await fetch('/api/auth/me', { credentials:'include' });
    if(!meRes.ok){
      document.getElementById('notLoggedIn').style.display = 'block';
      return;
    }
    const me = (await meRes.json()).user;
    document.getElementById('joinContent').style.display = 'block';
    document.getElementById('jEmail').value = me.email;
    document.getElementById('jFullName').value = (me.firstName + ' ' + me.lastName).trim();

    const statusRes = await fetch('/api/membership/status', { credentials:'include' });
    const data = await statusRes.json();

    document.getElementById('statusNone').style.display = 'none';
    document.getElementById('statusPending').style.display = 'none';
    document.getElementById('statusAccepted').style.display = 'none';

    if(data.status === 'pending' || data.status === 'accepted'){
      document.getElementById(data.status === 'pending' ? 'statusPending' : 'statusAccepted').style.display = 'block';
      document.getElementById('joinForm').style.opacity = '.5';
      document.getElementById('joinForm').style.pointerEvents = 'none';
    } else {
      document.getElementById('statusNone').style.display = 'block';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadStatus();

    const btn = document.getElementById('joinSubmitBtn');
    btn.addEventListener('click', async () => {
      const errBox = document.getElementById('joinError');
      const showErr = (msg) => { errBox.textContent = msg; errBox.style.display = 'block'; };
      errBox.style.display = 'none';

      const body = {
        fullName: document.getElementById('jFullName').value.trim(),
        university: document.getElementById('jUniversity').value.trim(),
        major: document.getElementById('jMajor').value.trim(),
        interest: document.getElementById('jInterest').value,
        motivation: document.getElementById('jMotivation').value.trim(),
        portfolio: document.getElementById('jPortfolio').value.trim(),
        agree: document.getElementById('jAgree').checked
      };

      btn.disabled = true;
      try{
        const res = await fetch('/api/membership/apply', {
          method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });
        if(res.ok){
          await loadStatus();
        } else {
          const data = await res.json().catch(()=>({}));
          showErr(data.error || 'تعذّر إرسال الطلب');
        }
      }catch(e){
        showErr('تعذّر الاتصال بالخادم');
      }
      btn.disabled = false;
    });
  });
})();
