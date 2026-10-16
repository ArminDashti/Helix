import { BookOpen } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import KnowledgeRagPanel from "./KnowledgeRagPanel.jsx";
import KnowledgeTablesPanel from "./KnowledgeTablesPanel.jsx";

const TABS = [
  { id: "tables", labelKey: "nav.tableDocs", Panel: KnowledgeTablesPanel },
  { id: "rag", labelKey: "nav.rag", Panel: KnowledgeRagPanel },
];

export default function KnowledgePage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = TABS.find((tab) => tab.id === searchParams.get("tab")) ?? TABS[0];

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        icon={BookOpen}
        title={t("nav.knowledge")}
        actions={
          <div role="tablist" className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active.id === tab.id}
                onClick={() => setSearchParams({ tab: tab.id }, { replace: true })}
                className={[
                  "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                  active.id === tab.id
                    ? "bg-moss text-white"
                    : "border border-line/80 bg-paper/80 text-ink hover:bg-fog",
                ].join(" ")}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        }
      />
      <active.Panel />
    </div>
  );
}
