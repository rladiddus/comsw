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

// 보이는 줄(ids)만 끌어 옮긴 뒤, 전체 순서(sort_order)에서 그 줄들이 있던 자리에 새 순서로 다시 넣는다.
// 다른 줄의 자리와 순서 없는 줄(null)은 그대로 두고, 0..n-1로 다시 매겨 바뀐 줄만 돌려준다.
export function subsetReorderUpdates(rows, ids, from, to) {
  const all = rows.filter((r) => r.sort_order != null).sort((a, b) => a.sort_order - b.sort_order);
  const mine = all.filter((r) => ids.includes(r.id));
  if (from === to || from < 0 || to < 0 || from >= mine.length || to >= mine.length) return [];
  const moved = [...mine];
  moved.splice(to, 0, ...moved.splice(from, 1));
  let k = 0;
  return all
    .map((r) => (ids.includes(r.id) ? moved[k++] : r))
    .map((r, sort_order) => ({ id: r.id, sort_order }))
    .filter((u) => rows.find((r) => r.id === u.id).sort_order !== u.sort_order);
}
