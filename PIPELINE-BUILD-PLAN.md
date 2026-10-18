# PIPELINE-BUILD-PLAN — خطة بناء محرك مراحل OUM (0 → 12)

> خطة للاعتماد قبل التنفيذ. المصدر الحاكم: «خطة مراحل OUM — الجودة أولًا وبأقل تكلفة» (194 سطرًا، قُرئت كاملة).
> جميع القرارات أدناه مبنية على فحص حقيقي للمستودع وقاعدة البيانات (المخرجات في هذا الملف).

---

## 1 · جرد الواقع (ما وجدته فعليًا)

| البند | الواقع المقاس |
| --- | --- |
| مخطط قاعدة البيانات | **24 جدولًا** (`prisma/schema.prisma`, 548 سطرًا) — لا يوجد أي من جداول المحرك الجديدة (runs/run_stages/assets/qa_reports/cost_ledger/channel_dna/notifications) |
| «المحرك» الحالي | `lib/pipeline.ts` = **بيانات عرض فقط** (أيقونات مراحل صفحة الهبوط) — لا State Machine ولا بوابات |
| مسار الإنتاج الحالي | `lib/services/content.ts` + `app/api/content/[id]/generate` + `lib/niche/*` + `lib/ai-providers/*` — تدفق مبسط مرتبط بـ `ContentItem` |
| مفتاحا التشفير | `lib/admin/secrets.ts`: `encryptSecret/decryptSecret` (AES‑256‑GCM) + خزنة `api_service_keys` — **قابلة لإعادة الاستخدام فورًا لتوكنات القنوات** |
| مفاتيح المزودين | **الخزنة فارغة (0 مدخلات) و env بلا مفاتيح** → لا يوجد أي مزود LLM/وسائط مُهيّأ حاليًا على هذا الجهاز |
| Zod | **غير مثبت** — يجب إضافته (الدستور ينص على Type شِيمات) |
| Rate limiting | موجود ويعمل (Upstash + ذاكرة) في `lib/security/guardian.ts` — يُعاد استخدامه لواجهات المحرك |
| بيانات الإنتاج المحلية | users:2 · channels:1 · content:6 · niches:1 · KB:4 صفوف · ticket:1 · sub:1 · promo:1 · grant:1 · auditLogs:15 · secEvents:3 → **لا مساس بها** |
| Node / Prisma | Node v24.22 · Prisma 5.21 · Next 15.5.27 (بناء أخضر متحقق منه سابقًا) |
| Cron الحالي | `vercel.json` فيه واحد فقط (`/api/cron/daily-research` يوميًا 3ص) |

---

## 2 · القرارات المعمارية (تحتاج موافقتك — والتوصية واضحة)

### D1 · مزامنة الجداول مع «الـ 11» — **التوصية: تطبيق تدريجي بلا كسر الإنتاج**

جداول المحرك الدستورية الثلاثة **موجودة أصلًا** (users ✓ · channels ✓ بتوكنات مشفرة ✓ · audit_logs ✓)، الناقص **8 جداول جديدة** تُنشأ بإضافة (Additive Migration) بلا حذف أي شيء:

```
الـ 11 الدستورية          الحالة        الموافق الحالي / ملاحظة
─────────────────────────────────────────────────────────────────
users                    ✔ موجود      User (يرتبط بـ subscriptions القائم — تفاصيل الدفع تبقى خارجًا)
channels                 ✔ موجود      Channel (accessToken/refreshToken مشفران AES-256-GCM بالفعل)
audit_log              ✔ موجود      AuditLog (مُسمّى audit_logs فعليًا — مطابقة دلالية)
channel_dna              ← جديد      يحل محل customInstructions + حقول القناة المتفرقة + تحليل النيش
runs                     ← جديد      (يستوعب ContentItem لاحقًا في P5)
run_stages               ← جديد      (يستوعب ContentStatusEvent لاحقًا في P5)
assets                   ← جديد      (يستوعب mediaUrls لاحقًا في P5)
qa_reports               ← جديد
cost_ledger              ← جديد
niche_kb                 ← جديد      (يستوعب niches/best_practices/things_to_avoid/mistake_logs في P5 بترحيل بيانات)
notifications            ← جديد
─────────────────────────────────────────────────────────────────
المؤجل بالوثيقة حرفيًا: invoices، coupons، credits_grants، tickets، تعدد الأدوار → تبقى جداولها الحالية كما هي (ميزات حية) وتُجمَّد: لا حقول جديدة، لا ميزات جديدة.
طبقة تشغيلية (خارج الـ11 بحكم طبيعتها): sessions (مصادقة)، api_service_keys، youtube_cache، search_cache، search_provider_state، system_settings، security_events/chat — بنية تحتية لا كيانات مجال.
```

