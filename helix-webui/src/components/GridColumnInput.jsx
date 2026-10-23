import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "../context/I18nContext.jsx";
import { parseColumns } from "../utils/textDirection.js";

const inputClass =
  "min-w-[6rem] flex-1 border-0 bg-transparent px-1 py-1.5 text-[15px] text-ink outline-none placeholder:text-muted";

/**
 * Chip-based column picker for grid output.
 * @param {{ columns: string[], onChange: (cols: string[]) => void, id?: string, disabled?: boolean }} props
 */
export default function GridColumnInput({
  columns,
  onChange,
  id = "grid_columns",
  disabled = false,
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  function commitDraft(raw) {
    const parts = parseColumns(raw);
    if (!parts.length) return;
    const next = [...columns];
    for (const part of parts) {
      if (!next.includes(part)) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  function removeAt(index) {
    onChange(columns.filter((_, i) => i !== index));
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && columns.length) {
      onChange(columns.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}_input`} className="block text-sm font-medium text-ink">
        {t("analysis.columns")}
      </label>
      <div
        className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper px-2 py-1.5 ring-moss/30 focus-within:border-moss focus-within:ring-2 disabled:opacity-60"
        onClick={() => !disabled && inputRef.current?.focus()}
        aria-disabled={disabled}
      >
        <ul className="contents" role="list" aria-label={t("analysis.columns")}>
          {columns.map((col, index) => (
            <li key={`${col}-${index}`} className="list-none">
              <span
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-fog/50 px-2 py-0.5 text-sm text-ink"
              >
                <span>{col}</span>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted hover:bg-fog hover:text-ink"
                  aria-label={`${t("analysis.removeColumn")}: ${col}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(index);
                  }}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          id={`${id}_input`}
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commitDraft(draft)}
          placeholder={columns.length ? "" : t("analysis.columnsPlaceholder")}
          aria-describedby={`${id}_hint`}
          className={inputClass}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-fog sm:hidden"
          onClick={() => commitDraft(draft)}
        >
          {t("analysis.columnsAdd")}
        </button>
      </div>
      <p id={`${id}_hint`} className="text-xs text-muted">
        {t("analysis.columnsHint")}
      </p>
    </div>
  );
}
