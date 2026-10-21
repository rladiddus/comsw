// 공개 사이트(assets/js/supabase-client.js)와 같은 규칙으로 셀 값을 다룬다.

export function normText(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[​‌‍﻿ ]/g, "").trim();
}

export function truthy(v) {
  if (v === true) return true;
  return ["true", "y", "yes", "1", "checked"].includes(normText(v).toLowerCase());
}

export function deptKeyword(name) {
  return normText(name).replace(/학과$/, "");
}

export function splitMulti(v) {
  return normText(v).split(/[,;\/\n\r]+/).map(normText).filter(Boolean);
}

export function splitRoadmapNames(v) {
  const names = normText(v).split(/,|\n| \/ /).map(s => normText(s).replace(/\s+/g, " ")).filter(Boolean);
  return [...new Set(names)];
}

export function prepCategory(v) {
  const t = normText(v).replace(/\s+/g, "");
  if (t === "교재명" || t === "교재") return "textbook";
  if (t === "준비물") return "supply";
  if (["ai툴", "aitool", "ai도구"].includes(t.toLowerCase())) return "ai";
  return null;
}
