// Hash Club backend - Express + MySQL (XAMPP) + secure sessions
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendCandidates = [
  path.resolve(__dirname, '..', 'frontend'),
  path.resolve(process.cwd(), 'frontend')
];
const ROOT_DIR = frontendCandidates.find(dir => require('fs').existsSync(path.join(dir, 'index.html'))) || frontendCandidates[0];

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hash_club',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

async function ensureDatabaseSchema() {
  // Minimal, robust startup schema. The authentication system only needs the
  // users table; the rest of the site schema can still be imported from
  // database/schema.sql for the other interactive modules.
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    auth_provider VARCHAR(30) DEFAULT 'local',
    provider_subject VARCHAR(255) DEFAULT NULL,
    university VARCHAR(150) DEFAULT '',
    major VARCHAR(150) DEFAULT '',
    bio TEXT,
    skills_json TEXT,
    social_json TEXT,
    avatar_data MEDIUMTEXT,
    membership_status ENUM('none','pending','accepted','rejected') NOT NULL DEFAULT 'none',
    membership_application_json TEXT,
    role VARCHAR(30) NOT NULL DEFAULT 'member',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NULL,
    INDEX idx_users_email (email),
    INDEX idx_users_membership_status (membership_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Lightweight migrations for databases created by older versions.
  const migrations = [
    ['auth_provider', "VARCHAR(30) DEFAULT 'local'"],
    ['provider_subject', 'VARCHAR(255) DEFAULT NULL'],
    ['university', "VARCHAR(150) DEFAULT ''"],
    ['major', "VARCHAR(150) DEFAULT ''"],
    ['bio', 'TEXT'],
    ['skills_json', 'TEXT'],
    ['social_json', 'TEXT'],
    ['avatar_data', 'MEDIUMTEXT'],
    ['membership_status', "ENUM('none','pending','accepted','rejected') NOT NULL DEFAULT 'none'"],
    ['membership_application_json', 'TEXT'],
    ['role', "VARCHAR(30) NOT NULL DEFAULT 'member'"],
    ['updated_at', 'DATETIME(3) NULL']
  ];
  for (const [column, definition] of migrations) {
    const [rows] = await pool.query(`SHOW COLUMNS FROM users LIKE ?`, [column]);
    if (!rows.length) await pool.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }

  // This table is used by the notification center and does not depend on a
  // foreign key, avoiding the old incompatible-FK startup failure.
  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(32) PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    text VARCHAR(500) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_notifications_user_email_created_at (user_email, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

function oauthConfig(provider, req) {
  const base = appBase(req);
  const configs = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      redirectUri: `${base}/api/auth/oauth/google/callback`
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorize: 'https://github.com/login/oauth/authorize',
      token: 'https://github.com/login/oauth/access_token',
      scope: 'read:user user:email',
      redirectUri: `${base}/api/auth/oauth/github/callback`
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      authorize: 'https://www.linkedin.com/oauth/v2/authorization',
      token: 'https://www.linkedin.com/oauth/v2/accessToken',
      scope: 'openid profile email',
      redirectUri: `${base}/api/auth/oauth/linkedin/callback`
    }
  };
  return configs[provider];
}

async function exchangeOAuthCode(provider, code, cfg) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, client_id: cfg.clientId,
    client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri
  });
  const tokenRes = await fetch(cfg.token, {
    method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded', 'Accept':'application/json'}, body
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error_description || tokenData.error || 'OAuth token exchange failed');
  return tokenData.access_token;
}

async function getOAuthIdentity(provider, accessToken) {
  if (provider === 'google') {
    const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers:{Authorization:`Bearer ${accessToken}`}});
    const d = await r.json(); if (!r.ok || !d.email || !d.sub) throw new Error('لم نتمكن من قراءة بيانات حساب Google');
    return {subject:d.sub, email:d.email.toLowerCase(), firstName:d.given_name || (d.name||'').split(' ')[0] || 'عضو', lastName:d.family_name || (d.name||'').split(' ').slice(1).join(' ') || 'هاش'};
  }
  if (provider === 'github') {
    const r = await fetch('https://api.github.com/user', {headers:{Authorization:`Bearer ${accessToken}`, 'User-Agent':'Hash-Club'}});
    const d = await r.json(); if (!r.ok || !d.id) throw new Error('لم نتمكن من قراءة بيانات حساب GitHub');
    let email = d.email;
    if (!email) {
      const er = await fetch('https://api.github.com/user/emails', {headers:{Authorization:`Bearer ${accessToken}`, 'User-Agent':'Hash-Club'}});
      const emails = await er.json(); const primary = Array.isArray(emails) && (emails.find(x=>x.primary && x.verified) || emails.find(x=>x.verified)); email = primary && primary.email;
    }
    if (!email) throw new Error('حساب GitHub لا يحتوي على بريد إلكتروني متاح ومؤكد');
    const names = (d.name || d.login || 'عضو هاش').trim().split(/\s+/);
    return {subject:String(d.id), email:email.toLowerCase(), firstName:names[0] || 'عضو', lastName:names.slice(1).join(' ') || 'هاش'};
  }
  if (provider === 'linkedin') {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', {headers:{Authorization:`Bearer ${accessToken}`}});
    const d = await r.json(); if (!r.ok || !d.email || !d.sub) throw new Error('لم نتمكن من قراءة بيانات حساب LinkedIn');
    return {subject:d.sub, email:d.email.toLowerCase(), firstName:d.given_name || (d.name||'').split(' ')[0] || 'عضو', lastName:d.family_name || (d.name||'').split(' ').slice(1).join(' ') || 'هاش'};
  }
  throw new Error('مزود تسجيل الدخول غير مدعوم');
}

function mailerConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail(message) {
  if (!mailerConfigured()) throw new Error('EMAIL_NOT_CONFIGURED');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...message });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hash-club-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: process.env.COOKIE_SECURE === 'true'
  }
}));
app.use(express.static(ROOT_DIR));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'hash-club', time: new Date().toISOString() }));

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function toJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function publicUser(u) {
  return {
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    university: u.university || '',
    major: u.major || '',
    bio: u.bio || '',
    skills: toJson(u.skills_json, []),
    social: toJson(u.social_json, { linkedin: '', github: '', twitter: '' }),
    avatarData: u.avatar_data || '',
    membershipStatus: u.membership_status || 'none',
    role: u.role || 'member',
    createdAt: u.created_at
  };
}

async function findUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function currentUser(req) {
  if (!req.session.userId) return null;
  return findUserById(req.session.userId);
}

async function requireAuth(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول أولًا' });
    req.currentUser = user;
    next();
  } catch (e) {
    next(e);
  }
}

async function notify(userEmail, text) {
  if (!userEmail) return;
  await pool.query(
    'INSERT INTO notifications (id, user_email, text, created_at, is_read) VALUES (?, ?, ?, NOW(3), 0)',
    [newId(), userEmail, text]
  );
}

