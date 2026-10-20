import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { assetUrl } from "../utils/assetUrl.js";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function LoginPage() {
  const { t } = useI18n();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const dest = location.state?.from || "/";
    return <Navigate to={dest} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(failMessage(err, t, "auth.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-2xl border border-line/80 bg-paper/90 p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img
            src={assetUrl("helix-logo.png")}
            alt={t("layout.logoAlt")}
            className="h-14 w-auto"
            width={88}
            height={56}
          />
          <h1 className="font-display text-lg text-ink">{t("auth.signInTitle")}</h1>
          <p className="text-center text-sm text-muted">{t("auth.signInHint")}</p>
        </div>
        {error ? (
          <p className="mb-3 rounded-xl border border-warn-border bg-warn-bg px-3 py-2 text-sm text-warn">
            {error}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("admin.username")}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("auth.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              required
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-60"
          >
            {submitting ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
