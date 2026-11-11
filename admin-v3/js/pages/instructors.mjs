import { el, pick, chip, btn, panel, table, select, headActions, nameOf } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { mountCardList } from "../../../admin/js/card-list.mjs";
import { instructorCard } from "../../../admin/js/pages/instructors.mjs";
import { modal } from "../v3.mjs";

// 강사 관리(V3 시안 '강사·재직 관리'): 재직 상태는 사이트 공개(is_listed)와 다르다(재직 칸은 DB 추가 전).
// 강사 목록 오른쪽 위 [학과 ▾][강사 ▾] + (전체)(공개)(비공개)(계정 연결) 탭. 줄을 누르면 그 강사 카드(기존 강사 화면과 같은 카드)를 팝업으로 연다.
// 계정 연결 탭은 기존 '계정 연결' 화면(쌤톡 회원 ↔ 강사).
// 줄 오른쪽 끝 공개 체크로 바로 공개/비공개(실제 저장). 전체 탭은 공개 강사가 위, 비공개가 아래.
// 팝업에서 저장하면(공개 체크·수정·삭제) 뒤의 목록을 바로 다시 읽어 그린다(새로고침 안 해도 됨).
const old = (file) => () => import(`../../../admin/js/pages/${file}.mjs`);
const TABS = [["all", "전체"], ["listed", "공개"], ["hidden", "비공개"], ["accounts", "계정 연결"]];
let tab = "all"; // 이 화면만 기억

export async function render(container, ctx) {
  const { supabase } = ctx;
  const people = () => Promise.all([
    pick(supabase, "instructors", "id, name, is_listed, account_uid, sort_order", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "instructor_departments", "instructor_id, department_id"),
    pick(supabase, "instructor_subjects", "instructor_id, subject_id, sort_order"),
  ]);
  const [[instructors, idepts, isubjects], depts, subjects] = await Promise.all([
    people(),
    pick(supabase, "departments", "id, name, sort_order", (q) => q.order("sort_order")),
    pick(supabase, "subjects", "id, name, sort_order", (q) => q.order("sort_order")),
  ]);
  // 강사·학과·과목 연결을 다시 읽어 목록을 새로 그린다(팝업에서 저장할 때마다).
  async function reload() {
    const fresh = await people().catch(() => null);
    if (!fresh) return;
    [instructors, idepts, isubjects].forEach((arr, i) => arr.splice(0, arr.length, ...fresh[i]));
    fillNames(); draw();
  }
  // 강사 추가: '새 강사'(비공개)를 만들고 바로 그 카드 팝업을 연다(이름·사진 등은 팝업에서 '수정').
  const add = btn("강사 추가", async () => {
    add.disabled = true;
    const { data, error } = await supabase.from("instructors").insert({ name: "새 강사", is_listed: false }).select().single();
    add.disabled = false;
    if (error) return alert(dbErrorMessage(error));
    instructors.push(data);
    fillNames(); draw(); open(data);
  }, true);
  headActions(ctx, add);
  const deptsOf = (id) => idepts.filter((x) => x.instructor_id === id).map((x) => x.department_id);

  // 강사 카드 팝업: 펼친 카드 한 장. 강사마다 같은 크기(.v3-tpop).
  async function open(i) {
    const box = el("div", { className: "v3-tpopbody" });
    const d = modal(`${i.name} 강사`, [box], [], "닫기");
    d.classList.add("v3-tpop");
    const base = instructorCard(supabase, depts, subjects);
    const card = await mountCardList(box, { ...base, fields: base.fields.filter((f) => f.key !== "gender"), activeLabel: "공개", query: (q) => q.eq("id", i.id), toolbar: false, sortable: false, onSaved: reload, onRows: (r) => { if (!r.length) reload(); } });
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

  const tabBar = el("div", { className: "v2-tabs v3-insttabs" }, TABS.map(([k, t]) =>
    Object.assign(el("button", { type: "button", className: "v2-tab", textContent: t }), { onclick: () => { tab = k; draw(); } })));
  const pickers = el("div", { className: "v2-row v2-gap" }, [deptPick, namePick]);
  let accounts = null; // 계정 연결 화면은 처음 열 때 한 번만 그린다
  const listBox = el("div");
  function draw() {
    [...tabBar.children].forEach((b, i) => b.classList.toggle("active", TABS[i][0] === tab));
    pickers.hidden = tab === "accounts";
    const head = [el("div", { className: "v2-row v2-gap" }, [pickers, tabBar])];
    if (tab === "accounts") {
      if (!accounts) { accounts = el("div", { className: "v3-instaccounts" }); old("accounts")().then((m) => m.render(accounts, ctx)).catch((e) => accounts.append(el("p", { className: "save-state err", textContent: e.message }))); }
      return listBox.replaceChildren(panel("강사 목록", [accounts], "", head));
    }
    const shown = instructors.filter((i) => (!deptPick.value || deptsOf(i.id).includes(deptPick.value)) && (!namePick.value || i.id === namePick.value)
      && (tab === "all" || (tab === "listed") === Boolean(i.is_listed)))
      .sort((a, b) => Number(Boolean(b.is_listed)) - Number(Boolean(a.is_listed))); // 공개 위, 비공개 아래(그 안은 강사 순서)
    // 공개 체크: 줄을 눌러 팝업이 열리지 않게 막고 바로 저장
    const listedBox = (i) => {
      const box = el("input", { type: "checkbox", checked: Boolean(i.is_listed), title: "사이트 공개" });
      box.addEventListener("change", async () => {
        box.disabled = true;
        const { error } = await supabase.from("instructors").update({ is_listed: box.checked }).eq("id", i.id);
        box.disabled = false;
        if (error) { box.checked = !box.checked; return alert(dbErrorMessage(error)); }
        i.is_listed = box.checked;
        draw();
      });
      return el("label", { className: "v3-listed", onclick: (e) => e.stopPropagation() }, [box, el("span", { textContent: "공개" })]);
    };
    const t = table(["강사", "사이트", "담당 학과", "담당 과목", "공개"], shown, (i) => [
      i.name, i.is_listed ? chip("공개", "vacation") : chip("비공개"),
      deptsOf(i.id).map((id) => nameOf(depts, id)).join(", ") || "—",
      isubjects.filter((x) => x.instructor_id === i.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((x) => nameOf(subjects, x.subject_id)).join(", ") || "—",
      listedBox(i),
    ], open);
    t.node.classList.add("v3-instable");
    listBox.replaceChildren(panel("강사 목록", [t.node], "", head));
  }
  container.append(listBox); // 위쪽 숫자 카드(재직·퇴사·공개·계정 연결)는 2026-11-11 삭제
  draw();
}
