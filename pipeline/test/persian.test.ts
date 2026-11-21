import { describe, expect, it } from "vitest";
import {
  normalizePersian, normalizeChars, fixZwnj, fixPunctuation, toPersianDigits, screenDigits,
  bidiForSubtitleFile, startsWithLatin, hasForbiddenCodepoints, ZWNJ, numberToPersianWords, spokenForm,
} from "../src/core";

const Z = ZWNJ;
describe("normalizeChars", () => {
  it("maps Arabic yeh/kaf to Persian", () => expect(normalizeChars("كتاب علي")).toBe("کتاب علی"));
  it("maps alef maksura", () => expect(normalizeChars("موسيقى")).toBe("موسیقی"));
  it("removes kashida", () => expect(normalizeChars("ســلام")).toBe("سلام"));
  it("maps Arabic-Indic digits", () => expect(normalizeChars("٢٠٢٦")).toBe("۲۰۲۶"));
  it("collapses double spaces", () => expect(normalizeChars("سلام   دنیا")).toBe("سلام دنیا"));
  it("drops ZWNJ next to spaces", () => expect(normalizeChars(`کتاب${Z} و`)).toBe("کتاب و"));
  it("collapses repeated ZWNJ", () => expect(normalizeChars(`می${Z}${Z}روم`)).toBe(`می${Z}روم`));
  it("strips pasted bidi marks", () => expect(normalizeChars("\u200Fسلام\u200E")).toBe("سلام"));
  it("trims", () => expect(normalizeChars("  سلام ")).toBe("سلام"));
  it("tabs to spaces", () => expect(normalizeChars("سلام\tدنیا")).toBe("سلام دنیا"));
});

describe("fixZwnj", () => {
  it("می + space", () => expect(fixZwnj("می خواهیم")).toBe(`می${Z}خواهیم`));
  it("نمی + space", () => expect(fixZwnj("نمی دانم")).toBe(`نمی${Z}دانم`));
  it("glued می", () => expect(fixZwnj("میخواهیم")).toBe(`می${Z}خواهیم`));
  it("glued نمی", () => expect(fixZwnj("نمیتوانم")).toBe(`نمی${Z}توانم`));
  it("does not touch میدان", () => expect(fixZwnj("میدان آزادی")).toBe("میدان آزادی"));
  it("does not touch میز", () => expect(fixZwnj("میز چوبی")).toBe("میز چوبی"));
  it("does not touch میوه", () => expect(fixZwnj("میوه")).toBe("میوه"));
  it("ها suffix", () => expect(fixZwnj("کتاب ها")).toBe(`کتاب${Z}ها`));
  it("های suffix", () => expect(fixZwnj("نت های پیانو")).toBe(`نت${Z}های پیانو`));
  it("ترین suffix", () => expect(fixZwnj("بهترین و زیبا ترین")).toBe(`بهترین و زیبا${Z}ترین`));
  it("تر suffix", () => expect(fixZwnj("سریع تر")).toBe(`سریع${Z}تر`));
  it("ه + ام", () => expect(fixZwnj("خسته ام")).toBe(`خسته${Z}ام`));
  it("ه + ای", () => expect(fixZwnj("نغمه ای")).toBe(`نغمه${Z}ای`));
  it("keeps existing ZWNJ", () => expect(fixZwnj(`می${Z}نوازیم`)).toBe(`می${Z}نوازیم`));
  it("does not glue standalone words starting with ها", () => expect(fixZwnj("او هادی است")).toBe("او هادی است"));
  it("prefix after guillemet", () => expect(fixZwnj("«می خواهم»")).toBe(`«می${Z}خواهم»`));
  it("multiple in one sentence", () =>
    expect(fixZwnj("ما می خواهیم آکورد ها را یاد بگیریم")).toBe(`ما می${Z}خواهیم آکورد${Z}ها را یاد بگیریم`));
  it("idempotent", () => {
    const once = fixZwnj("می خواهیم کتاب ها");
    expect(fixZwnj(once)).toBe(once);
  });
});

