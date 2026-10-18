/**
 * Shared deterministic fixtures for the pipeline tests.
 *
 *   makeResponder()  — one valid, consistent LLM answer per skill purpose
 *   makeFetchPage()  — a healthy public video page
 *   setupPipeline()  — MemoryStore + stubs + engine + injectable clock
 *
 * The stubs fake the MODEL / PROVIDER only: every stage, check, guard, store
 * operation and orchestration step exercised by the tests is production code.
 * Any skill purpose without a mapped answer throws, so a newly wired LLM call
 * can never silently pass the tests untested.
 */
import { StubLlm } from "@/src/pipeline/providers/stub-llm";
import { StubMedia } from "@/src/pipeline/providers/stub-media";
import { StubYouTube } from "@/src/pipeline/providers/stub-youtube";
import type { ChatJsonArgs, NotifyInput, PageSnapshot } from "@/src/pipeline/providers/types";
import type { ModelFamily } from "@/src/pipeline/config";
import type { RunRecord } from "@/src/pipeline/store";
import { MemoryStore } from "@/src/pipeline/memory-store";
import { PipelineEngine } from "@/src/pipeline/engine";

export const TEST_TITLE = "لماذا تسخن بطارية هاتفك وكيف تحميها من التلف";
export const TEST_CHANNEL_ID = "chan_test";

export const TEST_HOOKS = [
  "هاتفك بيسخن لما تشحنه؟ السبب مش اللي بتظنه.",
  "ثلاث عادات صغيرة بتقصر عمر بطارية هاتفك من غير ما تحس.",
  "لو بطاريتك بتنزل بسرعة، المقطع ده هيفرق معاك جداً.",
];

const RULES = [
  { id: "r1", text: "نبرة هادئة وواضحة بلا مبالغات", kind: "tone" as const, source: "instruction" as const, hard: false },
  { id: "r2", text: "فيديو عمودي قصير في حدود ثلاث دقائق", kind: "format" as const, source: "instruction" as const, hard: false },
  { id: "r3", text: "لغة عربية مبسطة مفهومة للمبتدئين", kind: "style" as const, source: "instruction" as const, hard: false },
];

const SENTENCE =
  "اليوم سنتحدث عن سبب سخونة بطارية الهاتف أثناء الشحن وكيف يمكنك حماية جهازك بخطوات بسيطة وعملية";

/** ~360 words, no placeholders, no duplicated paragraphs (pace 120 wpm at 3 min) */
export const TEST_SCRIPT = Array.from({ length: 15 }, (_, i) => `${SENTENCE} في الجزء رقم ${i + 1}.`).join(" ");

/** 8 scenes x 22.5s = 180s = the 3-minute target (S4 tolerance 25%) */
export const TEST_SCENES = Array.from({ length: 8 }, (_, i) => ({
  id: `s${i + 1}`,
  index: i,
  narration: `المشهد رقم ${i + 1}: نشرح هنا نقطة مهمة عن بطارية هاتفك بأسلوب مبسط وسريع.`,
  seconds: 22.5,
  shotType: (["broll", "text_card", "screen", "montage"] as const)[i % 4],
  visualPrompt: `مشهد بصري رقم ${i + 1}: لقطة مقربة لهاتف على مكتب بإضاءة نهارية واضحة وتفاصيل واقعية.`,
  mood: "هادئ",
  requiresAvatar: false,
}));

