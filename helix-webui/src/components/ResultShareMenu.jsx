import { useEffect, useMemo, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import IconButton from "./IconButton.jsx";
import ShareChannelIcon from "./ShareChannelIcon.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import {
  buildShareBody,
  buildShareSubject,
  resultDetailUrl,
  resultShareChannels,
} from "../lib/shareResult.js";

const CHANNEL_LABEL_KEYS = {
  telegram: "results.shareTelegram",
  whatsapp: "results.shareWhatsApp",
  linkedin: "results.shareLinkedIn",
  gmail: "results.shareGmail",
  outlook: "results.shareOutlook",
  x: "results.shareX",
  facebook: "results.shareFacebook",
  reddit: "results.shareReddit",
  email: "results.shareEmail",
  copy: "results.shareCopyLink",
  native: "results.shareNative",
};

function canNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export default function ResultShareMenu({
  resultId,
  prompt = "",
  textReport = "",
  compact = false,
  className = "",
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef(null);

  const url = useMemo(() => resultDetailUrl(resultId), [resultId]);
  const subject = useMemo(
    () => buildShareSubject({ appTitle: t("layout.brand"), prompt }),
    [t, prompt],
  );
  const body = useMemo(
    () => buildShareBody({ prompt, textReport, url }),
    [prompt, textReport, url],
  );
  const bodyText = useMemo(
    () => buildShareBody({ prompt, textReport, url: "" }),
    [prompt, textReport],
  );

  const channels = useMemo(() => {
    const all = resultShareChannels({ url, subject, body, bodyText });
    if (canNativeShare()) return all;
    return all.filter((ch) => ch.id !== "native");
  }, [url, subject, body, bodyText]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function handleChannel(channel) {
    if (channel.action === "copy") {
      try {
        await navigator.clipboard.writeText(body || url);
        setCopied(true);
      } catch {
        /* ignore */
      }
      setOpen(false);
      return;
    }
    if (channel.action === "native") {
      try {
        await navigator.share({ title: subject, text: body, url });
      } catch {
        /* user dismissed */
      }
      setOpen(false);
      return;
    }
    if (channel.href) {
      window.open(channel.href, "_blank", "noopener,noreferrer");
      setOpen(false);
    }
  }

  const btnClass = compact
    ? "rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
    : "rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog";

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <IconButton
        type="button"
        icon={Share2}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("results.shareMenuAria")}
        onClick={() => setOpen((v) => !v)}
        className={btnClass}
      >
        {compact ? null : t("results.share")}
      </IconButton>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg"
        >
          {copied ? (
            <p className="px-3 py-2 text-xs font-medium text-moss" role="status">
              {t("results.shareCopied")}
            </p>
          ) : null}
          {channels.map((channel) => {
            const labelKey = CHANNEL_LABEL_KEYS[channel.id];
            const label = labelKey ? t(labelKey) : channel.id;
            return (
              <button
                key={channel.id}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm text-ink hover:bg-fog/80"
                onClick={() => handleChannel(channel)}
              >
                <ShareChannelIcon channelId={channel.id} />
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
