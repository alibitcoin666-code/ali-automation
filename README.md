# ali-automation

شروع ساده: GitHub Actions + Cloudflare Workers

- هر بار که فایلی در شاخه main تغییر کند، GitHub به‌طور خودکار Worker را روی Cloudflare دیپلوی می‌کند.
- کد Worker در `src/index.js` است.
- دو Secret لازم است: `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID`