const IDEAS = [
  {
    title: TEST_TITLE,
    angle: "شرح علمي مبسط لأسباب سخونة البطارية أثناء الشحن مع خطوات وقاية عملية.",
    targetAudience: "مستخدمو الهواتف الذكية العاديون",
    whyNow: "سؤال متكرر مع ارتفاع درجات الحرارة",
    score: 92,
    reasons: ["طلب مرتفع", "قابل للتنفيذ فوراً"],
  },
  {
    title: "عادات الشحن التي تقصر عمر بطاريتك",
    angle: "رصد الأخطاء اليومية الشائعة في الشحن وكيفية تصحيحها خطوة بخطوة.",
    targetAudience: "الجمهور العام المهتم بالتقنية",
    whyNow: "سلوك يومي يحتاج تصحيحاً",
    score: 85,
    reasons: ["موضوع يومي"],
  },
  {
    title: "هل الشحن السريع يضر هاتفك فعلاً؟",
    angle: "تفكيك الشائعات حول الشحن السريع بالأدلة العملية والتجارب.",
    targetAudience: "مستخدمو الشواحن السريعة",
    whyNow: "جدل دائم بين المستخدمين",
    score: 84,
    reasons: ["فضول عالٍ"],
  },
  {
    title: "كيف تحافظ على بطارية هاتفك في السفر",
    angle: "خطوات عملية للشحن الآمن أثناء التنقل والسفر الطويل.",
    targetAudience: "المسافرون",
    whyNow: "موسم سفر",
    score: 78,
    reasons: ["جمهور محدد"],
  },
  {
    title: "أخطاء ترفع حرارة هاتفك في الصيف",
    angle: "ربط ارتفاع الحرارة بالعادات الصيفية وكيفية الوقاية منها.",
    targetAudience: "الجمهور العام",
    whyNow: "ارتفاع الحرارة موسمياً",
    score: 80,
    reasons: ["موسمي"],
  },
];

const TITLES = [
  { text: TEST_TITLE, style: "سؤال مباشر", reason: "يلمس مشكلة يومية يعرفها الجمهور" },
  { text: "سبب سخونة الهاتف الحقيقي وكيف تحمي بطاريتك", style: "شرح", reason: "وعد واضح بالفائدة" },
  { text: "ثلاث خطوات تمنع تلف بطارية هاتفك", style: "قائمة", reason: "قابل للتطبيق فوراً" },
];

export interface ResponderOptions {
  /** promise-match-judge fails and demands a fix in S7 (rewind-loop tests) */
  rejectPromise?: boolean;
}