const auth = express.Router();

auth.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!firstName || !lastName) return res.status(400).json({ error: 'الرجاء إدخال الاسم الأول واسم العائلة' });
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ error: 'الرجاء إدخال بريد إلكتروني صالح' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    if (existing.length) return res.status(409).json({ error: 'هذا البريد مسجّل بالفعل — جرّب تسجيل الدخول' });

    const id = newId();
    const passwordHash = bcrypt.hashSync(password, 10);
    await pool.query(
      `INSERT INTO users
       (id, first_name, last_name, email, password_hash, skills_json, social_json, membership_status, created_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, 'none', NOW(3))`,
      [id, firstName.trim(), lastName.trim(), cleanEmail, passwordHash, JSON.stringify({ linkedin: '', github: '', twitter: '' })]
    );

    const user = await findUserById(id);
    req.session.userId = id;
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

auth.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) return res.status(400).json({ error: 'الرجاء تعبئة البريد الإلكتروني وكلمة المرور' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    const user = rows[0];
    const match = user && bcrypt.compareSync(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });

    req.session.userId = user.id;
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

auth.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

auth.get('/me', async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'غير مسجّل الدخول' });
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

auth.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const { university, major, bio, skills, social, avatarData } = req.body || {};
    let nextAvatar = req.currentUser.avatar_data || '';
    if (avatarData !== undefined) {
      if (avatarData === '') {
        nextAvatar = '';
      } else if (typeof avatarData === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(avatarData) && avatarData.length <= 1500000) {
        nextAvatar = avatarData;
      } else {
        return res.status(400).json({ error: 'صورة الملف الشخصي غير صالحة أو حجمها كبير' });
      }
    }
    const nextSocial = {
      linkedin: social && typeof social.linkedin === 'string' ? social.linkedin.trim() : '',
      github: social && typeof social.github === 'string' ? social.github.trim() : '',
      twitter: social && typeof social.twitter === 'string' ? social.twitter.trim() : ''
    };
    const nextSkills = Array.isArray(skills) ? skills.map(s => String(s).trim()).filter(Boolean).slice(0, 15) : [];

    await pool.query(
      `UPDATE users
       SET university = ?, major = ?, bio = ?, skills_json = ?, social_json = ?, avatar_data = ?, updated_at = NOW(3)
       WHERE id = ?`,
      [
        typeof university === 'string' ? university.trim().slice(0, 150) : '',
        typeof major === 'string' ? major.trim().slice(0, 150) : '',
        typeof bio === 'string' ? bio.trim().slice(0, 600) : '',
        JSON.stringify(nextSkills),
        JSON.stringify(nextSocial),
        nextAvatar,
        req.currentUser.id
      ]
    );

    const user = await findUserById(req.currentUser.id);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});


// Change password from the authenticated settings page.
auth.post('/password/change', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
    const valid = bcrypt.compareSync(currentPassword, req.currentUser.password_hash);
    if (!valid) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.currentUser.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

auth.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const password = String(req.body.password || '');
    if (!bcrypt.compareSync(password, req.currentUser.password_hash)) return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
    await pool.query('DELETE FROM users WHERE id = ?', [req.currentUser.id]);
    req.session.destroy(() => res.json({ ok: true }));
  } catch (e) { next(e); }
});

