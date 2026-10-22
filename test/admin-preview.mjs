import { navFor, routeFrom } from "../admin/js/router.mjs";
import { fakeSupabase } from "../admin/test/fake-supabase.mjs";
import { configureServices } from "../admin/js/services.mjs";
import { mountPage } from "../admin/js/mount.mjs";

// 화면 확인용 예시 데이터. 새로 고침하면 처음 상태로 돌아간다.
const data = {
  instructors: [{
    id: "demo-teacher",
    name: "김선생",
    account_uid: "demo",
    career: "디지털 디자인 교육 5년",
    message: "기초부터 차근차근, 함께 완성하는 수업",
    is_listed: false,
  }, { id: "unlinked", name: "최웹", account_uid: null, is_listed: true }],
  departments: [{
    id: "design",
    name: "시각편집학과",
    is_active: true,
    sort_order: 0,
  }, { id: "web", name: "웹학과", is_active: true, sort_order: 1 }],
  subjects: [{ id: "photoshop", name: "포토샵", sort_order: 0 }, {
    id: "illustrator",
    name: "일러스트레이터",
    sort_order: 1,
  }, { id: "web1", name: "웹디자인", sort_order: 2 }],
  subject_departments: [{ subject_id: "photoshop", department_id: "design" }, {
    subject_id: "illustrator",
    department_id: "design",
  }, { subject_id: "web1", department_id: "web" }],
  curriculum_sets: [{
    id: "design-set",
    department_id: "design",
    name: "시각편집학과",
    sort_order: 0,
  }, { id: "web-set", department_id: "web", name: "웹학과", sort_order: 1 }],
  instructor_departments: [
    { instructor_id: "demo-teacher", department_id: "design" },
    { instructor_id: "unlinked", department_id: "web" },
  ],
  instructor_subjects: [
    { instructor_id: "demo-teacher", subject_id: "photoshop", sort_order: 1 },
    { instructor_id: "unlinked", subject_id: "web1", sort_order: 1 },
  ],
  instructor_curricula: [{
    id: "curriculum-demo",
    instructor_id: "demo-teacher",
    set_id: "design-set",
    subject_id: "photoshop",
    step_label: "1단계",
    written:
      "포토샵의 기본 화면을 이해하고 선택 도구와 레이어를 활용해 나만의 첫 포스터를 제작합니다.",
    summary: "기본 도구와 레이어를 활용한 포스터 제작",
    status: "approved",
    sort_order: 0,
  }],
  instructor_profile_drafts: [],
  instructor_link_requests: [],
  site_settings: [],
};

// 확인할 사람. 선생님과 학과장이 같은 예시 데이터를 써서 '제출 → 학과장 승인' 흐름을 이어 볼 수 있다.
const PEOPLE = {
  newbie: { role: "teacher", uid: "newbie", name: "이새봄", badge: "선생님 · 처음 방문" },
  teacher: { role: "teacher", uid: "demo", name: "김선생", badge: "선생님 · 연결된 강사" },
  head: { role: "head", uid: "head", name: "박학과장", badge: "학과장" },
};
const MEMBERS = [
  { uid: "demo", name: "김선생", username: "kimteacher", majors: ["시각편집학과"] },
  { uid: "newbie", name: "이새봄", username: "spring", majors: ["시각편집학과"] },
  { uid: "web-member", name: "최웹", username: "choiweb", majors: ["웹학과"] },
];
let me = PEOPLE.newbie;
const ownId = () => data.instructors.find((i) => i.account_uid === me.uid)?.id;

const supabase = fakeSupabase(data);
supabase.rpc = async (name, args) => {
  if (name === "comsw_create_my_instructor") {
    const id = `instructor-${me.uid}`;
    data.instructors.push({ id, name: args.p_name, account_uid: me.uid, is_listed: false });
    return { data: id, error: null };
  }
  if (name === "comsw_submit_my_curriculum") {
    const payload = {
      set_id: args.p_set_id,
      instructor_id: ownId(),
      subject_id: args.p_subject_id,
      step_label: args.p_step_label,
      written: args.p_written,
      summary: null,
      media_url: args.p_media_url,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    const existing = data.instructor_curricula.find((r) =>
      r.status === "pending" && r.instructor_id === payload.instructor_id &&
      r.set_id === payload.set_id && r.subject_id === payload.subject_id &&
      r.step_label === payload.step_label
    );
    if (existing) Object.assign(existing, payload);
    else data.instructor_curricula.push({ id: crypto.randomUUID(), ...payload });
    return { data: existing?.id ?? null, error: null };
  }
  if (name === "comsw_approve_curriculum") {
    const row = data.instructor_curricula.find((r) => r.id === args.p_id);
    data.instructor_curricula.splice(
      0,
      data.instructor_curricula.length,
      ...data.instructor_curricula.filter((r) =>
        r === row ||
        !(r.status === "approved" && r.instructor_id === row.instructor_id &&
          r.subject_id === row.subject_id && r.step_label === row.step_label)
      ),
    );
    row.status = "approved";
  }
  if (name === "comsw_save_my_profile") {
    data.instructor_profile_drafts.splice(0, Infinity, {
      instructor_id: ownId(),
      name: args.p_name,
      career: args.p_career,
      message: args.p_message,
      source_asset_id: args.p_source_asset_id,
      source_consent: args.p_source_consent,
      status: "pending",
      updated_at: new Date().toISOString(),
    });
  }
  if (name === "comsw_approve_profile") {
    const d = data.instructor_profile_drafts[0];
    d.status = "approved";
    Object.assign(data.instructors.find((i) => i.id === d.instructor_id), {
      name: d.name,
      career: d.career,
      message: d.message,
      photo_url: d.photo_url || null,
    });
  }
  return { data: [], error: null };
};

// 업로드는 이 브라우저 안에서만 보여 준다(실제 저장소에 올리지 않음).
configureServices({
  upload: async (file, kind) => ({
    id: crypto.randomUUID(),
    filename: file.name,
    url: kind === "profile-source" ? null : URL.createObjectURL(file),
  }),
  summarize: async () => ({
    text: "기본 도구와 레이어를 활용한 포스터 제작 (예시 요약)",
    cached: false,
  }),
  generateProfile: async () => {
    throw new Error("화면 예시에서는 AI 사진을 생성하지 않습니다.");
  },
  status: async () => ({
    storage: false,
    ai: false,
    budget: { month: "2026-10", used: 0, limit: 3000 },
  }),
});

const who = document.querySelector("#demoRole");
async function show() {
  me = PEOPLE[who.value];
  const id = routeFrom(location.hash, me.role);
  document.querySelector("#roleName").textContent = me.badge;
  document.querySelector("#demoNav").replaceChildren(
    ...navFor(me.role).map((n) => {
      const a = document.createElement("a");
      a.href = `#/${n.id}`;
      a.textContent = n.label;
      if (n.id === id) a.className = "active";
      return a;
    }),
  );
  const paths = { main: "main-page" };
  await mountPage(
    document.querySelector("#demoContent"),
    () => import(`../admin/js/pages/${paths[id] || id}.mjs`),
    {
      supabase,
      uid: me.uid,
      displayName: me.name,
      role: me.role,
      loadMyName: async () => me.name,
      loadMembers: async () => MEMBERS,
    },
  );
}
who.addEventListener("change", () => {
  location.hash = "";
  show();
});
window.addEventListener("hashchange", show);
document.querySelector("#demoReset").addEventListener("click", () => location.reload());
show();
