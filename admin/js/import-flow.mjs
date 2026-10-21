import { transform } from "../../tools/migrate/transform.mjs";
import { toImportPayload } from "../../tools/migrate/to-sql.mjs";

// GAS가 동기화해 둔 시트 원본(raw_sheet_rows). 공개 읽기라 익명 키로 읽는다.
export async function fetchRawRows({ url, anonKey }, fetchFn = fetch) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetchFn(`${url}/rest/v1/raw_sheet_rows?select=source_id,sheet_name,row_number,data&order=id.asc`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`시트 원본을 읽지 못했습니다 (HTTP ${res.status})`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function importFromSheets({ fetchRaw, supabase }) {
  const raw = await fetchRaw();
  if (!raw.length) throw new Error("시트 원본이 비어 있습니다");
  const model = transform(raw);
  const { data, error } = await supabase.rpc("comsw_import", { payload: toImportPayload(model) });
  if (error) throw new Error(error.message);
  return { counts: data, warnings: model.warnings };
}
