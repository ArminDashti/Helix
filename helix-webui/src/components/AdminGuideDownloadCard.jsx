import { BookOpen, Download } from "lucide-react";
import { useI18n } from "../context/I18nContext.jsx";
import { assetUrl } from "../utils/assetUrl.js";

const ADMIN_GUIDE_PDF = assetUrl("docs/fa/helix-admin-guide.pdf");

export default function AdminGuideDownloadCard() {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-moss/30 bg-moss/5 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-moss" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{t("guide.adminTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("guide.adminDescription")}</p>
        </div>
      </div>
      <a
        href={ADMIN_GUIDE_PDF}
        download="helix-admin-guide-fa.pdf"
        aria-label={t("guide.downloadAria")}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-moss/40 bg-paper px-4 py-2 text-sm font-medium text-moss hover:bg-moss/10"
      >
        <Download className="size-4" aria-hidden />
        {t("guide.downloadPdf")}
      </a>
    </div>
  );
}
