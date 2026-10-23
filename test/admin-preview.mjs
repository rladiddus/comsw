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
    { instructor_id: "demo-teacher", subject_id: "illustrator", sort_order: 2 },
    { instructor_id: "demo-teacher", subject_id: "web1", sort_order: 3 },
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
  site_settings: [{ key: "roadmap_logo_url", value: "" }],
  main_media: [
    { id: "media-1", url: "", caption: "A creative design study for\ninspiring change", is_active: true, sort_order: 0 },
    { id: "media-2", url: "", caption: "두 번째 배경 문구", is_active: false, sort_order: 1 },
  ],
  menus: [],
  loading_items: [
    { id: "load-1", image_url: "", text: "For Masterpieces", font_family: "Great Vibes", font_size: "1.25rem, 3.5vw, 3rem", font_weight: "400", is_active: true, sort_order: 0 },
    { id: "load-2", image_url: "", text: "꿈을 디자인하다", font_family: "Paperlogy", font_size: "1.25rem, 3.5vw, 3rem", font_weight: "800", is_active: false, sort_order: 1 },
  ],
};

// 조회하기 화면 확인용: 김선생의 승인된 2~4단계(이미지는 내장 SVG).
const sample = (n, color) =>
  "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="${color}"/><text x="500" y="540" font-size="140" text-anchor="middle" fill="#fff" font-family="sans-serif">${n}단계</text></svg>`,
  );
Object.assign(data.departments[0], { name_en: "Visual Design", description: "포토샵·일러스트로 시작해 브랜드 디자인 포트폴리오까지 완성하는 학과입니다.", image_url: sample("", "#fa491d") });
Object.assign(data.departments[1], { name_en: "Web Design", description: "웹 퍼블리싱과 UI 디자인을 함께 배웁니다." });
data.instructors[0].photo_url = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672"><rect width="941" height="1672" fill="#dfe6ee"/><circle cx="470" cy="520" r="230" fill="#8a9bb0"/><rect x="170" y="820" width="600" height="852" rx="280" fill="#8a9bb0"/></svg>');
Object.assign(data.subjects[0], { duration: "4주", program: "포토샵 CC", level: "★★☆☆☆" });
Object.assign(data.subjects[1], { duration: "4주", program: "일러스트레이터 CC", level: "★★★☆☆" });
// 커리큘럼 관리 > 신청 과목 확인용: 학과 커리큘럼 문구·로드맵·김선생의 승인 대기 2단계.
data.subjects[0].dept_curriculum = "01 포토샵 기본 툴과 레이어\n02 보정과 합성";
data.subjects[1].dept_curriculum = "01 벡터 드로잉 기초\n02 로고·아이콘 제작";
data.subject_weeks = [
  { id: "sw1", subject_id: "photoshop", week_label: "1단계", summary: "인터페이스와 레이어 기초", sort_order: 0 },
  { id: "sw2", subject_id: "photoshop", week_label: "2단계", summary: "선택 도구와 보정", sort_order: 1 },
];
data.roadmap_tracks = [{ id: "rt1", name: "시각편집 로드맵", department_id: "design", sort_order: 0 }];
data.roadmap_steps = [{ id: "rs1", track_id: "rt1", position: 1, source_text: "포토샵과 일러스트로 디자인 툴 기초를 다집니다", summary: "툴 기초\n이미지 편집" }];
data.roadmap_step_subjects = [{ step_id: "rs1", subject_id: "photoshop", sort_order: 0 }, { step_id: "rs1", subject_id: "illustrator", sort_order: 1 }];
for (const [n, text] of [[1, "포토샵 화면 구성과 레이어 개념을 익히고 간단한 포스터를 만듭니다."], [2, "선택 도구와 마스크, 보정 레이어로 사진을 자연스럽게 합성합니다."]]) {
  data.instructor_curricula.push({
    id: `pending-${n}`, instructor_id: "demo-teacher", set_id: "design-set", subject_id: "photoshop",
    step_label: `${n}단계`, written: text, summary: null, status: "pending", sort_order: 10 + n,
    media_url: sample(`신청 ${n}`, n === 1 ? "#c0392b" : "#2980b9"), updated_at: new Date().toISOString(),
  });
}
data.main_media[0].url = sample("배경 1", "#222");
data.loading_items[0].image_url = sample("", "#334");
data.loading_items[1].image_url = sample("", "#6a4");
data.main_media[1].url = sample("배경 2", "#fa491d");
data.instructor_curricula[0].step_label = "1단계";
data.instructor_curricula[0].media_url = sample(1, "#fa491d");
for (const [n, color, text] of [
  [2, "#2f6fed", "선택 도구와 마스크로 사진을 합성하고, 보정 레이어로 분위기를 맞춥니다."],
  [3, "#1c9a6c", "타이포그래피와 그리드를 활용해 SNS 카드뉴스 3종을 완성합니다."],
  [4, "#8a4fd8", "지금까지 만든 결과물을 정리해 포트폴리오 한 페이지로 구성합니다."],
]) {
  data.instructor_curricula.push({
    id: `curriculum-demo-${n}`,
    instructor_id: "demo-teacher",
    set_id: "design-set",
    subject_id: "photoshop",
    step_label: `${n}단계`,
    written: text,
    status: "approved",
    sort_order: n,
    media_url: sample(n, color),
  });
}

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
// 가상 쌤톡 학과(쌤톡 회원 문서 majors). 수업 설정에서 저장하면 바뀐다.
const MAJORS = { newbie: ["시각편집학과"], demo: ["시각편집학과"], head: [] };
let me = PEOPLE.newbie;
const ownId = () => data.instructors.find((i) => i.account_uid === me.uid)?.id;

