// 특강·세미나: 여러 특강 목록 → 고르면 공개 정보 + 신청 수강생(비공개, 학과장·관리자만 DB가 보여 줌).
import * as data from "../data.mjs";
import { h, head, box, table, pill, media, dl, fill, empty } from "../ui.mjs";

let pick = null;

export async function render({ main }) {
  main.replaceChildren(head("특강·세미나", "특강 정보를 고치고 신청한 수강생을 확인합니다. 신청자 정보는 공개되지 않습니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [list, counts] = await Promise.all([data.seminars(), data.applicationCounts()]);
    if (!list.length) return box(null, empty("특강이 없습니다"));
    const out = h("div");
    const draw = () => {
      const s = list.find((x) => x.id === pick);
      const detail = h("div");
      out.replaceChildren(h("div", { class: "two" },
        box(`특강 ${list.length}개`, table([
          ["특강", (x) => x.title],
          ["일시", (x) => x.datetime_text || "—"],
          ["공개", (x) => pill(x.is_listed === false ? "숨김" : "공개", x.is_listed === false ? "neutral" : "")],
          ["신청", (x) => `${counts.get(x.id) ?? 0}${x.capacity ? ` / ${x.capacity}` : ""}명`],
        ], list, { selected: s, onPick: (x) => { pick = x.id; draw(); } })),
        detail));
      if (!s) return detail.replaceChildren(box(null, empty("특강을 고르면 정보와 신청자가 나옵니다")));
      const apps = h("div");
      detail.replaceChildren(
        box(s.title, h("div", { class: "two" },
          dl([["부제", s.subtitle], ["일시", s.datetime_text], ["강사", s.instructor], ["장소", s.place], ["정원", s.capacity ? `${s.capacity}명` : null]]),
          media(s.poster_url))),
        apps);
      fill(apps, async () => {
        const rows = await data.applications(s.id);
        return box(`신청 수강생 ${rows.length}명`, table([
          ["이름", (a) => a.name], ["연락처", (a) => a.phone], ["신청 시각", (a) => new Date(a.created_at).toLocaleString("ko-KR")],
        ], rows));
      });
    };
    draw();
    return out;
  });
}
