export default {
  // وقتی کسی آدرس Worker را باز می‌کند یا وب‌هوکی صدا می‌زند
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, time: new Date().toISOString() });
    }

    return new Response("Worker is running ✅");
  },

  // وقتی زمان‌بند (cron) اجرا می‌شود
  async scheduled(event, env, ctx) {
    console.log("Cron ran at", new Date(event.scheduledTime).toISOString());
    // کار تکراری خودت را اینجا بنویس
  },
};
