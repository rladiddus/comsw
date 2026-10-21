// 삭제 경고용 개수. 세지 못하면 0으로 치지 않는다 — 경고 없이 함께 지워지는 것을 막는다.
export async function countRows(supabase, table, column, value) {
  const { count, error } = await supabase.from(table).select(column, { count: "exact", head: true }).eq(column, value);
  if (error || typeof count !== "number") throw new Error("함께 지워질 데이터 수를 확인하지 못했습니다. 잠시 후 다시 시도해주세요");
  return count;
}