export function makeResponder(opts: ResponderOptions = {}) {
  const verdictOk = (score: number) => ({ pass: true, score, reasons: ["متوافق مع المعايير"], fixes: [] });
  const verdictFix = {
    pass: false,
    score: 60,
    reasons: ["العنوان يوعد بما لا يقدمه الفيديو"],
    fixes: [{ text: "أعد صياغة العنوان ليطابق المضمون", stage: "S7" }],
  };

  const table: Record<string, () => unknown> = {
    "instructions-converter": () => ({ rules: RULES, notes: ["التعليمات العامة حُولت إلى قواعد قابلة للفحص"] }),
    "conflict-detector": () => ({ conflicts: [], cleaned: RULES, droppedDuplicates: 0 }),
    "competitor-analyzer": () => ({
      competitors: [],
      suggestions: [{ name: "قناة تبسيط التقنية", why: "أسلوب مبسط وأفكار قريبة من جمهورنا", searchQuery: "شرح تقنية مبسط" }],
    }),
    "audience-embedder": () => ({
      audience: {
        summary:
          "جمهور عربي يستخدم هواتف ذكية يومياً ويعاني من سرعة نفاد البطارية وسخونة الجهاز أثناء الشحن ويريد حلولاً عملية بسيطة.",
        markets: ["eg"],
        languages: ["ar"],
        pains: ["سخونة الهاتف", "نفاد سريع للبطارية"],
        desires: ["بطارية تدوم أطول", "شحن آمن"],
      },
    }),
    "trend-scout": () => ({
      trends: [
        { topic: "سخونة الهواتف أثناء الشحن", why: "أسئلة متكررة في التعليقات", momentum: "rising" },
        { topic: "إطالة عمر البطارية", why: "اهتمام مستمر بمشكلة يومية", momentum: "steady" },
        { topic: "عادات الشحن الخاطئة", why: "محتوى قابل للتطبيق فوراً", momentum: "rising" },
      ],
    }),
    "idea-scorer": () => ({
      ideas: IDEAS,
      recommendation: { title: IDEAS[0].title, why: "أعلى توازن بين الطلب وسهولة التنفيذ مع جمهور عريض." },
    }),
    "series-planner": () => ({
      seriesName: "بطارية بلا صداع",
      nextEpisodes: ["الشواحن السريعة: متى تضر بطاريتك؟", "هل الشحن ليلاً يضر الهاتف؟"],
    }),
    "hook-writer": () => ({ hooks: TEST_HOOKS }),
    "niche-writer": () => ({ script: TEST_SCRIPT }),
    "dialect-polisher": () => ({ script: TEST_SCRIPT, changes: ["تخفيف الفصحى إلى لغة يومية"] }),
    "retention-structurer": () => ({
      structure: [
        { name: "خطاف", seconds: 15 },
        { name: "السبب العلمي", seconds: 60 },
        { name: "خطوات الوقاية", seconds: 75 },
        { name: "الخلاصة والدعوة", seconds: 30 },
      ],
    }),
    "claims-extractor": () => ({ claims: [] }),
    "claims-verifier": () => ({ verdicts: [], judgeFamily: "openai", judgeModel: "stub-openai" }),
    "scene-director": () => ({
      scenes: TEST_SCENES,
      onScreenText: ["بطارية أطول", "خطوات عملية", "لا تفوت الخلاصة"],
    }),
    "voice-director": () => ({ voice: { style: "سرد عربي هادئ وواثق", rateWpm: 140, emphasisNotes: ["شد على الأرقام"] } }),
    "scene-prompt-engineer": () => ({
      items: TEST_SCENES.map((s) => ({
        sceneId: s.id,
        prompt: `مشهد واقعي رقم ${s.index + 1} لبطارية هاتف وملحقاتها بإضاءة نهارية وتفاصيل عالية الدقة.`,
      })),
    }),
    "pace-doctor": () => ({ verdict: "ok", suggestions: [], notes: "الإيقاع متوازن على مدى الفيديو" }),
    "title-lab": () => ({ titles: TITLES }),
    "thumbnail-copywriter": () => ({
      concepts: [
        {
          overlayText: "سبب مفاجئ",
          concept: "لقطة مقربة لهاتف ساخن مع رمز حرارة أحمر وأيقونة بطارية منخفضة.",
          prompt: "هاتف على طاولة خشبية مع رمز حرارة متوهج وإضاءة درامية خفيفة.",
        },
        {
          overlayText: "توقف عن هذا",
          concept: "يد تلمس هاتفاً متصلاً بشاحن مع علامة خطأ حمراء واضحة.",
          prompt: "مشهد عمودي ليد تلمس هاتف أثناء الشحن مع علامة تحذير حمراء.",
        },
      ],
    }),
    "design-describer": () => ({
      artNotes: "ألوان دافئة تعكس الحرارة مع تباين عالٍ ونصوص عربية كبيرة وواضحة.",
      palette: ["#F97316", "#0F172A"],
      layout: "عنصر رئيسي في المنتصف والنص في الأعلى",
    }),
    "seo-writer": () => ({
      description:
        "في هذا الفيديو نشرح بالتفصيل أسباب سخونة بطارية الهاتف أثناء الشحن، وما العادات اليومية التي تسببها، وخطوات عملية واضحة لتحمي جهازك وتطيل عمر البطارية من غير تكاليف إضافية.",
      tags: ["بطارية الهاتف", "سخونة الهاتف", "نصائح شحن", "تقنية مبسطة"],
    }),
    "sensitive-topics-guard": () => verdictOk(92),
    "promise-match-judge": () => (opts.rejectPromise ? verdictFix : verdictOk(90)),
    "originality-judge": () => verdictOk(88),
    "lesson-extractor": () => ({
      lessons: [
        {
          lesson: "المقاطع التي تعطي خطوات عملية مرقمة ترفع نسبة الإكمال في نيش التقنية.",
          evidenceText: "اكتملت الرحلة عبر كل البوابات مع درجات QA مرتفعة.",
          confidence: 3,
        },
      ],
    }),
  };

  return (args: ChatJsonArgs): unknown => {
    const fn = table[args.purpose];
    if (!fn) throw new Error(`stub-responder: no answer mapped for purpose "${args.purpose}"`);
    return structuredClone(fn());
  };
}

