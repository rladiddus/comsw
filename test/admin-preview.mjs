import { navFor, routeFrom } from "../admin/js/router.mjs";
import { fakeSupabase } from "../admin/test/fake-supabase.mjs";
import { configureServices } from "../admin/js/services.mjs";
import { mountPage } from "../admin/js/mount.mjs";

const data = {
  instructors: [{
    id: "demo-teacher",
    name: "김선생",
    account_uid: "demo",
    career: "디지털 디자인 교육 5년",
    message: "기초부터 차근차근, 함께 완성하는 수업",
    is_listed: false,
  }],
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
  instructor_curricula: [{
    id: "curriculum-demo",
    instructor_id: "demo-teacher",
    set_id: "design-set",
    subject_id: "photoshop",
    step_label: "1주차",
    written:
      "포토샵의 기본 화면을 이해하고 선택 도구와 레이어를 활용해 나만의 첫 포스터를 제작합니다.",
    summary: "기본 도구와 레이어를 활용한 포스터 제작",
    status: "approved",
    sort_order: 0,
  }],
};
const supabase = fakeSupabase(data);
supabase.rpc = async (name, args) => {
  if (name === "comsw_submit_my_curriculum") {
    const payload = {
      set_id: args.p_set_id,
      instructor_id: "demo-teacher",
      subject_id: args.p_subject_id,
      step_label: args.p_step_label,
      written: args.p_written,
      summary: args.p_summary,
      media_url: args.p_media_url,
      status: "pending",
    };
    const existing = data.instructor_curricula.find((r) =>
      r.status === "pending" && r.set_id === payload.set_id &&
      r.subject_id === payload.subject_id && r.step_label === payload.step_label
    );
    if (existing) Object.assign(existing, payload);
    else {data.instructor_curricula.push({
        id: crypto.randomUUID(),
        ...payload,
      });}
  }
  if (name === "comsw_save_my_profile") {
    data.instructor_profile_drafts = [{
      instructor_id: "demo-teacher",
      name: args.p_name,
      career: args.p_career,
      message: args.p_message,
      source_asset_id: args.p_source_asset_id,
      source_consent: args.p_source_consent,
      status: "pending",
    }];
  }
  if (name === "comsw_approve_profile") {
    data.instructor_profile_drafts[0].status = "approved";
  }
  return { data: [], error: null };
};
configureServices({
  upload: async () => {
    throw new Error("화면 예시에서는 드라이브에 업로드하지 않습니다.");
  },
  summarize: async () => ({
    text: "기본 도구와 레이어를 활용한 포스터 제작",
    cached: true,
  }),
  generateProfile: async () => {
    throw new Error("화면 예시에서는 AI 사진을 생성하지 않습니다.");
  },
  status: async () => ({
    drive: false,
    ai: false,
    budget: { month: "2026-10", used: 0, limit: 3000 },
  }),
});
const role = document.querySelector("#demoRole");
async function show() {
  const current = role.value;
  const id = routeFrom(location.hash, current);
  document.querySelector("#roleName").textContent = current === "teacher"
    ? "선생님"
    : "학과장";
  document.querySelector("#demoNav").replaceChildren(
    ...navFor(current).map((n) => {
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
    { supabase, uid: "demo", displayName: "김선생", role: current },
  );
}
role.addEventListener("change", show);
window.addEventListener("hashchange", show);
show();
