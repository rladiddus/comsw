// V4 업무 규칙(docs/v4-설계.md 9장). 화면과 DB 함수가 같은 규칙을 쓴다.

export const STEPS = 4; // 강사별·공통 커리큘럼 모두 과목당 4단계 고정

// 기준 과목: 이름 맨 끝 숫자(개월 나눔)만 뗀다. "캐드1"·"라이노 1" → "캐드"·"라이노", "3D맥스"는 그대로.
export function baseName(name) {
  const s = String(name ?? "").trim();
  const base = s.replace(/\s*\d+(\s*~\s*\d+)?$/, "").trim(); // 끝 숫자나 범위(1~2)
  return base || s;
}

// 단계 수 상태: 0 = 아직 없음, 4 = 정상, 그 밖 = 공개는 그대로 두고 "4단계로 다시 정리 필요"
export function stepState(count) {
  if (!count) return { ok: false, label: "단계 없음", kind: "neutral" };
  if (count === STEPS) return { ok: true, label: "4단계", kind: "" };
  return { ok: false, label: `${count}단계 · 4단계로 다시 정리 필요`, kind: "warn" };
}

// 학과 안 과목 순서: 학과별 순서(sort_order, 2단계 SQL 뒤)가 있으면 그것, 없으면 과목 전체 순서
export function deptOrder(links, subjects) {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  return links
    .filter((l) => byId.has(l.subject_id))
    .map((l) => ({ link: l, subject: byId.get(l.subject_id) }))
    .sort((a, b) => num(a.link.sort_order ?? a.subject.sort_order) - num(b.link.sort_order ?? b.subject.sort_order)
      || a.subject.name.localeCompare(b.subject.name, "ko"))
    .map((x) => x.subject);
}
const num = (v) => (v == null ? Number.MAX_SAFE_INTEGER : Number(v));

// 강사 커리큘럼 줄을 (강사, 과목, 일반/방학 특강) 한 건으로 묶는다. 대기 줄이 있으면 '이번 제출'.
export function curriculumUnits(rows) {
  const units = new Map();
  for (const r of rows) {
    const key = `${r.instructor_id}|${r.subject_id}|${r.set_id}|${r.vacation ? 1 : 0}`;
    const u = units.get(key) ?? { key, instructor_id: r.instructor_id, subject_id: r.subject_id, set_id: r.set_id, vacation: !!r.vacation, approved: [], pending: [] };
    u[r.status === "pending" ? "pending" : "approved"].push(r);
    units.set(key, u);
  }
  const bySort = (a, b) => num(a.sort_order) - num(b.sort_order);
  return [...units.values()].map((u) => ({ ...u, approved: u.approved.sort(bySort), pending: u.pending.sort(bySort) }));
}

// 로드맵 한 단계의 이름(공개 SQL v4_roadmap_label과 같은 규칙): 끝 숫자만 다른 과목들 → '캐드 1~2', 아니면 줄바꿈.
export function roadmapLabel(names) {
  const m = names.map((n) => String(n).trim().match(/^(.*?)\s*(\d+)$/));
  if (names.length >= 2 && m.every(Boolean) && new Set(m.map((x) => x[1].trim())).size === 1 && m[0][1].trim()) {
    const nums = m.map((x) => Number(x[2]));
    return `${m[0][1].trim()} ${Math.min(...nums)}~${Math.max(...nums)}`;
  }
  return names.join("\n");
}
