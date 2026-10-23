import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Bot,
  BookOpen,
  Database,
  FileStack,
  LayoutTemplate,
  PanelLeft,
  PanelLeftClose,
  Play,
  Activity,
  Settings,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { fetchBranding } from "../api/client.js";
import { assetUrl } from "../utils/assetUrl.js";
const THEME_STORAGE_KEY = "helix-theme";
const NAV_COLLAPSED_STORAGE_KEY = "helix-nav-collapsed";

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function formatLinkStatus(status, checking, t) {
  if (checking && !status) return t("layout.status.checking");
  return isConnectedStatus(status)
    ? t("layout.status.connected")
    : t("layout.status.disconnected");
}

function StatusLine({ status, label, checking, t }) {
  const state = formatLinkStatus(status, checking, t);
  const connected = isConnectedStatus(status);
  const title = t("layout.status.lineTitle", { label, state });
  return (
    <>
      <span className="text-start text-muted" title={title}>
        {label}
      </span>
      <span
        className={`text-start ${connected ? "text-moss" : "text-danger"}`}
        title={title}
      >
        {state}
      </span>
    </>
  );
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(preference) {
  if (preference === "light") return "light";
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return "dark";
}

function readThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

function readNavCollapsed() {
  try {
    return localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function applyTheme(preference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
}

function NavItem({ link, collapsed }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      title={link.label}
      className={({ isActive }) =>
        [
          "flex items-center rounded-xl py-2 text-sm font-medium transition",
          collapsed ? "justify-center px-2" : "gap-2 px-3",
          isActive
            ? "bg-moss text-white"
            : "border border-line/80 bg-paper/80 text-ink hover:bg-fog",
        ].join(" ")
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? null : <span>{link.label}</span>}
    </NavLink>
  );
}

export default function Layout() {
  const { health, checking } = useApiStatus();
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const [theme, setTheme] = useState(readThemePreference);
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const [branding, setBranding] = useState({
    company_name: "",
    company_logo_data_url: "",
  });

  const navGroups = [
    {
      labelKey: "nav.groups.analyze",
      links: [
        { to: "/", label: t("nav.analysis"), icon: BarChart3, end: true },
        { to: "/results", label: t("nav.results"), icon: Play },
        { to: "/canvas", label: t("nav.canvas"), icon: LayoutTemplate },
        { to: "/templates", label: t("nav.templates"), icon: FileStack },
        { to: "/db-explorer", label: t("nav.dbExplorer"), icon: Database },
      ],
    },
    {
      labelKey: "nav.groups.configure",
      links: [
        { to: "/skills", label: t("nav.skills"), icon: Sparkles },
        { to: "/agents", label: t("nav.agents"), icon: Bot },
        { to: "/knowledge", label: t("nav.knowledge"), icon: BookOpen },
      ],
    },
  ];

  const footerLinks = [
    ...(isAdmin ? [{ to: "/admin", label: t("nav.admin"), icon: Shield }] : []),
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, navCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [navCollapsed]);

  useEffect(() => {
    let cancelled = false;
    async function loadBranding() {
      try {
        const data = await fetchBranding();
        if (cancelled) return;
        setBranding({
          company_name: data?.branding?.company_name || "",
          company_logo_data_url: data?.branding?.company_logo_data_url || "",
        });
      } catch {
        if (!cancelled) {
          setBranding({ company_name: "", company_logo_data_url: "" });
        }
      }
    }
    loadBranding();
    const onChanged = () => loadBranding();
    window.addEventListener("helix-branding-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("helix-branding-changed", onChanged);
    };
  }, []);

  useEffect(() => {
    if (theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const engineStatus = health?.api?.status;
  const dbStatus = health?.database?.status;
  const llmStatus = health?.llm?.status;

  return (
    <div className="flex h-dvh overflow-hidden">
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-50 bg-warn px-3 py-1 text-center text-sm font-medium text-paper">
          {t("layout.offline")}
        </div>
      )}
      <nav
        className={[
          "flex shrink-0 flex-col gap-1 border-e border-line/80 bg-paper/60 py-2 transition-[width] duration-200 ease-out",
          navCollapsed
            ? "w-[3.25rem] px-1"
            : "w-[20%] min-w-[10rem] max-w-[14rem] px-2 sm:px-3",
        ].join(" ")}
        aria-label={t("layout.navAria")}
        aria-expanded={!navCollapsed}
      >
        <div
          className={[
            "mb-2 flex items-center rounded-xl border border-line/80 bg-fog/30",
            navCollapsed ? "flex-col gap-1 px-1 py-2" : "gap-2 px-2 py-2",
          ].join(" ")}
        >
          <div
            className={[
              "flex shrink-0 items-center justify-center overflow-hidden",
              navCollapsed ? "h-8 w-8" : "h-12 w-[4.75rem]",
            ].join(" ")}
            aria-label={t("layout.logoAria")}
            title={t("layout.logoTitle")}
          >
            <img
              src={assetUrl("helix-logo.png")}
              alt={t("layout.logoAlt")}
              className={[
                "w-auto object-contain",
                navCollapsed ? "h-8 max-w-8" : "h-12 max-w-[4.75rem]",
              ].join(" ")}
              width={76}
              height={48}
            />
          </div>
          {navCollapsed ? null : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold tracking-wide text-ink">
                  {t("layout.brand")}
                </p>
                <p className="truncate text-[11px] text-muted">{t("layout.tagline")}</p>
              </div>
              {branding.company_logo_data_url || branding.company_name ? (
                <div className="flex min-w-0 max-w-[45%] shrink-0 flex-col items-end gap-0.5 border-s border-line/60 ps-2">
                  {branding.company_logo_data_url ? (
                    <img
                      src={branding.company_logo_data_url}
                      alt={
                        branding.company_name || t("layout.companyLogoAlt")
                      }
                      title={t("layout.companyLogoTitle")}
                      aria-label={t("layout.companyLogoAria")}
                      className="h-8 w-auto max-w-[4.5rem] object-contain"
                    />
                  ) : null}
                  {branding.company_name ? (
                    <p className="w-full truncate text-end text-[10px] font-medium text-ink/80">
                      {branding.company_name}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
          <button
            type="button"
            onClick={() => setNavCollapsed((c) => !c)}
            className={[
              "shrink-0 rounded-lg border border-line/80 p-1.5 text-muted hover:bg-fog hover:text-ink",
              navCollapsed ? "" : "ms-auto",
            ].join(" ")}
            title={
              navCollapsed ? t("layout.expandNav") : t("layout.collapseNav")
            }
            aria-label={
              navCollapsed ? t("layout.expandNav") : t("layout.collapseNav")
            }
          >
            {navCollapsed ? (
              <PanelLeft className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </button>
        </div>

        {navGroups.map((group) =>
          navCollapsed ? (
            <div key={group.labelKey} className="flex flex-col gap-1">
              {group.links.map((link) => (
                <NavItem key={link.to} link={link} collapsed={navCollapsed} />
              ))}
            </div>
          ) : (
            <details key={group.labelKey} className="group" open>
              <summary
                className="cursor-pointer select-none list-none px-2 py-2 marker:content-none [&::-webkit-details-marker]:hidden"
                aria-label={t(group.labelKey)}
              >
                <div className="h-px w-full bg-line/70" aria-hidden="true" />
              </summary>
              <div className="mt-0.5 flex flex-col gap-1 ps-2">
                {group.links.map((link) => (
                  <NavItem key={link.to} link={link} collapsed={navCollapsed} />
                ))}
              </div>
            </details>
          ),
        )}

        <div className="mt-auto space-y-1 pt-2">
          {footerLinks.map((link) => (
            <NavItem key={link.to} link={link} collapsed={navCollapsed} />
          ))}

          {navCollapsed ? (
            <NavLink
              to="/settings?tab=status"
              title={t("layout.status.openLogsTitle")}
              className="flex justify-center rounded-xl border border-line/80 bg-fog/40 px-2 py-2 hover:bg-fog"
              aria-label={t("layout.status.openLogsAria")}
            >
              <Activity className="size-4 shrink-0 text-muted" aria-hidden />
            </NavLink>
          ) : (
            <NavLink
              to="/settings?tab=status"
              title={t("layout.status.openLogsTitle")}
              className="block w-full rounded-xl border border-line/80 bg-fog/40 px-3 py-2 text-start text-[11px] font-medium hover:bg-fog"
              aria-label={t("layout.status.openLogsAria")}
            >
              <span className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 font-geek tracking-wide">
                <StatusLine
                  status={llmStatus}
                  label={t("layout.status.llm")}
                  checking={checking}
                  t={t}
                />
                <StatusLine
                  status={engineStatus}
                  label={t("layout.status.engine")}
                  checking={checking}
                  t={t}
                />
                <StatusLine
                  status={dbStatus}
                  label={t("layout.status.database")}
                  checking={checking}
                  t={t}
                />
              </span>
            </NavLink>
          )}

          {user ? (
            <NavItem
              collapsed={navCollapsed}
              link={{
                to: "/profile",
                label: t("nav.profile"),
                icon: User,
              }}
            />
          ) : null}

          {navCollapsed ? null : (
            <p className="rounded-xl border border-line/80 bg-fog/40 px-2 py-1.5 text-center text-sm leading-snug text-muted">
              {t("layout.credit")}{" "}
              <a
                href="https://github.com/armindashti"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                {t("layout.creatorName")}
              </a>
            </p>
          )}
        </div>
      </nav>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2 sm:p-3">
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet context={{ theme, setTheme }} />
        </div>
      </main>
    </div>
  );
}
