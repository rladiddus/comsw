// 학과·과목: 학과 구성(학과 추가·이름 수정, 끌어서 순서) / 전체 과목(넓은 목록) / 삭제된 과목.
// 과목을 누르면 팝업(강사 팝업과 같은 크기): 왼쪽 강사 넣기·빼기, 오른쪽 공통 4단계(문구·대표 이미지). 바꾸면 떠 있는 창으로 저장·적용.
// 학과 추가·이름 수정, 과목 삭제·복원은 팝업에서 눌러 바로 반영.
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, fill, note, fail, busy, publishBanner, modal } from "../ui.mjs";
import { baseName, deptOrder, stepState } from "../rules.mjs";
import { deptLayout } from "./dept-layout.mjs";
import { commonEditor } from "./common-editor.mjs";
import { canSwitch, unsaved, untrack, applyTracked } from "../changes.mjs";

let state = { tab: "depts", dept: null };

export async function render({ main, params = [] }) {
  if (params[0]) state.tab = params[0];
  if (params[1]) state.dept = params[1];
  const reload = () => render({ main });
  main.replaceChildren(head("학과·과목", "학과마다 과목 구성과 순서를 정하고, 과목마다 공통 4단계 커리큘럼을 정리합니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const cat = await data.catalog();
    const subjects = data.live(cat.subjects);
    const weeks = await data.weeks();
    const general = weeks.filter((w) => !w.set_id);
    const stepsOf = (id) => general.filter((w) => w.subject_id === id).sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    const deptsOf = (id) => cat.links.filter((l) => l.subject_id === id).map((l) => cat.departments.find((d) => d.id === l.department_id)?.name).filter(Boolean);
    const vacsOf = (id) => cat.vacLinks.filter((l) => l.subject_id === id).map((l) => cat.vacations.find((v) => v.id === l.set_id)?.name).filter(Boolean);
    const out = h("div");
    const msg = h("div");
    const banner = await publishBanner(data.unpublished);
    const stepPill = (s) => { const st = stepState(stepsOf(s.id).length); return pill(st.label, st.kind); };

    // 과목 팝업: 왼쪽 강사, 오른쪽 공통 4단계. 전체 과목에서 열면 [과목 삭제]도.
    const openSubject = (s, { withDelete = false } = {}) => {
      const popMsg = h("div");
      const steps = stepsOf(s.id);
      const extra = [
        h("hr", { style: "border:0;border-top:1px solid var(--line);margin:14px 0" }),
        s.duration ? h("p", { class: "muted" }, `과정 기간 ${s.duration}`) : null,
        s.relink_needed ? note("복원한 과목입니다. 학과나 방학 특강에 다시 넣기 전에는 홈페이지에 나오지 않습니다.") : null,
        h("a", { class: "btn", href: `#/prep/${encodeURIComponent(baseName(s.name))}` }, `공통 준비물(${baseName(s.name)})`),
        withDelete ? h("div", { style: "margin-top:10px" }, h("button", { type: "button", class: "btn danger", onclick: (e) => busy(e.currentTarget, popMsg, async () => {
          const d = deptsOf(s.id), v = vacsOf(s.id);
          const where = [d.length ? `학과: ${d.join(", ")}` : "", v.length ? `방학 특강: ${v.join(", ")}` : ""].filter(Boolean).join("\n") || "연결된 학과·방학 특강 없음";
          if (!confirm(`'${s.name}' 과목을 삭제할까요?\n\n빠지는 곳\n${where}\n\n자료는 보관되고 홈페이지에는 바로 반영됩니다.`)) return;
          await data.call("comsw_v4_delete_subject", { p_id: s.id });
          pop.close();
          state.tab = "deleted"; reload();
        }) }, "과목 삭제")) : null,
      ];
      const editor = commonEditor(s, cat, steps.length === 4 ? steps : [], { msg: popMsg, reload: () => { pop.close(); reload(); }, extraLeft: extra });
      const st = stepState(steps.length);
      const applyBtn = h("button", { type: "button", class: "btn primary", onclick: () => busy(applyBtn, popMsg, () => applyTracked(editor.trackId)) }, "사이트 적용");
      const pop = modal(`${s.name} · 공통 커리큘럼(일반)`, h("div", { class: "modal-body" },
        popMsg, h("div", { class: "row" }, h("span", { class: "muted" }, deptsOf(s.id).join(", ") || "학과 없음"), pill(`공개 중 ${st.label}`, st.kind)),
        h("div", { class: "modal-main", style: "margin-top:10px" }, editor)), {
        beforeClose: () => !unsaved() || confirm("임시 저장하지 않은 바뀐 설정이 있습니다. 닫으면 사라집니다. 닫을까요?"),
        onClose: () => untrack(editor.trackId),
        actions: [applyBtn],
      });
    };

    // 학과 추가·이름 수정 팝업(바로 반영)
    const deptPopup = (d) => {
      const popMsg = h("div");
      const input = h("input", { value: d?.name ?? "", "aria-label": "학과 이름", placeholder: "예: 게임학과", style: "width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:5px" });
      const ok = h("button", { type: "button", class: "btn primary" }, d ? "수정" : "추가");
      const pop = modal(d ? "학과명 수정" : "학과 추가", h("section", { class: "box", style: "margin:0" }, popMsg,
        h("label", { class: "step", style: "display:block" }, h("b", {}, "학과 이름"), input),
        h("p", { class: "muted" }, d ? "바꾸면 사이트 전체에서 새 이름이 보입니다(바로 반영)." : "추가하면 바로 반영되고, 학과 구성에서 과목을 넣을 수 있습니다."),
        h("div", { class: "actions" }, ok)));
      pop.dlg.classList.add("modal-small");
      ok.onclick = () => busy(ok, popMsg, async () => {
        if (!input.value.trim()) throw new Error("학과 이름을 입력해주세요");
        state.dept = await data.call("comsw_v4_save_department", { p_id: d?.id ?? null, p_name: input.value.trim() });
        pop.close();
        reload();
      });
      input.focus();
    };

    const draw = () => {
      const top = tabs([["depts", "학과 구성"], ["subjects", "전체 과목"], ["deleted", "삭제된 과목"]], state.tab, (t) => { if (!canSwitch()) return; state.tab = t; draw(); });
      let view;
      if (state.tab === "depts") {
        state.dept = cat.departments.some((d) => d.id === state.dept) ? state.dept : cat.departments[0]?.id;
        const dept = cat.departments.find((d) => d.id === state.dept);
        const ordered = deptOrder(cat.links.filter((l) => l.department_id === state.dept), subjects);
        view = [
          h("div", { class: "chips" },
            cat.departments.map((d) => h("button", { type: "button", "aria-pressed": String(d.id === state.dept), onclick: () => { if (!canSwitch()) return; state.dept = d.id; draw(); } }, d.name)),
            h("button", { type: "button", class: "add-chip", onclick: () => deptPopup(null) }, "+ 학과 추가")),
          h("div", { style: "height:14px" }),
          dept ? deptLayout(dept, ordered, subjects, { msg, reload, stepPill, openSubject: (id) => openSubject(subjects.find((x) => x.id === id)), rename: () => deptPopup(dept) })
            : box(null, fail("학과가 없습니다. [+ 학과 추가]로 만들어주세요.")),
        ];
      } else if (state.tab === "subjects") {
        view = [box(`과목 ${subjects.length}개 · 과목을 누르면 공통 커리큘럼 팝업`, table([
          ["과목", (s) => h("span", { class: "subject-chip" }, s.name)],
          ["준비물 기준", (s) => (baseName(s.name) === s.name ? "—" : baseName(s.name))],
          ["학과", (s) => deptsOf(s.id).join(", ") || pill("학과 없음", "neutral")],
          ["방학 특강", (s) => vacsOf(s.id).join(", ") || "—"],
          ["공통", stepPill],
        ], subjects, { onPick: (s) => openSubject(s, { withDelete: true }) }))];
      } else {
        const gone = cat.subjects.filter((s) => s.deleted_at);
        view = data.hasDeleteColumn(cat.subjects)
          ? [box(`삭제된 과목 ${gone.length}개`, note("복원하면 과목과 자료만 돌아옵니다. 학과·방학 특강·순서·홈페이지 노출은 다시 연결해야 합니다."),
            table([["과목", (s) => s.name], ["삭제한 때", (s) => new Date(s.deleted_at).toLocaleString("ko-KR")],
              ["", (s) => h("button", { type: "button", class: "btn", onclick: (e) => busy(e.currentTarget, msg, async () => {
                if (!confirm(`'${s.name}' 과목을 복원할까요? 과목과 자료만 돌아오고, 학과·방학 특강에는 다시 넣어야 합니다.`)) return;
                await data.call("comsw_v4_restore_subject", { p_id: s.id });
                state.tab = "subjects"; reload();
              }) }, "복원")]], gone))]
          : [box(null, note("삭제된 과목 보관은 DB 준비(V4 2단계 SQL) 뒤에 사용할 수 있습니다."))];
      }
      out.replaceChildren(banner, msg, top, ...view);
    };
    draw();
    return out;
  });
}
