# نَبض | NABD

نَبض هو مساعد قرار مالي Local-first للتجار والمشاريع الصغيرة. يجمع الحركات المالية من CSV، يحسب التدفق النقدي، يتوقع الضغط على السيولة، ثم يمرر النتيجة عبر شبكة من الوكلاء المتخصصين بدل الاعتماد على نموذج واحد غامض.

## ما الذي يقدمه؟

- **Observer Agent** لتنظيف الحركات وتوحيدها.
- **Cashflow Agent** لحساب الرصيد الحالي وتوقع 14 يومًا.
- **Risk Agent** لاكتشاف العجز، الدفعات الكبيرة، وتركيز قنوات التحصيل.
- **Reasoning Agent** لتحديد السبب الأقرب للمشكلة.
- **Planning Agent** لبناء إجراءات ذات أثر مالي واضح.
- **Explainer Agent** لتحويل النتيجة إلى لغة عربية بسيطة.
- مختبر **What-if** لتجربة التحصيل الإضافي، خفض المصروفات، أو تأجيل دفعة قبل تنفيذ القرار.
- مساعد أسئلة محلي يعمل بدون API.
- استيراد CSV، قالب CSV جاهز، وتصدير Backup/Report.
- حفظ محلي في المتصفح، بدون رفع البيانات المالية إلى خادم خارجي.
- PWA قابلة للتثبيت وتعمل Offline بعد الزيارة الأولى.

## التشغيل

لا يحتاج المشروع إلى npm أو build step. شغّله بأي static server، مثل:

```bash
python -m http.server 8080
```

ثم افتح `http://localhost:8080`.

## النشر

### Render Static Site
- Build command: اتركه فارغًا
- Publish directory: `.`

يوجد أيضًا `render.yaml` جاهز.

يمكن نشر المشروع كذلك على GitHub Pages أو Netlify أو Cloudflare Pages أو أي استضافة Static.

## CSV المتوقع

```text
date,amount,type,category,description,channel,status
```

- `type`: `income` أو `expense`
- `status`: `completed` أو `scheduled`
- `channel`: `cash` أو `zaincash` أو `bank` أو `other`

## الخصوصية

هذه النسخة Local-first: التحليل والحفظ يتمان داخل المتصفح. لا توجد حسابات مستخدمين أو مزامنة سحابية افتراضيًا، وهذا مقصود لتقليل تكلفة التشغيل وتجنب إرسال البيانات المالية الحساسة.

نَبض أداة دعم قرار ولا يقدم استشارة محاسبية أو استثمارية أو قانونية. يجب مراجعة صحة البيانات والافتراضات قبل اتخاذ قرارات مالية جوهرية.

## مسار التحويل إلى SaaS

النسخة الحالية صالحة كـ MVP تجاري أو Pilot. عند الحاجة إلى تعدد المستخدمين والمزامنة يمكن إضافة Auth + PostgreSQL/Supabase مع إبقاء محرك الوكلاء الحالي، ثم إضافة موصلات ZainCash أو المصارف عندما تتوفر APIs واتفاقيات وصول رسمية.

## الترخيص

All Rights Reserved. راجع [LICENSE](./LICENSE).


## Engineering hardening (proposed in draft PR #1)

The baseline review and the prioritized next steps are in [docs/ENGINEERING_AUDIT.md](docs/ENGINEERING_AUDIT.md). This is an existing-project repair, not a rewrite or a new paid infrastructure plan.

- CSV parsing now handles quoted commas, embedded line breaks, escaped quotation marks and UTF-8 BOM. An invalid file is rejected **atomically** with no silent partial writes. Exact duplicate transactions are skipped; legitimate identical payments need an explicit future review workflow.
- A fresh first CSV import replaces the example dataset instead of accidentally combining fake balances with real records. The demo is labeled. Backups can be restored, with explicit confirmation, and damaged local browser storage is not overwritten automatically.
- Date-aware calculations flag completed transactions dated in the future and overdue scheduled payments/receivables. Overdue outgoing payments are included conservatively on day zero; overdue incoming funds are **not assumed collected**. What-if calculations retain whole IQD values.
- Unverified financial-benefit estimates are not shown as guaranteed effects. The chart separates negative balances below an explicit zero line.
- The interface has safer untrusted-text rendering, more readable copy and keyboard-focusable file pickers.
- The service worker caches only the same-origin app shell and static resources and rotates its cache version.

### Test locally without installing dependencies

Run the existing static server:

    python -m http.server 8080

Open http://localhost:8080. For the dependency-free arithmetic, CSV and mocked-browser regressions run:

    npm run check
    npm test

GitHub Actions also starts a static server, controls a **real Chrome browser** using a test-only Playwright driver, and checks one mobile offline reload. It stores two **synthetic demo** screenshots for a short retention period. No extra runtime package or paid API is required by the website. Passing smoke tests does not replace a complete accessibility, financial, security or operational audit.

### Limitations that must remain visible

The “current balance” begins with an **assumed opening balance of zero**, so the result is not your verified bank balance unless the imported history covers all relevant transactions. The 14-day output is a deterministic schedule-based scenario, **not** an AI-trained predictive model. The six named stages are explainable JavaScript operations, **not** six independent LLM agents. Browser localStorage and raw backup exports can expose financial details on a shared machine or be lost when browser data is cleared. No real medical, banking or merchant data was used in these tests.

Production scope, real opening balances, multi-account support, actual local hosting cost and whether intelligent autonomous agents are necessary require owner decisions before expansion. There has been no public deployment or authorization to incur spending.
