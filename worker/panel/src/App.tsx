import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import type { RenderPlan, Storyboard, Caption } from "@amf/pipeline/core";
import { DEMO, AuthError, loadJobs, loadJob, loadMe, loadFileJson, createJob, jobAction, type JobDetail, type JobRow, type Me } from "./data";

const PlayerView = lazy(() => import("./PlayerView"));

const fa = (s: string | number) => String(s).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
const CH: Record<string, string> = { pianova: "پیانووا", musicradio69: "موزیک رادیو ۶۹", onehandonedream: "یک دست، یک رؤیا", neutral: "خنثی" };
const TY: Record<string, string> = { EDUCATIONAL: "آموزشی", PROMO: "تبلیغاتی", NEWS: "خبری" };
const FO: Record<string, string> = { landscape_16x9: "۱۶:۹", shorts_9x16: "۹:۱۶" };
const ST: Record<string, string> = {
  queued: "در صف", scripting: "نوشتن متن", script_review: "منتظر تأیید متن", preview_rendering: "ساخت پیش‌نمایش",
  preview_review: "منتظر تأیید پیش‌نمایش", final_rendering: "رندر نهایی", qa: "کنترل کیفیت", delivered: "تحویل شد",
  rejected: "رد شد", failed: "خطا", cancelled: "لغو شد",
};
const tone = (s: string) => (s === "delivered" ? "ok" : s === "failed" || s === "rejected" ? "bad" : s.endsWith("review") ? "wait" : s === "cancelled" ? "mute" : "run");
const time = (ms: number) => {
  const s = ms / 1000;
  return `${fa(Math.floor(s / 60))}:${fa(String(Math.floor(s % 60)).padStart(2, "0"))}.${fa(String(Math.floor(ms % 1000)).padStart(3, "0"))}`;
};
const date = (t: number) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(t));

interface QaReport { pass: boolean; failures: string[]; warnings: string[]; checks: Record<string, unknown> }

