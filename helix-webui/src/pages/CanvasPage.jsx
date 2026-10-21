import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, FileDown, LayoutTemplate, Upload } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import IconButton from "../components/IconButton.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { fetchBranding } from "../api/client.js";
import { assetUrl } from "../utils/assetUrl.js";
import {
  buildPdfHtml,
  exportResultPdf,
  renderSampleChartDataUrl,
} from "../lib/exportResultPdf.js";
import {
  DEFAULT_PDF_DESIGN,
  FONT_OPTIONS,
  PDF_ELEMENT_IDS,
  designForExport,
  loadPdfDesign,
  normalizePdfDesign,
  savePdfDesign,
} from "../lib/pdfDesign.js";

const SAMPLE_GRID = {
  columns: ["Region", "Revenue", "Units"],
  rows: [
    { Region: "North", Revenue: 420, Units: 12 },
    { Region: "South", Revenue: 310, Units: 9 },
    { Region: "East", Revenue: 510, Units: 15 },
    { Region: "West", Revenue: 280, Units: 7 },
  ],
};

const SAMPLE_GRID_FA = {
  columns: ["منطقه", "درآمد", "واحد"],
  rows: [
    { منطقه: "شمال", درآمد: 420, واحد: 12 },
    { منطقه: "جنوب", درآمد: 310, واحد: 9 },
    { منطقه: "شرق", درآمد: 510, واحد: 15 },
    { منطقه: "غرب", درآمد: 280, واحد: 7 },
  ],
};

