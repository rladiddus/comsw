// 방학 특강: 특강마다 과목 구성. 같은 과목도 일반·특강별 자료는 따로다(특강 공통 커리큘럼은 2단계 SQL 뒤).
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, fill, empty, note } from "../ui.mjs";
import { stepState } from "../rules.mjs";

let pick = null;

export async function render({ main }) {
  main.replaceChildren(head("방학 특강", "특강마다 과목을 구성하고, 그 특강의 강사 자료와 공통 자료를 따로 관리합니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const cat = await data.catalog();
    if (!cat.vacations.length) return box(null, empty("방학 특강이 없습니다"));
    const weeks = await data.weeks();
    const out = h("div");
    const draw = () => {
      pick = cat.vacations.some((v) => v.id === pick) ? pick : cat.vacations[0].id;
      const ids = new Set(cat.vacLinks.filter((l) => l.set_id === pick).map((l) => l.subject_id));
      const list = data.live(cat.subjects).filter((s) => ids.has(s.id));
      const own = (s) => weeks.filter((w) => w.subject_id === s.id && w.set_id === pick).length;
      out.replaceChildren(
        tabs(cat.vacations.map((v) => [v.id, v.name]), pick, (id) => { pick = id; draw(); }, "chips"),
        h("div", { style: "height:14px" }),
        box(`과목 ${list.length}개`,
          note("특강에서 과목을 빼면 이 특강과의 연결만 풀립니다. 과목과 다른 자료는 그대로입니다."),
          table([
            ["과목", (s) => s.name],
            ["이 특강 공통 커리큘럼", (s) => { const n = own(s); return n ? pill(stepState(n).label, stepState(n).kind) : pill("없음(일반 것을 보여 줌)", "neutral"); }],
          ], list)),
      );
    };
    draw();
    return out;
  });
}
