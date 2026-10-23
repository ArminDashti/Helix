import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, Eye, Save, Trash2, Upload } from "lucide-react";
import {
  ApiError,
  createRagDoc,
  deleteRagDoc,
  fetchRagDocs,
  updateRagDoc,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { formatNumber } from "../i18n/format.js";
import { renderMarkdownToHtml } from "../lib/markdownPreview.js";
import useFlash from "../lib/useFlash.js";
import { useLiveSync } from "../context/LiveSyncContext.jsx";

const RAG_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;

function ragIdFromFilename(filename) {
  const base = String(filename || "").replace(/\\/g, "/").split("/").pop() || "";
  let stem = base;
  if (/\.md$/i.test(stem)) stem = stem.slice(0, -3);
  return stem.trim();
}

export default function KnowledgeRagPanel() {
  const { t, locale } = useI18n();
  const [docs, setDocs] = useState([]);
  const [totals, setTotals] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [viewMode, setViewMode] = useState("source");
  const uploadRef = useRef(null);

  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId],
  );

  async function reload() {
    const data = await fetchRagDocs();
    const items = data.docs || [];
    setDocs(items);
    setTotals(data.totals || null);
    return items;
  }

  useEffect(() => {
    (async () => {
      try {
        const items = await reload();
        if (items[0]?.id) setSelectedId(items[0].id);
      } catch (err) {
        setError(failMessage(err, t, "rag.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useLiveSync("rag", () => reload().catch(() => {}));

  useEffect(() => {
    if (!selected) {
      setDraft("");
      setDirty(false);
      return;
    }
    setDraft(selected.content || "");
    setDirty(false);
  }, [selected?.id, selected?.content]);

  const filteredDocs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => {
      const hay = `${doc.id} ${doc.title || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [docs, filter]);

  async function persistUpload(file) {
    const name = file.name || "";
    if (!/\.md$/i.test(name)) {
      setError(t("rag.invalidExtension", { name }));
      return;
    }
    const id = ragIdFromFilename(name);
    if (!id || !RAG_ID_RE.test(id)) {
      setError(t("rag.invalidId", { name }));
      return;
    }
    const text = await file.text();
    const exists = docs.some((d) => d.id === id);
    if (
      exists &&
      !window.confirm(t("rag.overwriteConfirm", { id, filename: name }))
    ) {
      return;
    }
    if (exists) {
      return updateRagDoc(id, { content: text });
    }
    try {
      return await createRagDoc({ id, content: text });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        return updateRagDoc(id, { content: text });
      }
      throw err;
    }
  }

  async function handleUploadChange(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const imported = [];
    try {
      for (const file of files) {
        const item = await persistUpload(file);
        if (item) imported.push(item);
      }
      const items = await reload();
      const last = imported[imported.length - 1];
      if (last?.id) {
        setSelectedId(last.id);
        const fresh = items.find((d) => d.id === last.id);
        if (fresh) setDraft(fresh.content || "");
        setDirty(false);
      }
      if (imported.length === 1) {
        setStatus(t("rag.uploadedOne", { id: imported[0].id }));
      } else if (imported.length > 1) {
        setStatus(t("rag.uploadedMany", { count: imported.length }));
      }
    } catch (err) {
      setError(failMessage(err, t, "rag.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRagDoc(selectedId, { content: draft });
      setDocs((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d)),
      );
      setDraft(updated.content || "");
      setDirty(false);
      setStatus(t("rag.saved", { id: updated.id }));
      await reload();
    } catch (err) {
      setError(failMessage(err, t, "rag.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(t("rag.deleteConfirm", { id: selected.id }))) return;
    setError(null);
    try {
      await deleteRagDoc(selected.id);
      const items = await reload();
      const next = items[0]?.id ?? null;
      setSelectedId(next);
      setStatus(t("rag.deleted", { id: selected.id }));
    } catch (err) {
      setError(failMessage(err, t, "common.deleteFailed"));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("rag.loading")}</p>;
  }

  const budget = totals?.budget_tokens;
  const tokenTotal = totals?.tokens ?? 0;
  const docCount = totals?.docs ?? docs.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="shrink-0 text-sm text-muted">{t("rag.subtitle")}</p>
      {totals ? (
        <p className="shrink-0 text-xs text-muted">
          {t("rag.totals", {
            docs: formatNumber(docCount, locale),
            tokens: formatNumber(tokenTotal, locale),
            budget: budget != null ? formatNumber(budget, locale) : "—",
          })}
        </p>
      ) : null}
      <FlashMessage message={status} />
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(18rem,28rem)_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <div className="flex flex-wrap gap-1.5 px-1 pb-2">
            <input
              ref={uploadRef}
              type="file"
              accept=".md,text/markdown"
              multiple
              className="hidden"
              onChange={handleUploadChange}
            />
            <IconButton
              type="button"
              icon={Upload}
              disabled={uploading}
              onClick={() => uploadRef.current?.click()}
              className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
            >
              {uploading ? t("rag.uploading") : t("rag.upload")}
            </IconButton>
          </div>
          <label className="block px-1">
            <span className="sr-only">{t("rag.filterSr")}</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("rag.filterPlaceholder")}
              className="w-full rounded-lg border border-line bg-fog/40 px-2 py-1.5 text-sm outline-none focus:border-moss"
            />
          </label>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {docs.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">{t("rag.empty")}</li>
            ) : filteredDocs.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">{t("rag.noMatching")}</li>
            ) : (
              filteredDocs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(doc.id)}
                    className={[
                      "w-full rounded-xl px-3 py-1.5 text-start text-sm transition",
                      selectedId === doc.id
                        ? "bg-moss text-white"
                        : "text-ink hover:bg-fog",
                    ].join(" ")}
                  >
                    <span className="block font-medium">{doc.title || doc.id}</span>
                    <span
                      className={[
                        "block text-[11px]",
                        selectedId === doc.id ? "text-white/80" : "text-muted",
                      ].join(" ")}
                    >
                      {doc.id}
                      {doc.tokens != null
                        ? ` · ${formatNumber(doc.tokens, locale)} ${t("rag.tokensShort")}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-4">
          {!selected ? (
            <p className="text-sm text-muted">{t("rag.selectDoc")}</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">
                  {selected.title || selected.id}
                </h3>
                <div
                  className="flex flex-wrap gap-1"
                  role="group"
                  aria-label={t("markdown.editorModeAria")}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("source")}
                    className={[
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
                      viewMode === "source"
                        ? "bg-moss text-white"
                        : "border border-line bg-fog text-ink",
                    ].join(" ")}
                  >
                    <Code2 className="size-3.5" aria-hidden />
                    {t("markdown.source")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={[
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
                      viewMode === "preview"
                        ? "bg-moss text-white"
                        : "border border-line bg-fog text-ink",
                    ].join(" ")}
                  >
                    <Eye className="size-3.5" aria-hidden />
                    {t("markdown.preview")}
                  </button>
                </div>
              </div>
              {viewMode === "source" ? (
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setDirty(true);
                  }}
                  className="min-h-0 flex-1 resize-none rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
                  spellCheck={false}
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-fog/20 px-3 py-2 text-ink"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToHtml(draft),
                  }}
                />
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <IconButton
                  type="button"
                  icon={Save}
                  disabled={saving || !dirty}
                  onClick={handleSave}
                  className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("markdown.save")}
                </IconButton>
                <IconButton
                  type="button"
                  icon={Trash2}
                  onClick={handleDelete}
                  className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-xs font-medium text-warn hover:opacity-90"
                >
                  {t("markdown.delete")}
                </IconButton>
                {dirty ? (
                  <span className="text-xs text-muted">{t("rag.unsaved")}</span>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
