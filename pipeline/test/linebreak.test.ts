import { describe, expect, it } from "vitest";
import { breakLines, visualLength } from "../src/core";

const w = (s: string) => s.split(" ");
describe("breakLines", () => {
  it("single short line", () => expect(breakLines(w("سلام دوستان عزیز")).lines).toHaveLength(1));
  it("two balanced lines under 42", () => {
    const r = breakLines(w("امروز می‌خواهیم با هم یاد بگیریم که چطور آکوردهای پایه را روی پیانو بنوازیم"));
    expect(r.lines).toHaveLength(2);
    expect(r.fits).toBe(true);
    for (const l of r.lines) expect(visualLength(l)).toBeLessThanOrEqual(42);
  });
  it("never splits number and unit", () => {
    const r = breakLines(w("هر روز فقط ۱۵ دقیقه تمرین کنید تا دست چپ شما قوی و آزاد و مستقل شود"));
    for (const l of r.lines) expect(l.startsWith("دقیقه")).toBe(false);
  });
  it("avoids line starting with Latin", () => {
    const r = breakLines(w("به کانال پیانوای ما خوش آمدید و حالا با Pianova همراه باشید"));
    expect(r.lines[1]!.startsWith("Pianova")).toBe(false);
  });
  it("does not split ZWNJ compounds", () => {
    const r = breakLines(w("ما امروز می‌خواهیم درباره‌ی مهم‌ترین تکنیک‌های دست چپ صحبت کنیم"));
    expect(r.lines.join(" ")).toContain("می‌خواهیم");
    expect(r.lines.join(" ")).toContain("مهم‌ترین");
  });
  it("prefers break after punctuation", () => {
    const r = breakLines(w("اول آرام شروع کنید، بعد سرعت را کم‌کم بالا ببرید"));
    expect(r.lines[0]!.endsWith("،")).toBe(true);
  });
  it("does not end line with و", () => {
    const r = breakLines(w("تمرین منظم و صبر و تمرکز سه کلید اصلی پیشرفت در نوازندگی هستند"));
    expect(r.lines[0]!.endsWith(" و")).toBe(false);
  });
  it("reports not fitting when too long", () => {
    const long = w("این یک جمله بسیار بسیار طولانی است که به هیچ وجه در دو خط چهل و دو حرفی جا نمی‌شود چون واقعا طولانی است و ادامه دارد");
    expect(breakLines(long).fits).toBe(false);
  });
  it("visualLength ignores ZWNJ", () => expect(visualLength("می‌خواهم")).toBe(7));
});
