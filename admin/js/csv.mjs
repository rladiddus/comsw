// 엑셀에서 한글이 깨지지 않도록 BOM을 붙이고, 수식으로 실행될 수 있는 칸은 '로 막는다.
export function toCsv(headers, rows) {
  const cell = v => {
    const s = String(v ?? "");
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return "﻿" + [headers, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
}
