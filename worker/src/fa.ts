/** Persian UI strings for the bot and panel. Persian digits everywhere the user reads numbers. */

export const faDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

export const CHANNEL_FA: Record<string, string> = {
  pianova: "پیانووا",
  musicradio69: "موزیک رادیو ۶۹",
  onehandonedream: "یک دست، یک رؤیا",
  neutral: "خنثی (بدون برند)",
};

export const TYPE_FA: Record<string, string> = {
  EDUCATIONAL: "آموزشی",
  PROMO: "تبلیغاتی",
  NEWS: "خبری",
};

export const FORMAT_FA: Record<string, string> = {
  landscape_16x9: "افقی ۱۶:۹",
  shorts_9x16: "شورتز ۹:۱۶",
};

export const STYLE_FA: Record<string, string> = {
  cinematicLuxury: "سینمایی لوکس",
  kineticTypography: "تایپوگرافی جنبشی",
  flat2dExplainer: "توضیحی دوبعدی",
  isometric25d: "ایزومتریک",
  parallaxDepth: "عمق پارالاکس",
  liquidGlass: "شیشه‌ی مایع",
  neonGlow: "نئون",
  dataViz: "نمودار و داده",
  broadcastNews: "خبری تلویزیونی",
  paperCollage: "کلاژ کاغذی",
  minimalSwiss: "مینیمال سوئیسی",
  audioReactive: "واکنش به صدا",
  motionTrails: "رد حرکت",
  lightLeakFilm: "فیلم و نشت نور",
  hero3d: "سه‌بعدی",
  noiseFields: "میدان نویز",
};

export const STATUS_FA: Record<string, string> = {
  queued: "در صف",
  scripting: "در حال نوشتن متن",
  script_review: "منتظر تأیید متن",
  preview_rendering: "در حال ساخت پیش‌نمایش",
  preview_review: "منتظر تأیید پیش‌نمایش",
  final_rendering: "در حال رندر نهایی",
  qa: "کنترل کیفیت",
  delivered: "تحویل شد",
  rejected: "رد شد",
  failed: "خطا",
  cancelled: "لغو شد",
};

export const T = {
  notOwner: "این ربات خصوصی است.",
  killSwitch: "کارخانه موقتاً خاموش است (FACTORY_ENABLED).",
  start:
    "سلام. اینجا «کارخانه‌ی موشن علی» است.\n\n" +
    "/new ساخت ویدیوی تازه\n/status وضعیت آخرین کار\n/jobs فهرست کارها\n/cancel لغو کار جاری\n/quota سهمیه‌ی امروز\n/templates قالب‌ها و سبک‌ها\n/panel ورود به پنل وب",
  pickChannel: "کانال را انتخاب کنید:",
  pickType: "نوع ویدیو؟",
  pickFormat: "قالب تصویر؟",
  pickLength: "مدت تقریبی؟",
  askTopic: "موضوع را در یک یا دو جمله بنویسید. (برای خبر، در خطهای بعدی لینک منابع را بگذارید.)",
  newsNeedsSources: "برای ویدیوی خبری دست‌کم یک لینک منبع لازم است. موضوع و لینک‌ها را دوباره بفرستید.",
  quotaFull: (n: number) => `سهمیه‌ی امروز (${faDigits(n)} ویدیو) پر شده است. فردا دوباره امتحان کنید.`,
  queued: (id: string) => `کار ${id} ساخته شد. متن ویدیو در حال نوشتن است…`,
  noJobs: "هنوز کاری ثبت نشده است.",
  cancelled: (id: string) => `کار ${id} لغو شد.`,
  nothingToCancel: "کار فعالی برای لغو نیست.",
  askEdit: "یادداشت اصلاحی را بفرستید (مثلاً «قدم دوم کوتاه‌تر شود»).",
  editQueued: "یادداشت ثبت شد؛ متن دوباره نوشته می‌شود.",
  approvedScript: "متن تأیید شد. صدا، زیرنویس و پیش‌نمایش ۷۲۰p در حال ساخت است…",
  approvedPreview: "پیش‌نمایش تأیید شد. رندر نهایی و کنترل کیفیت شروع شد…",
  rejected: "کار رد شد و متوقف شد.",
  panelLink: "لینک ورود به پنل (یک‌بارمصرف، ۱۰ دقیقه):",
  guardFailed: (r: string) => `درخواست رد شد: ${r}`,
  unknown: "دستور را نشناختم. /start را بزنید.",
  btnApprove: "✔ تأیید",
  btnEdit: "✎ اصلاح",
  btnReject: "✖ رد",
};