const supabase = fakeSupabase(data);
supabase.rpc = async (name, args) => {
  if (name === "comsw_create_my_instructor") {
    const id = `instructor-${me.uid}`;
    data.instructors.push({ id, name: args.p_name, account_uid: me.uid, is_listed: false });
    return { data: id, error: null };
  }
  if (name === "comsw_set_my_classes") {
    const id = ownId();
    const keep = (list, key, ids) =>
      list.splice(0, Infinity, ...list.filter((x) => x.instructor_id !== id || ids.includes(x[key])));
    keep(data.instructor_departments, "department_id", args.p_department_ids);
    keep(data.instructor_subjects, "subject_id", args.p_subject_ids);
    for (const d of args.p_department_ids) {
      if (!data.instructor_departments.some((x) => x.instructor_id === id && x.department_id === d)) {
        data.instructor_departments.push({ instructor_id: id, department_id: d });
      }
    }
    for (const sId of args.p_subject_ids) {
      if (!data.instructor_subjects.some((x) => x.instructor_id === id && x.subject_id === sId)) {
        data.instructor_subjects.push({ instructor_id: id, subject_id: sId, sort_order: 99 });
      }
    }
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
  // 화면 확인용 AI(실제 호출 없음): 종류별 예시 문장.
  summarize: async (kind) => ({
    text: {
      week: "기본 도구와 레이어를 활용한 포스터 제작 (예시 요약)",
      department: "01 포토샵 기본 툴과 레이어 이해 (예시)\n02 마스크·보정으로 사진 합성 (예시)",
      roadmap: "툴 기초 다지기\n사진 합성 입문",
    }[kind] ?? "예시 문장",
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
  const paths = { departments: "department-tabs", instructors: "instructor-tabs", "curriculum-admin": "curriculum-admin" };
  await mountPage(
    document.querySelector("#demoContent"),
    () => import(`../admin/js/pages/${paths[id] || id}.mjs`),
    {
      supabase,
      uid: me.uid,
      displayName: me.name,
      role: me.role,
      loadMyName: async () => me.name,
      loadMyMajors: async () => MAJORS[me.uid] ?? [],
      saveMyMajors: async (_uid, list) => {
        MAJORS[me.uid] = list;
      },
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
