import { useI18n } from "../context/I18nContext.jsx";

const shellClass =
  "rounded-2xl border border-line/70 bg-fog/15 shadow-sm transition";

/**
 * Fixed Analysis page panel with optional enable/disable.
 * @param {{
 *   title: string,
 *   enabled?: boolean,
 *   onEnabledChange?: (next: boolean) => void,
 *   enableable?: boolean,
 *   children: import("react").ReactNode,
 * }} props
 */
export default function AnalysisSection({
  title,
  enabled = true,
  onEnabledChange,
  enableable = false,
  children,
}) {
  const { t } = useI18n();
  const dimmed = enableable && !enabled;

  return (
    <section
      className={`${shellClass} p-4 sm:p-5 ${dimmed ? "opacity-70" : ""}`}
      aria-disabled={dimmed || undefined}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          {title}
        </h2>
        {enableable && onEnabledChange ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-line bg-fog/40 text-moss focus:ring-moss"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
            />
            <span className="text-muted">{t("analysis.sectionEnabled")}</span>
          </label>
        ) : null}
      </div>
      <div className={dimmed ? "pointer-events-none select-none" : undefined}>
        {children}
      </div>
    </section>
  );
}