const ELEMENT_LABEL_KEYS = {
  header: "canvas.elementHeader",
  helixLogo: "canvas.showHelixLogo",
  companyLogo: "canvas.showCompanyLogo",
  title: "canvas.showTitle",
  charts: "canvas.showCharts",
  text: "canvas.showText",
  grid: "canvas.showGrid",
  footer: "canvas.showFooter",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

const TEXT_ALIGN_ELEMENTS = new Set(["title", "text", "footer"]);

export default function CanvasPage() {
  const { t, locale } = useI18n();
  const [design, setDesign] = useState(() => loadPdfDesign());
  const [selectedElement, setSelectedElement] = useState("header");
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [designNotice, setDesignNotice] = useState(null);

  const pdfLabels = useMemo(
    () => ({
      pdfAlert: t("results.pdfAlert"),
      pdfTitle: t("results.pdfTitle"),
      pdfHeading: t("results.pdfHeading"),
      pdfChartAlt: t("results.pdfChartAlt"),
      pdfLogoAlt: t("results.pdfLogoAlt"),
      pdfCompanyLogoAlt: t("results.pdfCompanyLogoAlt"),
      pdfFooter: t("results.pdfFooter"),
    }),
    [t],
  );

  const samplePrompt = t("canvas.samplePrompt");
  const sampleReport = t("canvas.sampleReport");
  const previewPrompt = useMemo(
    () => (design.reportTitleOverride || "").trim() || samplePrompt,
    [design.reportTitleOverride, samplePrompt],
  );
  const sampleGrid = locale === "fa" ? SAMPLE_GRID_FA : SAMPLE_GRID;
  const footerFallback = pdfLabels.pdfFooter;

  const activeEl = design.elements?.[selectedElement] || {};

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const logoDataUrl = await fetch(assetUrl("helix-logo.png"))
        .then((r) => (r.ok ? r.blob() : null))
        .then(
          (blob) =>
            new Promise((resolve) => {
              if (!blob) return resolve("");
              const reader = new FileReader();
              reader.onloadend = () =>
                resolve(
                  typeof reader.result === "string" ? reader.result : "",
                );
              reader.readAsDataURL(blob);
            }),
        )
        .catch(() => "");

      let companyLogoDataUrl = design.companyLogoDataUrl || "";
      if (!companyLogoDataUrl) {
        try {
          const branding = await fetchBranding();
          companyLogoDataUrl =
            branding?.branding?.company_logo_data_url || "";
        } catch {
          companyLogoDataUrl = "";
        }
      }
      if (!companyLogoDataUrl) {
        companyLogoDataUrl = await fetch(assetUrl("company-logo.png"))
          .then((r) => (r.ok ? r.blob() : null))
          .then(
            (blob) =>
              new Promise((resolve) => {
                if (!blob) return resolve("");
                const reader = new FileReader();
                reader.onloadend = () =>
                  resolve(
                    typeof reader.result === "string" ? reader.result : "",
                  );
                reader.readAsDataURL(blob);
              }),
          )
          .catch(() => "");
      }
      if (cancelled) return;
      const sampleChart = renderSampleChartDataUrl(
        locale === "fa" ? "fa" : "en",
      );
      const { html } = buildPdfHtml({
        prompt: previewPrompt,
        textReport: sampleReport,
        grid: sampleGrid,
        chartImages: sampleChart ? [sampleChart] : [],
        language: locale === "fa" ? "fa" : "en",
        labels: pdfLabels,
        logoDataUrl,
        companyLogoDataUrl,
        design,
        footerSampleText:
          (design.footerText || "").trim() || footerFallback,
      });
      setPreviewHtml(html);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    design,
    locale,
    previewPrompt,
    sampleReport,
    sampleGrid,
    pdfLabels,
    footerFallback,
  ]);

  function persistDesign(next) {
    const saved = savePdfDesign(next);
    setDesign(saved);
  }

  function updateTopLevel(key, value) {
    persistDesign({ ...design, [key]: value });
  }

  function updateElementField(field, value) {
    const id = selectedElement;
    persistDesign({
      ...design,
      elements: {
        ...design.elements,
        [id]: {
          ...(design.elements?.[id] || {}),
          [field]: value,
        },
      },
    });
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(t("canvas.logoInvalid"));
      return;
    }
    if (file.size > 250_000) {
      setLogoError(t("canvas.logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl =
        typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setLogoError(t("canvas.logoInvalid"));
        return;
      }
      updateTopLevel("companyLogoDataUrl", dataUrl);
    };
    reader.onerror = () => setLogoError(t("canvas.logoInvalid"));
    reader.readAsDataURL(file);
  }

  function handlePreviewClick(event) {
    const target = event.target.closest("[data-canvas-element]");
    if (!target) return;
    const id = target.getAttribute("data-canvas-element");
    if (id && PDF_ELEMENT_IDS.includes(id)) {
      setSelectedElement(id);
    }
  }

  async function handleExportSample() {
    setSaving(true);
    try {
      const sampleChart = renderSampleChartDataUrl(
        locale === "fa" ? "fa" : "en",
      );
      await exportResultPdf({
        prompt: previewPrompt,
        textReport: sampleReport,
        grid: sampleGrid,
        chartImages: sampleChart ? [sampleChart] : [],
        language: locale === "fa" ? "fa" : "en",
        labels: pdfLabels,
        logoUrl: assetUrl("helix-logo.png"),
        companyLogoUrl: design.companyLogoDataUrl
          ? ""
          : assetUrl("company-logo.png"),
        locale,
        design,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const next = {
      ...DEFAULT_PDF_DESIGN,
      elements: { ...DEFAULT_PDF_DESIGN.elements },
    };
    savePdfDesign(next);
    setDesign(loadPdfDesign());
    setSelectedElement("header");
    setLogoError(null);
    setDesignNotice(null);
  }

  async function handleCopyDesign() {
    setDesignNotice(null);
    try {
      const json = JSON.stringify(designForExport(design), null, 2);
      await navigator.clipboard.writeText(json);
      setDesignNotice(t("canvas.designCopied"));
    } catch {
      setDesignNotice(t("canvas.designCopyFailed"));
    }
  }

  function handleImportDesignFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setDesignNotice(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const raw = JSON.parse(String(reader.result || "{}"));
        const next = normalizePdfDesign(raw);
        persistDesign(next);
        setDesignNotice(t("canvas.designImported"));
      } catch {
        setDesignNotice(t("canvas.designImportInvalid"));
      }
    };
    reader.onerror = () => setDesignNotice(t("canvas.designImportInvalid"));
    reader.readAsText(file);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <PageHeader icon={LayoutTemplate} title={t("canvas.title")}>
        <p className="mt-1 text-sm text-muted">{t("canvas.subtitle")}</p>
      </PageHeader>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <aside
          className="h-full min-h-0 space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-line/80 bg-paper/80 p-4"
          onWheel={(e) => e.stopPropagation()}
        >
          <h2 className="text-sm font-semibold text-ink">
            {t("canvas.options")}
          </h2>

          <div>
            <label
              htmlFor="canvas_element"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.selectElement")}
            </label>
            <select
              id="canvas_element"
              value={selectedElement}
              onChange={(e) => setSelectedElement(e.target.value)}
              className={inputClass}
            >
              {PDF_ELEMENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(ELEMENT_LABEL_KEYS[id] || id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="canvas_visibility"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.visibility")}
            </label>
            <select
              id="canvas_visibility"
              value={activeEl.visible === false ? "hide" : "show"}
              onChange={(e) =>
                updateElementField("visible", e.target.value === "show")
              }
              className={inputClass}
            >
              <option value="show">{t("canvas.visible")}</option>
              <option value="hide">{t("canvas.hidden")}</option>
            </select>
          </div>

          {selectedElement === "title" ? (
            <div>
              <label
                htmlFor="canvas_title_override"
                className="block text-sm font-medium text-ink"
              >
                {t("canvas.reportTitleOverride")}
              </label>
              <input
                id="canvas_title_override"
                type="text"
                value={design.reportTitleOverride ?? ""}
                placeholder={samplePrompt}
                onChange={(e) =>
                  updateTopLevel("reportTitleOverride", e.target.value)
                }
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">{t("canvas.reportTitleHint")}</p>
            </div>
          ) : null}

          {selectedElement === "footer" ? (
            <div>
              <label
                htmlFor="canvas_footer_text"
                className="block text-sm font-medium text-ink"
              >
                {t("canvas.footerText")}
              </label>
              <textarea
                id="canvas_footer_text"
                rows={3}
                value={design.footerText ?? ""}
                placeholder={footerFallback}
                onChange={(e) => updateTopLevel("footerText", e.target.value)}
                className={inputClass}
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="el_font"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.font")}
            </label>
            <select
              id="el_font"
              value={activeEl.fontFamily || DEFAULT_PDF_DESIGN.elements.header.fontFamily}
              onChange={(e) => updateElementField("fontFamily", e.target.value)}
              className={inputClass}
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="el_font_size" className="block text-sm font-medium text-ink">
              {t("canvas.fontSizePx")}
            </label>
            <input
              id="el_font_size"
              type="number"
              min={8}
              max={48}
              value={activeEl.fontSizePx ?? 14}
              onChange={(e) =>
                updateElementField("fontSizePx", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="el_color" className="block text-sm font-medium text-ink">
              {t("canvas.color")}
            </label>
            <input
              id="el_color"
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(activeEl.color || "")
                  ? activeEl.color
                  : "#111111"
              }
              onChange={(e) => updateElementField("color", e.target.value)}
              className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-line bg-fog/40"
            />
          </div>

          <div>
            <label htmlFor="el_border_color" className="block text-sm font-medium text-ink">
              {t("canvas.borderColor")}
            </label>
            <input
              id="el_border_color"
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(activeEl.borderColor || "")
                  ? activeEl.borderColor
                  : "#3d9b82"
              }
              onChange={(e) => updateElementField("borderColor", e.target.value)}
              className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-line bg-fog/40"
            />
          </div>

          {TEXT_ALIGN_ELEMENTS.has(selectedElement) ? (
            <div>
              <label
                htmlFor="el_text_align"
                className="block text-sm font-medium text-ink"
              >
                {t("canvas.textAlign")}
              </label>
              <select
                id="el_text_align"
                value={
                  activeEl.textAlign && activeEl.textAlign !== "inherit"
                    ? activeEl.textAlign
                    : selectedElement === "title"
                      ? "center"
                      : "left"
                }
                onChange={(e) => updateElementField("textAlign", e.target.value)}
                className={inputClass}
              >
                <option value="left">{t("canvas.alignLeft")}</option>
                <option value="center">{t("canvas.alignCenter")}</option>
                <option value="right">{t("canvas.alignRight")}</option>
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="el_bg" className="block text-sm font-medium text-ink">
              {t("canvas.backgroundColor")}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="el_bg"
                type="color"
                aria-label={t("canvas.backgroundColor")}
                value={
                  /^#[0-9a-fA-F]{6}$/.test(activeEl.backgroundColor || "")
                    ? activeEl.backgroundColor
                    : "#ffffff"
                }
                onChange={(e) =>
                  updateElementField("backgroundColor", e.target.value)
                }
                className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-line bg-fog/40"
              />
              <input
                type="text"
                value={activeEl.backgroundColor || "transparent"}
                onChange={(e) =>
                  updateElementField("backgroundColor", e.target.value)
                }
                className="h-10 w-full min-w-0 rounded-xl border border-line bg-fog/40 px-3 text-sm outline-none focus:border-moss"
                spellCheck={false}
              />
            </div>
          </div>

          <div>
            <label htmlFor="el_border_w" className="block text-sm font-medium text-ink">
              {t("canvas.borderThickness")}
            </label>
            <input
              id="el_border_w"
              type="number"
              min={0}
              max={8}
              value={activeEl.borderWidthPx ?? 1}
              onChange={(e) =>
                updateElementField("borderWidthPx", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="el_border_r" className="block text-sm font-medium text-ink">
              {t("canvas.borderCorner")}
            </label>
            <input
              id="el_border_r"
              type="number"
              min={0}
              max={24}
              value={activeEl.borderRadiusPx ?? 14}
              onChange={(e) =>
                updateElementField("borderRadiusPx", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="el_padding" className="block text-sm font-medium text-ink">
              {t("canvas.paddingPx")}
            </label>
            <input
              id="el_padding"
              type="number"
              min={0}
              max={48}
              value={activeEl.paddingPx ?? 14}
              onChange={(e) =>
                updateElementField("paddingPx", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div className="border-t border-line/60 pt-3">
            <label
              htmlFor="pdf_orientation"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.orientation")}
            </label>
            <select
              id="pdf_orientation"
              value={design.orientation || "landscape"}
              onChange={(e) => updateTopLevel("orientation", e.target.value)}
              className={inputClass}
            >
              <option value="landscape">{t("canvas.landscape")}</option>
              <option value="portrait">{t("canvas.portrait")}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pdf_page_bg"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.pageBackground")}
            </label>
            <input
              id="pdf_page_bg"
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(design.pageBackgroundColor || "")
                  ? design.pageBackgroundColor
                  : "#ffffff"
              }
              onChange={(e) =>
                updateTopLevel("pageBackgroundColor", e.target.value)
              }
              className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-line bg-fog/40"
            />
          </div>

          <div>
            <label htmlFor="pdf_margin" className="block text-sm font-medium text-ink">
              {t("canvas.pageMarginMm")}
            </label>
            <input
              id="pdf_margin"
              type="number"
              min={8}
              max={24}
              value={design.pageMarginMm ?? 12}
              onChange={(e) =>
                updateTopLevel("pageMarginMm", Number(e.target.value))
              }
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t("canvas.pdfFooterExtras")}</p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={design.footerShowDate !== false}
                onChange={(e) =>
                  updateTopLevel("footerShowDate", e.target.checked)
                }
                className="size-4 rounded border-line text-moss focus:ring-moss"
              />
              {t("canvas.footerShowDate")}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={design.footerShowPageNumbers !== false}
                onChange={(e) =>
                  updateTopLevel("footerShowPageNumbers", e.target.checked)
                }
                className="size-4 rounded border-line text-moss focus:ring-moss"
              />
              {t("canvas.footerShowPageNumbers")}
            </label>
          </div>

          <div>
            <label
              htmlFor="pdf_company_logo"
              className="block text-sm font-medium text-ink"
            >
              {t("canvas.changeLogo")}
            </label>
            <input
              id="pdf_company_logo"
              type="file"
              accept="image/*"
              onChange={handleLogoFile}
              className="mt-1 block w-full text-sm text-ink file:me-2 file:rounded-lg file:border-0 file:bg-moss file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
            {design.companyLogoDataUrl ? (
              <button
                type="button"
                onClick={() => updateTopLevel("companyLogoDataUrl", "")}
                className="mt-2 text-xs font-medium text-moss hover:underline"
              >
                {t("canvas.clearLogo")}
              </button>
            ) : null}
            {logoError ? (
              <p className="mt-1 text-xs text-warn">{logoError}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <IconButton
              type="button"
              icon={FileDown}
              disabled={saving}
              onClick={handleExportSample}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-60"
            >
              {t("canvas.exportSample")}
            </IconButton>
            <IconButton
              type="button"
              icon={ClipboardCopy}
              onClick={handleCopyDesign}
              className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
            >
              {t("canvas.copyDesign")}
            </IconButton>
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
            >
              <Upload className="size-4 shrink-0" aria-hidden="true" />
              {t("canvas.importDesign")}
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={handleImportDesignFile}
              />
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
            >
              {t("canvas.reset")}
            </button>
          </div>
          {designNotice ? (
            <p className="text-xs text-moss" role="status">{designNotice}</p>
          ) : null}
        </aside>

        <div className="min-h-0 overflow-auto rounded-2xl border border-line/80 bg-fog/30 p-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t("canvas.preview")}
          </h2>
          <div
            className="overflow-auto rounded-xl border border-line bg-white p-2 shadow-sm"
            onClick={handlePreviewClick}
            onKeyDown={() => {}}
            role="presentation"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
}
