import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Ban, Bot, ListChecks, Pencil, Trash2 } from "lucide-react";
import {
  deleteAgent,
  fetchAgents,
  fetchSkills,
  setAgentDisabled,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";
import useFlash from "../lib/useFlash.js";
import StackedNames from "../components/StackedNames.jsx";
import { sortByLabel } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";
import { resolveAgentIcon } from "../lib/agentIcons.js";

function namesForAgent(agentId, items, locale) {
  return sortByLabel(
    items
      .filter((item) => (item.agents || []).includes(agentId))
      .map((item) => item.name || item.id),
    (label) => label,
    locale,
  );
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale } = useI18n();
  const [agents, setAgents] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();

  async function reload() {
    const [a, s] = await Promise.all([fetchAgents(), fetchSkills()]);
    setAgents(a || []);
    setSkills(s || []);
  }

  useLiveSync(["agents", "skills"], () => reload().catch(() => {}));
  useEffect(() => {
    function onFocusVis() {
      if (document.visibilityState !== "hidden") reload().catch(() => {});
    }
    window.addEventListener("focus", onFocusVis);
    document.addEventListener("visibilitychange", onFocusVis);
    return () => {
      window.removeEventListener("focus", onFocusVis);
      document.removeEventListener("visibilitychange", onFocusVis);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(
          err instanceof Error
            ? failMessage(err, t, "agents.loadFailed")
            : t("agents.loadFailed"),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    const flash = location.state?.status;
    if (!flash) return;
    setStatus(translateKnownMessage(t, flash) || flash);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, setStatus, t]);

  const rows = useMemo(
    () =>
      agents
        .filter((agent) => ["orchester", "researcher"].includes(agent.id))
        .map((agent) => ({ key: agent.id, item: agent })),
    [agents],
  );

  async function handleDisable(agent) {
    setError(null);
    try {
      const updated = await setAgentDisabled(agent.id, !agent.disabled);
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, ...updated } : a)),
      );
      const label = agentCompanyLabel(updated);
      setStatus(
        updated.disabled
          ? t("common.disabledNamed", { name: label })
          : t("common.enabledNamed", { name: label }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? failMessage(err, t, "common.updateFailed")
          : t("common.updateFailed"),
      );
    }
  }

  async function handleDelete(agent) {
    const label = agentCompanyLabel(agent);
    if (!window.confirm(t("agents.deleteConfirm", { name: label }))) return;
    setError(null);
    try {
      await deleteAgent(agent.id);
      await reload();
      setStatus(t("agents.deleted"));
    } catch (err) {
      setError(
        err instanceof Error
          ? failMessage(err, t, "agents.deleteFailed")
          : t("agents.deleteFailed"),
      );
    }
  }

  const columns = [
    {
      key: "id",
      label: t("common.id"),
      render: (agent) => (
        <span className="font-mono text-sm text-ink">{agent.id}</span>
      ),
    },
    {
      key: "name",
      label: t("common.name"),
      render: (agent) => {
        const Icon = resolveAgentIcon(agent.icon);
        return (
          <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span>{agent.name || agent.id}</span>
          </span>
        );
      },
    },
    {
      key: "description",
      label: t("agents.description"),
      render: (agent) =>
        agent.description || (
          <span className="text-muted">{t("common.noneDash")}</span>
        ),
    },
    {
      key: "skills",
      label: t("agents.colSkills"),
      render: (agent) => (
        <StackedNames items={namesForAgent(agent.id, skills, locale)} />
      ),
    },
    {
      key: "actions",
      label: t("common.actions"),
      render: (agent) => (
        <div className="flex flex-wrap gap-1.5">
          <IconButton
            type="button"
            icon={ListChecks}
            onClick={() =>
              navigate(`/agents/${encodeURIComponent(agent.id)}/assignments`)
            }
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("agents.assign")}
          </IconButton>
          <IconButton
            type="button"
            icon={Pencil}
            onClick={() => navigate(`/agents/${encodeURIComponent(agent.id)}`)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("common.edit")}
          </IconButton>
          <IconButton
            type="button"
            icon={Ban}
            onClick={() => handleDisable(agent)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {agent.disabled ? t("common.enable") : t("common.disable")}
          </IconButton>
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(agent)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("common.delete")}
          </IconButton>
        </div>
      ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-muted">{t("agents.loading")}</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Bot} title={t("agents.title")} />
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />
      <DataGrid
        columns={columns}
        rows={rows}
        emptyLabel={t("common.noAgents")}
      />
    </div>
  );
}
