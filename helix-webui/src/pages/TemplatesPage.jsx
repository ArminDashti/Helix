import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  createReportTemplate,
  deleteReportTemplate,
  fetchReportTemplates,
  updateReportTemplate,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { stashAnalysisPrefill } from "../lib/analysisPrefill.js";
import useFlash from "../lib/useFlash.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

const EMPTY_FORM = {
  id: "",
  name: "",
  description: "",
  prompt: "",
  outputs: { chart: true, grid: false, research: false },
  report_type: "low",
  chart_types: ["bar"],
  grid_columns: "",
  language: "en",
  allow_operator_questions: false,
  disabled: false,
};

function outputsLabel(outputs, t) {
  const parts = [];
  if (outputs?.chart) parts.push(t("analysis.modeChart"));
  if (outputs?.grid) parts.push(t("analysis.modeGrid"));
  if (outputs?.research) parts.push(t("analysis.modeResearch"));
  return parts.join(" · ") || t("common.noneDash");
}

export default function TemplatesPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    const list = await fetchReportTemplates({ includeDisabled: isAdmin });
    setTemplates(list || []);
  }

  useLiveSync(["report-templates", "config"], () => reload().catch(() => {}));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch (err) {
        if (!cancelled) setError(failMessage(err, t, "templates.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, isAdmin]);

  const visibleTemplates = useMemo(
    () => templates.filter((item) => isAdmin || !item.disabled),
    [templates, isAdmin],
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(item) {
    setForm({
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      prompt: item.prompt || "",
      outputs: { ...EMPTY_FORM.outputs, ...item.outputs },
      report_type: item.report_type || "low",
      chart_types: Array.isArray(item.chart_types) ? item.chart_types : ["bar"],
      grid_columns: (item.grid_columns || []).join(", "),
      language: item.language || "en",
      allow_operator_questions: Boolean(item.allow_operator_questions),
      disabled: Boolean(item.disabled),
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  function toggleOutput(key) {
    setForm((prev) => ({
      ...prev,
      outputs: { ...prev.outputs, [key]: !prev.outputs[key] },
    }));
  }

  function buildPayload() {
    const columns = form.grid_columns
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      id: form.id.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      prompt: form.prompt.trim(),
      outputs: form.outputs,
      report_type: form.report_type,
      chart_types: form.outputs.chart ? form.chart_types : [],
      grid_columns: form.outputs.grid ? columns : [],
      language: form.language,
      allow_operator_questions: form.allow_operator_questions,
      disabled: form.disabled,
    };
  }

  async function handleSave(event) {
    event.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (!payload.prompt) {
      setError(t("templates.promptRequired"));
      return;
    }
    try {
      if (editingId) {
        await updateReportTemplate(editingId, payload);
        setStatus(t("templates.saved"));
      } else {
        if (!payload.id) {
          setError(t("templates.idRequired"));
          return;
        }
        await createReportTemplate(payload);
        setStatus(t("templates.created"));
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(t("templates.deleteConfirm", { name: item.name || item.id }))) {
      return;
    }
    setError(null);
    try {
      await deleteReportTemplate(item.id);
      setStatus(t("templates.deleted"));
      if (editingId === item.id) resetForm();
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "common.deleteFailed"));
    }
  }

  function useTemplate(item) {
    stashAnalysisPrefill({
      prompt: item.prompt,
      outputs: item.outputs,
      report_type: item.report_type,
      chart_types: item.chart_types,
      grid_columns: item.grid_columns,
      language: item.language,
      allow_operator_questions: item.allow_operator_questions,
    });
    navigate("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-10 sm:p-6">
      <PageHeader icon={FileStack} title={t("templates.title")}>
        {isAdmin ? (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-moss px-3 py-2 text-sm font-medium text-white hover:bg-moss/90"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("templates.new")}
          </button>
        ) : null}
      </PageHeader>

      <p className="text-sm text-muted">{t("templates.subtitle")}</p>

      <FlashMessage message={status} />
      {error ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {isAdmin && showForm ? (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-line bg-paper/80 p-4 shadow-sm sm:p-5"
        >
          <h2 className="text-base font-semibold text-ink">
            {editingId ? t("templates.editTitle") : t("templates.createTitle")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("common.id")}</span>
              <input
                className={inputClass}
                value={form.id}
                disabled={Boolean(editingId)}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                placeholder={t("templates.idPlaceholder")}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("common.name")}</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
          </div>
          <label className="mt-4 block text-sm">
            <span className="font-medium text-ink">{t("templates.description")}</span>
            <input
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="font-medium text-ink">{t("templates.prompt")}</span>
            <textarea
              className={`${inputClass} min-h-[6rem]`}
              value={form.prompt}
              onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {["chart", "grid", "research"].map((key) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(form.outputs[key])}
                  onChange={() => toggleOutput(key)}
                />
                {t(`analysis.mode${key === "chart" ? "Chart" : key === "grid" ? "Grid" : "Research"}`)}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("templates.reportType")}</span>
              <select
                className={inputClass}
                value={form.report_type}
                onChange={(e) => setForm((p) => ({ ...p, report_type: e.target.value }))}
              >
                <option value="low">{t("analysis.speedFast")}</option>
                <option value="medium">{t("analysis.speedNormal")}</option>
                <option value="high">{t("analysis.speedLong")}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("templates.language")}</span>
              <select
                className={inputClass}
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              >
                <option value="en">{t("analysis.outputLanguageEn")}</option>
                <option value="fa">{t("analysis.outputLanguageFa")}</option>
              </select>
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm sm:mt-8">
              <input
                type="checkbox"
                checked={form.allow_operator_questions}
                onChange={(e) =>
                  setForm((p) => ({ ...p, allow_operator_questions: e.target.checked }))
                }
              />
              {t("templates.allowQuestions")}
            </label>
          </div>
          {form.outputs.chart ? (
            <label className="mt-4 block text-sm">
              <span className="font-medium text-ink">{t("templates.chartTypes")}</span>
              <input
                className={inputClass}
                value={(form.chart_types || []).join(", ")}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    chart_types: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="bar, line"
              />
            </label>
          ) : null}
          {form.outputs.grid ? (
            <label className="mt-4 block text-sm">
              <span className="font-medium text-ink">{t("templates.gridColumns")}</span>
              <input
                className={inputClass}
                value={form.grid_columns}
                onChange={(e) => setForm((p) => ({ ...p, grid_columns: e.target.value }))}
                placeholder={t("templates.gridColumnsPlaceholder")}
              />
            </label>
          ) : null}
          {editingId ? (
            <label className="mt-4 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.disabled}
                onChange={(e) => setForm((p) => ({ ...p, disabled: e.target.checked }))}
              />
              {t("templates.disabled")}
            </label>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-moss/90"
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : visibleTemplates.length === 0 ? (
        <p className="text-sm text-muted">{t("templates.empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visibleTemplates.map((item) => (
            <li
              key={item.id}
              className="flex flex-col rounded-2xl border border-line bg-paper/80 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink">{item.name || item.id}</h3>
                  {item.description ? (
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                  ) : null}
                </div>
                {item.disabled && isAdmin ? (
                  <span className="shrink-0 rounded-lg bg-fog px-2 py-0.5 text-xs text-muted">
                    {t("templates.disabledBadge")}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-ink/90">{item.prompt}</p>
              <p className="mt-2 text-xs text-muted">{outputsLabel(item.outputs, t)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => useTemplate(item)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-moss px-3 py-2 text-sm font-medium text-white hover:bg-moss/90"
                >
                  <Play className="size-4" aria-hidden="true" />
                  {t("templates.use")}
                </button>
                {isAdmin ? (
                  <>
                    <IconButton
                      label={t("common.edit")}
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t("common.delete")}
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
