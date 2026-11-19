// 방학 특강: 만들기·이름, 과목 구성(빼기 = 이 특강 연결만 해제), 홈페이지에 보일 특강. [저장] = 바로 공개.
// 특강 과목의 강사 자료는 강사 메뉴에서 특강별로 검수·확정하고, 과목마다 [공통 4단계 정리]로 이 특강 공통을 만든다(B안, 2026-11-19).
// 공통을 확정한 과목은 홈페이지 방학 특강에서 강사 원본 대신 공통 4단계가 보인다.
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, fill, empty, note, busy, publishBanner } from "../ui.mjs";
import { commonEditor } from "./common-editor.mjs";

let pick = null;
let open = null; // 공통 정리를 연 과목
const edits = new Map();

export async function render({ main }) {
  main.replaceChildren(head("방학 특강", "방학 특강을 만들고 과목을 구성합니다. 같은 과목도 일반 수업·특강별 자료는 따로입니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, settings, rows, vsteps] = await Promise.all([data.catalog(), data.settings(), data.curricula((q) => q.eq("status", "approved")),
      data.all("v4_vacation_steps", (q) => q.order("step")).catch(() => [])]);
    const shown = settings.find((s) => s.key === "vacation_set_id")?.value;
    const subjects = data.live(cat.subjects).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    const draw = () => {
      const opts = [...cat.vacations.map((v) => [v.id, `${v.name}${v.id === shown ? " (홈페이지)" : ""}`]), ["new", "+ 새 방학 특강"]];
      pick = opts.some(([v]) => v === pick) ? pick : opts[0][0];
      const v = cat.vacations.find((x) => x.id === pick);
      const ekey = v?.id ?? "new"; // 저장 전 체크 상태는 화면을 다시 그려도 남긴다
      if (!edits.has(ekey)) edits.set(ekey, new Set(cat.vacLinks.filter((l) => l.set_id === v?.id).map((l) => l.subject_id)));
      const chosen = edits.get(ekey);
      const name = h("input", { value: v?.name ?? "", "aria-label": "특강 이름", placeholder: "예: 2026 겨울방학특강", style: "width:100%" });
      const show = h("input", { type: "checkbox", checked: v ? v.id === shown : false });
      const count = (sid) => new Set(rows.filter((r) => r.set_id === v?.id && r.subject_id === sid).map((r) => r.instructor_id)).size;
      const save = h("button", { type: "button", class: "btn primary" }, v ? "저장(바로 공개)" : "만들기");
      save.onclick = () => busy(save, msg, async () => {
        if (!name.value.trim()) throw new Error("특강 이름을 입력해주세요");
        if (!confirm(`${name.value.trim()} 구성을 저장할까요? 홈페이지에 바로 반영됩니다.`)) return;
        edits.clear();
        pick = await data.call("comsw_v4_save_vacation", { p_id: v?.id ?? null, p_name: name.value.trim(), p_subjects: [...chosen], p_show: show.checked });
        render({ main });
      });
      out.replaceChildren(banner, msg, tabs(opts, pick, (id) => { pick = id; open = null; msg.replaceChildren(); draw(); }, "chips"), h("div", { style: "height:14px" }),
        h("div", { class: "two" },
          box(v ? v.name : "새 방학 특강", h("label", { class: "step" }, h("b", {}, "특강 이름"), name),
            h("label", { style: "display:flex;gap:8px;margin:10px 0" }, show, "홈페이지 방학 특강 페이지에 이 특강을 보여 주기"),
            note("과목을 빼면 이 특강과의 연결만 풀립니다. 과목과 다른 자료는 그대로입니다."),
            h("div", { class: "actions" }, save)),
          box(`과목 구성 · ${chosen.size}개`, subjects.length ? h("div", { style: "max-height:420px;overflow:auto" }, subjects.map((s) =>
            h("label", { style: "display:flex;gap:8px;align-items:center;margin:4px 0" },
              h("input", { type: "checkbox", checked: chosen.has(s.id), onchange: (e) => { e.target.checked ? chosen.add(s.id) : chosen.delete(s.id); } }),
              s.name, v && count(s.id) ? pill(`확정된 강사 ${count(s.id)}명`, "neutral") : null,
              v && vsteps.some((x) => x.set_id === v.id && x.subject_id === s.id) ? pill("공통 확정") : null,
              v && cat.vacLinks.some((l) => l.set_id === v.id && l.subject_id === s.id)
                ? h("button", { type: "button", class: "btn", style: "margin-left:auto", onclick: (e) => { e.preventDefault(); open = s.id; draw(); } }, "공통 4단계 정리") : null))) : empty("과목이 없습니다"))),
        v && open && subjects.some((s) => s.id === open) ? (() => {
          const sub = subjects.find((s) => s.id === open);
          const cur = vsteps.filter((x) => x.set_id === v.id && x.subject_id === sub.id).map((x) => ({ summary: x.summary, image_url: x.image_url ?? "" }));
          return h("div", { style: "margin-top:16px" }, box(`${sub.name} · ${v.name} 공통 4단계`, note("이 특강에 확정된 강사 자료만 참고합니다. 확정하면 홈페이지 방학 특강에서 이 과목은 공통 4단계로 보입니다.")),
            commonEditor(sub, cat, cur.length === 4 ? cur : [], { msg, reload: () => render({ main }), set: v }));
        })() : null);
    };
    draw();
    return out;
  });
}
