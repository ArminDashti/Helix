import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  BookOpen,
  Building2,
  Database,
  Download,
  Monitor,
  MessageSquare,
  Moon,
  RefreshCw,
  Save,
  ScrollText,
  Settings as SettingsIcon,
  Sun,
  User,
} from "lucide-react";
import { version as appVersion } from "../../package.json";
import AboutMePage from "./AboutMePage.jsx";
import LogsPage from "./LogsPage.jsx";
import {
  fetchAgents,
  fetchBranding,
  fetchDatabaseSettings,
  fetchLatestRelease,
  fetchOpenRouterModels,
  sendFeedback,
  fetchOpenRouterSettings,
  fetchProviderSettings,
  fetchSampleTiers,
  ensureSampleTier,
  saveBranding,
  saveDatabaseSettings,
  saveOpenRouterSettings,
  saveProvider,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import LlmChatTester from "../components/LlmChatTester.jsx";
import ModelCombobox from "../components/ModelCombobox.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";
import { formatDateTime } from "../i18n/format.js";
import useFlash from "../lib/useFlash.js";
import { assetUrl } from "../utils/assetUrl.js";
import { compareAz, sortByLabel, sortStrings } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";

const EMPTY_DB = {
  engine: "sqlite",
  host: "",
  port: 0,
  name: "helix-sample.sqlite",
  user: "",
  password: "",
  sslmode: "prefer",
  driver: "ODBC Driver 18 for SQL Server",
  trust_server_certificate: true,
  encrypt: true,
  path: "",
};

const SSL_MODES = ["disable", "prefer", "require", "verify-ca", "verify-full"];

// Display-only stand-in for a saved API key; the real key never leaves the API host.
const SAVED_API_KEY_MASK = "*".repeat(20);

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const EMPTY_OPENROUTER = {
  token: "",
  base_url: OPENROUTER_BASE_URL,
  agents: {},
  token_configured: false,
};

const LLM_AGENT_IDS = [
  "orchester",
  "guardian",
  "researcher",
  "final-approver",
  "web-searcher",
];

// The API is the source of truth for which connectors exist; these keys only translate the ones
// the webui already knows. A connector added server-side still shows up here, labelled by the API.
const CONNECTOR_LABEL_KEYS = {
  openrouter: "settings.apiOpenrouter",
  opencode_go: "settings.apiOpencodeGo",
  openai_compatible: "settings.apiOpenaiCompatible",
};

function connectorLabel(t, connector) {
  const key = CONNECTOR_LABEL_KEYS[connector?.id];
  if (key) return t(key);
  return connector?.label || connector?.id || "";
}

// Mirrors the backend connector seeding: on a switch only app-owned values (empty, or equal to a
// connector default) are replaced, so a base URL or model the admin typed survives intact.
function seedConnectorFields(prev, nextConnector, prevConnector) {
  const nextUrl = (nextConnector?.base_url || "").trim();
  const prevUrl = (prevConnector?.base_url || "").trim();
  const currentUrl = (prev.base_url || "").trim();
  let baseUrl = currentUrl;
  if (nextUrl && (!currentUrl || currentUrl === prevUrl || currentUrl === nextUrl)) {
    baseUrl = nextUrl;
  } else if (!nextUrl && currentUrl && currentUrl === prevUrl) {
    baseUrl = "";
  }

  const nextModel = (nextConnector?.default_model || "").trim();
  const prevModel = (prevConnector?.default_model || "").trim();

  const agents = {};
  for (const [agentId, entry] of Object.entries(prev.agents || {})) {
    const model = (entry?.model || "").trim();
    const adoptNext =
      nextModel && (!model || model === prevModel || model === nextModel);
    agents[agentId] = adoptNext ? { ...entry, model: nextModel } : { ...entry };
  }

  return { ...prev, base_url: baseUrl, agents };
}

const ADMIN_GUIDE_PDF = assetUrl("docs/fa/helix-admin-guide.pdf");

function AdminGuideDownloadCard({ t }) {
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

const EMPTY_BRANDING = {
  company_name: "",
  company_logo_data_url: "",
};

const THEME_OPTIONS = [
  { value: "light", labelKey: "layout.theme.light", icon: Sun },
  { value: "dark", labelKey: "layout.theme.dark", icon: Moon },
  { value: "system", labelKey: "layout.theme.system", icon: Monitor },
];

const TAB_ALIASES = {
  provider: "llm",
  openrouter: "llm",
  sql: "database",
  connection: "llm",
};

function engineLabel(t, value) {
  if (value === "sqlite") return t("settings.engineSqlite");
  if (value === "postgresql") return t("settings.enginePostgresql");
  if (value === "sqlserver") return t("settings.engineSqlserver");
  return value;
}

function isSampleDbName(name) {
  const base = String(name || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.toLowerCase();
  return (
    base === "helix-sample.sqlite" ||
    base === "adventureworks-lt.sqlite" ||
    base === "sample.sqlite"
  );
}

function tabIcon(tabId) {
  if (tabId === "general") return Building2;
  if (tabId === "database") return Database;
  if (tabId === "status") return Activity;
  if (tabId === "update") return Download;
  if (tabId === "feedback") return MessageSquare;
  if (tabId === "logs") return ScrollText;
  if (tabId === "about") return User;
  return SettingsIcon;
}

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function UpdateSection() {
  const { t } = useI18n();
  const [release, setRelease] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function checkForUpdates() {
    setChecking(true);
    setError(null);
    try {
      setRelease(await fetchLatestRelease());
    } catch (err) {
      setError(failMessage(err, t, "common.failedToLoad"));
    } finally {
      setChecking(false);
    }
  }

  const updateAvailable =
    Boolean(release?.latest_version) && release.latest_version !== appVersion;

  return (
    <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabUpdate")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("settings.updateIntro")}</p>
        </div>
        <IconButton
          type="button"
          icon={RefreshCw}
          onClick={checkForUpdates}
          disabled={checking}
          className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm font-medium text-ink hover:bg-fog disabled:opacity-50"
        >
          {checking ? t("settings.checkingUpdates") : t("settings.checkUpdates")}
        </IconButton>
      </div>
      <p className="text-sm text-ink">
        {t("settings.currentVersion")}: {appVersion}
      </p>
      {release ? (
        <div className="space-y-1 text-sm text-ink">
          <p>
            {t("settings.latestVersion")}: {release.latest_version || "—"}
          </p>
          <p className="text-muted">
            {updateAvailable
              ? t("settings.updateAvailable", { version: release.latest_version })
              : t("settings.upToDate")}
          </p>
          {release.release_url ? (
            <a
              href={release.release_url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-ink"
            >
              {t("settings.viewRelease")}
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function FeedbackSection() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [issueUrl, setIssueUrl] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!message.trim()) {
      setError(t("settings.feedbackEmpty"));
      return;
    }
    setSending(true);
    setError(null);
    setIssueUrl(null);
    try {
      const saved = await sendFeedback({
        message: message.trim(),
        email: email.trim(),
      });
      setMessage("");
      setEmail("");
      setIssueUrl(saved.issue_url);
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {t("settings.tabFeedback")}
      </h2>
      <p className="text-sm text-muted">{t("settings.feedbackIntro")}</p>
      <Field label={t("settings.feedbackMessage")} id="feedback_message">
        <textarea
          id="feedback_message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass}
          placeholder={t("settings.feedbackMessagePlaceholder")}
        />
      </Field>
      <Field label={t("settings.feedbackEmail")} id="feedback_email">
        <input
          id="feedback_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder={t("settings.feedbackEmailPlaceholder")}
        />
      </Field>
      {error ? (
        <p className="text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
      {issueUrl ? (
        <p className="text-sm text-ink">
          {t("settings.feedbackSent")}{" "}
          <a
            href={issueUrl}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-ink"
          >
            {t("settings.viewIssue")}
          </a>
        </p>
      ) : null}
      <div className="flex justify-end pt-1">
        <IconButton
          type="submit"
          icon={MessageSquare}
          disabled={sending}
          className="rounded-xl bg-moss px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? t("settings.feedbackSending") : t("settings.feedbackSend")}
        </IconButton>
      </div>
    </form>
  );
}

function StatusLogsSection() {
  const { t, locale } = useI18n();
  const { health, checking, lastFetchError, statusLog, checkConnection } =
    useApiStatus();
  const providerKey = "llm";
  const current = {
    llm: {
      status: health?.[providerKey]?.status,
      detail: health
        ? health[providerKey]?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .map((part) => translateKnownMessage(t, part))
              .join(" — ")
          : t("settings.cannotReach"),
      checked_at: health?.[providerKey]?.checked_at,
    },
    engine: {
      status: health?.api?.status,
      detail: health
        ? health.api?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .map((part) => translateKnownMessage(t, part))
              .join(" — ")
          : t("settings.cannotReach"),
      checked_at: health?.api?.checked_at,
    },
    database: {
      status: health?.database?.status,
      detail: health
        ? health.database?.detail || ""
        : t("settings.engineUnreachableDb"),
      checked_at: health?.database?.checked_at,
    },
  };

  const services = [
    { id: "llm", label: t("settings.tabLlm") },
    { id: "engine", label: t("layout.status.engine") },
    { id: "database", label: t("layout.status.database") },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabStatus")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("settings.statusIntro")}</p>
          <p className="mt-1 text-sm text-muted">
            <Link to="/settings?tab=logs" className="underline decoration-line underline-offset-2 hover:text-ink">
              {t("settings.statusLogsLink")}
            </Link>
          </p>
        </div>
        <IconButton
          type="button"
          icon={RefreshCw}
          onClick={() => checkConnection({ silent: false })}
          className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          {checking ? t("settings.checking") : t("settings.checkNow")}
        </IconButton>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {services.map((svc) => {
          const block = current[svc.id];
          const connected = isConnectedStatus(block.status);
          const stateLabel =
            checking && !block.status
              ? t("settings.checking")
              : connected
                ? t("settings.connected")
                : block.status
                  ? t("settings.disconnectedWithRaw", { status: block.status })
                  : t("settings.disconnected");
          const events = [...statusLog]
            .filter((evt) => evt.service === svc.id)
            .reverse();
          return (
            <div
              key={svc.id}
              className="flex min-h-0 flex-col rounded-xl border border-line/80 bg-fog/30 p-3"
            >
              <p className="text-sm font-semibold text-ink">{svc.label}</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  connected ? "text-moss" : "text-danger"
                }`}
              >
                {stateLabel}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("settings.checkedAt", {
                  time: formatDateTime(block.checked_at, locale) || t("common.noneDash"),
                })}
              </p>
              <p className="mt-2 text-sm text-ink">
                {translateKnownMessage(t, block.detail) || t("settings.noReason")}
              </p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {events.length === 0 ? (
                  <li className="text-muted">{t("settings.noEvents")}</li>
                ) : (
                  events.map((evt, index) => (
                    <li
                      key={`${evt.at}-${evt.status}-${index}`}
                      className="rounded-lg border border-line/70 bg-paper/80 px-2 py-1.5"
                    >
                      <p className="text-muted">{formatDateTime(evt.at, locale)}</p>
                      <p className="font-medium text-ink">{evt.status}</p>
                      {evt.detail ? (
                        <p className="mt-0.5 break-words text-ink">
                          {translateKnownMessage(t, evt.detail)}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const requestedTab = TAB_ALIASES[tabParam] || tabParam;

  const tabs = useMemo(
    () => [
      { id: "general", label: t("settings.tabGeneral") },
      { id: "llm", label: t("settings.tabLlm") },
      { id: "database", label: t("settings.tabDatabase") },
      { id: "status", label: t("settings.tabStatus") },
      { id: "update", label: t("settings.tabUpdate") },
      { id: "feedback", label: t("settings.tabFeedback") },
      { id: "logs", label: t("nav.logs") },
      { id: "about", label: t("nav.aboutMe") },
    ],
    [t],
  );

  const activeSection = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "general";

  const dbEngines = useMemo(
    () =>
      sortByLabel(
        [
          { value: "sqlite", label: t("settings.engineSqlite") },
          { value: "postgresql", label: t("settings.enginePostgresql") },
          { value: "sqlserver", label: t("settings.engineSqlserver") },
        ],
        (item) => item.label,
        locale,
      ),
    [t, locale],
  );

  const sslModes = useMemo(
    () => sortStrings(SSL_MODES, locale),
    [locale],
  );

  const [connectors, setConnectors] = useState([]);
  const [dbForm, setDbForm] = useState(EMPTY_DB);
  const [connectionString, setConnectionString] = useState("");
  const [connectionStringDirty, setConnectionStringDirty] = useState(false);
  const [brandingForm, setBrandingForm] = useState(EMPTY_BRANDING);
  const [logoError, setLogoError] = useState(null);
  const [provider, setProvider] = useState("openrouter");
  const [orForm, setOrForm] = useState(EMPTY_OPENROUTER);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [status, setStatus] = useFlash();
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentNameById, setAgentNameById] = useState({});
  const [sampleTiers, setSampleTiers] = useState([]);
  const [tierBusy, setTierBusy] = useState(null);
  const { checkConnection } = useApiStatus();

  const activeTokenConfigured = Boolean(orForm.token_configured);
  const llmReady = activeTokenConfigured;

  const connectorById = useMemo(() => {
    const map = {};
    for (const connector of connectors) {
      if (connector?.id) map[connector.id] = connector;
    }
    return map;
  }, [connectors]);

  const activeConnector = connectorById[provider] || null;
  // With no catalog yet (or an unreachable API) the picker still offers the active connector, so
  // the Connector field is never empty; field visibility falls back to the pre-connector rules.
  const apiOptions = useMemo(
    () =>
      connectors.length
        ? connectors.map((connector) => ({
            value: connector.id,
            label: connectorLabel(t, connector),
          }))
        : [{ value: provider, label: connectorLabel(t, { id: provider }) }],
    [connectors, provider, t],
  );
  const showsBaseUrl = activeConnector
    ? activeConnector.asks_base_url !== false
    : true;
  const showsApiKey = activeConnector
    ? activeConnector.api_key_required !== false
    : true;
  // A connector that owns its endpoint shows it read-only instead of asking for it.
  const managedBaseUrl = showsBaseUrl ? "" : activeConnector?.base_url || "";

  async function reloadSampleTiers() {
    try {
      const tiers = await fetchSampleTiers();
      setSampleTiers(tiers);
    } catch {
      setSampleTiers([]);
    }
  }

  async function handleEnsureTier(tierId) {
    setError(null);
    setTierBusy(tierId);
    try {
      await ensureSampleTier(tierId);
      await reloadSampleTiers();
      setStatus(t("settings.tierDownloaded"));
    } catch (err) {
      setError(failMessage(err, t, "settings.tierDownloadFailed"));
    } finally {
      setTierBusy(null);
    }
  }

  async function handleUseTier(tier) {
    setError(null);
    setTierBusy(tier.id);
    try {
      if (!tier.exists) {
        await ensureSampleTier(tier.id);
      }
      const next = {
        ...dbForm,
        engine: "sqlite",
        name: tier.filename,
        path: "",
      };
      setDbForm(next);
      setConnectionStringDirty(false);
      await saveDatabaseSettings(next);
      await reloadSampleTiers();
      setStatus(t("settings.tierActive"));
      await checkConnection({ silent: true });
    } catch (err) {
      setError(failMessage(err, t, "settings.tierUseFailed"));
    } finally {
      setTierBusy(null);
    }
  }

  function agentLabel(agentId) {
    return agentNameById[agentId] || agentId.replace(/_/g, " ");
  }

  function setActiveSection(id) {
    setSearchParams(id === "general" ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    (async () => {
      const failures = [];
      let anyOk = false;
      try {
        try {
          const agents = await fetchAgents();
          const map = {};
          for (const a of agents || []) {
            if (a?.id) map[a.id] = agentCompanyLabel(a);
          }
          setAgentNameById(map);
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionAgentsFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const brandingData = await fetchBranding();
          setBrandingForm({
            ...EMPTY_BRANDING,
            ...(brandingData.branding || {}),
          });
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionBrandingFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const dbData = await fetchDatabaseSettings();
          setDbForm({ ...EMPTY_DB, ...dbData.database });
          setConnectionString(dbData.connection_string || "");
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionDatabaseFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          await reloadSampleTiers();
        } catch {
          /* optional */
        }

        try {
          const orData = await fetchOpenRouterSettings();
          setOrForm({ ...EMPTY_OPENROUTER, ...orData.openrouter, token: "" });
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionLlmFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const providerData = await fetchProviderSettings();
          const catalog = Array.isArray(providerData.connectors)
            ? providerData.connectors.filter((entry) => entry?.id)
            : [];
          setConnectors(catalog);
          const raw = String(providerData.provider || "").toLowerCase();
          const saved = catalog.some((entry) => entry.id === raw)
            ? raw
            : catalog[0]?.id || "openrouter";
          setProvider(saved);
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionApiFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        setSectionErrors(failures);
        if (!anyOk && failures.length) {
          setError(t("settings.allUnreachable"));
        } else if (failures.length) {
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  // Live UI: any backend change to config/branding/users must reflect immediately
  useLiveSync(["config", "branding", "database", "pipeline_graph"], () => {
    // soft reload relevant sections without full loading flicker
    (async () => {
      try { const d = await fetchBranding(); setBrandingForm((p) => ({ ...p, ...(d.branding || {}) })); } catch {}
      try { const d = await fetchDatabaseSettings(); setDbForm(d.database || EMPTY_DB); } catch {}
      try { const d = await fetchProviderSettings(); setProviderForm(d.provider || {}); } catch {}
      try { const d = await fetchOpenRouterSettings(); setOpenRouterForm(d.openrouter || EMPTY_OPENROUTER); } catch {}
    })();
  });
  useEffect(() => {
    function onFocusVis() {
      if (document.visibilityState !== "hidden") {
        (async () => {
          try { const d = await fetchBranding(); setBrandingForm((p) => ({ ...p, ...(d.branding || {}) })); } catch {}
        })();
      }
    }
    window.addEventListener("focus", onFocusVis);
    document.addEventListener("visibilitychange", onFocusVis);
    return () => { window.removeEventListener("focus", onFocusVis); document.removeEventListener("visibilitychange", onFocusVis); };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!llmReady) {
      setModels([]);
      setModelsError(null);
      setModelsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const data = await fetchOpenRouterModels({ silent: true });
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        if (!cancelled) {
          setModelsError(
            err instanceof Error ? err.message : t("settings.modelsFail"),
          );
          setModels([]);
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, llmReady, t]);

  function defaultPortForEngine(engine) {
    if (engine === "sqlserver") return 1433;
    if (engine === "sqlite") return 0;
    return 5432;
  }

  function updateDbField(key, value) {
    setDbForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "engine") {
        next.port = defaultPortForEngine(value);
        if (value === "sqlite") {
          next.name = "helix-sample.sqlite";
          next.host = "";
          next.path = "";
        } else {
          if (isSampleDbName(next.name) || isSampleDbName(next.path)) {
            next.name = "";
          }
          next.path = "";
        }
      }
      return next;
    });
    setConnectionStringDirty(false);
    if (key === "engine") {
      setConnectionString("");
    }
  }

  function updateOrField(key, value) {
    setOrForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAgentModel(agentId, model) {
    setOrForm((prev) => ({
      ...prev,
      agents: {
        ...prev.agents,
        [agentId]: { ...(prev.agents?.[agentId] || {}), model },
      },
    }));
  }

  function handleApiChange(next) {
    const nextConnector = connectorById[next] || null;
    const prevConnector = activeConnector;
    setProvider(next);
    setOrForm((prev) => seedConnectorFields(prev, nextConnector, prevConnector));
  }

  async function handleSaveGeneral(event) {
    event.preventDefault();
    setError(null);
    setLogoError(null);
    setStatus(null);
    try {
      const data = await saveBranding({
        company_name: brandingForm.company_name || "",
        company_logo_data_url: brandingForm.company_logo_data_url || "",
      });
      setBrandingForm({ ...EMPTY_BRANDING, ...(data.branding || {}) });
      setStatus(t("settings.savedGeneral"));
      window.dispatchEvent(new CustomEvent("helix-branding-changed"));
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  function handleCompanyLogoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(t("settings.companyLogoInvalid"));
      return;
    }
    if (file.size > 250_000) {
      setLogoError(t("settings.companyLogoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setLogoError(t("settings.companyLogoInvalid"));
        return;
      }
      setBrandingForm((prev) => ({
        ...prev,
        company_logo_data_url: dataUrl,
      }));
    };
    reader.onerror = () => setLogoError(t("settings.companyLogoInvalid"));
    reader.readAsDataURL(file);
  }

  async function handleSaveDatabase(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const engine = dbForm.engine || "sqlite";
      const trimmedConn = (connectionString || "").trim();
      const staleSqliteConn = trimmedConn.toLowerCase().startsWith("file:");
      const payload =
        connectionStringDirty && trimmedConn && !(engine !== "sqlite" && staleSqliteConn)
          ? { connection_string: trimmedConn, engine }
          : engine === "sqlite"
            ? { engine: "sqlite", name: "helix-sample.sqlite" }
            : {
                engine,
                host: dbForm.host,
                port: Number(dbForm.port) || defaultPortForEngine(engine),
                name: dbForm.name,
                user: dbForm.user,
                password: dbForm.password,
                driver: dbForm.driver,
                sslmode: dbForm.sslmode,
                encrypt: dbForm.encrypt,
                trust_server_certificate: dbForm.trust_server_certificate,
              };
      const data = await saveDatabaseSettings(payload);
      setDbForm({ ...EMPTY_DB, ...data.database });
      setConnectionString(data.connection_string || "");
      setConnectionStringDirty(false);
      setStatus(t("settings.dbSaved"));
      checkConnection({ silent: true });
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function handleSaveLlm(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        agents: orForm.agents,
      };
      if (showsApiKey && orForm.token?.trim()) {
        payload.token = orForm.token.trim();
      }
      // A connector that owns its endpoint pins it server-side — never send one back over it.
      if (showsBaseUrl) {
        payload.base_url = (orForm.base_url || "").trim();
      }
      // Switch the connector before writing settings: its defaults (endpoint, model, key env) are
      // then already in place for the settings write that follows.
      const providerData = await saveProvider(provider);
      setProvider(providerData.provider || provider);
      const data = await saveOpenRouterSettings(payload);
      setOrForm({ ...EMPTY_OPENROUTER, ...data.openrouter, token: "" });
      setStatus(t("settings.llmSaved"));
      checkConnection({ silent: true });
      if (data.openrouter?.token_configured) {
        await refreshModels({ tokenConfigured: true });
      }
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function refreshModels({
    tokenConfigured = llmReady,
  } = {}) {
    if (!tokenConfigured && !(orForm.token || "").trim()) {
      setModels([]);
      setModelsError(null);
      setModelsLoading(false);
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchOpenRouterModels({ force: true, silent: true });
      setModels(data.models || []);
    } catch (err) {
      setModelsError(
        err instanceof Error ? err.message : t("settings.modelsFail"),
      );
    } finally {
      setModelsLoading(false);
    }
  }

  if (tabParam === "agents") {
    return <Navigate to="/agents" replace />;
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("settings.loading")}</p>;
  }

  const agentSource = orForm.agents;
  const agentIdPool = Object.keys(agentSource || {}).length
    ? Object.keys(agentSource)
    : Object.keys(agentNameById);
  const filteredLlmAgents = LLM_AGENT_IDS.filter(
    (id) =>
      [
        "orchester",
        "guardian",
        "researcher",
        "final-approver",
        "web-searcher",
      ].includes(id) || agentIdPool.includes(id),
  );
  const agentIds = sortStrings(filteredLlmAgents, locale).sort((a, b) =>
    compareAz(agentLabel(a), agentLabel(b), locale),
  );

  const modelPlaceholder =
    activeConnector?.id === "openrouter"
      ? t("settings.modelsSearchOpenRouter")
      : activeConnector && activeConnector.id !== "openai_compatible"
        ? t("settings.modelsSearchConnector", {
            connector: connectorLabel(t, activeConnector),
          })
        : t("settings.modelsSearch");

  function sectionErrorMessage(failure) {
    const message =
      translateKnownMessage(t, failure.message) || t("common.failedToLoad");
    return t(failure.key, { message });
  }

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden">
      <PageHeader icon={SettingsIcon} title={t("settings.title")} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-line/80 bg-paper/50 p-2 md:w-1/4 md:min-w-[10rem] md:max-w-[16rem] md:border-b-0 md:border-e">
        <nav
          className="flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden"
          role="tablist"
          aria-label={t("settings.categoriesAria")}
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
        {error ? (
          <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            {translateKnownMessage(t, error) || error}
          </p>
        ) : null}
        {sectionErrors.length ? (
          <div className="shrink-0 space-y-1 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            <p className="font-medium">{t("settings.sectionLoadFailed")}</p>
            <ul className="list-disc ps-5">
              {sectionErrors.map((failure) => (
                <li key={failure.key}>{sectionErrorMessage(failure)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <FlashMessage message={status} />

      {activeSection === "general" ? (
        <div className="space-y-3">
          <AdminGuideDownloadCard t={t} />
        <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
          <div>
            <p className="block text-sm font-medium text-ink">{t("layout.languageAria")}</p>
            <div
              className="mt-1 flex flex-row gap-1 rounded-xl border border-line/80 bg-fog/40 p-1"
              role="group"
              aria-label={t("layout.languageAria")}
            >
              {[
                { value: "en", label: t("layout.languageEn") },
                { value: "fa", label: t("layout.languageFa") },
              ].map((opt) => {
                const active = locale === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLocale(opt.value)}
                    title={opt.label}
                    aria-label={opt.label}
                    aria-pressed={active}
                    className={[
                      "flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs font-semibold transition",
                      "px-2",
                      active ? "bg-moss text-white" : "text-ink hover:bg-fog",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-ink">{t("layout.themeAria")}</p>
            <div
              className="mt-1 flex flex-row gap-1 rounded-xl border border-line/80 bg-fog/40 p-1"
              role="group"
              aria-label={t("layout.themeAria")}
            >
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.value;
                const label = t(opt.labelKey);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    title={label}
                    aria-label={label}
                    aria-pressed={active}
                    className={[
                      "flex flex-1 items-center justify-center rounded-lg py-1.5 transition",
                      "px-2",
                      active ? "bg-moss text-white" : "text-ink hover:bg-fog",
                    ].join(" ")}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <form
          onSubmit={handleSaveGeneral}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabGeneral")}
          </h2>
          <p className="text-sm text-muted">{t("settings.generalIntro")}</p>
          <Field label={t("settings.companyName")} id="company_name">
            <input
              id="company_name"
              value={brandingForm.company_name || ""}
              onChange={(e) =>
                setBrandingForm((prev) => ({
                  ...prev,
                  company_name: e.target.value,
                }))
              }
              className={inputClass}
              placeholder={t("settings.companyNamePlaceholder")}
            />
          </Field>
          <Field label={t("settings.companyLogo")} id="company_logo">
            <div className="space-y-2">
              {brandingForm.company_logo_data_url ? (
                <div className="flex items-center gap-3">
                  <img
                    src={brandingForm.company_logo_data_url}
                    alt={t("layout.companyLogoAlt")}
                    className="h-14 w-auto max-w-[8rem] rounded-lg border border-line/80 object-contain bg-fog/40 p-1"
                  />
                  <IconButton
                    type="button"
                    onClick={() =>
                      setBrandingForm((prev) => ({
                        ...prev,
                        company_logo_data_url: "",
                      }))
                    }
                    className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80"
                  >
                    {t("settings.companyLogoClear")}
                  </IconButton>
                </div>
              ) : null}
              <input
                id="company_logo"
                type="file"
                accept="image/*"
                onChange={handleCompanyLogoFile}
                className="block w-full text-sm text-ink file:me-3 file:rounded-lg file:border-0 file:bg-fog file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              <p className="text-xs text-muted">{t("settings.companyLogoHint")}</p>
              {logoError ? (
                <p className="text-sm text-warn" role="alert">
                  {logoError}
                </p>
              ) : null}
            </div>
          </Field>
          <div className="flex justify-end pt-1">
            <IconButton
              type="submit"
              icon={Save}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t("common.save")}
            </IconButton>
          </div>
        </form>
        </div>
      ) : null}

      {activeSection === "status" ? <StatusLogsSection /> : null}
      {activeSection === "update" ? <UpdateSection /> : null}
      {activeSection === "feedback" ? <FeedbackSection /> : null}
      {activeSection === "logs" ? <LogsPage /> : null}
      {activeSection === "about" ? <AboutMePage /> : null}

      {activeSection === "llm" ? (
        <>
        <form
          onSubmit={handleSaveLlm}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t("settings.tabLlm")}
            </h2>
            <IconButton
              type="button"
              icon={RefreshCw}
              onClick={() => refreshModels()}
              disabled={modelsLoading || !llmReady}
              className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80 disabled:opacity-50"
            >
              {t("settings.refreshModels")}
            </IconButton>
          </div>
          <p className="text-sm text-muted">{t("settings.llmIntro")}</p>

          <Field label={t("settings.connector")} id="llm_api">
            <select
              id="llm_api"
              value={provider}
              onChange={(e) => handleApiChange(e.target.value)}
              className={inputClass}
            >
              {apiOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          {showsBaseUrl ? (
            <Field label={t("settings.baseUrl")} id="llm_base_url">
              <input
                id="llm_base_url"
                value={orForm.base_url || ""}
                onChange={(e) => updateOrField("base_url", e.target.value)}
                className={inputClass}
                placeholder={
                  activeConnector?.base_url || t("settings.baseUrlPlaceholder")
                }
                spellCheck={false}
              />
            </Field>
          ) : managedBaseUrl ? (
            <>
              <Field label={t("settings.baseUrl")} id="llm_base_url_fixed">
                <input
                  id="llm_base_url_fixed"
                  value={managedBaseUrl}
                  readOnly
                  disabled
                  className={inputClass}
                  spellCheck={false}
                />
              </Field>
              <p className="text-xs text-muted">
                {t("settings.baseUrlManagedHint")}
              </p>
            </>
          ) : null}

          {showsApiKey ? (
            <>
              <Field label={t("settings.apiKey")} id="llm_token">
                <input
                  id="llm_token"
                  type="password"
                  autoComplete="off"
                  value={orForm.token || (activeTokenConfigured ? SAVED_API_KEY_MASK : "")}
                  onChange={(e) => updateOrField("token", e.target.value.replaceAll("*", ""))}
                  className={inputClass}
                  placeholder={t("settings.apiKeyPastePlaceholder")}
                  spellCheck={false}
                />
              </Field>
              <p className="text-xs text-muted">
                {activeTokenConfigured
                  ? t("settings.apiKeySavedHint")
                  : t("settings.apiKeyPasteHint")}
              </p>
            </>
          ) : null}

          {modelsError ? (
            <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
              {t("settings.modelsError", {
                message: translateKnownMessage(t, modelsError),
              })}
            </p>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">{t("settings.perAgent")}</h3>
            <div className="grid gap-3 sm:grid-cols-5">
              {agentIds.map((agentId) => (
                <Field
                  key={agentId}
                  label={agentLabel(agentId)}
                  id={`agent-${agentId}`}
                >
                  <ModelCombobox
                    id={`agent-${agentId}`}
                    value={orForm.agents?.[agentId]?.model || ""}
                    onChange={(v) => updateAgentModel(agentId, v)}
                    models={models}
                    loading={modelsLoading}
                    placeholder={modelPlaceholder}
                  />
                </Field>
              ))}
            </div>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            {t("settings.saveLlm")}
          </IconButton>
        </form>
        <div className="mt-3">
          <LlmChatTester
            models={models}
            orForm={orForm}
          />
        </div>
        </>
      ) : null}

      {activeSection === "database" ? (
        <form
          onSubmit={handleSaveDatabase}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabDatabase")}
          </h2>

          <Field label={t("settings.dbEngine")} id="engine">
            <select
              id="engine"
              value={dbForm.engine || "sqlite"}
              onChange={(e) => updateDbField("engine", e.target.value)}
              className={inputClass}
            >
              {dbEngines.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {engineLabel(t, opt.value)}
                </option>
              ))}
            </select>
          </Field>

          {dbForm.engine === "sqlite" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t("settings.sqliteHint")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(sampleTiers.length
                  ? sampleTiers
                  : [
                      { id: "small", label: "Small", size_label: "~1.2 MB", exists: false, filename: "helix-sample-small.sqlite" },
                      { id: "medium", label: "Medium", size_label: "~2.8 MB", exists: false, filename: "helix-sample-medium.sqlite" },
                      { id: "big", label: "Big", size_label: "~55 MB", exists: false, filename: "helix-sample-big.sqlite" },
                    ]
                ).map((tier) => {
                  const active =
                    (dbForm.name || "").toLowerCase() ===
                    String(tier.filename || "").toLowerCase();
                  const busy = tierBusy === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className={[
                        "rounded-xl border p-3",
                        active
                          ? "border-moss bg-moss/10"
                          : "border-line bg-fog/40",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold text-ink">
                        {t(`settings.tier.${tier.id}`)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {tier.size_label}
                        {tier.size_hint ? ` (${t("settings.tierApprox")})` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {tier.filename}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!tier.exists ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleEnsureTier(tier.id)}
                            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-fog disabled:opacity-60"
                          >
                            {busy
                              ? t("settings.tierWorking")
                              : t("settings.tierDownload")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || active}
                            onClick={() => handleUseTier(tier)}
                            className="rounded-lg bg-moss px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-moss-deep disabled:opacity-60"
                          >
                            {active
                              ? t("settings.tierInUse")
                              : busy
                                ? t("settings.tierWorking")
                                : t("settings.tierUse")}
                          </button>
                        )}
                        {tier.exists && !active ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleEnsureTier(tier.id)}
                            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-fog disabled:opacity-60"
                          >
                            {t("settings.tierRedownload")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("settings.host")} id="host">
                  <input
                    id="host"
                    value={dbForm.host}
                    onChange={(e) => updateDbField("host", e.target.value)}
                    className={inputClass}
                    placeholder={
                      dbForm.engine === "postgresql"
                        ? "127.0.0.1"
                        : "sql.example.com"
                    }
                  />
                </Field>
                <Field label={t("settings.port")} id="port">
                  <input
                    id="port"
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => updateDbField("port", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("settings.name")} id="name">
                  <input
                    id="name"
                    value={dbForm.name}
                    onChange={(e) => updateDbField("name", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {dbForm.engine === "postgresql" ? (
                  <Field label={t("settings.sslMode")} id="sslmode">
                    <select
                      id="sslmode"
                      value={dbForm.sslmode || "prefer"}
                      onChange={(e) => updateDbField("sslmode", e.target.value)}
                      className={inputClass}
                    >
                      {sslModes.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label={t("settings.driver")} id="driver">
                    <input
                      id="driver"
                      value={dbForm.driver}
                      onChange={(e) => updateDbField("driver", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                )}
                <Field label={t("settings.user")} id="user">
                  <input
                    id="user"
                    value={dbForm.user}
                    onChange={(e) => updateDbField("user", e.target.value)}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("settings.password")} id="password">
                  <input
                    id="password"
                    type="password"
                    value={dbForm.password}
                    onChange={(e) => updateDbField("password", e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </Field>
              </div>

              {dbForm.engine === "sqlserver" ? (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(dbForm.encrypt)}
                      onChange={(e) => updateDbField("encrypt", e.target.checked)}
                      className="size-4 rounded border-line text-moss"
                    />
                    {t("settings.encrypt")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(dbForm.trust_server_certificate)}
                      onChange={(e) =>
                        updateDbField("trust_server_certificate", e.target.checked)
                      }
                      className="size-4 rounded border-line text-moss"
                    />
                    {t("settings.trustCert")}
                  </label>
                </div>
              ) : null}
            </>
          )}

          <div>
            <label htmlFor="conn" className="block text-sm font-medium text-ink">
              {t("settings.connectionString")}
            </label>
            <textarea
              id="conn"
              rows={3}
              value={connectionString}
              onChange={(e) => {
                setConnectionString(e.target.value);
                setConnectionStringDirty(true);
              }}
              className="mt-1 w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-muted">{t("settings.connectionHint")}</p>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            {t("settings.saveDatabase")}
          </IconButton>
        </form>
      ) : null}
      </div>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
