// 학과·과목: 학과 구성 / 전체 과목 / 삭제된 과목. 과목 상세 = 공통 4단계 + 참고할 강사 자료(검수 완료본만).
// 학과 구성 저장(dept-layout), 공통 4단계 정리(common-editor), 과목 삭제·복원. 모두 그 건만 바로 공개.
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, media, fill, empty, note, busy, publishBanner } from "../ui.mjs";
import { baseName, deptOrder, stepState, curriculumUnits } from "../rules.mjs";
import { deptLayout } from "./dept-layout.mjs";
import { commonEditor } from "./common-editor.mjs";

let state = { tab: "depts", dept: null, subject: null };

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
    const countOf = (id) => general.filter((w) => w.subject_id === id).length;
    const deptsOf = (id) => cat.links.filter((l) => l.subject_id === id).map((l) => cat.departments.find((d) => d.id === l.department_id)?.name).filter(Boolean);
    const vacsOf = (id) => cat.vacLinks.filter((l) => l.subject_id === id).map((l) => cat.vacations.find((v) => v.id === l.set_id)?.name).filter(Boolean);
    const out = h("div");
    const msg = h("div");
    const banner = await publishBanner(data.unpublished);
    const stepPill = (s) => { const st = stepState(countOf(s.id)); return pill(st.label, st.kind); };

    const draw = () => {
      const top = tabs([["depts", "학과 구성"], ["subjects", "전체 과목"], ["deleted", "삭제된 과목"]], state.tab, (t) => { state.tab = t; state.subject = null; draw(); });
      let view;
      if (state.tab === "depts") {
        state.dept ??= cat.departments[0]?.id;
        const ordered = deptOrder(cat.links.filter((l) => l.department_id === state.dept), subjects);
        view = [
          tabs(cat.departments.map((d) => [d.id, d.name]), state.dept, (id) => { state.dept = id; draw(); }, "chips"),
          h("div", { style: "height:14px" }),
          deptLayout(cat.departments.find((d) => d.id === state.dept), ordered, subjects,
            { msg, reload, stepPill, openSubject: (id) => { state.subject = id; state.tab = "subjects"; draw(); } }),
        ];
      } else if (state.tab === "subjects") {
        const pick = subjects.find((s) => s.id === state.subject);
        view = [h("div", { class: "two" },
          box(`과목 ${subjects.length}개`, table([
            ["과목", (s) => s.name],
            ["준비물 기준", (s) => (baseName(s.name) === s.name ? "—" : baseName(s.name))],
            ["학과", (s) => deptsOf(s.id).join(", ") || pill("학과 없음", "neutral")],
            ["방학 특강", (s) => vacsOf(s.id).join(", ") || "—"],
            ["공통", stepPill],
          ], subjects, { selected: pick, onPick: (s) => { state.subject = s.id; draw(); } })),
          pick ? subjectDetail(pick, cat, general, { msg, reload, deptsOf, vacsOf }) : box(null, empty("과목을 고르면 공통 커리큘럼과 참고할 강사 자료가 나옵니다")))];
      } else {
        const gone = cat.subjects.filter((s) => s.deleted_at);
        view = data.hasDeleteColumn(cat.subjects)
          ? [box(`삭제된 과목 ${gone.length}개`, note("복원하면 과목과 자료만 돌아옵니다. 학과·방학 특강·순서·홈페이지 노출은 다시 연결해야 합니다."),
            table([["과목", (s) => s.name], ["삭제한 때", (s) => new Date(s.deleted_at).toLocaleString("ko-KR")],
              ["", (s) => h("button", { type: "button", class: "btn", onclick: (e) => busy(e.currentTarget, msg, async () => {
                if (!confirm(`'${s.name}' 과목을 복원할까요? 과목과 자료만 돌아오고, 학과·방학 특강에는 다시 넣어야 합니다.`)) return;
                await data.call("comsw_v4_restore_subject", { p_id: s.id });
                state.tab = "subjects"; state.subject = s.id; reload();
              }) }, "복원")]], gone))]
          : [box(null, note("삭제된 과목 보관은 DB 준비(V4 2단계 SQL) 뒤에 사용할 수 있습니다."))];
      }
      out.replaceChildren(banner, msg, top, ...view);
    };
    draw();
    return out;
  });
}

function subjectDetail(s, cat, general, { msg, reload, deptsOf, vacsOf }) {
  const steps = general.filter((w) => w.subject_id === s.id).sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
  const st = stepState(steps.length);
  return h("div", {},
    box(null,
      h("div", { class: "row" }, h("h3", {}, `${s.name} · 공개 중인 공통 커리큘럼(일반)`), pill(st.label, st.kind)),
      s.relink_needed ? note("복원한 과목입니다. 학과나 방학 특강에 다시 넣기 전에는 홈페이지에 나오지 않습니다.") : null,
      s.duration ? h("p", { class: "muted" }, `과정 기간 ${s.duration}`) : null,
      steps.length ? h("div", { class: "steps" }, steps.map((w) => h("div", { class: "step" },
        h("b", {}, w.week_label), h("p", {}, w.summary || w.written || "—"), w.image_url ? media(w.image_url) : null)))
        : empty("공통 커리큘럼이 아직 없습니다"),
      h("div", { class: "actions", style: "margin-top:10px" },
        h("a", { class: "btn", href: `#/prep/${encodeURIComponent(baseName(s.name))}` }, `공통 준비물 정리(${baseName(s.name)})`))),
    commonEditor(s, cat, steps.length === 4 ? steps : [], { msg, reload }),
    box("과목 삭제", h("p", { class: "muted" }, "학과에서만 빼려면 학과 구성에서 빼세요. 과목 삭제는 모든 학과·방학 특강에서 빠지고 삭제된 과목으로 옮겨집니다(자료는 보관, 복원 가능)."),
      h("button", { type: "button", class: "btn danger", onclick: (e) => busy(e.currentTarget, msg, async () => {
        const d = deptsOf(s.id), v = vacsOf(s.id);
        const where = [d.length ? `학과: ${d.join(", ")}` : "", v.length ? `방학 특강: ${v.join(", ")}` : ""].filter(Boolean).join("\n") || "연결된 학과·방학 특강 없음";
        if (!confirm(`'${s.name}' 과목을 삭제할까요?

빠지는 곳
${where}

자료는 보관되고 홈페이지에는 바로 반영됩니다.`)) return;
        await data.call("comsw_v4_delete_subject", { p_id: s.id });
        state.tab = "deleted"; state.subject = null; reload();
      }) }, "과목 삭제")));
}