// Password reset: requests always work through the backend; real delivery requires SMTP credentials in .env.
auth.post('/password-reset/request', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'الرجاء إدخال بريد إلكتروني صالح' });
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!users.length) return res.json({ ok: true }); // do not reveal whether an account exists
    if (!mailerConfigured()) return res.status(503).json({ error: 'خدمة البريد غير مهيأة بعد. أضيفي إعدادات SMTP الحقيقية في ملف .env لإرسال الرسائل.' });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < NOW(3)', [users[0].id]);
    await pool.query('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, DATE_ADD(NOW(3), INTERVAL 30 MINUTE), NOW(3))', [newId(), users[0].id, tokenHash]);
    const resetUrl = `${appBase(req)}/pages/auth.html?reset=${encodeURIComponent(rawToken)}`;
    await sendMail({
      to: email,
      subject: 'إعادة تعيين كلمة المرور | نادي هاش',
      text: `مرحبًا، لإعادة تعيين كلمة المرور افتحي الرابط التالي خلال 30 دقيقة:\n${resetUrl}`,
      html: `<div dir="rtl"><h2>إعادة تعيين كلمة المرور</h2><p>اضغطي على الرابط التالي خلال 30 دقيقة:</p><p><a href="${resetUrl}">إعادة تعيين كلمة المرور</a></p></div>`
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

auth.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token) return res.status(400).json({ error: 'رابط إعادة التعيين غير صالح' });
    if (password.length < 8) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW(3) LIMIT 1', [tokenHash]);
    if (!rows.length) return res.status(400).json({ error: 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته' });
    const hash = bcrypt.hashSync(password, 10);
    await pool.query('UPDATE users SET password_hash = ?, auth_provider = IF(auth_provider = \'local\', \'local\', auth_provider), updated_at = NOW(3) WHERE id = ?', [hash, rows[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW(3) WHERE id = ?', [rows[0].id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Real OAuth flow. Provider credentials must be configured in .env; no fake success is returned.
auth.get('/oauth/:provider', (req, res) => {
  const provider = req.params.provider;
  const cfg = oauthConfig(provider, req);
  if (!cfg) return res.status(404).send('مزود تسجيل الدخول غير مدعوم');
  if (!cfg.clientId || !cfg.clientSecret) return res.redirect(`/pages/auth.html?oauth_error=${encodeURIComponent('تسجيل الدخول عبر ' + provider + ' غير مهيأ بعد. أضيفي مفاتيح OAuth الحقيقية في ملف .env.')}`);
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = { provider, state, createdAt: Date.now() };
  const url = new URL(cfg.authorize);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

auth.get('/oauth/:provider/callback', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const cfg = oauthConfig(provider, req);
    if (!cfg) return res.redirect('/pages/auth.html?oauth_error=مزود+غير+مدعوم');
    if (req.query.error) return res.redirect(`/pages/auth.html?oauth_error=${encodeURIComponent('تم إلغاء تسجيل الدخول عبر ' + provider)}`);
    const state = req.session.oauthState;
    if (!state || state.provider !== provider || state.state !== req.query.state || Date.now() - state.createdAt > 10 * 60 * 1000) {
      return res.redirect('/pages/auth.html?oauth_error=تعذر+التحقق+من+جلسة+تسجيل+الدخول');
    }
    delete req.session.oauthState;
    const accessToken = await exchangeOAuthCode(provider, String(req.query.code || ''), cfg);
    const identity = await getOAuthIdentity(provider, accessToken);
    let [rows] = await pool.query('SELECT * FROM users WHERE auth_provider = ? AND provider_subject = ? LIMIT 1', [provider, identity.subject]);
    let user = rows[0];
    if (!user) {
      [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [identity.email]);
      user = rows[0];
      if (user) {
        await pool.query('UPDATE users SET auth_provider = ?, provider_subject = ?, updated_at = NOW(3) WHERE id = ?', [provider, identity.subject, user.id]);
      } else {
        const id = newId();
        const randomPassword = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
        await pool.query(`INSERT INTO users (id, first_name, last_name, email, password_hash, auth_provider, provider_subject, skills_json, social_json, membership_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, 'none', NOW(3))`, [id, identity.firstName, identity.lastName, identity.email, randomPassword, provider, identity.subject, JSON.stringify({linkedin:'',github:'',twitter:''})]);
        user = await findUserById(id);
      }
    }
    user = user || await findUserById(rows[0] && rows[0].id);
    req.session.userId = user.id;
    res.redirect('/pages/profile.html');
  } catch (e) {
    console.error('OAuth error:', e.message);
    res.redirect(`/pages/auth.html?oauth_error=${encodeURIComponent('تعذر إكمال تسجيل الدخول عبر الحساب الاجتماعي. تحققي من إعدادات OAuth وحاولي مرة أخرى.')}`);
  }
});

app.use('/api/auth', auth);

const content = express.Router();

content.get('/posts', async (req, res, next) => {
  try {
    const me = await currentUser(req);
    const [posts] = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes_count,
        EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_email = ?) AS liked_by_me
       FROM posts p
       ORDER BY p.created_at DESC`,
      [me ? me.email : '']
    );
    const ids = posts.map(p => p.id);
    let tagsByPost = {};
    let commentsByPost = {};

    if (ids.length) {
      const [tags] = await pool.query('SELECT post_id, tag FROM post_tags WHERE post_id IN (?) ORDER BY id', [ids]);
      tagsByPost = tags.reduce((acc, row) => {
        acc[row.post_id] = acc[row.post_id] || [];
        acc[row.post_id].push(row.tag);
        return acc;
      }, {});

      const [comments] = await pool.query(
        'SELECT post_id, author_name, text, created_at FROM post_comments WHERE post_id IN (?) ORDER BY created_at ASC',
        [ids]
      );
      commentsByPost = comments.reduce((acc, row) => {
        acc[row.post_id] = acc[row.post_id] || [];
        acc[row.post_id].push({ authorName: row.author_name, text: row.text, createdAt: row.created_at });
        return acc;
      }, {});
    }

    res.json({
      ok: true,
      posts: posts.map(p => ({
        id: p.id,
        authorName: p.author_name,
        text: p.text,
        tags: tagsByPost[p.id] || [],
        createdAt: p.created_at,
        likesCount: Number(p.likes_count || 0),
        likedByMe: !!p.liked_by_me,
        isMine: !!(me && p.author_email === me.email),
        comments: commentsByPost[p.id] || []
      }))
    });
  } catch (e) {
    next(e);
  }
});

content.post('/posts', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'اكتبي شيئًا قبل النشر' });
    const tags = Array.isArray(req.body.tags) ? req.body.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 6) : [];
    const id = newId();
    const authorName = req.currentUser.first_name + ' ' + req.currentUser.last_name;

    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO posts (id, author_email, author_name, text, created_at) VALUES (?, ?, ?, ?, NOW(3))',
      [id, req.currentUser.email, authorName, text]
    );
    for (const tag of tags) {
      await conn.query('INSERT INTO post_tags (post_id, tag) VALUES (?, ?)', [id, tag]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

content.post('/posts/:id/like', requireAuth, async (req, res, next) => {
  try {
    const postId = req.params.id;
    const email = req.currentUser.email;
    const [posts] = await pool.query('SELECT author_email FROM posts WHERE id = ? LIMIT 1', [postId]);
    const post = posts[0];
    if (!post) return res.status(404).json({ error: 'المنشور غير موجود' });

    const [existing] = await pool.query('SELECT id FROM post_likes WHERE post_id = ? AND user_email = ? LIMIT 1', [postId, email]);
    let likedByMe;
    if (existing.length) {
      await pool.query('DELETE FROM post_likes WHERE post_id = ? AND user_email = ?', [postId, email]);
      likedByMe = false;
    } else {
      await pool.query('INSERT INTO post_likes (post_id, user_email, created_at) VALUES (?, ?, NOW(3))', [postId, email]);
      likedByMe = true;
      if (post.author_email !== email) await notify(post.author_email, `أعجب ${req.currentUser.first_name} بمنشورك`);
    }
    const [[countRow]] = await pool.query('SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?', [postId]);
    res.json({ ok: true, likesCount: Number(countRow.count), likedByMe });
  } catch (e) {
    next(e);
  }
});

content.post('/posts/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'اكتبي تعليقًا أولًا' });
    const [posts] = await pool.query('SELECT author_email FROM posts WHERE id = ? LIMIT 1', [req.params.id]);
    const post = posts[0];
    if (!post) return res.status(404).json({ error: 'المنشور غير موجود' });

    const authorName = req.currentUser.first_name + ' ' + req.currentUser.last_name;
    await pool.query(
      'INSERT INTO post_comments (id, post_id, author_email, author_name, text, created_at) VALUES (?, ?, ?, ?, ?, NOW(3))',
      [newId(), req.params.id, req.currentUser.email, authorName, text]
    );
    if (post.author_email !== req.currentUser.email) await notify(post.author_email, `علّق ${req.currentUser.first_name} على منشورك`);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

content.get('/projects', async (req, res, next) => {
  try {
    const me = await currentUser(req);
    const [projects] = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM project_votes v WHERE v.project_id = p.id) AS votes_count,
        EXISTS(SELECT 1 FROM project_votes v WHERE v.project_id = p.id AND v.user_email = ?) AS voted_by_me
       FROM projects p
       ORDER BY p.created_at DESC`,
      [me ? me.email : '']
    );
    const ids = projects.map(p => p.id);
    let techByProject = {};
    if (ids.length) {
      const [techRows] = await pool.query('SELECT project_id, tech FROM project_tech WHERE project_id IN (?) ORDER BY id', [ids]);
      techByProject = techRows.reduce((acc, row) => {
        acc[row.project_id] = acc[row.project_id] || [];
        acc[row.project_id].push(row.tech);
        return acc;
      }, {});
    }

    res.json({
      ok: true,
      projects: projects.map(p => ({
        id: p.id,
        ownerName: p.owner_name,
        name: p.name,
        description: p.description,
        github: p.github || '',
        demo: p.demo || '',
        tech: techByProject[p.id] || [],
        createdAt: p.created_at,
        votesCount: Number(p.votes_count || 0),
        votedByMe: !!p.voted_by_me,
        isMine: !!(me && p.owner_email === me.email)
      }))
    });
  } catch (e) {
    next(e);
  }
});

content.post('/projects', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    if (!name || !description) return res.status(400).json({ error: 'الاسم والوصف مطلوبان' });
    const tech = Array.isArray(req.body.tech) ? req.body.tech.map(t => String(t).trim()).filter(Boolean).slice(0, 8) : [];
    const id = newId();
    const ownerName = req.currentUser.first_name + ' ' + req.currentUser.last_name;

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO projects (id, owner_email, owner_name, name, description, github, demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [id, req.currentUser.email, ownerName, name, description, (req.body.github || '').trim(), (req.body.demo || '').trim()]
    );
    for (const item of tech) {
      await conn.query('INSERT INTO project_tech (project_id, tech) VALUES (?, ?)', [id, item]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

content.post('/projects/:id/vote', requireAuth, async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const email = req.currentUser.email;
    const [projects] = await pool.query('SELECT owner_email, name FROM projects WHERE id = ? LIMIT 1', [projectId]);
    const project = projects[0];
    if (!project) return res.status(404).json({ error: 'المشروع غير موجود' });

    const [existing] = await pool.query('SELECT id FROM project_votes WHERE project_id = ? AND user_email = ? LIMIT 1', [projectId, email]);
    let votedByMe;
    if (existing.length) {
      await pool.query('DELETE FROM project_votes WHERE project_id = ? AND user_email = ?', [projectId, email]);
      votedByMe = false;
    } else {
      await pool.query('INSERT INTO project_votes (project_id, user_email, created_at) VALUES (?, ?, NOW(3))', [projectId, email]);
      votedByMe = true;
      if (project.owner_email !== email) await notify(project.owner_email, `صوّت ${req.currentUser.first_name} لمشروعك "${project.name}"`);
    }
    const [[countRow]] = await pool.query('SELECT COUNT(*) AS count FROM project_votes WHERE project_id = ?', [projectId]);
    res.json({ ok: true, votesCount: Number(countRow.count), votedByMe });
  } catch (e) {
    next(e);
  }
});

content.get('/blog', async (req, res, next) => {
  try {
    const me = await currentUser(req);
    const [posts] = await pool.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
    res.json({
      ok: true,
      posts: posts.map(p => ({
        id: p.id,
        title: p.title,
        category: p.category,
        authorName: p.author_name,
        createdAt: p.created_at,
        body: p.body,
        isMine: !!(me && p.author_email === me.email)
      }))
    });
  } catch (e) {
    next(e);
  }
});

content.post('/blog', requireAuth, async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    const body = (req.body.body || '').trim();
    if (!title || !body) return res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
    const authorName = req.currentUser.first_name + ' ' + req.currentUser.last_name;
    await pool.query(
      `INSERT INTO blog_posts (id, author_email, author_name, title, category, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
      [newId(), req.currentUser.email, authorName, title, (req.body.category || 'عام').trim(), body]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

content.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const [notifications] = await pool.query(
      `SELECT id, text, created_at, is_read
       FROM notifications
       WHERE user_email = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.currentUser.email]
    );
    res.json({
      ok: true,
      notifications: notifications.map(n => ({
        id: n.id,
        text: n.text,
        createdAt: n.created_at,
        read: !!n.is_read
      })),
      unreadCount: notifications.filter(n => !n.is_read).length
    });
  } catch (e) {
    next(e);
  }
});

content.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_email = ?', [req.currentUser.email]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

content.get('/membership/status', requireAuth, (req, res) => {
  res.json({
    ok: true,
    status: req.currentUser.membership_status || 'none',
    application: toJson(req.currentUser.membership_application_json, null)
  });
});

content.post('/membership/apply', requireAuth, async (req, res, next) => {
  try {
    const { fullName, university, major, interest, motivation, portfolio } = req.body || {};
    if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'الاسم الكامل مطلوب' });
    if (!motivation || !motivation.trim()) return res.status(400).json({ error: 'الرجاء كتابة دوافعك للانضمام' });
    if (!req.body.agree) return res.status(400).json({ error: 'يجب الموافقة على ميثاق النادي' });
    if (['pending', 'accepted'].includes(req.currentUser.membership_status)) {
      return res.status(409).json({ error: 'لديك طلب مُقدَّم بالفعل' });
    }

    const application = {
      fullName: fullName.trim(),
      university: (university || '').trim(),
      major: (major || '').trim(),
      interest: (interest || '').trim(),
      motivation: motivation.trim(),
      portfolio: (portfolio || '').trim(),
      submittedAt: new Date().toISOString()
    };
    await pool.query(
      `UPDATE users
       SET membership_status = 'pending', membership_application_json = ?, updated_at = NOW(3)
       WHERE id = ?`,
      [JSON.stringify(application), req.currentUser.id]
    );
    res.json({ ok: true, status: 'pending', application });
  } catch (e) {
    next(e);
  }
});


