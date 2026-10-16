import { useI18n } from "../context/I18nContext.jsx";

export default function KnowledgeRagPanel() {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-line/80 bg-paper/80 p-4 text-sm text-muted">
      <p className="font-medium text-ink">{t("rag.subtitle")}</p>
      <p className="mt-2">{t("rag.placeholder")}</p>
    </section>
  );
}
