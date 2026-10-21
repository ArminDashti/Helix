import { useCallback, useEffect, useMemo } from "react";
import { LogOut, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import IconButton from "../components/IconButton.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";

function profileInitials(firstName, lastName, username) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  const source = `${first} ${last}`.trim() || String(username || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function splitDisplayName(displayName, username) {
  const source = String(displayName || "").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  const fallback = parts[0] || String(username || "").trim();
  return { firstName: fallback, lastName: "" };
}

export default function ProfilePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading, logout, refresh } = useAuth();

  const close = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const { firstName, lastName } = useMemo(
    () => splitDisplayName(user?.display_name, user?.username),
    [user?.display_name, user?.username],
  );

  const initials = useMemo(
    () => profileInitials(firstName, lastName, user?.username),
    [firstName, lastName, user?.username],
  );

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={close}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line/80 px-4 py-3">
          <h2 id="profile-modal-title" className="font-display text-lg font-semibold text-ink">
            {t("profile.title")}
          </h2>
          <IconButton
            type="button"
            icon={X}
            onClick={close}
            className="rounded-lg border border-line p-1.5 text-muted hover:bg-fog hover:text-ink"
            title={t("common.close")}
            aria-label={t("common.close")}
          />
        </header>

        <div className="space-y-4 px-4 py-5">
          {loading && !user ? (
            <p className="text-center text-sm text-muted">{t("common.loading")}</p>
          ) : null}

          {!loading && !user ? (
            <p className="text-center text-sm text-muted">{t("profile.unavailable")}</p>
          ) : null}

          {user ? (
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="flex size-20 items-center justify-center rounded-2xl bg-moss/15 font-display text-2xl font-semibold text-moss"
                  aria-hidden="true"
                >
                  {initials}
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="rounded-xl border border-line/80 bg-fog/30 px-3 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {t("profile.firstName")}
                  </dt>
                  <dd className="mt-1 text-ink">{firstName || t("common.noneDash")}</dd>
                </div>
                <div className="rounded-xl border border-line/80 bg-fog/30 px-3 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {t("profile.lastName")}
                  </dt>
                  <dd className="mt-1 text-ink">{lastName || t("common.noneDash")}</dd>
                </div>
                <div className="rounded-xl border border-line/80 bg-fog/30 px-3 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {t("admin.username")}
                  </dt>
                  <dd className="mt-1 text-ink">{user.username}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </div>

        {user ? (
          <footer className="shrink-0 border-t border-line/80 px-4 py-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-fog px-4 py-2.5 text-sm font-medium text-ink hover:bg-fog/80"
            >
              <LogOut className="size-4" aria-hidden />
              {t("auth.signOut")}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