// Events: registrations are persisted and tied to the logged-in user.
content.post('/events/:id/register', requireAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.id || '').slice(0, 120);
    if (!eventId) return res.status(400).json({ error: 'فعالية غير صالحة' });
    await pool.query('INSERT IGNORE INTO event_registrations (id, event_id, user_id, created_at) VALUES (?, ?, ?, NOW(3))', [newId(), eventId, req.currentUser.id]);
    const [[row]] = await pool.query('SELECT created_at FROM event_registrations WHERE event_id = ? AND user_id = ?', [eventId, req.currentUser.id]);
    res.json({ ok: true, registeredAt: row.created_at });
  } catch (e) { next(e); }
});
content.get('/events/:id/status', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT created_at FROM event_registrations WHERE event_id = ? AND user_id = ? LIMIT 1', [req.params.id, req.currentUser.id]);
    res.json({ ok: true, registered: !!rows.length, registeredAt: rows[0] && rows[0].created_at });
  } catch (e) { next(e); }
});

content.post('/courses/:id/enroll', requireAuth, async (req, res, next) => {
  try {
    const courseId = String(req.params.id || '').slice(0, 120);
    await pool.query('INSERT IGNORE INTO course_enrollments (id, course_id, user_id, created_at) VALUES (?, ?, ?, NOW(3))', [newId(), courseId, req.currentUser.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
content.get('/courses/my', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT course_id, created_at FROM course_enrollments WHERE user_id = ? ORDER BY created_at DESC', [req.currentUser.id]);
    res.json({ ok: true, courses: rows.map(r => ({ id:r.course_id, enrolledAt:r.created_at })) });
  } catch (e) { next(e); }
});

// Phase 12: real one-to-one conversations.
content.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const withUser = String(req.query.with || '').trim();
    let sql = `SELECT m.id,m.sender_id,m.recipient_user_id,m.recipient_label,m.body,m.created_at,
      s.first_name AS sender_first_name,s.last_name AS sender_last_name
      FROM messages m JOIN users s ON s.id=m.sender_id
      WHERE (m.sender_id=? OR m.recipient_user_id=?)`;
    const params=[req.currentUser.id,req.currentUser.id];
    if(withUser){
      sql += ' AND ((m.sender_id=? AND m.recipient_user_id=?) OR (m.sender_id=? AND m.recipient_user_id=?))';
      params.push(req.currentUser.id,withUser,withUser,req.currentUser.id);
    }
    sql += ' ORDER BY m.created_at ASC LIMIT 200';
    const [rows]=await pool.query(sql,params);
    res.json({ok:true,messages:rows.map(m=>({id:m.id,senderId:m.sender_id,recipientUserId:m.recipient_user_id,recipientLabel:m.recipient_label,body:m.body,createdAt:m.created_at,mine:m.sender_id===req.currentUser.id,senderName:`${m.sender_first_name} ${m.sender_last_name}`}))});
  } catch(e){next(e);}
});
content.post('/messages', requireAuth, async (req, res, next) => {
  try {
    const recipientId=String(req.body.recipientId||'').trim();
    const body=String(req.body.body||'').trim().slice(0,4000);
    if(!recipientId||!body) return res.status(400).json({error:'اختاري عضوًا واكتبي الرسالة أولًا'});
    if(recipientId===req.currentUser.id) return res.status(400).json({error:'لا يمكنك إرسال رسالة إلى نفسك'});
    const recipient=await findUserById(recipientId);
    if(!recipient) return res.status(404).json({error:'المستلم غير موجود'});
    const id=newId(), label=`${recipient.first_name} ${recipient.last_name}`.trim();
    await pool.query('INSERT INTO messages (id,sender_id,recipient_user_id,recipient_label,body,created_at) VALUES (?,?,?,?,?,NOW(3))',[id,req.currentUser.id,recipient.id,label,body]);
    await notify(recipient.email,`لديك رسالة جديدة من ${req.currentUser.first_name} ${req.currentUser.last_name}`);
    res.json({ok:true,id});
  } catch(e){next(e);}
});

