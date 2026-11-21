# راه‌اندازی کارخانه‌ی موشن علی

این راهنما همه‌ی مراحل نصب را از صفر توضیح می‌دهد. هیچ کلیدی را در چت، کد یا کامیت نگذارید؛ کلیدها فقط در **GitHub Secrets** و **Cloudflare secrets** ذخیره می‌شوند.

## ۱. پیش‌نیازها
- Node.js ۲۲ و pnpm ۹ (`corepack enable`)
- حساب GitHub (مخزن عمومی؛ دقیقه‌های Actions برای مخزن عمومی رایگان است)
- حساب Cloudflare (پلن رایگان Workers، D1، R2، Workers AI)
- کلید Gemini API از Google AI Studio
- یک ربات تلگرام از @BotFather

## ۲. نصب محلی
```bash
pnpm install
bash scripts/install-fonts.sh        # بررسی sha256 فونت‌های OFL و نصب TTF
pnpm --filter @amf/pipeline test     # تست‌های متن فارسی، زیرنویس و همگام‌سازی
```

## ۳. منابع Cloudflare
```bash
cd worker
npx wrangler d1 create amf                     # شناسه را در wrangler.jsonc → database_id بگذارید
npx wrangler d1 migrations apply amf --remote
npx wrangler r2 bucket create amf-media
```
مقدارهای `vars` در `wrangler.jsonc`:
| متغیر | توضیح |
|---|---|
| `OWNER_ID` | شناسه‌ی عددی تلگرام شما (فقط همین کاربر به ربات دسترسی دارد) |
| `GITHUB_REPO` | مثلاً `username/ali-motion-factory` |
| `PUBLIC_URL` | آدرس Worker، مثلاً `https://ali-motion-factory.<subdomain>.workers.dev` |
| `DAILY_CAP` | سقف ویدیوی روزانه (پیش‌فرض ۶) |
| `FACTORY_ENABLED` | کلید خاموش/روشن کل کارخانه |

اسرار Worker (هر کدام با `npx wrangler secret put NAME`):
`BOT_TOKEN`، `TG_WEBHOOK_SECRET` (رشته‌ی تصادفی)، `GITHUB_TOKEN` (توکن fine-grained فقط با دسترسی Actions: write روی همین مخزن)، `CALLBACK_SECRET` (رشته‌ی تصادفی مشترک با Actions)، `SESSION_SECRET` (رشته‌ی تصادفی).

## ۴. اسرار GitHub Actions
Settings → Secrets and variables → Actions:
`GEMINI_API_KEY`، `CF_ACCOUNT_ID`، `CF_AI_TOKEN` (توکن با دسترسی Workers AI)، `R2_ACCESS_KEY_ID`، `R2_SECRET_ACCESS_KEY`، `R2_BUCKET` (=`amf-media`)، `CALLBACK_URL` (=`PUBLIC_URL/cb/github`)، `CALLBACK_SECRET`، و اختیاری برای Drive: `GDRIVE_CLIENT_ID`، `GDRIVE_CLIENT_SECRET`، `GDRIVE_REFRESH_TOKEN`، `GDRIVE_FOLDER_ID`.
متغیر (Variables): `FACTORY_ENABLED=true`.

## ۵. استقرار Worker و پنل
```bash
cd worker && pnpm deploy          # ساخت پنل وب + wrangler deploy
```

## ۶. وصل کردن وب‌هوک تلگرام
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url="$PUBLIC_URL/tg/webhook" -d secret_token="$TG_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message","callback_query"]'
```
Worker هر درخواستی را که هدر `X-Telegram-Bot-Api-Secret-Token` درست نداشته باشد رد می‌کند.

## ۷. آزمون
در تلگرام `/start` و سپس `/new` را بزنید. برای پنل وب، `/panel` لینک یک‌بارمصرف ۱۰ دقیقه‌ای می‌دهد.

## قانون سخت
هیچ بخشی از این برنامه به یوتیوب آپلود نمی‌کند. کانال `youtube.com/@Alibaghbani1hand` در سه لایه (Worker، مرحله‌ی guard در Actions، و guard پایپ‌لاین) مسدود است.
