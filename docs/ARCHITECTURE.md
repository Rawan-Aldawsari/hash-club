# توثيق تقني - نادي هاش

## كيف يشتغل المشروع الآن

المشروع مقسوم إلى:

```text
frontend/   ملفات HTML/CSS/JS الثابتة
backend/    خادم Express يقدم الواجهة و API
database/   ملف schema.sql لقاعدة MySQL على XAMPP
```

الواجهة تتصل بالخادم عبر مسارات مثل:

```text
/api/auth/register
/api/auth/login
/api/posts
/api/projects
/api/blog
/api/membership/apply
```

الخادم يتصل بقاعدة MySQL من خلال مكتبة `mysql2`، ويقرأ بيانات الاتصال من ملف `.env`.

## قاعدة البيانات

ملف `database/schema.sql` ينشئ قاعدة `hash_club` والجداول التالية:

- `users`: الحسابات، الملف الشخصي، حالة العضوية، وطلب الانضمام.
- `posts`: منشورات المجتمع.
- `post_tags`: وسوم المنشورات.
- `post_likes`: إعجابات المنشورات.
- `post_comments`: تعليقات المنشورات.
- `projects`: مشاريع الأعضاء.
- `project_tech`: التقنيات المستخدمة في المشاريع.
- `project_votes`: تصويت المشاريع.
- `blog_posts`: مقالات المدونة.
- `notifications`: إشعارات المستخدمين.

بعض الحقول المرنة مثل المهارات وروابط التواصل وبيانات طلب العضوية تُخزّن كنص JSON داخل MySQL، لأن النموذج الحالي للواجهة بسيط ولا يحتاج جداول تفصيلية لها حتى الآن.

## تسجيل الدخول

- كلمة المرور لا تخزن كنص، بل يتم تشفيرها بـ `bcryptjs`.
- الجلسة محفوظة بكوكي `httpOnly`.
- بيانات الحسابات محفوظة في جدول `users`.

## التشغيل المحلي

1. شغلي Apache و MySQL من XAMPP.
2. استوردي `database/schema.sql` من phpMyAdmin.
3. انسخي `.env.example` إلى `.env`.
4. من مجلد `backend` شغلي:

```bash
npm install
npm start
```

5. افتحي:

```text
http://localhost:3000
```

لا تفتحي ملفات HTML مباشرة بالنقر المزدوج، لأن الحسابات والبيانات تحتاج الخادم.
