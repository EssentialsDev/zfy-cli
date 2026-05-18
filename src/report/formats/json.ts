import type { EoyReport } from "../eoy.js";

export function formatJson(report: EoyReport, pretty = true): string {
  return pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
}
