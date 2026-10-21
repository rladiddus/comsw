// 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다.
export function toCsv(headers, rows) {
  const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [headers, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
}
