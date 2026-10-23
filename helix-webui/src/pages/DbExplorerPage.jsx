import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Database, Play } from "lucide-react";
import {
  fetchDbExplorerColumns,
  fetchDbExplorerTables,
  runDbExplorerQuery,
} from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchableCombobox from "../components/SearchableCombobox.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { compareAz, sortStrings } from "../utils/sortOptions.js";
import { preferIdOrderColumn } from "../utils/preferIdOrderColumn.js";

const LIMITS = [16, 32, 64, 128];

const OBJECT_KINDS = [
  { value: "tables", labelKey: "dbExplorer.kindTables" },
  { value: "views", labelKey: "dbExplorer.kindViews" },
];

export default function DbExplorerPage() {
  const { t, locale } = useI18n();
  const [objectKind, setObjectKind] = useState("tables");
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState("");
  const [columns, setColumns] = useState([]);
  const [limit, setLimit] = useState(32);
  const [position, setPosition] = useState("top");
  const [where, setWhere] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [sort, setSort] = useState("ASC");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const kindLabel = t(
    OBJECT_KINDS.find((k) => k.value === objectKind)?.labelKey ||
      "dbExplorer.kindTables",
  );

  const tableOptions = useMemo(
    () =>
      tables.map((tbl) => ({
        value: tbl.full_name,
        label: tbl.full_name,
      })),
    [tables],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchDbExplorerTables(objectKind);
        if (cancelled) return;
        const list = [...(data.tables || [])].sort((a, b) =>
          compareAz(a.full_name, b.full_name, locale),
        );
        setTables(list);
        setTable(list[0]?.full_name || "");
        setResult(null);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(failMessage(err, t, "dbExplorer.loadObjectsFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectKind, locale, t]);

  useEffect(() => {
    if (!table) {
      setColumns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDbExplorerColumns(table);
        if (cancelled) return;
        const cols = [...(data.columns || [])].sort((a, b) =>
          compareAz(a.name, b.name, locale),
        );
        setColumns(cols);
        setOrderBy(preferIdOrderColumn(data.columns || cols) || cols[0]?.name || "");
      } catch {
        if (!cancelled) setColumns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [table, locale]);

  const columnNames = useMemo(
    () => sortStrings(columns.map((c) => c.name), locale),
    [columns, locale],
  );

  async function handleRun(event) {
    event.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const data = await runDbExplorerQuery({
        table,
        limit,
        position,
        where,
        order_by: orderBy,
        sort,
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(failMessage(err, t, "dbExplorer.queryFailed"));
    } finally {
      setRunning(false);
    }
  }

  function positionLabel(pos) {
    return pos === "top" ? t("dbExplorer.positionTop") : t("dbExplorer.positionTail");
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("dbExplorer.loading")}</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={Database} title={t("dbExplorer.title")} />

      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleRun}
        className="filter-section shrink-0 space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
          <div className="block min-w-[8rem] shrink-0 text-sm">
            <select
              value={objectKind}
              onChange={(e) => setObjectKind(e.target.value)}
              aria-label={t("dbExplorer.objectType")}
              className="h-10 w-full min-w-[9rem] rounded-xl border border-line bg-fog/40 px-3 text-sm outline-none focus:border-moss"
            >
              {OBJECT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {t(k.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="block min-w-[12rem] shrink-0 text-sm">
            <SearchableCombobox
              value={table}
              onChange={setTable}
              options={tableOptions}
              placeholder={t("dbExplorer.filterPlaceholder")}
              ariaLabel={kindLabel}
            />
          </div>

          <fieldset
            className="shrink-0 text-sm"
            aria-label={t("dbExplorer.rows")}
          >
            <div className="flex flex-wrap gap-2">
              {LIMITS.map((n) => (
                <IconButton
                  key={n}
                  type="button"
                  icon={Database}
                  onClick={() => setLimit(n)}
                  className={[
                    "h-10 rounded-lg border px-3 text-xs font-semibold",
                    limit === n
                      ? "border-moss bg-moss text-white"
                      : "border-line bg-fog/40 text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {n}
                </IconButton>
              ))}
            </div>
          </fieldset>

          <fieldset
            className="shrink-0 text-sm"
            aria-label={t("dbExplorer.position")}
          >
            <div className="flex gap-2">
              {["top", "tail"].map((pos) => (
                <IconButton
                  key={pos}
                  type="button"
                  icon={pos === "top" ? ArrowUp : ArrowDown}
                  onClick={() => setPosition(pos)}
                  className={[
                    "h-10 rounded-lg border px-3 text-xs font-semibold capitalize",
                    position === pos
                      ? "border-moss bg-moss text-white"
                      : "border-line bg-fog/40 text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {positionLabel(pos)}
                </IconButton>
              ))}
            </div>
          </fieldset>

          <div className="block min-w-[8rem] shrink-0 text-sm">
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              aria-label={t("dbExplorer.orderBy")}
              className="h-10 w-full rounded-xl border border-line bg-fog/40 px-3 text-sm outline-none focus:border-moss"
            >
              {columnNames.length === 0 ? (
                <option value="">{t("common.noneDash")}</option>
              ) : (
                columnNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="block min-w-[6rem] shrink-0 text-sm">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label={t("dbExplorer.sort")}
              className="h-10 w-full rounded-xl border border-line bg-fog/40 px-3 text-sm outline-none focus:border-moss"
            >
              <option value="ASC">{t("dbExplorer.sortAsc")}</option>
              <option value="DESC">{t("dbExplorer.sortDesc")}</option>
            </select>
          </div>

          <div className="block min-w-[16rem] grow text-sm">
            <input
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder={t("dbExplorer.wherePlaceholder")}
              aria-label={t("dbExplorer.where")}
              className="h-10 w-full rounded-xl border border-line bg-fog/40 px-3 font-mono text-[13px] outline-none focus:border-moss"
            />
          </div>

          <IconButton
            type="submit"
            icon={Play}
            disabled={!table || running}
            className="h-10 shrink-0 rounded-xl bg-moss px-5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {running ? t("dbExplorer.running") : t("dbExplorer.run")}
          </IconButton>
        </div>
      </form>

      {result ? (
        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>
              {t("dbExplorer.resultMeta", {
                count: result.row_count,
                position: positionLabel(result.position),
                limit: result.limit,
                column: result.order_by,
                sort:
                  result.sort === "DESC"
                    ? t("dbExplorer.sortDesc")
                    : t("dbExplorer.sortAsc"),
              })}
            </span>
            <code className="max-w-full truncate rounded-lg bg-fog/50 px-2 py-1 font-mono text-[11px] text-ink">
              {result.sql}
            </code>
          </div>
          <div dir="ltr" className="min-h-0 flex-1 overflow-auto rounded-xl border border-line">
            <table className="min-w-full text-center font-sans text-sm">
              <thead className="sticky top-0 bg-fog/80 text-xs uppercase tracking-wide text-muted backdrop-blur">
                <tr>
                  {(result.columns || []).map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.rows || []).map((row, idx) => (
                  <tr key={idx} className="border-t border-line/70">
                    {(result.columns || []).map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-1.5 text-center font-sans text-[12px]">
                        {row[c] === null || row[c] === undefined ? (
                          <span className="text-muted">{t("dbExplorer.null")}</span>
                        ) : (
                          String(row[c])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}









