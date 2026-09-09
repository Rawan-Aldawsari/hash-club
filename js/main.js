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

// ---- toast feedback (defined early, used by several features) ----
function hcToast(msg){
  try{
    let t = document.getElementById('hcToast');
    if(!t){
      t = document.createElement('div');
      t.id = 'hcToast';
      t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:var(--navy,#2d3365);color:#fff;padding:13px 24px;border-radius:12px;font-size:13.5px;font-weight:700;z-index:9999;box-shadow:0 20px 50px -20px rgba(45,51,101,.5);opacity:0;transition:opacity .25s ease;pointer-events:none;white-space:nowrap;font-family:"Cairo",sans-serif;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._hcTimer);
    t._hcTimer = setTimeout(()=>{ t.style.opacity = '0'; }, 2200);
  }catch(e){ /* toast is cosmetic only */ }
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

  ready(function(){
    try{
      if(!hcStorageAvailable()){
        hcShowStorageWarning();
        return; // nothing else in this module can work without storage
      }

      const getUsers = () => { try{ return JSON.parse(localStorage.getItem('hc_users')||'[]'); }catch(e){ return []; } };
      const saveUsers = (list) => { try{ localStorage.setItem('hc_users', JSON.stringify(list)); }catch(e){} };
      const getSession = () => { try{ return JSON.parse(localStorage.getItem('hc_session')||'null'); }catch(e){ return null; } };
      const setSession = (u) => { try{ localStorage.setItem('hc_session', JSON.stringify({email:u.email, name:(u.firstName+' '+u.lastName).trim(), firstName:u.firstName})); }catch(e){} };
      window.hcLogout = function(){ localStorage.removeItem('hc_session'); location.href = 'index.html'; };

      const signupBtn = document.getElementById('signupSubmitBtn');
      if(signupBtn){
        signupBtn.addEventListener('click', function(){
          try{
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
            const users = getUsers();
            if(users.some(function(u){ return u.email === email; })){ showErr('هذا البريد مسجّل بالفعل — جرّب تبويب "تسجيل الدخول"'); return; }
            const newUser = {firstName:first, lastName:last, email:email, password:pass};
            users.push(newUser);
            saveUsers(users);
            setSession(newUser);
            hcToast('✅ تم إنشاء حسابك بنجاح، جاري تحويلك...');
            setTimeout(function(){ location.href = 'join.html'; }, 800);
          }catch(err){
            hcToast('حدث خطأ غير متوقع، حاول مرة أخرى');
          }
        });
      }

      const loginBtn = document.getElementById('loginSubmitBtn');
      if(loginBtn){
        loginBtn.addEventListener('click', function(){
          try{
            const email = (document.getElementById('loginEmail')||{}).value ? document.getElementById('loginEmail').value.trim().toLowerCase() : '';
            const pass = (document.getElementById('loginPassword')||{}).value || '';
            const errBox = document.getElementById('loginError');
            const showErr = (msg)=>{ if(errBox){ errBox.textContent = msg; errBox.style.display = 'block'; } };
            if(errBox) errBox.style.display = 'none';
            if(!email || !pass){ showErr('الرجاء تعبئة البريد الإلكتروني وكلمة المرور'); return; }
            const users = getUsers();
            const found = users.find(function(u){ return u.email === email && u.password === pass; });
            if(!found){
              showErr('البريد الإلكتروني أو كلمة المرور غير صحيحة، أو لا يوجد حساب بهذا البريد — جرّب تبويب "حساب جديد"');
              return;
            }
            setSession(found);
            hcToast('✅ مرحبًا بعودتك، ' + found.firstName);
            setTimeout(function(){ location.href = 'profile.html'; }, 700);
          }catch(err){
            hcToast('حدث خطأ غير متوقع، حاول مرة أخرى');
          }
        });
      }

      // reflect logged-in state in header (runs on every page)
      const session = getSession();
      if(session){
        document.querySelectorAll('.header-actions a[href$="auth.html"]').forEach(function(a){
          a.textContent = '👋 ' + session.name.split(' ')[0];
          a.setAttribute('href', a.getAttribute('href').startsWith('pages/') ? 'pages/profile.html' : 'profile.html');
        });
        document.querySelectorAll('.header-actions a[href$="join.html"]').forEach(function(a){
          a.textContent = 'تسجيل الخروج';
          a.classList.remove('btn-primary'); a.classList.add('btn-ghost');
          a.setAttribute('href', '#');
          a.addEventListener('click', function(e){ e.preventDefault(); window.hcLogout(); });
        });
      }

      // guard member-only pages
      if(document.body.getAttribute('data-auth') === 'required' && !session){
        location.href = 'auth.html';
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
          <button class="icon-btn" id="notifBtn" title="الإشعارات">🔔<span class="badge-dot"></span></button>
          <div class="notif-drop" id="notifDrop">
            <h6>الإشعارات الأخيرة</h6>
            <div class="notif-item"><span class="dot"></span><div><b>ردّ فهد الدوسري على منشورك</b><span>قبل 10 دقائق</span></div></div>
            <div class="notif-item"><span class="dot"></span><div><b>تذكير: ورشة Cloud Pipeline غدًا</b><span>اليوم</span></div></div>
            <div class="notif-item"><span class="dot"></span><div><b>تم قبول طلب انضمامك للجنة</b><span>أمس</span></div></div>
            <a href="settings.html" style="display:block;text-align:center;font-size:12px;font-weight:700;color:var(--periwinkle);padding:8px;">عرض كل الإشعارات</a>
          </div>
        </div>
        <button class="icon-btn" id="darkBtn" title="الوضع الليلي">🌙</button>
        <button class="icon-btn lang-btn" id="langBtn" title="Language">EN</button>
      `;
      actions.insertBefore(wrap, actions.firstChild);

      document.getElementById('notifBtn').addEventListener('click', (e)=>{
        e.stopPropagation();
        document.getElementById('notifDrop').classList.toggle('open');
      });
      document.addEventListener('click', ()=> { const d = document.getElementById('notifDrop'); if(d) d.classList.remove('open'); });

      document.getElementById('darkBtn').addEventListener('click', (e)=>{
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        e.currentTarget.textContent = isDark ? '🌙' : '☀️';
      });

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
      const btns = wrap.querySelectorAll('.tab-btn');
      btns.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const target = btn.getAttribute('data-tab');
          wrap.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          wrap.querySelectorAll('.tab-panel').forEach(p=>{
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

  // generic demo-button feedback (vote/follow/copy/chat-send/compose/etc.)
  try{
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a.btn, a.social-btn, .vote-btn');
      if(!btn) return;

      if(['notifBtn','darkBtn','langBtn','loginSubmitBtn','signupSubmitBtn'].includes(btn.id)) return;
      if(btn.classList.contains('tab-btn') || btn.classList.contains('role-tab')) return;
      if(btn.classList.contains('menu-toggle')) return;
      if(btn.closest('#notifDrop')) return;
      if(btn.closest('.chat-list-item')) return;

      const tag = btn.tagName.toLowerCase();
      if(tag === 'a'){
        const href = btn.getAttribute('href');
        if(href && href !== '#' && href.charAt(0) !== '#') return;
        if(href && href.length > 1 && href.charAt(0) === '#' && document.getElementById(href.slice(1))) return;
        e.preventDefault();
      }

      if(btn.classList.contains('vote-btn')){
        const m = btn.textContent.match(/(\d+)/);
        if(m){ btn.textContent = btn.textContent.replace(/\d+/, parseInt(m[1],10) + 1); }
        btn.style.borderColor = 'var(--periwinkle)';
        btn.style.color = 'var(--periwinkle)';
        return;
      }

      const label = btn.textContent.trim();
      if(label === 'متابعة'){
        btn.textContent = 'تتم المتابعة ✓';
        btn.classList.remove('btn-ghost'); btn.classList.add('btn-primary');
        return;
      }
      if(label === 'تتم المتابعة ✓'){
        btn.textContent = 'متابعة';
        btn.classList.add('btn-ghost'); btn.classList.remove('btn-primary');
        return;
      }

      if(label.includes('نسخ')){
        const input = btn.parentElement ? btn.parentElement.querySelector('input') : null;
        if(input){
          input.select();
          try{ document.execCommand('copy'); }catch(err){}
        }
        hcToast('📋 تم نسخ الرابط');
        return;
      }

      if(btn.closest('.chat-input')){
        const wrap = btn.closest('.chat-input');
        const input = wrap.querySelector('input');
        if(input && input.value.trim()){
          const chatWindow = btn.closest('.chat-window');
          const body = chatWindow ? chatWindow.querySelector('.chat-body') : null;
          if(body){
            const b = document.createElement('div');
            b.className = 'bubble out';
            b.textContent = input.value.trim();
            body.appendChild(b);
            body.scrollTop = body.scrollHeight;
          }
          input.value = '';
        }
        return;
      }

      if(btn.closest('.compose-actions')){
        const compose = btn.closest('.compose');
        const textarea = compose ? compose.querySelector('textarea') : null;
        if(textarea && textarea.value.trim()){
          const post = document.createElement('article');
          post.className = 'panel post reveal in';
          post.innerHTML = '<div class="post-head"><div class="avatar">أنا</div><div><b>أنت</b><span>الآن</span></div></div>'
            + '<p class="body-text">' + textarea.value.trim().replace(/</g,'&lt;') + '</p>'
            + '<div class="post-actions"><span>❤️ 0 إعجاب</span><span>💬 0 تعليق</span><span>🔁 مشاركة</span></div>';
          compose.insertAdjacentElement('afterend', post);
          textarea.value = '';
          hcToast('✅ تم نشر منشورك');
        } else {
          hcToast('اكتب شيئًا أولًا');
        }
        return;
      }

      if(label) hcToast('✅ ' + label);
    });
  }catch(e){}

  // like/comment/share text spans inside posts
  try{
    document.addEventListener('click', (e)=>{
      const span = e.target.closest('.post-actions span');
      if(!span) return;
      if(span.textContent.includes('❤️') || span.textContent.includes('👏')){
        const m = span.textContent.match(/(\d+)/);
        if(m){ span.textContent = span.textContent.replace(/\d+/, parseInt(m[1],10)+1); }
      }
    });
  }catch(e){}
});
