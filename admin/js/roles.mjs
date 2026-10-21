const LABELS = { admin: "관리자", head: "학과장", teacher: "선생님" };

export function roleLabel(role) {
  return Object.hasOwn(LABELS, role) ? LABELS[role] : null;
}

export function canManage(role) {
  return role === "admin" || role === "head";
}

export function canEnter(role) {
  return Object.hasOwn(LABELS, role);
}
