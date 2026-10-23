import { AGENT_ICON_OPTIONS, DEFAULT_AGENT_ICON_ID } from "../lib/agentIcons.js";

export default function AgentIconPicker({ value, onChange, label }) {
  const selected = value || DEFAULT_AGENT_ICON_ID;

  return (
    <div className="block text-sm">
      {label ? (
        <span className="font-medium text-ink">{label}</span>
      ) : null}
      <div
        className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10"
        role="radiogroup"
        aria-label={label}
      >
        {AGENT_ICON_OPTIONS.map(({ id, Icon }) => {
          const active = id === selected;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              title={id}
              onClick={() => onChange(id)}
              className={[
                "flex h-10 w-full items-center justify-center rounded-xl border transition-colors",
                active
                  ? "border-moss bg-moss/15 text-moss ring-2 ring-moss/30"
                  : "border-line bg-fog/40 text-ink hover:border-moss/50 hover:bg-fog",
              ].join(" ")}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