content.get('/tasks', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id,title,assignee,status,created_at FROM tasks WHERE created_by = ? ORDER BY created_at DESC', [req.currentUser.id]);
    res.json({ ok:true, tasks:rows });
  } catch (e) { next(e); }
});
content.post('/tasks', requireAuth, async (req, res, next) => {
  try {
    const title=String(req.body.title||'').trim().slice(0,220), assignee=String(req.body.assignee||'').trim().slice(0,180);
    if(!title || !assignee) return res.status(400).json({ error:'عنوان المهمة والشخص المكلّف مطلوبان' });
    const id=newId(); await pool.query('INSERT INTO tasks (id,title,assignee,created_by,status,created_at) VALUES (?, ?, ?, ?, \'open\', NOW(3))',[id,title,assignee,req.currentUser.id]);
    res.json({ok:true,id});
  } catch(e){next(e);}
});

content.post('/newsletter/subscribe', async (req,res,next)=>{
  try{
    const email=String(req.body.email||'').trim().toLowerCase();
    if(!email.includes('@')) return res.status(400).json({error:'أدخل بريدًا إلكترونيًا صالحًا'});
    await pool.query('INSERT IGNORE INTO newsletter_subscribers (email,created_at) VALUES (?,NOW(3))',[email]);
    res.json({ok:true});
  }catch(e){next(e);}
});
content.post('/feedback', async (req,res,next)=>{
  try{
    const body=String(req.body.body||'').trim().slice(0,4000); if(!body) return res.status(400).json({error:'اكتب التقييم أولًا'});
    const user=await currentUser(req); await pool.query('INSERT INTO feedback (id,user_id,body,created_at) VALUES (?, ?, ?, NOW(3))',[newId(),user?user.id:null,body]); res.json({ok:true});
  }catch(e){next(e);}
});
content.post('/bookings', requireAuth, async (req,res,next)=>{
  try{
    const mentor=String(req.body.mentor||'').trim().slice(0,180); if(!mentor) return res.status(400).json({error:'اختاري المرشد'});
    await pool.query('INSERT IGNORE INTO mentor_bookings (id,user_id,mentor,created_at) VALUES (?, ?, ?, NOW(3))',[newId(),req.currentUser.id,mentor]); res.json({ok:true});
  }catch(e){next(e);}
});