type Tab = "live" | "video" | "script" | "subs" | "qa" | "files" | "log";
const TABS: [Tab, string][] = [["live", "پیش‌نمایش زنده"], ["video", "ویدیوی رندرشده"], ["script", "متن"], ["subs", "زیرنویس"], ["qa", "کنترل کیفیت"], ["files", "خروجی‌ها"], ["log", "رویدادها"]];

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [auth, setAuth] = useState<"ok" | "need" | "loading">("loading");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<"job" | "new">("job");
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, js] = await Promise.all([loadMe(), loadJobs()]);
      setMe(m);
      setJobs(js);
      setAuth("ok");
      setSel((s) => s ?? js[0]?.id ?? null);
    } catch (e) {
      if (e instanceof AuthError) setAuth("need");
      else setErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    if (DEMO) return;
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  if (auth === "need")
    return (
      <div className="center">
        <div className="card login">
          <h1>کارخانه‌ی موشن علی</h1>
          <p>برای ورود، در ربات تلگرام دستور <code>/panel</code> را بفرستید و لینک یک‌بارمصرف را باز کنید.</p>
        </div>
      </div>
    );

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="mark" aria-hidden>◆</span>
          <div>
            <div className="brand-name">کارخانه‌ی موشن علی</div>
            <div className="brand-sub">{DEMO ? "نسخه‌ی نمایشی" : "پنل مالک"}</div>
          </div>
        </div>
        <button className="btn btn--gold wide" onClick={() => setView("new")}>+ ویدیوی تازه</button>
        {me && (
          <div className="quota">
            <span>سهمیه‌ی امروز</span>
            <b>{fa(me.today)} / {fa(me.cap)}</b>
            <span className={me.enabled ? "dot dot--ok" : "dot dot--bad"}>{me.enabled ? "روشن" : "خاموش"}</span>
          </div>
        )}
        <nav className="jobs" aria-label="کارها">
          {auth === "loading" && [0, 1, 2].map((i) => <div key={i} className="job skel" />)}
          {jobs.map((j) => (
            <button key={j.id} className={`job ${sel === j.id && view === "job" ? "job--on" : ""}`} onClick={() => (setSel(j.id), setView("job"))}>
              <div className="job-top">
                <span className={`pill pill--${j.channel}`}>{CH[j.channel]}</span>
                <span className={`st st--${tone(j.status)}`}>{ST[j.status] ?? j.status}</span>
              </div>
              <div className="job-topic">{j.topic}</div>
              <div className="job-meta">{TY[j.type]} · {FO[j.format]} · <bdi>{j.id}</bdi></div>
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {err && <div className="banner banner--bad">{err}</div>}
        {DEMO && <div className="banner">نسخه‌ی نمایشی با پنج نمونه‌ی واقعی تولیدشده در کارخانه. ساخت و تأیید فقط در پنل اصلی (Worker) فعال است.</div>}
        {view === "new" ? <NewJob onDone={(id) => (void refresh(), setSel(id), setView("job"))} /> : sel ? <JobView id={sel} onChange={refresh} /> : <div className="empty">کاری انتخاب نشده است.</div>}
      </main>
    </div>
  );
}

function JobView({ id, onChange }: { id: string; onChange: () => void }) {
  const [d, setD] = useState<JobDetail | null>(null);
  const [plan, setPlan] = useState<RenderPlan | null>(null);
  const [sb, setSb] = useState<Storyboard | null>(null);
  const [qa, setQa] = useState<QaReport | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setD(null), setPlan(null), setSb(null), setQa(null), setMsg(null);
    (async () => {
      const det = await loadJob(id);
      if (!live) return;
      setD(det);
      const [p, s, q] = await Promise.all([
        loadFileJson<RenderPlan>(det.files["render/plan-final.json"] ?? det.files["render/plan-preview.json"]),
        loadFileJson<Storyboard>(det.files["storyboard.json"]),
        loadFileJson<QaReport>(det.files["qa/report.json"]),
      ]);
      if (!live) return;
      setPlan(p), setSb(s), setQa(q);
      if (!p) setTab("script");
    })().catch((e) => setMsg((e as Error).message));
    return () => void (live = false);
  }, [id]);

  const act = async (a: "approve" | "reject" | "cancel" | "edit") => {
    setBusy(true);
    try {
      const r = await jobAction(id, a, a === "edit" ? { note } : {});
      setMsg(r.message ?? "انجام شد");
      setNote("");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <div className="card skel-block" />;
  const j = d.job;
  const review = j.status === "script_review" || j.status === "preview_review";
  const video = d.files["out/final.mp4"] ?? d.files["out/preview-720p.mp4"];
  return (
    <div className="job-view">
      <header className="jv-head">
        <div>
          <div className="jv-kicker">
            <span className={`pill pill--${j.channel}`}>{CH[j.channel]}</span> {TY[j.type]} · {FO[j.format]} · <bdi>{j.id}</bdi>
          </div>
          <h1 className="jv-title">{sb?.title ?? j.topic}</h1>
          <div className="jv-sub">
            <span className={`st st--${tone(j.status)}`}>{ST[j.status] ?? j.status}</span> · به‌روز: {date(j.updated_at)}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn--gold" disabled={!review || busy || DEMO} onClick={() => act("approve")}>تأیید</button>
          <button className="btn" disabled={!review || busy || DEMO} onClick={() => act("reject")}>رد</button>
          <button className="btn btn--ghost" disabled={busy || DEMO || ["delivered", "rejected", "cancelled", "failed"].includes(j.status)} onClick={() => act("cancel")}>لغو</button>
        </div>
      </header>
      {review && !DEMO && (
        <div className="edit-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت اصلاح؛ مثلاً «قدم دوم کوتاه‌تر شود»" aria-label="یادداشت اصلاح" />
          <button className="btn" disabled={!note.trim() || busy} onClick={() => act("edit")}>ارسال اصلاح</button>
        </div>
      )}
      {msg && <div className="banner">{msg}</div>}
      {j.error && <div className="banner banner--bad">{j.error}</div>}

      <div className="tabs" role="tablist">
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "tab tab--on" : "tab"} onClick={() => setTab(t)}>
            {l}
            {t === "qa" && qa && <span className={qa.pass ? "tick tick--ok" : "tick tick--bad"}>{qa.pass ? "✓" : "✗"}</span>}
          </button>
        ))}
      </div>

      <section className="panel-body">
        {tab === "live" &&
          (plan ? (
            <Suspense fallback={<div className="card skel-block" />}>
              <PlayerView plan={plan} audio={d.files["audio/final.m4a"]} />
              <p className="hint">این پیش‌نمایش با همان کامپوزیشن رندر نهایی، در مرورگر ساخته می‌شود. کیفیت مرجع، ویدیوی رندرشده است.</p>
            </Suspense>
          ) : (
            <div className="empty">برنامه‌ی رندر هنوز ساخته نشده است.</div>
          ))}
        {tab === "video" &&
          (video ? (
            <div className={j.format === "shorts_9x16" ? "player player--v" : "player"}>
              <video src={video} controls playsInline preload="metadata" style={{ width: "100%", borderRadius: 10, background: "#000" }} />
            </div>
          ) : (
            <div className="empty">هنوز ویدیویی رندر نشده است.</div>
          ))}
        {tab === "script" && sb && <ScriptView sb={sb} />}
        {tab === "subs" && plan && <SubsView caps={plan.captions} />}
        {tab === "qa" && (qa ? <QaView qa={qa} proof={d.files["qa/proof-sheet.png"]} /> : <div className="empty">گزارش کنترل کیفیت هنوز آماده نیست.</div>)}
        {tab === "files" && <FilesView files={d.files} />}
        {tab === "log" && (
          <ol className="log">
            {d.events.map((e, i) => (
              <li key={i}>
                <time>{date(e.at)}</time> <b>{e.stage}</b> <span className={`st st--${tone(e.status === "ok" ? "delivered" : e.status)}`}>{ST[e.status] ?? e.status}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ScriptView({ sb }: { sb: Storyboard }) {
  return (
    <div className="scenes">
      {sb.scenes.map((s, i) => (
        <article key={s.id} className="scene">
          <div className="scene-n">{fa(i + 1)}</div>
          <div>
            <div className="scene-type">{s.sceneType} · {s.style}</div>
            <p className="scene-voice">{s.voiceText}</p>
            {s.onScreenText.length > 0 && <div className="scene-ost">روی تصویر: {s.onScreenText.join(" | ")}</div>}
            {s.sources.length > 0 && (
              <div className="scene-src">
                منبع: {s.sources.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer"><bdi>{x.label}</bdi></a>)}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function SubsView({ caps }: { caps: Caption[] }) {
  const shown = caps.filter((c) => !c.hidden);
  const stats = useMemo(() => {
    const d = shown.map((c) => c.endMs - c.startMs);
    return { n: shown.length, min: Math.min(...d), max: Math.max(...d) };
  }, [shown]);
  return (
    <>
      <div className="stats">
        <div><b>{fa(stats.n)}</b><span>صفحه</span></div>
        <div><b>{fa((stats.min / 1000).toFixed(2))}</b><span>کمترین مدت (ثانیه)</span></div>
        <div><b>{fa((stats.max / 1000).toFixed(2))}</b><span>بیشترین مدت (ثانیه)</span></div>
      </div>
      <table className="subs">
        <thead><tr><th>#</th><th>شروع</th><th>پایان</th><th>متن</th></tr></thead>
        <tbody>
          {shown.map((c, i) => (
            <tr key={c.pageIndex}>
              <td>{fa(i + 1)}</td>
              <td className="num">{time(c.startMs)}</td>
              <td className="num">{time(c.endMs)}</td>
              <td>{c.lines.map((l, k) => <div key={k}>{l}</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function QaView({ qa, proof }: { qa: QaReport; proof?: string }) {
  return (
    <div className="qa">
      <div className={qa.pass ? "qa-head qa-head--ok" : "qa-head qa-head--bad"}>{qa.pass ? "همه‌ی بررسی‌ها قبول شد" : `${fa(qa.failures.length)} مورد رد شد`}</div>
      {qa.failures.length > 0 && <ul className="qa-list bad">{qa.failures.map((f) => <li key={f}><bdi>{f}</bdi></li>)}</ul>}
      {qa.warnings.length > 0 && <ul className="qa-list warn">{qa.warnings.map((f) => <li key={f}><bdi>{f}</bdi></li>)}</ul>}
      <details>
        <summary>جزئیات فنی</summary>
        <pre dir="ltr">{JSON.stringify(qa.checks, null, 2)}</pre>
      </details>
      {proof && <img className="proof" src={proof} alt="برگه‌ی اثبات زیرنویس" />}
    </div>
  );
}

const FILE_LABELS: [RegExp, string][] = [
  [/^out\/final\.mp4$/, "ویدیوی نهایی ۱۰۸۰p"], [/^out\/final-4k\.mp4$/, "ویدیوی نهایی 4K"], [/^out\/preview-720p\.mp4$/, "پیش‌نمایش ۷۲۰p"],
  [/thumb-1280x720/, "تامبنیل ۱۲۸۰×۷۲۰"], [/thumb-1080x1920/, "تامبنیل ۱۰۸۰×۱۹۲۰"], [/\.fa\.srt$/, "زیرنویس فارسی SRT"],
  [/\.youtube\.txt$/, "عنوان، توضیحات و هشتگ‌ها"], [/chapters\.txt$/, "فصل‌های یوتیوب"], [/^qa\/report\.json$/, "گزارش کنترل کیفیت"],
  [/proof-sheet/, "برگه‌ی اثبات زیرنویس"], [/^storyboard\.json$/, "استوری‌بورد"],
];
function FilesView({ files }: { files: Record<string, string> }) {
  const rows = Object.keys(files)
    .map((k) => [k, FILE_LABELS.find(([re]) => re.test(k))?.[1]] as const)
    .filter((r): r is readonly [string, string] => !!r[1]);
  return (
    <ul className="files">
      {rows.map(([k, label]) => (
        <li key={k}><a href={files[k]} target="_blank" rel="noreferrer" download>{label}</a><code dir="ltr">{k.split("/").pop()}</code></li>
      ))}
    </ul>
  );
}

function NewJob({ onDone }: { onDone: (id: string) => void }) {
  const [f, setF] = useState({ channel: "pianova", type: "EDUCATIONAL", format: "landscape_16x9", durationSec: 60, topic: "", points: "", sources: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: k === "durationSec" ? Number(e.target.value) : e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const urls = f.sources.split(/\s+/).filter((u) => /^https?:\/\//.test(u));
      const r = await createJob({
        channel: f.channel, type: f.type, format: f.format, durationSec: f.durationSec, topic: f.topic.trim(),
        points: f.points.split("\n").map((s) => s.trim()).filter(Boolean),
        sources: urls.map((u) => ({ label: new URL(u).hostname, url: u })),
        fps: f.channel === "musicradio69" ? 60 : 30,
      });
      if (r.ok && r.id) onDone(r.id);
      else setMsg(r.reason ?? "خطا");
    } catch (e2) {
      setMsg((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h1 className="jv-title">ویدیوی تازه</h1>
      <div className="grid">
        <label>کانال<select value={f.channel} onChange={set("channel")}>{Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>نوع<select value={f.type} onChange={set("type")}>{Object.entries(TY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>قالب<select value={f.format} onChange={set("format")}><option value="landscape_16x9">افقی ۱۶:۹</option><option value="shorts_9x16">شورتز ۹:۱۶</option></select></label>
        <label>مدت (ثانیه)<input type="number" min={15} max={180} value={f.durationSec} onChange={set("durationSec")} /></label>
      </div>
      <label>موضوع<input required minLength={3} value={f.topic} onChange={set("topic")} placeholder="مثلاً: آموزش آکورد مینور برای مبتدی‌ها" /></label>
      <label>نکته‌های کلیدی (هر خط یک نکته)<textarea rows={4} value={f.points} onChange={set("points")} /></label>
      <label>لینک منابع (برای خبر الزامی)<textarea rows={2} dir="ltr" value={f.sources} onChange={set("sources")} placeholder="https://…" /></label>
      {msg && <div className="banner banner--bad">{msg}</div>}
      <div className="actions">
        <button className="btn btn--gold" disabled={busy || DEMO}>{busy ? "در حال ثبت…" : "ساخت متن"}</button>
        {DEMO && <span className="hint">در نسخه‌ی نمایشی غیرفعال است.</span>}
      </div>
    </form>
  );
}
