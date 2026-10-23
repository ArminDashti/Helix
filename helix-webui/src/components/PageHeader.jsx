import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext.jsx";

const backButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line/70 bg-paper/50 text-muted shadow-sm backdrop-blur-sm transition hover:border-moss/35 hover:bg-fog/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/35";

function PageBackButton({ to, onBack, className = "" }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const label = t("common.back");

  function handleClick() {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  }

  const classNames = [backButtonClass, className].filter(Boolean).join(" ");

  if (to) {
    return (
      <Link
        to={to}
        className={classNames}
        title={label}
        aria-label={label}
      >
        <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={classNames}
      title={label}
      aria-label={label}
    >
      <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
    </button>
  );
}

export { PageBackButton };

export default function PageHeader({
  icon: Icon,
  title,
  actions,
  children,
  backTo,
  showBack = true,
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2.5">
        {showBack ? (
          <PageBackButton to={backTo} className="mt-0.5 sm:mt-1" />
        ) : null}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-xl text-ink sm:text-2xl">
            {Icon ? <Icon className="size-6 shrink-0" aria-hidden="true" /> : null}
            {title}
          </h1>
          {children}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
