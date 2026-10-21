import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CircleHelp, User } from "lucide-react";
import AdminGuideDownloadCard from "../components/AdminGuideDownloadCard.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import AboutMePage from "./AboutMePage.jsx";

const TAB_ALIASES = {
  documentation: "guide",
  admin: "guide",
  "admin-guide": "guide",
};

function tabIcon(tabId) {
  if (tabId === "guide") return BookOpen;
  if (tabId === "about") return User;
  return CircleHelp;
}

export default function HelpPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const requestedTab = TAB_ALIASES[tabParam] || tabParam;

  const tabs = useMemo(
    () => [
      { id: "guide", label: t("help.tabGuide") },
      { id: "about", label: t("help.tabAbout") },
    ],
    [t],
  );

  const activeSection = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "guide";

  function setActiveSection(id) {
    setSearchParams(id === "guide" ? {} : { tab: id }, { replace: true });
  }

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden">
      <PageHeader icon={CircleHelp} title={t("help.title")}>
        <p className="text-sm text-muted">{t("help.intro")}</p>
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="flex shrink-0 flex-col gap-2 border-b border-line/80 bg-paper/50 p-2 md:w-1/4 md:min-w-[10rem] md:max-w-[16rem] md:border-b-0 md:border-e">
          <nav
            className="flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden"
            role="tablist"
            aria-label={t("help.categoriesAria")}
          >
            {tabs.map((tab) => (
              <IconButton
                key={tab.id}
                type="button"
                role="tab"
                icon={tabIcon(tab.id)}
                aria-selected={activeSection === tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={[
                  "shrink-0 rounded-xl px-3 py-2 text-start text-sm font-medium transition md:w-full",
                  activeSection === tab.id
                    ? "bg-moss text-white"
                    : "border border-line bg-fog/40 text-ink hover:bg-fog",
                ].join(" ")}
              >
                {tab.label}
              </IconButton>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-3">
          {activeSection === "guide" ? (
            <div className="space-y-3">
              <AdminGuideDownloadCard />
            </div>
          ) : null}
          {activeSection === "about" ? <AboutMePage embedded /> : null}
        </div>
      </div>
    </div>
  );
}