**البديل الحرفي B** (إسقاط فوري للجداول الـ13 الزائدة): يكسر الفوترة والدعم ولوحة الإدارة والمصادقة فورًا، ويتطلب نسخة احتياطية + تعطيل صفحات حية. **لا أنصح به**؛ إن أردته فسنفصله كعملية منفصلة موثقة.

### D2 · الموقع داخل الشجرة — `src/` حرفيًا كما طلبت

```
src/pipeline/   ← المحرك والبوابات ومدققو الكود والمزودون
src/skills/     ← ترسانة المهارات (ملف لكل مهارة + سجل + تحميل شرطي)
```
`tsconfig` الحالي يشمل `**/*.ts` والـ alias `@/*` يخدمهما مباشرة. لا نلمس `app/` و`components/` و`lib/` إلا بالإضافة.

### D3 · المزودون و«القاضي غير الكاتب» — تنفيذ صارم + فشل رخيص عند الغياب

- المزودون يُقرؤون عبر `getServiceKey()` الموجود (خزنة ⟵ env) — لا مفاتيح في الكود أبدًا.
- خريطة عائلات: `deepseek = family "D"` · `openai/gpt = "O"` · `anthropic = "A"` (تُوسَّع).
- بوابة القاضي: إن لم يوجد مزود مستقل متاح → المرحلة تفشل **فورًا** برسالة `ProviderMissing` واضحة (هذا هو السلوك الصحيح والعقيم التكلفة، وليس تجاوزًا صامتًا).
- الخزنة فارغة الآن → التطوير والاختبارات تُبنى على: منطق حتمي كامل + محولات LLM مُختبَرة بـ Stub، ومسار AI الحقيقي يُفعَّل لحظة وضع مفاتيحك.

---

## 3 · الجداول الثمانية الجديدة (الحقول الفعلية)

- **channel_dna**: channelId (unique), version, rules(JSON: do/dont/tone/length/opening/closing), conflicts(JSON), competitors(JSON), audience(JSON), avatar(JSON: quality/fingerprint), mode(JSON: avatar|faceless|mixed + copilot), approvedAt/approvedBy.
- **runs**: userId, channelId, path(avatar|faceless|mixed), mode(copilot|autopilot), status(QUEUED|RUNNING|WAITING_HUMAN|HOLD|PUBLISHED|FAILED|DONE), currentStage(0-12), costCapCents, costSpentCents, scheduledFor, idempotencyKey(unique), locale… + علاقات runs→stages/assets/ledger.
- **run_stages**: runId+stageKey **unique** (المفتاح الفريد المانع للتكرار — نص الدستور), index, status(PENDING|RUNNING|PASSED|FAILED|RETRY|SKIPPED|WAITING), attempts, checkpoint(JSON), input/output(JSON), score, **skillVersions(JSON)** (تثبيت إصدارات المهارات — نص الدستور), error, startedAt/finishedAt/durationMs.
- **assets**: runId, kind, stage, filePath, mimeType, bytes, width/height/durationSec, source(generated|library|client_upload), provider, **license/licenseUrl (أعمدة — نص الدستور)**, meta(JSON).
- **qa_reports**: runId, stageKey, checkKey, kind(deterministic|judge|human), score, passed, reasons(JSON), action(passed|auto_fix|hold|retry|rejected), **judgeModel + writerModel** (إثبات فصل القاضي عن الكاتب في كل تقرير).
- **cost_ledger**: runId, stageKey, provider, operation, units(JSON), costCents, currency, meta — **كل استدعاء مدفوع يُسجَّل بلا استثناء**.
- **niche_kb**: nicheKey, scope, channelId?, lesson, lessonHash(unique مع nicheKey), evidence(JSON), confidence(1-5), occurrences (لا يُعتمد درس من فيديو واحد — نص الدستور), status(pending|active|retired), source.
- **notifications**: userId?, runId?, channel(telegram|email|inapp), kind, title, body, data(JSON), sentAt/readAt.

قواعد الدستور المُدمجة: JSON بدل جداول كثيرة ✓ · نسخ احتياطي يومي ✓ (`scripts/pipeline/db-backup.mjs` تصدير Core Tables مضغوط — pg_dump غير متاح في تثبيت `~/.local/pg`) · حذف المخرجات الوسيطة بعد مدة ✓ (`retention.ts` داخل tick) · بلا بيانات وهمية ✓ (لا seed للجداول الجديدة).

---

## 4 · تصميم المحرك (Fail-Early منفَّذ بالكود)