describe("fixPunctuation", () => {
  it("question mark", () => expect(fixPunctuation("چرا?")).toBe("چرا؟"));
  it("comma", () => expect(fixPunctuation("سلام, دنیا")).toBe("سلام، دنیا"));
  it("semicolon", () => expect(fixPunctuation("اول; دوم")).toBe("اول؛ دوم"));
  it("quotes to guillemets", () => expect(fixPunctuation('او گفت "سلام"')).toBe("او گفت «سلام»"));
  it("keeps Latin quotes", () => expect(fixPunctuation('"Hello"')).toBe('"Hello"'));
  it("no space before punctuation", () => expect(fixPunctuation("سلام ، دنیا")).toBe("سلام، دنیا"));
  it("space after punctuation", () => expect(fixPunctuation("سلام،دنیا")).toBe("سلام، دنیا"));
  it("guillemet inner spaces", () => expect(fixPunctuation("« سلام »")).toBe("«سلام»"));
  it("keeps decimal comma in numbers", () => expect(fixPunctuation("3,5")).toBe("3,5"));
  it("Latin question untouched", () => expect(fixPunctuation("Why?")).toBe("Why?"));
});

describe("digits", () => {
  it("to Persian", () => expect(toPersianDigits("1405")).toBe("۱۴۰۵"));
  it("screen digits keep Latin-attached numbers", () => expect(screenDigits("Pianova 2026")).toBe("Pianova 2026"));
  it("screen digits Persian context", () => expect(screenDigits("قدم 3")).toBe("قدم ۳"));
  it("mixed", () => expect(screenDigits("سال 1405 و Pianova 2026")).toBe("سال ۱۴۰۵ و Pianova 2026"));
});

describe("bidi", () => {
  it("wraps Latin runs with LRM and starts with RLM", () =>
    expect(bidiForSubtitleFile("کانال Pianova عالی است")).toBe("\u200Fکانال \u200EPianova\u200E عالی است"));
  it("startsWithLatin", () => {
    expect(startsWithLatin("Pianova کانال")).toBe(true);
    expect(startsWithLatin("کانال Pianova")).toBe(false);
  });
});

describe("forbidden codepoints", () => {
  it("detects arabic yeh", () => expect(hasForbiddenCodepoints("علي")).toContain("arabic-yeh-kaf"));
  it("detects kashida", () => expect(hasForbiddenCodepoints("ســلام")).toContain("kashida"));
  it("detects double space", () => expect(hasForbiddenCodepoints("a  b")).toContain("double-space"));
  it("detects dangling zwnj", () => expect(hasForbiddenCodepoints(`کتاب${Z} و`)).toContain("dangling-zwnj"));
  it("clean text", () => expect(hasForbiddenCodepoints(`می${Z}خواهیم`)).toEqual([]));
});

describe("normalizePersian end-to-end", () => {
  it("font-proof sentence", () =>
    expect(normalizePersian("مي خواهيم با يك دست, يك رؤيا بسازيم — 1405 — Pianova 2026")).toBe(
      `می${Z}خواهیم با یک دست، یک رؤیا بسازیم — 1405 — Pianova 2026`,
    ));
  it("idempotent", () => {
    const s = normalizePersian("ما مي خواهيم نت ها را بنوازيم?");
    expect(normalizePersian(s)).toBe(s);
  });
  it("question", () => expect(normalizePersian("آماده اي?")).toBe(`آماده${Z}ای؟`));
});

describe("numbers", () => {
  it("0", () => expect(numberToPersianWords(0)).toBe("صفر"));
  it("7", () => expect(numberToPersianWords(7)).toBe("هفت"));
  it("15", () => expect(numberToPersianWords(15)).toBe("پانزده"));
  it("42", () => expect(numberToPersianWords(42)).toBe("چهل و دو"));
  it("100", () => expect(numberToPersianWords(100)).toBe("صد"));
  it("1405", () => expect(numberToPersianWords(1405)).toBe("هزار و چهارصد و پنج"));
  it("2026", () => expect(numberToPersianWords(2026)).toBe("دو هزار و بیست و شش"));
  it("1000000", () => expect(numberToPersianWords(1000000)).toBe("یک میلیون"));
  it("spoken form digits", () => expect(spokenForm("۳")).toBe("سه"));
  it("spoken form percent", () => expect(spokenForm("50%")).toBe("پنجاه درصد"));
});
