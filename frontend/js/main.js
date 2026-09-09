// Hash Club — shared behaviors
// Structured so every feature is isolated in its own try/catch:
// one broken/unsupported feature can never block the others (especially login/signup).
const HASH_DICT = {
  "الرئيسية":"Home","الفعاليات":"Events","الدورات":"Courses","المجتمع":"Community",
  "اللجان":"Committees","المشاريع":"Projects","المدونة":"Blog","تسجيل الدخول":"Log in",
  "انضم الآن":"Join now","لوحة التحكم":"Dashboard","ملفي الشخصي":"My Profile",
  "الإعدادات":"Settings","الرسائل الخاصة":"Messages","الموارد":"Resources",
  "البحث الشامل":"Search","© 2026 نادي هاش. جميع الحقوق محفوظة.":"© 2026 Hash Club. All rights reserved.",
  "© 2026 نادي هاش.":"© 2026 Hash Club.","صُنع بهوية هاش — Alexandria × Cairo":"Made with Hash identity",
  "صُنع بهوية هاش":"Made with Hash identity","عن النادي":"About","قدّم طلب انضمام":"Request to join",
  "لوحات التحكم":"Dashboards"
};

// ---- no popups / no toast messages ----
// All actions update the page itself or navigate to the next real page.
function hcToast(){
  const old = document.getElementById('hcToast');
  if(old) old.remove();
}

// ---- localStorage availability check (shows a visible banner if blocked) ----
function hcStorageAvailable(){
  try{
    const k = '__hc_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  }catch(e){
    return false;
  }
}

function hcShowStorageWarning(){
  try{
    if(document.getElementById('hcStorageWarning')) return;
    const bar = document.createElement('div');
    bar.id = 'hcStorageWarning';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef5a6f;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:700;z-index:99999;font-family:"Cairo",sans-serif;';
    bar.textContent = '⚠️ التخزين المحلي محظور في هذه المعاينة، لذلك التسجيل/الدخول لن يعمل هنا — نزّل الملفات وافتحها مباشرة في متصفحك (وليس داخل معاينة الدردشة) ليعمل التسجيل فعليًا.';
    document.body.prepend(bar);
  }catch(e){}
}

