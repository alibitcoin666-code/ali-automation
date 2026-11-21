# هزینه‌ها و سهمیه‌های رایگان

هدف: **هزینه‌ی صفر** در حجم کاری یک کانال (چند ویدیو در روز). ارقام زیر از صفحه‌های رسمی در نوامبر ۲۰۲۶ برداشته شده‌اند؛ پیش از هر تصمیم، صفحه‌ی اصلی را دوباره ببینید.

| سرویس | سهم رایگان | مصرف تقریبی هر ویدیوی ۶۰–۹۰ ثانیه |
|---|---|---|
| GitHub Actions | «استفاده از رانرهای استاندارد GitHub در مخزن‌های عمومی رایگان است» — [GitHub Docs](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions) | ۲۰–۴۰ دقیقه رانر (پیش‌نمایش + نهایی) |
| Gemini متن و TTS | ردیف رایگان برای gemini-3.8-flash، gemini-3.5-flash-lite، gemini-3.8-flash-tts و flash-lite-tts — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) | یک درخواست متن + ۷–۱۰ درخواست صدا؛ محدودیت تعداد درخواست ردیف رایگان در [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| Workers AI (flux-1-schnell) | ۱۰٬۰۰۰ نورون در روز — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) | هر تصویر ۱۰۲۴² با ۸ گام ≈ ۴ کاشی × ۴٫۸ + ۸ × ۹٫۶ ≈ ۹۶ نورون → ۷ تصویر ≈ ۶۷۰ نورون (≈ ۱۴ ویدیو در روز رایگان) |
| Durable Objects (SQLite) | پلن رایگان: ۵ GB برای کل حساب، ۱ GB برای هر شیء — [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/) | چند ده ردیف و چند فایل JSON کوچک |
| GitHub Releases | بدون هزینه برای مخزن عمومی؛ هر فایل حداکثر ۲ GB | ۱۵۰–۲۵۰ MB (نهایی + پیش‌نمایش + state)؛ cleanup هفتگی میانی‌ها را پاک می‌کند |
| Workers AI متن (gpt-oss-120b، فقط بدون کلید Gemini) | از همان ۱۰٬۰۰۰ نورون روزانه؛ ‎$0.35 برای هر میلیون توکن ورودی و ‎$0.75 برای هر میلیون توکن خروجی — [gpt-oss-120b](https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/) | ≈ ۴ هزار توکن برای هر متن، یعنی کمتر از ۰٫۳ سنت |
| Workers | پلن رایگان Workers — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | چند ده درخواست |
| edge-tts (پشتیبان) | رایگان، بدون کلید | فقط اگر Gemini TTS در دسترس نباشد |
| Remotion | رایگان برای فرد و تیم‌های کوچک — [Remotion license](https://www.remotion.dev/license) | — |

## اگر از سهم رایگان رد شوید
- Gemini TTS پولی (تا پایان ۲۰۲۶): حدود ‎$0.00225 برای هر ۱۰ ثانیه صدای flash-tts و ‎$0.0015 برای flash-lite-tts — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). یک ویدیوی ۹۰ ثانیه‌ای ≈ ۲ سنت.
- Workers AI: ‎$0.011 برای هر ۱۰۰۰ نورون بالاتر از سهم روزانه.
- کارخانه هیچ اقدام پولی را بدون اجازه‌ی شما فعال نمی‌کند. سقف روزانه‌ی `DAILY_CAP` و کلید `FACTORY_ENABLED` جلوی مصرف ناخواسته را می‌گیرد.
