const STORAGE_KEY = "helix-analysis-prefill";

/** @param {Record<string, unknown>} data */
export function stashAnalysisPrefill(data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** @returns {Record<string, unknown> | null} */
export function consumeAnalysisPrefill() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