```ts
// src/pipeline/stage.ts
interface StageDefinition<I, O> {
  key: "S0"…"S12";  index: 0…12;  costTier: "free"|"text"|"image"|"video"|"publish";
  skills: SkillRef[];                    // تُثبَّت إصداراتها في run_stages
  gate(ctx): Promise<GateResult>;        // شروط العبور من المرحلة السابقة
  run(ctx, input): Promise<O>;           // التنفيذ
  validators: DeterministicCheck[];      // تُشغَّل قبل أي استدعاء LLM
  maxAttempts: number;                   // نص×2 · أصول×2 (سقف الدستور)
}
```

- **Tier guard**: لا دخول لأي مرحلة `image/video/publish` قبل: نجاح كل بوابات الـ tiers الأرخص + ناتج المرحلة السابقة صالح + (للنشر) اجتياز QA2. اختبار وحدة يثبت الحجب.
- **Cost guard**: قبل أي نداء مدفوع: `costSpentCents + estimate ≤ costCapCents` وإلا `BudgetExceeded` + إشعار. سقف افتراضي + سقف لكل قناة.
- **Judge guard**: `writerModel.family !== judgeModel.family` إلزامي وإلا فشل المرحلة.
- **Idempotency**: `@@unique([runId, stageKey])` + مفاتيح خطوات داخلية (رفع، جدولة، فحوص تالية) + تحديثات CAS للحالات — لا رفع/نشر مزدوج أبدًا.
- **تعدد المحاولات**: عدّاد `attempts` + حالة RETRY؛ عند النفاد: مسار بديل (مكتبة مرخصة) أو HOLD + إشعار (نص الدستور).
- **التسجيل**: كل انتقال يُكتب في run_stages + audit_log للعمليات الحساسة (نشر، تخطي بوابة، قرار يدوي).
- **الاختبارية**: قلب المحرك يعمل على منفذ تخزين (Store Port): Prisma للإنتاج + In-Memory للاختبارات → اختبارات node:test سريعة بلا قاعدة بيانات.

**حائط «ما يفحصه الكود»** (`src/pipeline/checks/`): الأطوال والقوائم والTODO، سلامة الروابط (مع حماية SSRF: https فقط، منع الشبكات الخاصة، مهلة وحجم)، مقاسات الملفات والأبعاد، مواعيد النشر المتعارضة، التكلفة، التكرار مع الأرشيف (تشابه نصي حتمي)، LVFS/تزامن الصوت (واجهة ffprobe — تُفعَّل عند توفر الوسائط).

---

## 5 · ترسانة المهارات `src/skills/` (القالب + التحميل الشرطي)

قالب كل مهارة (كما نص الدستور §6): `key · version · goal · kind(code|llm) · path(any|avatar|faceless|mixed) · inputSchema(Zod مغلق) · outputSchema(Zod مغلق) · checklist(فحوص حتمية) · examples(5–10 أمثلة ذهبية تُختبر في CI)`.

- **التحميل الشرطي**: `loadFor(stageKey, path)` — مسار `faceless` لا يحمّل مهارات الأفاتار إطلاقًا (تحقق اختباري).
- **الإصدارات**: تُسجَّل في `run_stages.skillVersions`؛ لا تعديل مهارة إلا باجتياز أمثلتها الذهبية.
- **التوزيع**: ~40 مهارة موزعة على المراحل 0→12 (بالأسماء الواردة نصًا في الوثيقة).
  - **الموجة 1 (تُنفَّذ الآن)**: كل مهارات `code` (فحوص، حاسبات، مدققو قوائم) + مهارات النص (S0–S3, S7, S8, S12) عبر محول LLM بعقود Zod.
  - **الموجة 2 (خارج هذه الدفعة)**: مهارات الوسائط/الأفاتار/الريندر (S4–S6, S10–11) تُسجَّل بعقود كاملة لكن بحالة `implemented:false` → بوابتها تفشل بـ`ProviderMissing` (فشل رخيص مقصود حتى اختيار مزودي الوسائط وميزانيتهم).

---

## 6 · الملفات (الفعلية) — إنشاء / تعديل

**إنشاء (جديد):**

```
src/pipeline/stage.ts · engine.ts · errors.ts · store.ts · prisma-store.ts · memory-store.ts · notifier.ts · retention.ts
src/pipeline/guards/tier.ts · cost.ts · judge.ts · idempotency.ts
src/pipeline/stages/index.ts + s00-setup.ts … s12-learning.ts        (13)
src/pipeline/checks/text.ts · links.ts · media.ts · schedule.ts · cost.ts · index.ts
src/pipeline/providers/types.ts · llm.ts · youtube.ts
src/pipeline/schemas/dna.ts · run.ts · stage.ts · asset.ts · qa.ts · cost.ts · kb.ts · notification.ts · index.ts
src/pipeline/__tests__/engine.test.ts · guards.test.ts · schemas.test.ts · stages.test.ts · skills.test.ts
src/skills/_types.ts · registry.ts · loader.ts
src/skills/s00/…s12/  (ملفات المهارات — الموجة 1 منفذة والموجة 2 مسجلة)
app/api/pipeline/runs/route.ts · runs/[id]/route.ts · runs/[id]/advance/route.ts · runs/[id]/decision/route.ts
app/api/cron/pipeline-tick/route.ts
scripts/pipeline/db-backup.mjs
prisma/migrations/…_pipeline_core/migration.sql
```