export function makeFetchPage(): (url: string) => Promise<PageSnapshot> {
  return async (url) => ({
    httpStatus: 200,
    contentType: "text/html",
    bodyText:
      `<html><head><title>${TEST_TITLE}</title></head><body><h1>${TEST_TITLE}</h1>` +
      `<p>صفحة الفيديو العامة تعمل بشكل طبيعي. ${url}</p>` +
      `<p>${"محتوى الصفحة ".repeat(30)}</p></body></html>`,
  });
}

export function seedTestChannel(store: MemoryStore): void {
  store.seedChannel({
    id: TEST_CHANNEL_ID,
    userId: "user_test",
    title: "قناة تجريبية",
    niche: "tech",
    markets: ["eg"],
    tone: "هادئ",
    requiresAvatar: false,
    avatarImageBytes: null,
    avatarImageBuffer: null,
    avatarImageMime: null,
    referenceChannelUrl: null,
    referenceVideoUrl: null,
    hasAccessToken: true,
    tokenExpired: false,
    customInstructions: "قدم محتوى تقنياً مبسطاً وموثوقاً",
  });
}

export interface Clock {
  now(): Date;
  advanceMs(ms: number): void;
  set(iso: string): void;
}

export interface SetupOptions {
  families?: ModelFamily[];
  mediaConfigured?: boolean;
  rejectPromise?: boolean;
}

export interface EngineOptions {
  families?: ModelFamily[];
  rejectPromise?: boolean;
  llmInTokens?: number;
  media?: StubMedia;
}

export function setupPipeline(opts: SetupOptions = {}) {
  const store = new MemoryStore();
  seedTestChannel(store);

  let clockMs = Date.parse("2026-01-05T10:00:00Z");
  const clock: Clock = {
    now: () => new Date(clockMs),
    advanceMs: (ms) => {
      clockMs += ms;
    },
    set: (iso) => {
      clockMs = Date.parse(iso);
    },
  };

  const media = new StubMedia({
    configured: opts.mediaConfigured ?? true,
    costCentsPerAsset: 1,
    filePathPrefix: "/tmp/opencode/oum-stub-tests",
  });
  const youtube = new StubYouTube({ now: clock.now });
  const notifications: NotifyInput[] = [];
  const llms: StubLlm[] = [];

  const makeEngine = (engineOpts: EngineOptions = {}): PipelineEngine => {
    const llm = new StubLlm({
      families: engineOpts.families ?? opts.families ?? ["deepseek", "openai"],
      respond: makeResponder({ rejectPromise: engineOpts.rejectPromise ?? opts.rejectPromise }),
      inTokens: engineOpts.llmInTokens,
    });
    llms.push(llm);
    return new PipelineEngine({
      store,
      llm,
      media: engineOpts.media ?? media,
      youtube,
      notify: async (n) => {
        notifications.push(n);
      },
      fetchPage: makeFetchPage(),
      now: clock.now,
    });
  };

  const engine = makeEngine();

  const createRun = (capCents = 1500): Promise<RunRecord> =>
    store.createRun({
      userId: "user_test",
      channelId: TEST_CHANNEL_ID,
      path: "FACELESS",
      mode: "COPILOT",
      costCapCents: capCents,
      locale: "ar-EG",
      nicheKey: "tech",
    });

  return { store, media, youtube, notifications, llms, clock, engine, makeEngine, createRun };
}

export type Harness = ReturnType<typeof setupPipeline>;
