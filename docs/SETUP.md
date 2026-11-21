# راه‌اندازی کارخانه‌ی موشن علی

این راهنما با کلیدهایی کار می‌کند که از قبل در مخزن `alibitcoin666-code/ali-automation` هستند. هیچ کلیدی را در چت، کد یا کامیت نگذارید؛ کلیدها فقط در **GitHub Secrets** و **Cloudflare secrets** نگه داشته می‌شوند.

## معماری (بدون D1 و R2)
- **Worker** با نام `ali-motion-factory` (ربات تلگرام + پنل وب + API) روی `https://ali-motion-factory.ali-bitcoin666.workers.dev`.
- **ذخیره‌سازی**: یک Durable Object با SQLite که روی پلن رایگان Workers در دسترس است: ۵ GB برای کل حساب و حداکثر ۸ MB برای هر BLOB ([محدودیت‌های Durable Objects](https://developers.cloudflare.com/durable-objects/platform/limits/)). این‌ها در آن نگه داشته می‌شوند: کارها، رویدادها، نشست‌ها، صف رندر و فایل‌های کوچک JSON.
- **رسانه‌ها** (MP4، M4A، تامبنیل بزرگ): به‌صورت Asset در یک Release پیش‌انتشار با تگ `job-<id>` در همین مخزن ذخیره می‌شوند. Worker آن‌ها را با پشتیبانی Range از طریق لینک امضاشده‌ی `/m/...` پخش می‌کند.
- **تصاویر flux و مدل متنی پشتیبان**: از طریق binding هوش مصنوعی خود Worker اجرا می‌شوند، پس Actions به توکن Workers AI نیازی ندارد.
- **شروع رندر**: Worker توکن GitHub ندارد. گردش‌کار `dispatcher.yml` هر ۵ دقیقه اجرا می‌شود و حدود ۴٫۵ دقیقه صف را بررسی می‌کند. هر مرحله‌ای را که در صف ببیند، با `GITHUB_TOKEN` همان اجرا در `render.yml` شروع می‌کند.

## اسرار لازم (Settings → Secrets and variables → Actions)
| نام | وضعیت | کاربرد |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | موجود | استقرار Worker. فقط دسترسی Workers Scripts: Edit لازم است |
| `CLOUDFLARE_ACCOUNT_ID` | موجود | شناسه‌ی حساب |
| `CALLBACK_SECRET` | ساخته شد (تصادفی) | امضای HMAC بین Actions و Worker. `SESSION_SECRET` و `TG_WEBHOOK_SECRET` از همین ساخته می‌شوند |
| `TELEGRAM_BOT_TOKEN` | **باید اضافه شود** | فعال شدن ربات. استقرار بعدی وب‌هوک و فهرست دستورها را خودکار تنظیم می‌کند |
| `TELEGRAM_OWNER_ID` | اختیاری | اگر خالی بماند، اولین `/start` خصوصی مالک ثبت می‌شود (فقط یک بار) |
| `GEMINI_API_KEY` | اختیاری | متن با Gemini و صدای Gemini TTS. بدون آن، متن با gpt-oss-120b روی Workers AI و صدا با edge-tts ساخته می‌شود |
| `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` / `GDRIVE_FOLDER_ID` | اختیاری | کپی نسخه‌ی نهایی در Google Drive |

## استقرار
با هر push به `main` که پوشه‌ی `worker/` یا بخش‌های مشترک را تغییر دهد، گردش‌کار `deploy.yml` اجرا می‌شود. می‌توانید آن را از تب Actions و با دکمه‌ی **Run workflow** هم اجرا کنید. این مراحل را انجام می‌دهد:
1. تست و typecheck
2. ساخت پنل
3. `wrangler deploy`
4. تنظیم اسرار Worker
5. وب‌هوک تلگرام (اگر توکن ربات باشد)
6. آزمون سلامت `/health`

## آزمون کامل ابری
در تب Actions، گردش‌کار **e2e** را با **Run workflow** اجرا کنید. این آزمون یک کار واقعی را از همان مسیر ربات می‌سازد: guard، سقف روزانه و صف. سپس متن و پیش‌نمایش را خودکار تأیید می‌کند و منتظر نسخه‌ی نهایی و نتیجه‌ی QA می‌ماند. فایل‌ها در Release با تگ `job-<id>` قرار می‌گیرند.

## نصب محلی
```bash
pnpm install
bash scripts/install-fonts.sh        # بررسی sha256 فونت‌های OFL و نصب TTF
pnpm --filter @amf/pipeline test     # تست‌های متن فارسی، زیرنویس و همگام‌سازی
pnpm --filter @amf/worker test       # تست‌های Worker و Durable Object
```

## قانون سخت
هیچ بخشی از این برنامه در یوتیوب آپلود نمی‌کند. کانال `youtube.com/@Alibaghbani1hand` در سه لایه مسدود است: Worker، مرحله‌ی guard در Actions و guard پایپ‌لاین.

## نکته‌ی حریم خصوصی
مخزن عمومی است، پس Releaseهای کارها هم برای هر کسی که لینک را داشته باشد قابل دیدن‌اند. برای فایل‌های تأییدنشده‌ی حساس، بعداً می‌توان R2 را فعال کرد. این کار در داشبورد Cloudflare انجام می‌شود و ممکن است ثبت روش پرداخت لازم باشد.