// ============================================================
// AUTH — runs first and independently so nothing else can block it
// ============================================================
(function hcAuthModule(){
  function ready(fn){
    if(document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  const API = '/api/auth';

  ready(async function(){
    try{
      window.hcLogout = async function(){
        try{ await fetch(API + '/logout', { method:'POST', credentials:'include' }); }catch(e){}
        location.href = location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
      };

      // ---- signup ----
      const signupBtn = document.getElementById('signupSubmitBtn');
      if(signupBtn){
        signupBtn.addEventListener('click', async function(){
          const first = (document.getElementById('signupFirst')||{}).value ? document.getElementById('signupFirst').value.trim() : '';
          const last = (document.getElementById('signupLast')||{}).value ? document.getElementById('signupLast').value.trim() : '';
          const email = (document.getElementById('signupEmail')||{}).value ? document.getElementById('signupEmail').value.trim().toLowerCase() : '';
          const pass = (document.getElementById('signupPassword')||{}).value || '';
          const terms = (document.getElementById('signupTerms')||{}).checked;
          const errBox = document.getElementById('signupError');
          const showErr = (msg)=>{ if(errBox){ errBox.textContent = msg; errBox.style.display = 'block'; } };
          if(errBox) errBox.style.display = 'none';

          if(!first || !last){ showErr('الرجاء إدخال الاسم الأول واسم العائلة'); return; }
          if(!email || email.indexOf('@') === -1 || email.indexOf('.') === -1){ showErr('الرجاء إدخال بريد إلكتروني صالح'); return; }
          if(!pass || pass.length < 8){ showErr('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
          if(!terms){ showErr('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية'); return; }

          signupBtn.disabled = true;
          try{
            const res = await fetch(API + '/register', {
              method:'POST',
              credentials:'include',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ firstName:first, lastName:last, email:email, password:pass })
            });
            const data = await res.json().catch(()=>({}));
            if(!res.ok){ showErr(data.error || 'حدث خطأ، حاول مرة أخرى'); signupBtn.disabled = false; return; }
            location.href = 'join.html';
          }catch(err){
            showErr('تعذّر الاتصال بالخادم — تأكد إنك فاتحة الموقع عبر http://localhost:3000 وإن الخادم شغّال (npm start داخل مجلد server)');
            signupBtn.disabled = false;
          }
        });
      }

      // ---- login ----
      const loginBtn = document.getElementById('loginSubmitBtn');
      if(loginBtn){
        loginBtn.addEventListener('click', async function(){
          const email = (document.getElementById('loginEmail')||{}).value ? document.getElementById('loginEmail').value.trim().toLowerCase() : '';
          const pass = (document.getElementById('loginPassword')||{}).value || '';
          const errBox = document.getElementById('loginError');
          const showErr = (msg)=>{ if(errBox){ errBox.textContent = msg; errBox.style.display = 'block'; } };
          if(errBox) errBox.style.display = 'none';
          if(!email || !pass){ showErr('الرجاء تعبئة البريد الإلكتروني وكلمة المرور'); return; }

          loginBtn.disabled = true;
          try{
            const res = await fetch(API + '/login', {
              method:'POST',
              credentials:'include',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ email:email, password:pass })
            });
            const data = await res.json().catch(()=>({}));
            if(!res.ok){ showErr(data.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة'); loginBtn.disabled = false; return; }
            location.href = 'profile.html';
          }catch(err){
            showErr('تعذّر الاتصال بالخادم — تأكد إنك فاتحة الموقع عبر http://localhost:3000 وإن الخادم شغّال (npm start داخل مجلد server)');
            loginBtn.disabled = false;
          }
        });
      }

      // ---- reflect session in header + guard member-only pages ----
      try{
        const res = await fetch(API + '/me', { credentials:'include' });
        if(res.ok){
          const data = await res.json();
          const user = data.user;
          document.querySelectorAll('.header-actions a[href$="auth.html"]').forEach(function(a){
            a.textContent = '👋 ' + user.firstName;
            a.setAttribute('href', a.getAttribute('href').startsWith('pages/') ? 'pages/profile.html' : 'profile.html');
          });
          document.querySelectorAll('.header-actions a[href$="join.html"]').forEach(function(a){
            a.textContent = 'تسجيل الخروج';
            a.classList.remove('btn-primary'); a.classList.add('btn-ghost');
            a.setAttribute('href', '#');
            a.addEventListener('click', function(e){ e.preventDefault(); window.hcLogout(); });
          });

          // real notifications (no fake data)
          try{
            const nres = await fetch('/api/notifications', { credentials:'include' });
            if(nres.ok){
              const ndata = await nres.json();
              const list = document.getElementById('notifList');
              const badge = document.getElementById('notifBadge');
              if(list){
                if(ndata.notifications && ndata.notifications.length){
                  list.innerHTML = ndata.notifications.slice(0, 8).map(function(n){
                    const mins = Math.floor((Date.now() - new Date(n.createdAt).getTime()) / 60000);
                    const when = mins < 1 ? 'الآن' : (mins < 60 ? ('قبل ' + mins + ' دقيقة') : ('قبل ' + Math.floor(mins/60) + ' ساعة'));
                    return '<div class="notif-item"><span class="dot"></span><div><b>' + n.text.replace(/</g,'&lt;') + '</b><span>' + when + '</span></div></div>';
                  }).join('');
                } else {
                  list.innerHTML = '<div style="padding:18px 10px;text-align:center;color:var(--ink-soft);font-size:12.5px;">لا توجد إشعارات بعد</div>';
                }
              }
              if(badge && ndata.unreadCount > 0) badge.style.display = 'block';
            }
          }catch(e){}
        } else if(document.body.getAttribute('data-auth') === 'required'){
          location.href = 'auth.html';
        }
      }catch(err){
        // الخادم غير متاح (مثلًا فتحتِ الملف مباشرة بدون تشغيل الخادم) — لا نكسر الصفحة،
        // فقط الصفحات المحمية تبقى بدون حماية فعلية في هذه الحالة.
        if(document.body.getAttribute('data-auth') === 'required'){
          hcToast('⚠️ تعذّر التحقق من تسجيل الدخول — شغّلي الخادم أولًا (npm start)');
        }
      }
    }catch(err){
      hcToast('تعذّر تحميل نظام الحسابات في هذه البيئة');
    }
  });
})();

// ============================================================
// Everything below is decorative/UX polish — isolated so it can
// never interfere with the auth module above.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // ---- inject header utility buttons (dark mode / notifications / language) ----
  try{
    const actions = document.querySelector('.header-actions');
    if(actions && !document.getElementById('hcUtilBtns')){
      const wrap = document.createElement('div');
      wrap.id = 'hcUtilBtns';
      wrap.style.cssText = 'display:flex;align-items:center;gap:10px;';
      wrap.innerHTML = `
        <div style="position:relative;">
          <button class="icon-btn" id="notifBtn" title="الإشعارات">🔔<span class="badge-dot" id="notifBadge" style="display:none;"></span></button>
          <div class="notif-drop" id="notifDrop">
            <h6>الإشعارات الأخيرة</h6>
            <div id="notifList" style="padding:18px 10px;text-align:center;color:var(--ink-soft);font-size:12.5px;">لا توجد إشعارات بعد</div>
            <a href="settings.html" style="display:block;text-align:center;font-size:12px;font-weight:700;color:var(--periwinkle);padding:8px;">عرض كل الإشعارات</a>
          </div>
        </div>
        <button class="icon-btn" id="darkBtn" title="الوضع الليلي">🌙</button>
        <button class="icon-btn lang-btn" id="langBtn" title="Language">EN</button>
      `;
      actions.insertBefore(wrap, actions.firstChild);

      // fix relative path depth for links injected here (root index.html vs pages/*.html)
      const hcPrefix = location.pathname.includes('/pages/') ? '' : 'pages/';
      const notifViewAll = wrap.querySelector('.notif-drop a[href="settings.html"]');
      if(notifViewAll) notifViewAll.setAttribute('href', hcPrefix + 'settings.html');

      document.getElementById('notifBtn').addEventListener('click', async (e)=>{
        e.stopPropagation();
        const dropdown=document.getElementById('notifDrop');
        dropdown.classList.toggle('open');
        if(dropdown.classList.contains('open')){
          try{
            const r=await fetch('/api/notifications/read-all',{method:'POST',credentials:'include'});
            if(r.ok){const badge=document.getElementById('notifBadge');if(badge)badge.style.display='none';}
          }catch(err){}
        }
      });
      document.addEventListener('click', ()=> { const d = document.getElementById('notifDrop'); if(d) d.classList.remove('open'); });

      // apply saved theme immediately (before paint would be ideal, but this still runs early)
      try{
        const savedTheme = localStorage.getItem('hc_theme');
        if(savedTheme === 'dark'){
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      }catch(e){}

      function hcSwapLogos(isDark){
        document.querySelectorAll('.brand img, .footer-brand img').forEach(img => {
          const src = img.getAttribute('src') || '';
          if(isDark && src.includes('logo-navy.png')){
            img.dataset.lightSrc = src;
            img.src = src.replace('logo-navy.png', 'logo-white.png');
          } else if(!isDark && img.dataset.lightSrc){
            img.src = img.dataset.lightSrc;
          }
        });
      }
      hcSwapLogos(document.documentElement.getAttribute('data-theme') === 'dark');

      document.getElementById('darkBtn').addEventListener('click', (e)=>{
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        const nowDark = !isDark;
        html.setAttribute('data-theme', nowDark ? 'dark' : 'light');
        e.currentTarget.textContent = nowDark ? '☀️' : '🌙';
        hcSwapLogos(nowDark);
        try{ localStorage.setItem('hc_theme', nowDark ? 'dark' : 'light'); }catch(err){}
      });
      // reflect saved state on the toggle icon itself
      if(document.documentElement.getAttribute('data-theme') === 'dark'){
        document.getElementById('darkBtn').textContent = '☀️';
      }

      let isEn = false;
      document.getElementById('langBtn').addEventListener('click', (e)=>{
        isEn = !isEn;
        e.currentTarget.textContent = isEn ? 'AR' : 'EN';
        document.documentElement.setAttribute('dir', isEn ? 'ltr' : 'rtl');
        walkAndTranslate(document.body, isEn);
      });
    }
  }catch(e){}

  function walkAndTranslate(root, toEn){
    try{
      root.querySelectorAll('a, span, button, h1, h2, h3, h4, h5, li').forEach(el=>{
        if(el.children.length) return;
        const txt = el.textContent.trim();
        if(!el.dataset.origAr) el.dataset.origAr = txt;
        const key = el.dataset.origAr;
        if(toEn && HASH_DICT[key]) el.textContent = HASH_DICT[key];
        else if(!toEn && el.dataset.origAr) el.textContent = el.dataset.origAr;
      });
    }catch(e){}
  }

  // header solid on scroll
  try{
    const header = document.getElementById('siteHeader');
    if(header){
      const onScroll = () => header.classList.toggle('solid', window.scrollY > 30);
      window.addEventListener('scroll', onScroll);
      onScroll();
    }
  }catch(e){}

  // mobile nav toggle
  try{
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('mainNav');
    if(toggle && nav){
      toggle.addEventListener('click', () => {
        const open = nav.style.display === 'block';
        nav.style.display = open ? 'none' : 'block';
        if(!open){
          nav.style.position='absolute'; nav.style.top='100%'; nav.style.insetInlineStart='0'; nav.style.right='0';
          nav.style.background='#fff'; nav.style.padding='20px 28px'; nav.style.boxShadow='var(--shadow)';
          const ul = nav.querySelector('ul');
          ul.style.flexDirection='column'; ul.style.alignItems='flex-start'; ul.style.gap='16px';
        }
      });
    }
  }catch(e){}

  // reveal on scroll
  try{
    if(typeof IntersectionObserver !== 'undefined'){
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, {threshold:.15});
      document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
    } else {
      document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
    }
  }catch(e){
    document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
  }

  // animated counters
  try{
    const counters = document.querySelectorAll('[data-count]');
    if(typeof IntersectionObserver !== 'undefined'){
      const countIO = new IntersectionObserver((entries)=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            const el = entry.target;
            const target = parseInt(el.getAttribute('data-count'),10);
            let cur = 0;
            const step = Math.max(1, Math.round(target/60));
            const t = setInterval(()=>{
              cur += step;
              if(cur >= target){ cur = target; clearInterval(t); }
              el.textContent = cur.toLocaleString('en-US');
            }, 20);
            countIO.unobserve(el);
          }
        });
      }, {threshold:.4});
      counters.forEach(c=>countIO.observe(c));
    } else {
      counters.forEach(el => { el.textContent = parseInt(el.getAttribute('data-count'),10).toLocaleString('en-US'); });
    }
  }catch(e){}

  // generic tabs
  try{
    document.querySelectorAll('[data-tabs]').forEach(wrap=>{
      const scope = wrap.parentElement || wrap; // panels are siblings of the tabs wrapper, not children of it
      const btns = wrap.querySelectorAll('.tab-btn');
      btns.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const target = btn.getAttribute('data-tab');
          wrap.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          scope.querySelectorAll('.tab-panel').forEach(p=>{
            p.classList.toggle('active', p.getAttribute('data-panel') === target);
          });
        });
      });
    });
  }catch(e){}

  // generic toggle switches
  try{
    document.querySelectorAll('.toggle').forEach(t=>{
      t.addEventListener('click', ()=> t.classList.toggle('on'));
    });
  }catch(e){}

  // role dashboard switch
  try{
    document.querySelectorAll('.role-tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const target = btn.getAttribute('data-role');
        document.querySelectorAll('.role-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-role-panel]').forEach(p=>{
          p.style.display = (p.getAttribute('data-role-panel') === target) ? '' : 'none';
        });
      });
    });
  }catch(e){}

  // simple chat conversation switch
  try{
    document.querySelectorAll('.chat-list-item').forEach(item=>{
      item.addEventListener('click', ()=>{
        document.querySelectorAll('.chat-list-item').forEach(i=>i.classList.remove('active'));
        item.classList.add('active');
        const nameEl = document.getElementById('chatPeerName');
        if(nameEl) nameEl.textContent = item.getAttribute('data-name') || nameEl.textContent;
      });
    });
  }catch(e){}

});
