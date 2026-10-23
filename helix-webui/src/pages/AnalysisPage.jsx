import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  BarChart3,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  ChevronDown,
  CircleDot,
  Globe,
  Play,
  Zap,
} from "lucide-react";
import { fetchAgents, streamRun, answerRun, createResult } from "../api/client.js";
import AnalysisSection from "../components/AnalysisSection.jsx";
import ErrorModal from "../components/ErrorModal.jsx";
import GridColumnInput from "../components/GridColumnInput.jsx";
import IconButton from "../components/IconButton.jsx";
import RunProgressModal from "../components/RunProgressModal.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { translateKnownMessage } from "../i18n/apiErrors.js";
import { readStoredLocale } from "../i18n/applyLocale.js";
import { translate } from "../i18n/messages.js";
import { consumeAnalysisPrefill } from "../lib/analysisPrefill.js";
import {
  composeRunPrompt,
  deriveApiMode,
  wantsChart,
  wantsGrid,
} from "../utils/analysisOutputs.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";
import { textDirection, textLang } from "../utils/textDirection.js";

const languageSelectClass =
  "min-w-[9rem] cursor-pointer appearance-none rounded-xl border border-line bg-fog/40 py-2.5 pe-9 ps-9 text-sm font-medium text-ink outline-none ring-moss/30 transition hover:bg-fog focus:border-moss focus:ring-2";

const textareaClass =
  "min-h-[5rem] w-full resize-y rounded-xl border border-line/80 bg-fog/25 px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-moss/30 transition focus:border-moss focus:ring-2";

const extraPromptClass = `${textareaClass} min-h-[4.5rem] text-sm`;

const sortSelectClass =
  "rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

const CHART_TYPE_META = [
  { value: "bar", icon: BarChart3, labelKey: "analysis.chartBar" },
  { value: "line", icon: ChartLine, labelKey: "analysis.chartLine" },
  { value: "area", icon: AreaChart, labelKey: "analysis.chartArea" },
  { value: "pie", icon: ChartPie, labelKey: "analysis.chartPie" },
  { value: "donut", icon: CircleDot, labelKey: "analysis.chartDonut" },
  { value: "scatter", icon: ChartScatter, labelKey: "analysis.chartScatter" },
  { value: "stacked_bar", icon: ChartColumn, labelKey: "analysis.chartStackedBar" },
  {
    value: "horizontal_bar",
    icon: BarChart3,
    labelKey: "analysis.chartHorizontalBar",
  },
];

const DEFAULT_OUTPUTS = { chart: true, grid: false, research: false };

function llmUnavailableMessage(health, t) {
  if (!health) {
    return t("analysis.llmUnreachable");
  }
  const block = health.llm;
  if (block?.status === "configured") return null;
  return translateKnownMessage(t, block?.detail) || t("analysis.apiKeyMissing");
}

function segmentShellClass() {
  return "inline-flex overflow-hidden rounded-xl border border-line bg-fog/30 p-0.5";
}

function segmentBtnClass(pressed) {
  return [
    "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition first:rounded-[0.65rem] last:rounded-[0.65rem]",
    pressed
      ? "bg-moss text-white shadow-sm"
      : "text-muted hover:bg-fog/80 hover:text-ink",
  ].join(" ");
}

