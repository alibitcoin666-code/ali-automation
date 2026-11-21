import type { Channel } from "@amf/pipeline/core";

/** Default Persian template copy per channel (already normalized; checked by tests). */
export const COPY: Record<Channel, { thanks: string; cta: string; subscribe: string; next: string }> = {
  pianova: { thanks: "ممنون که با پیانووا همراه بودید", cta: "مشترک شوید", subscribe: "مشترک شوید", next: "قسمت بعد را از دست ندهید" },
  musicradio69: { thanks: "موسیقی را حس کن، با ما بمان", cta: "مشترک شوید", subscribe: "مشترک شوید", next: "پخش بعدی در راه است" },
  onehandonedream: { thanks: "با یک دست، یک رؤیا؛ ممنون که همراهید", cta: "مشترک شوید", subscribe: "مشترک شوید", next: "داستان ادامه دارد" },
  neutral: { thanks: "ممنون که تا پایان همراه بودید", cta: "مشترک شوید", subscribe: "مشترک شوید", next: "ویدیوی بعدی را ببینید" },
};
