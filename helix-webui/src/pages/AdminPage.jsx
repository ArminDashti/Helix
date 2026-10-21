import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  createUser,
  deleteUser,
  fetchDbExplorerTables,
  fetchUsers,
  updateUser,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";
import useFlash from "../lib/useFlash.js";
const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

const emptyUserForm = {
  username: "",
  display_name: "",
  password: "",
  is_admin: false,
  data_access_plain: "",
  allowed_tables: [],
};

function isArmin(user) {
  return user?.id === "armin" || user?.username === "armin";
}

function tableName(item) {
  return String(item?.name || item?.table || "").trim();
}

export default function AdminPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [catalogTables, setCatalogTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState(null);

  async function reload() {
    const userList = await fetchUsers();
    setUsers(userList || []);
  }

  useLiveSync(["users"], () => reload().catch(() => {}));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await reload();
        const data = await fetchDbExplorerTables("tables");
        if (!cancelled) {
          const names = (data?.tables || [])
            .map(tableName)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
          setCatalogTables(names);
        }
      } catch (err) {
        if (!cancelled) setError(failMessage(err, t, "admin.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    function onFocusVis() {
      if (document.visibilityState !== "hidden") reload().catch(() => {});
    }
    document.addEventListener("visibilitychange", onFocusVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocusVis);
    };
  }, [t]);

  function resetUserForm() {
    setUserForm(emptyUserForm);
    setEditingUserId(null);
  }

  function toggleTable(name) {
    setUserForm((prev) => {
      const set = new Set(prev.allowed_tables);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return { ...prev, allowed_tables: [...set].sort() };
    });
  }

  const needsPlainAccess =
    !userForm.is_admin &&
    !isArmin(userForm) &&
    userForm.allowed_tables.length === 0;

  async function handleSaveUser(event) {
    event.preventDefault();
    setError(null);
    try {
      const payload = {
        username: userForm.username.trim(),
        display_name: userForm.display_name.trim(),
        is_admin: userForm.is_admin,
        data_access_plain: userForm.data_access_plain.trim(),
        allowed_tables: userForm.is_admin ? [] : [...userForm.allowed_tables],
      };
      if (!editingUserId) {
        if (!userForm.password.trim()) {
          setError(t("admin.passwordRequired"));
          return;
        }
        payload.password = userForm.password;
      } else if (userForm.password.trim()) {
        payload.password = userForm.password;
      }
      if (editingUserId) {
        await updateUser(editingUserId, payload);
        setStatus(t("admin.userSaved"));
      } else {
        await createUser(payload);
        setStatus(t("admin.userCreated"));
      }
      resetUserForm();
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "admin.saveFailed"));
    }
  }

  async function handleDeleteUser(user) {
    if (isArmin(user)) {
      setError(t("admin.cannotDeleteArmin"));
      return;
    }
    if (!window.confirm(t("admin.deleteConfirm", { username: user.username }))) return;
    setError(null);
    try {
      await deleteUser(user.id);
      if (editingUserId === user.id) resetUserForm();
      setStatus(t("admin.userDeleted"));
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "admin.deleteFailed"));
    }
  }

  const userRows = useMemo(
    () => users.map((item) => ({ key: item.id, item })),
    [users],
  );

  const userColumns = useMemo(
    () => [
      { key: "username", label: t("admin.username"), render: (user) => user.username },
      {
        key: "display",
        label: t("common.name"),
        render: (user) => user.display_name,
      },
      {
        key: "admin",
        label: t("admin.isAdmin"),
        render: (user) => (user.is_admin ? t("admin.yes") : t("admin.no")),
      },
      {
        key: "access",
        label: t("admin.dataAccess"),
        render: (user) =>
          user.is_admin
            ? t("admin.dataAccessAdmin")
            : (user.allowed_tables || []).join(", ") ||
              user.data_access_plain ||
              t("common.noneDash"),
      },
      {
        key: "edit",
        label: t("common.edit"),
        render: (user) => (
          <IconButton
            type="button"
            icon={Pencil}
            onClick={() => {
              setEditingUserId(user.id);
              setUserForm({
                username: user.username,
                display_name: user.display_name,
                password: "",
                is_admin: Boolean(user.is_admin),
                data_access_plain: user.data_access_plain || "",
                allowed_tables: [...(user.allowed_tables || [])],
              });
            }}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("common.edit")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("common.delete"),
        render: (user) =>
          isArmin(user) ? (
            <span className="text-xs text-muted">{t("admin.defaultAdmin")}</span>
          ) : (
            <IconButton
              type="button"
              icon={Trash2}
              onClick={() => handleDeleteUser(user)}
              className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
            >
              {t("common.delete")}
            </IconButton>
          ),
      },
    ],
    [t],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("admin.loading")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Shield} title={t("admin.title")} />
      <p className="text-sm">
        <Link
          to="/help?tab=guide"
          className="inline-flex items-center gap-1.5 text-moss hover:underline"
        >
          {t("admin.guideLink")}
        </Link>
      </p>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />

      <form
        onSubmit={handleSaveUser}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
      >
        <section className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-paper/80 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("admin.addUser")}
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("admin.username")}</span>
              <input
                value={userForm.username}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, username: e.target.value }))
                }
                className={inputClass}
                required
                disabled={Boolean(editingUserId)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("admin.displayName")}</span>
              <input
                value={userForm.display_name}
                onChange={(e) =>
                  setUserForm((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                className={inputClass}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">
                {editingUserId ? t("admin.passwordOptional") : t("auth.password")}
              </span>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, password: e.target.value }))
                }
                className={inputClass}
                required={!editingUserId}
                autoComplete="new-password"
              />
            </label>
          </div>
          <DataGrid columns={userColumns} rows={userRows} emptyLabel={t("admin.noUsers")} />
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-paper/80 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("admin.permission")}
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={userForm.is_admin || isArmin(userForm)}
              disabled={editingUserId === "armin" || isArmin(userForm)}
              onChange={(e) =>
                setUserForm((prev) => ({ ...prev, is_admin: e.target.checked }))
              }
            />
            <span className="font-medium text-ink">{t("admin.isAdmin")}</span>
          </label>
          {!userForm.is_admin && !isArmin(userForm) ? (
            <div className="block text-sm">
              <span className="font-medium text-ink">{t("admin.allowedTables")}</span>
              <p className="mt-1 text-xs text-muted">{t("admin.allowedTablesHint")}</p>
              <div
                className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line bg-fog/20 p-2"
              >
                {catalogTables.length === 0 ? (
                  <p className="text-xs text-muted">{t("admin.noCatalogTables")}</p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {catalogTables.map((name) => (
                      <li key={name}>
                        <label className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={userForm.allowed_tables.includes(name)}
                            onChange={() => toggleTable(name)}
                          />
                          <span className="truncate font-mono">{name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-ink">{t("admin.dataAccess")}</span>
            <textarea
              value={userForm.data_access_plain}
              onChange={(e) =>
                setUserForm((prev) => ({
                  ...prev,
                  data_access_plain: e.target.value,
                }))
              }
              rows={3}
              placeholder={t("admin.dataAccessPlaceholder")}
              className={inputClass}
              required={needsPlainAccess}
            />
            <span className="mt-1 block text-xs text-muted">
              {t("admin.dataAccessHint")}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <IconButton
              type="submit"
              icon={editingUserId ? Pencil : Plus}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
            >
              {editingUserId ? t("admin.saveUser") : t("admin.addUser")}
            </IconButton>
            {editingUserId ? (
              <button
                type="button"
                onClick={resetUserForm}
                className="rounded-xl border border-line px-3 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
        </section>
      </form>
    </div>
  );
}