function chartIconBtnClass(pressed, atCap) {
  return [
    "inline-flex size-14 items-center justify-center rounded-xl border transition",
    pressed
      ? "border-moss bg-moss/25 text-ink ring-1 ring-moss/40"
      : "border-line/80 bg-fog/30 text-muted hover:border-line hover:bg-fog/60 hover:text-ink",
    atCap ? "cursor-not-allowed opacity-50" : "",
  ].join(" ");
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { health, checkConnection } = useApiStatus();
  const { t, locale } = useI18n();
  const [prompt, setPrompt] = useState(() =>
    translate(readStoredLocale(), "analysis.promptDefault"),
  );
  const [outputs, setOutputs] = useState(DEFAULT_OUTPUTS);
  const [outputLanguage, setOutputLanguage] = useState(locale);
  const [reportType, setReportType] = useState("low");
  const [chartTypesSelected, setChartTypesSelected] = useState(["bar"]);
  const [gridColumns, setGridColumns] = useState([]);
  const [gridSortColumn, setGridSortColumn] = useState("");
  const [gridSortDir, setGridSortDir] = useState("ASC");
  const [researchPrompt, setResearchPrompt] = useState("");
  const [gridPrompt, setGridPrompt] = useState("");
  const [chartPrompt, setChartPrompt] = useState("");
  const [allowOperatorQuestions, setAllowOperatorQuestions] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [activePrompt, setActivePrompt] = useState("");
  const [runMessages, setRunMessages] = useState([]);
  const [runMeta, setRunMeta] = useState({});
  const [runTokenUsage, setRunTokenUsage] = useState(null);
  const [runStartedAt, setRunStartedAt] = useState(null);
  const [nameById, setNameById] = useState({});
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [llmError, setLlmError] = useState(null);
  const abortRef = useRef(null);
  const answerResolveRef = useRef(null);

  const outputLanguages = useMemo(
    () => [
      { value: "en", label: t("analysis.outputLanguageEn") },
      { value: "fa", label: t("analysis.outputLanguageFa") },
    ],
    [t],
  );

  const speedLevels = useMemo(
    () => [
      { value: "low", label: t("analysis.speedFast"), icon: Zap },
      { value: "medium", label: t("analysis.speedNormal"), icon: null },
      { value: "high", label: t("analysis.speedLong"), icon: null },
    ],
    [t],
  );

  const chartTypes = useMemo(
    () =>
      CHART_TYPE_META.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const prefill = consumeAnalysisPrefill();
    if (!prefill) return;
    if (typeof prefill.prompt === "string" && prefill.prompt.trim()) {
      setPrompt(prefill.prompt);
    }
    if (prefill.outputs && typeof prefill.outputs === "object") {
      setOutputs({ ...DEFAULT_OUTPUTS, ...prefill.outputs });
    }
    if (typeof prefill.report_type === "string") {
      setReportType(prefill.report_type);
    }
    if (Array.isArray(prefill.chart_types) && prefill.chart_types.length) {
      setChartTypesSelected(prefill.chart_types.slice(0, 4));
    }
    if (Array.isArray(prefill.grid_columns)) {
      setGridColumns(prefill.grid_columns.filter(Boolean));
    }
    if (typeof prefill.language === "string") {
      setOutputLanguage(prefill.language);
    }
    if (prefill.allow_operator_questions != null) {
      setAllowOperatorQuestions(Boolean(prefill.allow_operator_questions));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const agents = await fetchAgents();
        if (cancelled) return;
        const map = {};
        for (const a of agents || []) {
          if (a?.id) map[a.id] = agentCompanyLabel(a);
        }
        setNameById(map);
      } catch {
        /* keep empty map */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setOutputEnabled(key, enabled) {
    setOutputs((prev) => ({ ...prev, [key]: enabled }));
  }

  async function handleRun(event) {
    event.preventDefault();
    const mainTrimmed = prompt.trim();
    if (!mainTrimmed) {
      setError(t("analysis.promptRequired"));
      return;
    }
    const trimmed = composeRunPrompt(mainTrimmed, {
      research: outputs.research ? researchPrompt : "",
      grid: outputs.grid ? gridPrompt : "",
      chart: outputs.chart ? chartPrompt : "",
      gridSortColumn: outputs.grid ? gridSortColumn : "",
      gridSortDir,
    }).trim();
    const apiMode = deriveApiMode(outputs);
    if (!apiMode) {
      setError(t("analysis.outputRequired"));
      return;
    }
    const latest = (await checkConnection({ silent: true })) || health;
    const llmMessage = llmUnavailableMessage(latest, t);
    if (llmMessage) {
      setError(llmMessage);
      setLlmError({ title: t("analysis.cannotRun"), message: llmMessage });
      return;
    }
    setError(null);
    setLlmError(null);
    setRunError(null);
    setRunMessages([]);
    setRunTokenUsage(null);

    const includeChart = wantsChart(outputs);
    const includeGrid = wantsGrid(outputs);
    const selectedCharts = includeChart ? chartTypesSelected.slice(0, 4) : undefined;

    if (includeChart && (!selectedCharts || selectedCharts.length === 0)) {
      setError(t("analysis.chartRequired"));
      return;
    }

    setRunMeta({
      mode: apiMode,
      language: outputLanguage,
      report_type: reportType,
      chart_type: includeChart ? selectedCharts[0] : undefined,
      chart_types: includeChart ? selectedCharts : undefined,
    });
    setRunStartedAt(Date.now());
    setActivePrompt(trimmed);
    setModalOpen(true);
    setRunning(true);

    const payload = {
      prompt: trimmed,
      mode: apiMode,
      language: outputLanguage,
      report_type: reportType,
      chart_type: selectedCharts?.[0],
      chart_types: selectedCharts,
      columns: includeGrid && gridColumns.length ? gridColumns : undefined,
      allow_operator_questions: allowOperatorQuestions,
    };

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const startedAt = performance.now();
      let streamed = await streamRun(payload, handleStreamEvent, controller.signal);
      while (streamed?.paused) {
        const answers = await askOperator(streamed.question);
        if (!answers) return;
        streamed = await answerRun(
          { runId: streamed.question.run_id, answers },
          handleStreamEvent,
          controller.signal,
        );
      }
      const final = streamed;
      const clientDurationS = (performance.now() - startedAt) / 1000;
      const durationS =
        typeof final?.duration_s === "number" && Number.isFinite(final.duration_s)
          ? final.duration_s
          : clientDurationS;
      setModalOpen(false);
      setRunning(false);
      await createResult({
        prompt: trimmed,
        mode: apiMode,
        language: outputLanguage,
        payload: final,
        duration_s: durationS,
      });
      navigate("/results");
    } catch (err) {
      if (err?.name === "AbortError") return;
      setRunning(false);
      if (err?.kind === "rejection") {
        const body = translateKnownMessage(
          t,
          err.reasons || err.message || t("analysis.runFailed"),
        );
        setRunError({
          kind: "rejection",
          title: t("errors.rejection.title"),
          message: body,
          reasons: body,
        });
      } else {
        setRunError(
          err instanceof Error
            ? translateKnownMessage(t, err.message)
            : t("analysis.runFailed"),
        );
      }
    }
  }

  function handleStreamEvent(event) {
    if (event?.event === "step") {
      setRunMessages((prev) => [
        ...prev,
        {
          agent_id: event.agent_id,
          node_id: event.node_id,
          message: event.message,
          status: event.status,
          result: event.result,
          at: event.at,
          elapsed_s: event.elapsed_s,
          run_id: event.run_id,
          sql: event.sql,
          row_count: event.row_count,
          handoff: event.handoff,
        },
      ]);
      if (event.token_usage) setRunTokenUsage(event.token_usage);
    } else if (event?.event === "error" && event.error) {
      const body = translateKnownMessage(t, String(event.error));
      if (event.kind === "rejection") {
        setRunError({
          kind: "rejection",
          title: t("errors.rejection.title"),
          message: body,
          reasons: body,
        });
      } else {
        setRunError(body);
      }
    }
  }

  function askOperator(question) {
    setPendingQuestion(question);
    return new Promise((resolve) => {
      answerResolveRef.current = resolve;
    });
  }

  function submitAnswers(answers) {
    setPendingQuestion(null);
    const resolve = answerResolveRef.current;
    answerResolveRef.current = null;
    resolve?.(answers);
  }

  function stopRun() {
    abortRef.current?.abort();
    setRunning(false);
    setRunError(t("analysis.runStopped"));
  }

  function dismissModal() {
    if (running) {
      abortRef.current?.abort();
      setRunning(false);
    }
    if (answerResolveRef.current) {
      answerResolveRef.current(null);
      answerResolveRef.current = null;
    }
    setPendingQuestion(null);
    setModalOpen(false);
    setRunError(null);
  }

  function toggleChartType(value) {
    setChartTypesSelected((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      if (prev.length >= 4) return prev;
      return [...prev, value];
    });
  }

  const promptDir = textDirection(prompt);
  const chartEnabled = wantsChart(outputs);
  const gridEnabled = wantsGrid(outputs);
  const researchEnabled = Boolean(outputs.research);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h1
        className="border-s-[3px] border-moss ps-3 font-display text-xl text-ink sm:text-2xl"
      >
        {t("analysis.title")}
      </h1>
      <form
        onSubmit={handleRun}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-line/70 bg-paper/50 p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalysisSection title={t("analysis.prompt")}>
            <label htmlFor="prompt" className="sr-only">
              {t("analysis.prompt")}
            </label>
            <textarea
              id="prompt"
              value={prompt}
              dir={promptDir}
              lang={textLang(prompt)}
              onChange={(e) => setPrompt(e.target.value)}
              className={`${textareaClass} min-h-[8.5rem]`}
              placeholder={t("analysis.promptPlaceholder")}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <div
                className={segmentShellClass()}
                role="group"
                aria-label={t("analysis.speed")}
              >
                {speedLevels.map((item) => {
                  const pressed = reportType === item.value;
                  const SpeedIcon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => setReportType(item.value)}
                      className={segmentBtnClass(pressed)}
                    >
                      {SpeedIcon ? (
                        <SpeedIcon className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="relative shrink-0">
                <label htmlFor="output_language" className="sr-only">
                  {t("analysis.outputLanguage")}
                </label>
                <Globe
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <select
                  id="output_language"
                  value={outputLanguage}
                  onChange={(e) => setOutputLanguage(e.target.value)}
                  className={languageSelectClass}
                >
                  {outputLanguages.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={allowOperatorQuestions}
                  onChange={(e) => setAllowOperatorQuestions(e.target.checked)}
                  className="size-4 rounded border-line bg-fog/40 text-moss focus:ring-moss"
                />
                <span className="whitespace-nowrap">{t("analysis.allowQuestions")}</span>
              </label>
            </div>
          </AnalysisSection>

          <AnalysisSection
            title={t("analysis.modeResearch")}
            enableable
            enabled={researchEnabled}
            onEnabledChange={(next) => setOutputEnabled("research", next)}
          >
            <label htmlFor="research_prompt" className="text-xs font-medium text-muted">
              {t("analysis.additionalPrompt")}
            </label>
            <textarea
              id="research_prompt"
              value={researchPrompt}
              onChange={(e) => setResearchPrompt(e.target.value)}
              className={`${extraPromptClass} mt-1`}
              placeholder={t("analysis.additionalPromptPlaceholder")}
              disabled={!researchEnabled}
            />
          </AnalysisSection>

          <AnalysisSection
            title={t("analysis.modeGrid")}
            enableable
            enabled={gridEnabled}
            onEnabledChange={(next) => setOutputEnabled("grid", next)}
          >
            <GridColumnInput
              columns={gridColumns}
              onChange={setGridColumns}
              disabled={!gridEnabled}
            />
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="font-medium text-ink">{t("analysis.gridSort")}</span>
                <select
                  className={`${sortSelectClass} mt-1 min-w-[8rem]`}
                  value={gridSortColumn}
                  onChange={(e) => setGridSortColumn(e.target.value)}
                  disabled={!gridEnabled}
                >
                  <option value="">{t("common.noneDash")}</option>
                  {gridColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-ink">{t("analysis.gridSortDir")}</span>
                <select
                  className={`${sortSelectClass} mt-1`}
                  value={gridSortDir}
                  onChange={(e) => setGridSortDir(e.target.value)}
                  disabled={!gridEnabled || !gridSortColumn}
                >
                  <option value="ASC">{t("analysis.gridSortAsc")}</option>
                  <option value="DESC">{t("analysis.gridSortDesc")}</option>
                </select>
              </label>
            </div>
            <label htmlFor="grid_prompt" className="mt-3 block text-xs font-medium text-muted">
              {t("analysis.additionalPrompt")}
            </label>
            <textarea
              id="grid_prompt"
              value={gridPrompt}
              onChange={(e) => setGridPrompt(e.target.value)}
              className={`${extraPromptClass} mt-1`}
              placeholder={t("analysis.additionalPromptPlaceholder")}
              disabled={!gridEnabled}
            />
          </AnalysisSection>

          <AnalysisSection
            title={t("analysis.modeChart")}
            enableable
            enabled={chartEnabled}
            onEnabledChange={(next) => setOutputEnabled("chart", next)}
          >
            <p className="sr-only">{t("analysis.chartMultiHint")}</p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t("analysis.chart")}
            >
              {chartTypes.map((item) => {
                const pressed = chartTypesSelected.includes(item.value);
                const atCap = !pressed && chartTypesSelected.length >= 4;
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={pressed}
                    disabled={!chartEnabled || atCap}
                    onClick={() => toggleChartType(item.value)}
                    className={chartIconBtnClass(pressed, atCap)}
                  >
                    <Icon className="size-8" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <label htmlFor="chart_prompt" className="mt-3 block text-xs font-medium text-muted">
              {t("analysis.additionalPrompt")}
            </label>
            <textarea
              id="chart_prompt"
              value={chartPrompt}
              onChange={(e) => setChartPrompt(e.target.value)}
              className={`${extraPromptClass} mt-1`}
              placeholder={t("analysis.additionalPromptPlaceholder")}
              disabled={!chartEnabled}
            />
          </AnalysisSection>
        </div>

        <div className="flex justify-end border-t border-line/50 pt-3">
          <IconButton
            type="submit"
            icon={Play}
            disabled={running}
            className="w-full shrink-0 rounded-full bg-moss px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-moss-deep disabled:opacity-60 sm:w-auto"
          >
            {t("analysis.run")}
          </IconButton>
        </div>
      </form>

      {error ? (
        <p
          className="mt-3 rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn"
          role="status"
        >
          {error}
        </p>
      ) : null}

      <ErrorModal error={llmError} onDismiss={() => setLlmError(null)} />

      <RunProgressModal
        open={modalOpen}
        prompt={activePrompt}
        messages={runMessages}
        running={running}
        error={runError}
        onDismiss={dismissModal}
        onStop={stopRun}
        nameById={nameById}
        tokenUsage={runTokenUsage}
        meta={runMeta}
        startedAt={runStartedAt}
        question={pendingQuestion}
        onSubmitAnswers={submitAnswers}
      />
    </div>
  );
}
