import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "../context/I18nContext.jsx";
import { compareAz } from "../utils/sortOptions.js";

/**
 * Searchable single-select for { value, label } options.
 */
export default function SearchableCombobox({
  id,
  value,
  onChange,
  options = [],
  loading = false,
  disabled = false,
  placeholder,
  ariaLabel,
  className = "",
  inputClassName = "h-10 w-full min-w-[12rem] rounded-xl border border-line bg-fog/40 px-3 text-sm outline-none focus:border-moss",
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");

  const normalized = useMemo(() => {
    const list = (Array.isArray(options) ? options : [])
      .map((opt) => {
        const v = String(opt?.value ?? "").trim();
        if (!v) return null;
        const label = String(opt?.label ?? v);
        return { value: v, label };
      })
      .filter(Boolean);
    list.sort(
      (a, b) =>
        compareAz(a.label, b.label, locale) ||
        compareAz(a.value, b.value, locale),
    );
    return list;
  }, [options, locale]);

  const selectedLabel = useMemo(() => {
    const hit = normalized.find((o) => o.value === value);
    return hit?.label || value || "";
  }, [normalized, value]);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selectedLabel]);

  const filtered = useMemo(() => {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return normalized.slice(0, 80);
    return normalized
      .filter(
        (o) =>
          o.value.toLowerCase().includes(q) ||
          o.label.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [normalized, query]);

  function selectOption(nextValue) {
    onChange(nextValue);
    const hit = normalized.find((o) => o.value === nextValue);
    setQuery(hit?.label || nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={["relative", className].filter(Boolean).join(" ")}>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || loading}
        value={query}
        placeholder={loading ? t("common.loading") : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          setQuery(selectedLabel);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selectedLabel);
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[0]) selectOption(filtered[0].value);
          }
        }}
        className={inputClassName}
      />
      {open && !disabled && !loading ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full min-w-full overflow-y-auto rounded-xl border border-line bg-paper shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              {normalized.length === 0
                ? t("dbExplorer.noObjects")
                : t("dbExplorer.noMatching")}
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  className={[
                    "flex w-full px-3 py-2 text-start text-sm hover:bg-fog",
                    o.value === value ? "bg-moss/20 font-medium text-ink" : "text-ink",
                  ].join(" ")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(o.value)}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
