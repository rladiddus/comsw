// 이름이 고유해야 하는 표(메뉴·특강)에서 새 줄 기본 이름이 겹치지 않게 한다.
export function freeName(prefix, rows, key) {
  const taken = new Set(rows.map(r => r[key]));
  let n = 1;
  while (taken.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

export function nextOrder(rows) {
  const orders = rows.map(r => r.sort_order).filter(n => typeof n === "number");
  return orders.length ? Math.max(...orders) + 1 : 0;
}

// 화면 순서 기준으로 0..n-1을 다시 매긴 뒤 두 줄을 맞바꾸고, 값이 바뀌는 줄만 돌려준다.
export function moveUpdates(rows, index, delta) {
  const target = index + delta;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return [];
  const ids = rows.map(r => r.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  const before = new Map(rows.map(r => [r.id, r.sort_order]));
  return ids
    .map((id, sort_order) => ({ id, sort_order }))
    .filter(u => before.get(u.id) !== u.sort_order)
    .sort((a, b) => rows.findIndex(r => r.id === a.id) - rows.findIndex(r => r.id === b.id));
}
