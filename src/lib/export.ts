import type { AppRole } from "@/hooks/use-current-user";
import { getDirection, getLanguage, getLocale, tr } from "@/lib/i18n";

export type ExportFormat = "xlsx" | "pdf" | "docx" | "csv";

export type ExportTable = {
  title: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
};

export type ExportPayload = {
  fileName: string;
  orgName: string;
  tables: ExportTable[];
};

/** Formats each role may use. Payroll data is never offered to non-admins (callers pass `payroll`). */
export function allowedFormats(role: AppRole | null, opts: { payroll?: boolean } = {}): ExportFormat[] {
  if (role === "admin") return ["xlsx", "pdf", "docx", "csv"];
  if (opts.payroll) return [];
  if (role === "operator") return ["xlsx", "pdf"];
  if (role === "viewer") return ["pdf"];
  return [];
}

function cell(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function esc(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RTL/LTR document with the embedded Cairo font so Arabic letters are joined correctly. */
export function buildDocumentHtml(payload: ExportPayload, forWord = false) {
  const dir = getDirection();
  const lang = getLanguage();
  const date = new Intl.DateTimeFormat(getLocale(), { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const align = dir === "rtl" ? "right" : "left";
  const tables = payload.tables
    .map(
      (t) => `<h2>${esc(t.title)}</h2>
<table><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${
        t.rows.length
          ? t.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(cell(v))}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${t.columns.length}">${esc(tr("لا توجد بيانات"))}</td></tr>`
      }</tbody></table>`,
    )
    .join("");
  const wordHead = forWord
    ? `<meta name="ProgId" content="Word.Document"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->`
    : "";
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">${wordHead}
<title>${esc(payload.fileName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm}
body{font-family:'Cairo','Droid Arabic Kufi','Segoe UI',Tahoma,Arial,sans-serif;direction:${dir};text-align:${align};color:#111;margin:0}
.head{border-bottom:3px solid #1E52E6;padding-bottom:8px;margin-bottom:14px}
.head h1{margin:0;font-size:20px;color:#1E52E6}.head p{margin:2px 0 0;font-size:12px;color:#555}
h2{font-size:15px;margin:16px 0 6px}
table{width:100%;border-collapse:collapse;font-size:12px;direction:${dir}}
th{background:#1E52E6;color:#fff;font-weight:700}
th,td{border:1px solid #cfd6e4;padding:6px 8px;text-align:${align}}
tr:nth-child(even) td{background:#f4f6fb}
</style></head><body dir="${dir}">
<div class="head"><h1>${esc(payload.orgName || tr("نظام الموارد البشرية"))}</h1><p>${esc(payload.fileName)} — ${esc(date)}</p></div>
${tables}</body></html>`;
}

export async function runExport(format: ExportFormat, payload: ExportPayload) {
  const base = payload.fileName.replace(/[\\/:*?"<>|]+/g, "-");
  if (format === "csv") {
    const lines: string[] = [];
    for (const t of payload.tables) {
      lines.push(t.title, t.columns.join(","));
      for (const r of t.rows) lines.push(r.map((v) => `"${cell(v).replace(/"/g, '""')}"`).join(","));
      lines.push("");
    }
    download(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    return;
  }
  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: getDirection() === "rtl" }] };
    payload.tables.forEach((t, i) => {
      const ws = XLSX.utils.aoa_to_sheet([[payload.orgName], [t.title], [], t.columns, ...t.rows.map((r) => r.map((v) => v ?? ""))]);
      ws["!cols"] = t.columns.map(() => ({ wch: 20 }));
      const name = (t.title || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, "").slice(0, 28) || `Sheet${i + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, `${i + 1}-${name}`.slice(0, 31));
    });
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}.xlsx`);
    return;
  }
  if (format === "docx") {
    const html = buildDocumentHtml(payload, true);
    download(new Blob(["\uFEFF" + html], { type: "application/msword" }), `${base}.doc`);
    return;
  }
  // PDF: the browser renders with the Cairo font (correct Arabic shaping), then "Save as PDF".
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(buildDocumentHtml(payload));
  doc.close();
  const win = frame.contentWindow!;
  try {
    await Promise.race([(doc as Document).fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* ignore */
  }
  win.focus();
  win.print();
  setTimeout(() => frame.remove(), 60_000);
}