**تعديل (موجود):**

```
prisma/schema.prisma        (+8 نماذج + enums + علاقات — إضافي فقط)
package.json                (+zod، +tsx، +"test": "node --import tsx --test …")
vercel.json                 (+cron للـ pipeline-tick — انظر قيد أدناه)
README.md                   (قسم المحرك وتشغيل الاختبارات)
```

**لا يُلمس في هذه الدفعة:** `app/[locale]/**` و`components/**` (لا واجهات جديدة) · تدفق ContentItem الحي · أي جدول قائم (لا حذف/لا تغيير أعمدة).

---

## 7 · API وCron (مع قيد حقيقي)

- `POST /api/pipeline/runs` إنشاء تشغيل (تحقق Zod + ملكية + سقف التكلفة) · `GET` قائمة/تفاصيل.
- `POST /api/pipeline/runs/:id/advance` تنفيذ الخطوة التالية (idempotent — آمن للتكرار).
- `POST /api/pipeline/runs/:id/decision` بوابة المرحلة 9 (قبول/تعديل/رفض + وسم السبب).
- `GET /api/cron/pipeline-tick` بمفتاح `CRON_SECRET` (موجود ✓): يلتقط الفحوص المستحقة (10د/2س/48س/7أيام) والجدولة — مصمم **Catch-up**: يعمل بنجاح حتى لو جاء متأخرًا.
- **قيد Vercel Hobby:** cron بدقائق متكررة مستحيل مجانًا → وثّقت الحل: إما Pro، أو منبّه خارجي مجاني (cron-job.org) يضرب الـtick بالمفتاح. المحرك نفسه لا يعتمد على دقة التوقيت.

---

## 8 · بوابات التحقق لكل دفعة (بند 5 من الدليل)

| دفعة | البوابات |
| --- | --- |
| P1 البيانات | `prisma validate` + `migrate dev` محلي + `tsc` + `lint` + بقاء البيانات (فحص عدّ الصفوف قبل/بعد) |
| P2 المحرك | `node:test` (fail-early، السقف المالي، القاضي المستقل، idempotency، المحاولات) + tsc + lint + `npm run build` |
| P3 المهارات | الأمثلة الذهبية في CI + اختبار التحميل الشرطي (faceless لا يحمّل أفاتار) + tsc/lint |
| P4 API/cron | اختبار دخان curl حقيقي (تشغيل تجريبي Code-Only يمر S1 ويعبر) + Semgrep/Gitleaks/Trivy + لقطات Playwright (إثبات «لا انحدار بصري» — لا يوجد UI جديد) |

---

## 9 · نموذج التهديد (الملخص التنفيذي)

- **الأصول**: توكنات OAuth للقناة · محتوى وتعليمات العميل · رصيد المزودين (مال) · قدرة النشر العلني.
- **أهم 6 إساءات وضماناتها**: SSRF عبر روابط المراجع → مدقق URL (https/منع شبكات خاصة/مهل) · Prompt Injection من التعليمات → مخرجات Zod مغلقة + قاضٍ مستقل + فحوص كود + لا Tool-Use من مخرجات النماذج · انفلات التكلفة → سقف مالي مسبق + cost_ledger لكل نداء + Tier-Fail-Early · تسرب التوكنات → تشفير AES-GCM القائم + لا تسجيل + audit_log · نشر مكرر → مفاتيح idempotency + CAS · وصول عبر المستأجرين → فحص ملكية على كل قراءة/كتابة.
- **خارج النطاق الآن**: مزودو الوسائط (أفاتار/فيديو) — هرّبتها لموجة 2 لأنها قرار ميزانية.

---

## 10 · المطلوب منك للموافقة

1. **أوافق على D1 (التطبيق التدريجي + تجميد المؤجل)** أم تريد البديل الحرفي B؟
2. **دبّل خطوات التنفيذ**: أوصي بـ P1→P2 ثم أعرض النتيجة قبل P3→P4 (أصغر خطوة قابلة للتراجع). أو «نفّذ الأربع متتالية».
3. **مفاتيح المزودين** (خزنة أو env): بلاها سيبقى مسار AI مفعّلًا بالبنية لكنه يفشل الرخيص `ProviderMissing` — متى تضع مفتاحين من عائلتين مختلفتين ليعمل القاضي المستقل حقيقةً؟
