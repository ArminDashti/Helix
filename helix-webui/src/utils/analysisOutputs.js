/**
 * @typedef {{ chart: boolean, grid: boolean, research: boolean }} AnalysisOutputs
 */

/**
 * Map UI output toggles to API mode string.
 * @param {AnalysisOutputs} outputs
 * @returns {string | null} null when no output selected
 */
export function deriveApiMode(outputs) {
  const { chart, grid, research } = outputs;
  if (!chart && !grid && !research) return null;
  if (chart && grid && research) return "both";
  if (chart && research) return "both";
  if (chart && grid) return "chart_grid";
  if (grid && research) return "research";
  if (chart) return "chart";
  if (grid) return "grid";
  return "research";
}

export function wantsChart(outputs) {
  return Boolean(outputs?.chart);
}

export function wantsGrid(outputs) {
  return Boolean(outputs?.grid);
}

export function wantsResearch(outputs) {
  return Boolean(outputs?.research);
}

/**
 * Append optional section prompts and grid sort hints to the main prompt.
 * @param {string} main
 * @param {{
 *   research?: string,
 *   grid?: string,
 *   chart?: string,
 *   gridSortColumn?: string,
 *   gridSortDir?: string,
 * }} extras
 */
export function composeRunPrompt(main, extras = {}) {
  const base = String(main || "").trim();
  const blocks = [];
  const research = String(extras.research || "").trim();
  const grid = String(extras.grid || "").trim();
  const chart = String(extras.chart || "").trim();
  const sortCol = String(extras.gridSortColumn || "").trim();
  const sortDir = String(extras.gridSortDir || "ASC").trim().toUpperCase();

  if (research) blocks.push(`Research instructions:\n${research}`);
  if (grid) blocks.push(`Grid instructions:\n${grid}`);
  if (chart) blocks.push(`Chart instructions:\n${chart}`);
  if (sortCol) {
    blocks.push(`Sort the result grid by "${sortCol}" ${sortDir === "DESC" ? "DESC" : "ASC"}.`);
  }
  if (!blocks.length) return base;
  return `${base}\n\n---\n${blocks.join("\n\n")}`;
}

