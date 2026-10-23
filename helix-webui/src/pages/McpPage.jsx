import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Plug, Server } from "lucide-react";
import { fetchMcps, testSqlServerMcp } from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";

const TEST_BUSY = "__test__";

export default function McpPage({ embedded = false }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchMcps();
      setData(next);
      setError(null);
    } catch (err) {
      setError(failMessage(err, t, "mcp.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTest() {
    setBusy(TEST_BUSY);
    setError(null);
    setNotice(null);
    try {
      await testSqlServerMcp();
      setNotice(t("mcp.testOk"));
      await load();
    } catch (err) {
      setError(failMessage(err, t, "mcp.testFailed"));
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("mcp.loading")}</p>;
  }

  const servers = data?.servers || [];
  const sqlServer =
    servers.find((s) => s.name === "helix-sqlserver") ||
    servers.find((s) => s.is_sql_server);

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 flex-col gap-3"
          : "hx-rise flex h-full min-h-0 flex-col gap-3"
      }
    >
      {embedded ? (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t("settings.tabMcp")}</h2>
          <p className="mt-1 text-sm text-muted">{t("mcp.subtitle")}</p>
        </div>
      ) : (
        <PageHeader icon={Plug} title={t("nav.mcp")}>
          <p className="mt-1 text-sm text-muted">{t("mcp.subtitle")}</p>
        </PageHeader>
      )}

      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="shrink-0 rounded-xl border border-moss/40 bg-moss/10 px-4 py-2 text-sm text-moss">
          {notice}
        </p>
      ) : null}

      <section className="shrink-0 rounded-2xl border border-line/80 bg-paper/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Server className="size-4" aria-hidden="true" />
              {t("mcp.sqlTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted">{t("mcp.sqlDesc")}</p>
            <p className="mt-2 font-mono text-[11px] text-muted" dir="ltr">
              npx -y mssql-mcp-server
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("mcp.configPath")}
              <code className="ms-1 rounded-lg bg-fog/60 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                {data?.config_path || ""}
              </code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sqlServer ? (
              <span
                className={[
                  "rounded-lg border px-2 py-1 text-xs font-semibold",
                  sqlServer.enabled
                    ? "border-moss/40 bg-moss/10 text-moss"
                    : "border-line bg-fog/50 text-muted",
                ].join(" ")}
              >
                {sqlServer.enabled ? t("mcp.enabled") : t("mcp.disabled")}
              </span>
            ) : (
              <span className="rounded-lg border border-line bg-fog/50 px-2 py-1 text-xs text-muted">
                {t("mcp.notProvisioned")}
              </span>
            )}
            <IconButton
              type="button"
              icon={FlaskConical}
              disabled={busy === TEST_BUSY}
              onClick={handleTest}
              className="h-10 shrink-0 rounded-xl bg-moss px-4 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
            >
              {busy === TEST_BUSY ? t("mcp.testing") : t("mcp.test")}
            </IconButton>
          </div>
        </div>
        {!data?.exists ? (
          <p className="mt-2 text-xs text-warn">{t("mcp.notFound")}</p>
        ) : null}
        {sqlServer ? (
          <p className="mt-3 truncate font-mono text-xs text-muted" dir="ltr">
            {[sqlServer.command, ...(sqlServer.args || [])].join(" ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}








