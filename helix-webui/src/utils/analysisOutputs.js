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
