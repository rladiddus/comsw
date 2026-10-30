import { el, pick, chip, btn, stats, panel, table, editor, select, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { subpages } from "../../../admin/js/subpages.mjs";
import { mountCardList } from "../../../admin/js/card-list.mjs";
import { instructorCard } from "../../../admin/js/pages/instructors.mjs";
import { isEmployed, modal } from "../v3.mjs";

// 강사 관리(V3 시안 '강사·재직 관리'): 재직 상태는 사이트 공개(is_listed)와 다르다(재직 칸은 DB 추가 전).
// 강사 목록 오른쪽 위 [학과 ▾][강사 ▾]로 거르고, 줄을 누르면 그 강사 카드(기존 강사 화면과 같은 카드)를 팝업으로 연다.
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [instructors, depts, subjects, idepts, isubjects] = await Promise.all([
    pick(supabase, "instructors", "id, name, is_listed, account_uid, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "departments", "id, name, sort_order", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, sort_order", (q) => q.order("sort_order")),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "instructor_subjects", "instructor_id, subject_id, sort_order"),
  ]);
  const edit = editor("강사 추가·수정·계정 연결 (기존 화면)", async () => ({
    render: subpages("강사 편집", [["list", "강사", old("instructors"), { fresh: true }], ["accounts", "계정 연결", old("accounts")]]),
  }), ctx);
  headActions(ctx, btn("강사 추가", edit.open, true));
  const deptsOf = (id) => idepts.filter((x) => x.instructor_id === id).map((x) => x.department_id);

  // 강사 카드 팝업: 펼친 카드 한 장. 강사마다 같은 크기(.v3-tpop).
  async function open(i) {
    const box = el("div", { className: "v3-tpopbody" });
    const d = modal(`${i.name} 강사`, [box], [], "닫기");
    d.classList.add("v3-tpop");
    const card = await mountCardList(box, { ...instructorCard(supabase, depts, subjects), query: (q) => q.eq("id", i.id), toolbar: false, sortable: false });
    card.setFold(false);
  }

  // 오른쪽 위 고르기: 학과 → 그 학과 강사 이름
  const deptPick = select("학과", [["", "전체 학과"], ...depts.map((x) => [x.id, x.name])]);
  const namePick = select("강사", []);
  const fillNames = () => {
    const keep = namePick.value;
    const list = instructors.filter((i) => !deptPick.value || deptsOf(i.id).includes(deptPick.value));
    namePick.replaceChildren(...[["", "전체 강사"], ...list.map((i) => [i.id, i.name])].map(([v, t]) => el("option", { value: v, textContent: t })));
    namePick.value = list.some((i) => i.id === keep) ? keep : "";
  };
  deptPick.addEventListener("change", () => { fillNames(); draw(); });
  namePick.addEventListener("change", draw);
  fillNames();

  const statBox = el("div");
  const listBox = el("div");
  function draw() {
    const out = instructors.filter((i) => !isEmployed(i.id)).length;
    statBox.replaceChildren(stats([
      ["재직(확인 전)", `${instructors.length - out}`, "재직 상태는 아직 DB에 없음"],
      ["퇴사 처리(시험)", `${out}`, "과목 통합 커리큘럼 출처에서 빠짐", out > 0],
      ["사이트 공개", `${instructors.filter((i) => i.is_listed).length}`, "재직과 별개인 '사이트에 보이기'"],
      ["계정 연결", `${instructors.filter((i) => i.account_uid).length}`, "쌤톡 계정과 연결됨"],
    ]));
    const shown = instructors.filter((i) => (!deptPick.value || deptsOf(i.id).includes(deptPick.value)) && (!namePick.value || i.id === namePick.value));
    const t = table(["강사", "재직 상태", "사이트", "담당 학과", "담당 과목"], shown, (i) => [
      i.name, isEmployed(i.id) ? chip("재직", "good") : chip("퇴사(시험)", "red"), i.is_listed ? chip("공개", "vacation") : chip("비공개"),
      deptsOf(i.id).map((id) => nameOf(depts, id)).join(", ") || "—",
      isubjects.filter((x) => x.instructor_id === i.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((x) => nameOf(subjects, x.subject_id)).join(", ") || "—",
    ], open);
    t.node.classList.add("v3-instable");
    listBox.replaceChildren(panel("강사 목록", [t.node], "", [el("div", { className: "v2-row v2-gap" }, [deptPick, namePick])]));
  }
  container.append(statBox, listBox, edit.node);
  draw();
}