// ========================= Phase 2: resources, search, certificates, admin and real task workflow =========================
function isAdmin(user){
  const configured = String(process.env.ADMIN_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return !!user && (user.role === 'admin' || configured.includes(String(user.email).toLowerCase()));
}
function requireAdmin(req,res,next){
  if(!isAdmin(req.currentUser)) return res.status(403).json({error:'هذه العملية تتطلب صلاحية الإدارة. أضيفي بريد المسؤول إلى ADMIN_EMAILS أو عيّني role=admin في قاعدة البيانات.'});
  next();
}

content.get('/resources', async (req,res,next)=>{
  try{
    const q=String(req.query.q||'').trim(); const category=String(req.query.category||'').trim();
    let sql='SELECT id,title,category,description,action_type,external_url FROM resources WHERE 1=1'; const vals=[];
    if(q){ sql+=' AND (title LIKE ? OR description LIKE ? OR category LIKE ?)'; vals.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
    if(category && category!=='الكل'){ sql+=' AND category=?'; vals.push(category); }
    sql+=' ORDER BY created_at DESC'; const [rows]=await pool.query(sql,vals); res.json({ok:true,resources:rows});
  }catch(e){next(e);}
});
content.get('/resources/:id/download', async (req,res,next)=>{
  try{
    const [[r]]=await pool.query('SELECT title,content FROM resources WHERE id=? LIMIT 1',[req.params.id]);
    if(!r) return res.status(404).send('المورد غير موجود');
    const filename=(r.title||'hash-resource').replace(/[\\/:*?"<>|]/g,'_')+'.txt';
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(r.content || r.title);
  }catch(e){next(e);}
});
content.get('/resources/:id/open', async (req,res,next)=>{
  try{
    const [[r]]=await pool.query('SELECT external_url FROM resources WHERE id=? LIMIT 1',[req.params.id]);
    if(!r) return res.status(404).json({error:'المورد غير موجود'});
    res.json({ok:true,url:r.external_url||(`/api/resources/${encodeURIComponent(req.params.id)}/download`)});
  }catch(e){next(e);}
});

content.get('/search', async (req,res,next)=>{
  try{
    const q=String(req.query.q||'').trim(); const like='%'+q+'%';
    const [projects]=await pool.query('SELECT id,name,description FROM projects WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 20',[like,like]);
    const [articles]=await pool.query('SELECT id,title,category FROM blog_posts WHERE title LIKE ? OR body LIKE ? ORDER BY created_at DESC LIMIT 20',[like,like]);
    const [members]=await pool.query('SELECT first_name,last_name,major,university FROM users WHERE CONCAT(first_name," ",last_name) LIKE ? OR major LIKE ? LIMIT 20',[like,like]);
    const [resources]=await pool.query('SELECT id,title,category,description FROM resources WHERE title LIKE ? OR description LIKE ? LIMIT 20',[like,like]);
    res.json({ok:true,query:q,projects,articles,members,resources});
  }catch(e){next(e);}
});

content.get('/certificates/my', requireAuth, async (req,res,next)=>{
  try{
    const [rows]=await pool.query('SELECT code,title,certificate_type,issued_at FROM certificates WHERE user_id=? ORDER BY issued_at DESC',[req.currentUser.id]);
    res.json({ok:true,certificates:rows});
  }catch(e){next(e);}
});
content.get('/certificates/verify/:code', async (req,res,next)=>{
  try{
    const [[r]]=await pool.query(`SELECT c.code,c.title,c.certificate_type,c.issued_at,u.first_name,u.last_name FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.code=? LIMIT 1`,[req.params.code]);
    if(!r) return res.status(404).json({ok:false,error:'لم يتم العثور على شهادة بهذا الرمز'});
    res.json({ok:true,certificate:{code:r.code,title:r.title,type:r.certificate_type,issuedAt:r.issued_at,recipient:r.first_name+' '+r.last_name}});
  }catch(e){next(e);}
});
content.get('/certificates/:code/document', async (req,res,next)=>{
  try{
    const [[r]]=await pool.query(`SELECT c.code,c.title,c.certificate_type,c.issued_at,u.first_name,u.last_name FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.code=? LIMIT 1`,[req.params.code]);
    if(!r) return res.status(404).send('الشهادة غير موجودة');
    res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>شهادة ${r.title}</title><style>body{font-family:Arial,sans-serif;background:#f4f6fb;margin:0;padding:40px}.cert{max-width:900px;margin:auto;background:#fff;border:14px solid #30375f;padding:70px;text-align:center;border-radius:20px}h1{font-size:44px;color:#30375f}h2{font-size:32px}.code{margin-top:35px;color:#5667c9;font-weight:bold}@media print{button{display:none}body{background:#fff;padding:0}.cert{border-width:8px}}</style><div class="cert"><h1>نادي هاش</h1><p>تشهد بأن</p><h2>${String(r.first_name+' '+r.last_name).replace(/</g,'&lt;')}</h2><p>قد أتم/شارك في</p><h2>${String(r.title).replace(/</g,'&lt;')}</h2><p>${String(r.certificate_type).replace(/</g,'&lt;')}</p><p>تاريخ الإصدار: ${new Date(r.issued_at).toLocaleDateString('ar-SA')}</p><div class="code">رمز التحقق: ${r.code}</div><br><button onclick="window.print()">طباعة / حفظ كـ PDF</button></div></html>`);
  }catch(e){next(e);}
});
content.post('/certificates/issue', requireAuth, requireAdmin, async (req,res,next)=>{
  try{
    const recipient=String(req.body.recipient||'').trim(); const title=String(req.body.title||'شهادة مشاركة من نادي هاش').trim().slice(0,240);
    if(!recipient) return res.status(400).json({error:'أدخلي اسم أو بريد الطالب'});
    const [[u]]=await pool.query('SELECT id,email,first_name,last_name FROM users WHERE email=? OR CONCAT(first_name," ",last_name)=? LIMIT 1',[recipient.toLowerCase(),recipient]);
    if(!u) return res.status(404).json({error:'لم يتم العثور على طالب مطابق'});
    const code='HASH-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
    await pool.query('INSERT INTO certificates (id,code,user_id,title,certificate_type,issued_at,issuer_id) VALUES (?,?,?,?,?,NOW(3),?)',[newId(),code,u.id,title,'شهادة',req.currentUser.id]);
    await notify(u.email,`تم إصدار شهادة جديدة لك: ${title}`);
    res.json({ok:true,code});
  }catch(e){next(e);}
});

content.get('/tasks', requireAuth, async (req,res,next)=>{
  try{
    const [rows]=await pool.query('SELECT id,title,assignee,status,created_at FROM tasks WHERE created_by=? ORDER BY created_at DESC',[req.currentUser.id]);
    res.json({ok:true,tasks:rows});
  }catch(e){next(e);}
});
content.patch('/tasks/:id', requireAuth, async (req,res,next)=>{
  try{
    const status=String(req.body.status||'').trim(); if(!['open','in_progress','done'].includes(status)) return res.status(400).json({error:'حالة غير صالحة'});
    const [r]=await pool.query('UPDATE tasks SET status=? WHERE id=? AND created_by=?',[status,req.params.id,req.currentUser.id]);
    if(!r.affectedRows) return res.status(404).json({error:'المهمة غير موجودة'}); res.json({ok:true});
  }catch(e){next(e);}
});
content.delete('/tasks/:id', requireAuth, async (req,res,next)=>{
  try{ const [r]=await pool.query('DELETE FROM tasks WHERE id=? AND created_by=?',[req.params.id,req.currentUser.id]); if(!r.affectedRows)return res.status(404).json({error:'المهمة غير موجودة'}); res.json({ok:true}); }catch(e){next(e);}
});
content.post('/tasks/:id/comments', requireAuth, async (req,res,next)=>{
  try{ const body=String(req.body.body||'').trim(); if(!body)return res.status(400).json({error:'اكتب تعليقًا'}); const [[task]]=await pool.query('SELECT id FROM tasks WHERE id=? AND created_by=?',[req.params.id,req.currentUser.id]); if(!task)return res.status(404).json({error:'المهمة غير موجودة'}); await pool.query('INSERT INTO task_comments (id,task_id,user_id,body,created_at) VALUES (?,?,?,?,NOW(3))',[newId(),req.params.id,req.currentUser.id,body]); res.json({ok:true}); }catch(e){next(e);}
});

content.get('/tasks/:id/comments', requireAuth, async (req,res,next)=>{
  try{ const [[task]]=await pool.query('SELECT id FROM tasks WHERE id=? AND created_by=?',[req.params.id,req.currentUser.id]); if(!task)return res.status(404).json({error:'المهمة غير موجودة'}); const [rows]=await pool.query(`SELECT c.id,c.body,c.created_at,u.first_name,u.last_name FROM task_comments c JOIN users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at ASC`,[req.params.id]); res.json({ok:true,comments:rows.map(r=>({id:r.id,body:r.body,author:`${r.first_name} ${r.last_name}`,createdAt:r.created_at}))}); }catch(e){next(e);}
});

content.get('/admin/membership-applications', requireAuth, requireAdmin, async (req,res,next)=>{
  try{ const [rows]=await pool.query("SELECT id,first_name,last_name,email,major,membership_application_json,updated_at FROM users WHERE membership_status='pending' ORDER BY updated_at ASC"); res.json({ok:true,applications:rows.map(r=>({id:r.id,name:r.first_name+' '+r.last_name,email:r.email,major:r.major||'',application:toJson(r.membership_application_json,{}),submittedAt:r.updated_at}))}); }catch(e){next(e);}
});
content.post('/admin/membership/:id/accept', requireAuth, requireAdmin, async (req,res,next)=>{
  try{ const [r]=await pool.query("UPDATE users SET membership_status='accepted',updated_at=NOW(3) WHERE id=? AND membership_status='pending'",[req.params.id]); if(!r.affectedRows)return res.status(404).json({error:'الطلب غير موجود أو تمت معالجته'}); const [[u]]=await pool.query('SELECT email FROM users WHERE id=?',[req.params.id]); if(u)await notify(u.email,'تم قبول طلب انضمامك إلى نادي هاش'); res.json({ok:true}); }catch(e){next(e);}
});

content.get('/stats', async (req,res,next)=>{
  try{
    const [[users]]=await pool.query('SELECT COUNT(*) c FROM users'); const [[posts]]=await pool.query('SELECT COUNT(*) c FROM posts'); const [[projects]]=await pool.query('SELECT COUNT(*) c FROM projects'); const [[events]]=await pool.query('SELECT COUNT(*) c FROM event_registrations'); const [[courses]]=await pool.query('SELECT COUNT(*) c FROM course_enrollments');
    res.json({ok:true,stats:{users:Number(users.c),posts:Number(posts.c),projects:Number(projects.c),eventRegistrations:Number(events.c),courseEnrollments:Number(courses.c)}});
  }catch(e){next(e);}
});
content.get('/achievements/leaderboard', async (req,res,next)=>{
  try{
    const [rows]=await pool.query(`SELECT u.first_name,u.last_name,u.major,
      ((SELECT COUNT(*) FROM posts p WHERE p.author_email=u.email)*10 + (SELECT COUNT(*) FROM projects p WHERE p.owner_email=u.email)*25 + (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.user_id=u.id)*15 + (SELECT COUNT(*) FROM event_registrations er WHERE er.user_id=u.id)*10) AS points
      FROM users u ORDER BY points DESC, u.created_at ASC LIMIT 20`);
    res.json({ok:true,leaderboard:rows.map((r,i)=>({rank:i+1,name:r.first_name+' '+r.last_name,major:r.major||'عضو',points:Number(r.points)}))});
  }catch(e){next(e);}
});


// ========================= Phase 3: settings, committees, real status and interaction persistence =========================
content.get('/preferences', requireAuth, async (req,res,next)=>{
  try{
    await pool.query('INSERT IGNORE INTO user_preferences (user_id) VALUES (?)',[req.currentUser.id]);
    const [[p]]=await pool.query('SELECT * FROM user_preferences WHERE user_id=?',[req.currentUser.id]);
    res.json({ok:true,preferences:{privacyProfile:!!p.privacy_profile,privacyActivity:!!p.privacy_activity,notifyEmail:!!p.notify_email,notifySite:!!p.notify_site,language:p.language,theme:p.theme}});
  }catch(e){next(e);}
});
content.patch('/preferences', requireAuth, async (req,res,next)=>{
  try{
    const b=req.body||{};
    await pool.query('INSERT IGNORE INTO user_preferences (user_id) VALUES (?)',[req.currentUser.id]);
    await pool.query(`UPDATE user_preferences SET privacy_profile=?,privacy_activity=?,notify_email=?,notify_site=?,language=?,theme=? WHERE user_id=?`,[
      b.privacyProfile===false?0:1,b.privacyActivity===false?0:1,b.notifyEmail===false?0:1,b.notifySite===false?0:1,
      ['ar','en'].includes(b.language)?b.language:'ar',['light','dark'].includes(b.theme)?b.theme:'light',req.currentUser.id
    ]);
    res.json({ok:true});
  }catch(e){next(e);}
});
content.get('/events/:id/status', requireAuth, async (req,res,next)=>{
  try{const [rows]=await pool.query('SELECT created_at FROM event_registrations WHERE event_id=? AND user_id=? LIMIT 1',[req.params.id,req.currentUser.id]);res.json({ok:true,registered:!!rows.length,registeredAt:rows[0]?.created_at||null});}catch(e){next(e);}
});
content.get('/courses/:id/status', requireAuth, async (req,res,next)=>{
  try{const [rows]=await pool.query('SELECT created_at FROM course_enrollments WHERE course_id=? AND user_id=? LIMIT 1',[req.params.id,req.currentUser.id]);res.json({ok:true,enrolled:!!rows.length,enrolledAt:rows[0]?.created_at||null});}catch(e){next(e);}
});
content.get('/committees/my', requireAuth, async (req,res,next)=>{
  try{const [rows]=await pool.query('SELECT committee_key,status,created_at FROM committee_memberships WHERE user_id=? ORDER BY created_at DESC',[req.currentUser.id]);res.json({ok:true,memberships:rows});}catch(e){next(e);}
});
content.post('/committees/:key/join', requireAuth, async (req,res,next)=>{
  try{const key=String(req.params.key||'').trim().slice(0,100);if(!key)return res.status(400).json({error:'لجنة غير صالحة'});await pool.query('INSERT IGNORE INTO committee_memberships (id,committee_key,user_id,status,created_at) VALUES (?,?,?,?,NOW(3))',[newId(),key,req.currentUser.id,'pending']);const [[m]]=await pool.query('SELECT status FROM committee_memberships WHERE committee_key=? AND user_id=?',[key,req.currentUser.id]);res.json({ok:true,status:m.status});}catch(e){next(e);}
});
content.post('/suggestions/:key/vote', requireAuth, async (req,res,next)=>{
  try{const key=String(req.params.key||'').trim().slice(0,160);const [ex]=await pool.query('SELECT id FROM suggestion_votes WHERE suggestion_key=? AND user_id=? LIMIT 1',[key,req.currentUser.id]);let voted;if(ex.length){await pool.query('DELETE FROM suggestion_votes WHERE id=?',[ex[0].id]);voted=false;}else{await pool.query('INSERT INTO suggestion_votes (id,suggestion_key,user_id,created_at) VALUES (?,?,?,NOW(3))',[newId(),key,req.currentUser.id]);voted=true;}const [[c]]=await pool.query('SELECT COUNT(*) c FROM suggestion_votes WHERE suggestion_key=?',[key]);res.json({ok:true,voted,count:Number(c.c)});}catch(e){next(e);}
});
content.post('/notifications/:id/read', requireAuth, async (req,res,next)=>{
  try{await pool.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_email=?',[req.params.id,req.currentUser.email]);res.json({ok:true});}catch(e){next(e);}
});


// ========================= Phase 4: real communication and attendance workflows =========================
content.get('/messages/inbox', requireAuth, async (req,res,next)=>{
  try{
    const [rows]=await pool.query(`SELECT m.id,m.sender_id,m.recipient_label,m.body,m.created_at,u.first_name,u.last_name,u.email,
      EXISTS(SELECT 1 FROM message_reads mr WHERE mr.message_id=m.id AND mr.user_id=?) AS is_read
      FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.recipient_user_id=? OR m.recipient_label=? OR m.recipient_label='all'
      ORDER BY m.created_at DESC LIMIT 100`,[req.currentUser.id,req.currentUser.email,req.currentUser.id]);
    res.json({ok:true,messages:rows});
  }catch(e){next(e);}
});
content.post('/messages/:id/read', requireAuth, async (req,res,next)=>{
  try{ await pool.query('INSERT IGNORE INTO message_reads (message_id,user_id) VALUES (?,?)',[req.params.id,req.currentUser.id]); res.json({ok:true}); }catch(e){next(e);}
});
content.get('/messages/contacts', requireAuth, async (req,res,next)=>{
  try{const [rows]=await pool.query('SELECT id,first_name,last_name,email,major FROM users WHERE id<>? ORDER BY first_name,last_name LIMIT 100',[req.currentUser.id]);res.json({ok:true,contacts:rows.map(u=>({id:u.id,name:`${u.first_name} ${u.last_name}`,email:u.email,major:u.major||''}))});}catch(e){next(e);}
});
content.post('/events/:id/check-in', requireAuth, async (req,res,next)=>{
  try{
    const [registered]=await pool.query('SELECT id FROM event_registrations WHERE event_id=? AND user_id=? LIMIT 1',[req.params.id,req.currentUser.id]);
    if(!registered.length) return res.status(400).json({error:'يجب التسجيل في الفعالية قبل تسجيل الحضور'});
    await pool.query('INSERT IGNORE INTO event_attendance (id,event_id,user_id) VALUES (?,?,?)',[newId(),req.params.id,req.currentUser.id]);
    res.json({ok:true,checkedIn:true});
  }catch(e){next(e);}
});
content.get('/events/:id/attendance', requireAuth, async (req,res,next)=>{
  try{const [rows]=await pool.query('SELECT checked_in_at FROM event_attendance WHERE event_id=? AND user_id=? LIMIT 1',[req.params.id,req.currentUser.id]);res.json({ok:true,checkedIn:!!rows.length,checkedInAt:rows[0]?.checked_in_at||null});}catch(e){next(e);}
});
content.get('/account/activity', requireAuth, async (req,res,next)=>{
  try{
    const [posts]=await pool.query('SELECT id,text,created_at FROM posts WHERE author_email=? ORDER BY created_at DESC LIMIT 20',[req.currentUser.email]);
    const [projects]=await pool.query('SELECT id,title,created_at FROM projects WHERE owner_email=? ORDER BY created_at DESC LIMIT 20',[req.currentUser.email]);
    const [events]=await pool.query('SELECT event_id,created_at FROM event_registrations WHERE user_id=? ORDER BY created_at DESC LIMIT 20',[req.currentUser.id]);
    res.json({ok:true,activity:{posts,projects,events}});
  }catch(e){next(e);}
});


// ========================= Phase 13: real AI assistant =========================
// The assistant only calls the configured external AI provider. It never fabricates a
// successful answer when the provider has not been configured.
content.post('/ai/chat', requireAuth, async (req,res,next)=>{
  try {
    const message=String((req.body||{}).message||'').trim();
    if(!message) return res.status(400).json({error:'اكتبي سؤالك أولًا'});
    if(message.length>4000) return res.status(400).json({error:'السؤال طويل جدًا'});
    const key=String(process.env.OPENAI_API_KEY||'').trim();
    if(!key) return res.status(503).json({error:'المساعد الذكي غير مُهيأ بعد. أضيفي OPENAI_API_KEY إلى ملف .env ثم أعيدي تشغيل الخادم.'});
    if(typeof fetch!=='function') return res.status(500).json({error:'إصدار Node.js الحالي لا يدعم الاتصال بخدمة الذكاء الاصطناعي. استخدمي Node.js 18 أو أحدث.'});
    const model=String(process.env.OPENAI_MODEL||'gpt-4.1-mini');
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({model,messages:[
        {role:'system',content:'أنت مساعد نادي هاش. أجب بالعربية بشكل مفيد ومختصر. إذا سُئلت عن خدمات النادي ولم تكن لديك بيانات مؤكدة، وضّح ذلك ولا تخترع معلومات.'},
        {role:'user',content:message}
      ],temperature:0.7})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      const detail=data?.error?.message||'تعذر الحصول على رد من خدمة الذكاء الاصطناعي';
      return res.status(502).json({error:detail});
    }
    const answer=String(data?.choices?.[0]?.message?.content||'').trim();
    if(!answer) return res.status(502).json({error:'لم تُرجع خدمة الذكاء الاصطناعي إجابة صالحة'});
    res.json({ok:true,answer});
  } catch(e){ next(e); }
});

content.get('/recommendations', requireAuth, async (req,res,next)=>{
  try {
    const [enrollments]=await pool.query('SELECT course_id FROM course_enrollments WHERE user_id=? ORDER BY created_at DESC LIMIT 10',[req.currentUser.id]);
    const [events]=await pool.query('SELECT event_id FROM event_registrations WHERE user_id=? ORDER BY created_at DESC LIMIT 10',[req.currentUser.id]);
    const items=[];
    if(enrollments.length) items.push({type:'learning',title:'واصلي مسارك التعليمي',detail:'لديك دورات مسجلّة بالفعل؛ افتحي صفحة الدورات لمتابعة التسجيلات القادمة.'});
    if(events.length) items.push({type:'event',title:'فعاليات مرتبطة بنشاطك',detail:'سجلتِ سابقًا في فعاليات النادي، تابعي صفحة الفعاليات لمعرفة الجديد.'});
    if(!items.length) items.push({type:'start',title:'ابدئي من الدورات والفعاليات',detail:'لم نجد نشاطًا كافيًا بعد لتخصيص توصيات دقيقة؛ ابدئي بالتسجيل في اهتمام يناسبك.'});
    res.json({ok:true,recommendations:items});
  } catch(e){next(e);}
});

app.use('/api', content);

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

ensureDatabaseSchema().then(() => {
  app.listen(PORT, () => {
    console.log(`Hash Club backend is running: http://localhost:${PORT}`);
    console.log('MySQL database:', process.env.DB_NAME || 'hash_club');
  });
}).catch((err) => { console.error('Database initialization failed:', err); process.exit(1); });
