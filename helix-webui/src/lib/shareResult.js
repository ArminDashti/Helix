const REPORT_EXCERPT_MAX = 400;

export function resultDetailUrl(resultId) {
  if (!resultId || typeof window === "undefined") return "";
  return new URL(`/results/${resultId}`, window.location.origin).href;
}

export function buildShareSubject({ appTitle, prompt }) {
  const title = String(appTitle || "Helix").trim();
  const p = String(prompt || "").trim();
  if (!p) return title;
  const short = p.length > 80 ? `${p.slice(0, 77)}…` : p;
  return `${title}: ${short}`;
}

export function buildShareBody({ prompt, textReport, url }) {
  const parts = [];
  const p = String(prompt || "").trim();
  if (p) parts.push(p);
  const report = String(textReport || "").trim();
  if (report) {
    const excerpt =
      report.length > REPORT_EXCERPT_MAX
        ? `${report.slice(0, REPORT_EXCERPT_MAX)}…`
        : report;
    parts.push(excerpt);
  }
  const link = String(url || "").trim();
  if (link) parts.push(link);
  return parts.join("\n\n");
}

/**
 * @returns {{ id: string, external?: boolean } & ({ href: string } | { action: "copy" | "native" })}
 */
export function resultShareChannels({ url, subject, body, bodyText }) {
  const encUrl = encodeURIComponent(url);
  const encSubject = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);
  const encText = encodeURIComponent(bodyText ?? body);
  const waText = encodeURIComponent(body || url);

  return [
    {
      id: "telegram",
      href: `https://t.me/share/url?url=${encUrl}&text=${encText}`,
      external: true,
    },
    {
      id: "whatsapp",
      href: `https://api.whatsapp.com/send?text=${waText}`,
      external: true,
    },
    {
      id: "linkedin",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      external: true,
    },
    {
      id: "gmail",
      href: `https://mail.google.com/mail/?view=cm&fs=1&su=${encSubject}&body=${encBody}`,
      external: true,
    },
    {
      id: "outlook",
      href: `https://outlook.office.com/mail/deeplink/compose?subject=${encSubject}&body=${encBody}`,
      external: true,
    },
    {
      id: "x",
      href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encSubject}`,
      external: true,
    },
    {
      id: "facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      external: true,
    },
    {
      id: "reddit",
      href: `https://www.reddit.com/submit?url=${encUrl}&title=${encSubject}`,
      external: true,
    },
    {
      id: "email",
      href: `mailto:?subject=${encSubject}&body=${encBody}`,
      external: false,
    },
    { id: "copy", action: "copy" },
    { id: "native", action: "native" },
  ];
}
