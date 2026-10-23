import { useI18n } from "../context/I18nContext.jsx";

const shellBase =
  "rounded-2xl border bg-fog/15 shadow-sm transition-colors duration-200";

/**
 * Analysis page panel with optional include toggle.
 * @param {{
 *   title: string,
 *   description?: string,
 *   icon?: import("react").ReactNode,
 *   enabled?: boolean,
 *   onEnabledChange?: (next: boolean) => void,
 *   enableable?: boolean,
 *   sectionKey?: string,
 *   children: import("react").ReactNode,
 * }} props
 */
export default function AnalysisSection({
  title,
  description,
  icon,
  enabled = true,
  onEnabledChange,
  enableable = false,
  sectionKey,
  children,
}) {
  const { t } = useI18n();
  const active = !enableable || enabled;
  const switchId = enableable
    ? `analysis-section-${sectionKey || title.replace(/\s+/g, "-").toLowerCase()}`
    : undefined;

  return (
    <section
      className={[
        shellBase,
        "p-4 sm:p-5",
        active ? "border-line/70" : "border-line/50 bg-fog/10",
        enableable && enabled ? "ring-1 ring-moss/25" : "",
      ].join(" ")}
      aria-labelledby={switchId ? `${switchId}-heading` : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            {icon ? (
              <span
                className={[
                  "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border",
                  active
                    ? "border-moss/35 bg-moss/15 text-ink"
                    : "border-line/60 bg-fog/25 text-muted",
                ].join(" ")}
                aria-hidden="true"
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2
                id={switchId ? `${switchId}-heading` : undefined}
                className="text-base font-semibold text-ink"
              >
                {title}
              </h2>
              {description ? (
                <p className="mt-0.5 text-sm leading-snug text-muted">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {enableable && onEnabledChange ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-[11px] font-medium text-muted">
              {t("analysis.sectionEnabled")}
            </span>
            <button
              id={switchId}
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby={switchId ? `${switchId}-heading` : undefined}
              onClick={() => onEnabledChange(!enabled)}
              className={[
                "relative inline-flex h-7 w-12 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                enabled ? "border-moss bg-moss" : "border-line bg-fog/50",
              ].join(" ")}
            >
              <span
                className={[
                  "pointer-events-none absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                  enabled ? "translate-x-[1.35rem]" : "translate-x-0.5",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="sr-only">
                {enabled
                  ? t("analysis.sectionIncluded")
                  : t("analysis.sectionExcluded")}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {active ? (
        <div className="mt-4 border-t border-line/40 pt-4">{children}</div>
      ) : enableable ? (
        <p className="mt-3 text-sm text-muted">{t("analysis.sectionOffHint")}</p>
      ) : null}
    </section>
  );
}
