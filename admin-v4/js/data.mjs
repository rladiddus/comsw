// V4가 DB를 읽는 곳. 화면(pages)은 supabase를 직접 부르지 않고 여기 함수만 쓴다.
// 1단계: 읽기만. select("*")라 2단계 SQL로 생기는 칸(deleted_at, 학과별 sort_order 등)도 있으면 그대로 따라온다.
// 연결(로그인 토큰을 쓰는 supabase)은 app.mjs가 시작할 때 넣는다(테스트는 가짜 DB).
let db = null;
export const useDb = (client) => { db = client; };

const PAGE = 1000;
// 표 전체(1000줄 넘으면 나눠 읽음). 실패하면 던진다(빈 목록으로 숨기지 않음).
export async function all(table, build = (q) => q) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(db.from(table).select("*")).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

export const live = (subjects) => subjects.filter((s) => !s.deleted_at);
export const hasDeleteColumn = (subjects) => subjects.some((s) => "deleted_at" in s);

export async function catalog() {
  const [departments, subjects, links, sets, vacLinks] = await Promise.all([
    all("departments", (q) => q.order("sort_order", { nullsFirst: false })),
    all("subjects", (q) => q.order("sort_order", { nullsFirst: false })),
    all("subject_departments"),
    all("curriculum_sets", (q) => q.order("sort_order", { nullsFirst: false })),
    all("vacation_set_subjects"),
  ]);
  return { departments, subjects, links, sets, vacLinks, vacations: sets.filter((s) => s.is_vacation) };
}

export const weeks = (subjectIds) => all("subject_weeks", (q) => (subjectIds ? q.in("subject_id", subjectIds) : q).order("sort_order", { nullsFirst: false }));
export const curricula = (build) => all("instructor_curricula", build);
export const instructors = () => all("instructors", (q) => q.order("sort_order", { nullsFirst: false }));
export const instructorDepartments = () => all("instructor_departments");
export const instructorSubjects = (id) => all("instructor_subjects", (q) => q.eq("instructor_id", id));
export const profileDrafts = () => all("instructor_profile_drafts");
export const prepItems = () => all("course_prep_items", (q) => q.order("sort_order", { nullsFirst: false }));
export const materials = (build) => all("instructor_subject_materials", build);
export const seminars = () => all("seminars", (q) => q.order("sort_order", { nullsFirst: false }));
export const applications = (seminarId) => all("seminar_applications", (q) => q.eq("seminar_id", seminarId).order("created_at"));
export const applicationCounts = async () => {
  const { data, error } = await db.rpc("comsw_seminar_counts");
  if (error) throw new Error(`신청 수: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.id, Number(r.applied ?? 0)]));
};
export const mainMedia = () => all("main_media", (q) => q.order("sort_order", { nullsFirst: false }));
export const loadingItems = () => all("loading_items", (q) => q.order("sort_order", { nullsFirst: false }));
export const menus = () => all("menus", (q) => q.order("sort_order", { nullsFirst: false }));
export const settings = () => all("site_settings");
export const myInstructor = async (uid) => (await all("instructors", (q) => q.eq("account_uid", uid)))[0] ?? null;

// DB 함수 부르기. 실패하면 DB가 준 이유로 던진다(성공으로 보이지 않게).
export async function call(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    const missing = error.code === "PGRST202" || /Could not find the function/i.test(error.message ?? "");
    throw new Error(missing ? "DB 준비(V4 SQL) 전이라 아직 쓸 수 없습니다" : error.message);
  }
  return data;
}
// 다른 곳에서 고치고 사이트에 반영하지 않은 변경이 있나(있으면 V4 확정이 멈춤). DB 준비 전이면 null.
export const unpublished = () => call("comsw_v4_unpublished").catch(() => null);
