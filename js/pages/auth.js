(function () {
  function showMessage(id, text, success) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    el.style.color = success ? '#228b5b' : 'var(--danger)';
  }

  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  async function request(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'حدث خطأ، حاولي مرة أخرى.');
    return data;
  }

  const loginButton = document.getElementById('loginSubmitBtn');
  loginButton?.addEventListener('click', async () => {
    const email = (document.getElementById('loginEmail').value || '').trim();
    const password = document.getElementById('loginPassword').value || '';
    showMessage('loginError', '');
    if (!email || !password) return showMessage('loginError', 'الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
    loginButton.disabled = true;
    loginButton.textContent = 'جارٍ تسجيل الدخول...';
    try {
      await request('/api/auth/login', { email, password });
      window.location.href = 'profile.html';
    } catch (error) {
      showMessage('loginError', error.message);
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'تسجيل الدخول';
    }
  });

  const signupButton = document.getElementById('signupSubmitBtn');
  signupButton?.addEventListener('click', async () => {
    const firstName = (document.getElementById('signupFirst').value || '').trim();
    const lastName = (document.getElementById('signupLast').value || '').trim();
    const email = (document.getElementById('signupEmail').value || '').trim();
    const password = document.getElementById('signupPassword').value || '';
    const acceptedTerms = document.getElementById('signupTerms').checked;
    showMessage('signupError', '');
    if (!firstName || !lastName || !email || !password) return showMessage('signupError', 'الرجاء تعبئة جميع الحقول.');
    if (password.length < 8) return showMessage('signupError', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    if (!acceptedTerms) return showMessage('signupError', 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية.');
    signupButton.disabled = true;
    signupButton.textContent = 'جارٍ إنشاء الحساب...';
    try {
      await request('/api/auth/register', { firstName, lastName, email, password });
      window.location.href = 'join.html';
    } catch (error) {
      showMessage('signupError', error.message);
    } finally {
      signupButton.disabled = false;
      signupButton.textContent = 'إنشاء الحساب';
    }
  });

  // Allow pressing Enter inside either form.
  ['loginEmail', 'loginPassword'].forEach(id => document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginButton?.click();
  }));
  ['signupFirst', 'signupLast', 'signupEmail', 'signupPassword'].forEach(id => document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') signupButton?.click();
  }));
})();
