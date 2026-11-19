// 특강·세미나: 여러 특강 → 고르면 공개 정보 편집(포스터 올리기) + 신청 수강생(비공개, 학과장·관리자만 DB가 보여 줌).
// [저장] = 그 특강 정보만 바로 공개. 신청 기능·신청자 정보는 그대로.
import * as data from "../data.mjs";
import { h, head, box, table, pill, media, fill, empty, fail, busy, publishBanner } from "../ui.mjs";

let pick = null;
const FIELDS = [["title", "제목"], ["subtitle", "부제"], ["datetime_text", "일시"], ["instructor", "강사"], ["place", "장소"], ["capacity", "정원(숫자)"]];

export async function render({ main }) {
  main.replaceChildren(head("특강·세미나", "특강 정보를 고치고 신청한 수강생을 확인합니다. 신청자 정보는 공개되지 않습니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [list, counts] = await Promise.all([data.seminars(), data.applicationCounts()]);
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    const draw = () => {
      const s = pick === "new" ? {} : list.find((x) => x.id === pick);
      const detail = h("div");
      out.replaceChildren(banner, msg, h("div", { class: "two" },
        box(`특강 ${list.length}개`, table([
          ["특강", (x) => x.title],
          ["일시", (x) => x.datetime_text || "—"],
          ["공개", (x) => pill(x.is_listed === false ? "숨김" : "공개", x.is_listed === false ? "neutral" : "")],
          ["신청", (x) => `${counts.get(x.id) ?? 0}${x.capacity ? ` / ${x.capacity}` : ""}명`],
        ], list, { selected: s, onPick: (x) => { pick = x.id; msg.replaceChildren(); draw(); } }),
        h("div", { class: "actions", style: "margin-top:10px" }, h("button", { type: "button", class: "btn", onclick: () => { pick = "new"; draw(); } }, "+ 새 특강"))),
        detail));
      if (!s) return detail.replaceChildren(box(null, empty("특강을 고르면 정보와 신청자가 나옵니다")));
      const f = Object.fromEntries(FIELDS.map(([k]) => [k, s[k] == null ? "" : String(s[k])]));
      f.poster_url = s.poster_url ?? "";
      f.is_listed = s.is_listed !== false;
      const poster = h("div", {}, media(f.poster_url));
      const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": "포스터 이미지" });
      file.onchange = () => busy(file, msg, async () => {
        if (!file.files[0]) return;
        poster.replaceChildren(h("div", { class: "muted" }, "올리는 중..."));
        try { f.poster_url = (await data.upload(file.files[0], "image")).url; } finally { poster.replaceChildren(media(f.poster_url)); file.value = ""; }
      });
      const save = h("button", { type: "button", class: "btn primary" }, "저장(바로 공개)");
      save.onclick = () => busy(save, msg, async () => {
        if (!f.title.trim()) throw new Error("제목을 입력해주세요");
        if (!confirm(`'${f.title.trim()}' 특강 정보를 저장할까요? 홈페이지에 바로 반영됩니다.`)) return;
        pick = await data.call("comsw_v4_save_seminar", { p_id: s.id ?? null, p: f });
        render({ main });
      });
      const apps = h("div");
      detail.replaceChildren(
        box(s.id ? s.title : "새 특강", h("div", { class: "two" },
          h("div", {}, FIELDS.map(([k, label]) => h("label", { class: "step", style: "display:block;margin-bottom:8px" }, h("b", {}, label),
            h("input", { value: f[k], style: "width:100%", oninput: (e) => { f[k] = e.target.value; } }))),
            h("label", { style: "display:flex;gap:8px;margin:8px 0" }, h("input", { type: "checkbox", checked: f.is_listed, onchange: (e) => { f.is_listed = e.target.checked; } }), "홈페이지에 공개")),
          h("div", {}, h("h4", {}, "포스터"), poster, file)),
          h("div", { class: "actions", style: "margin-top:12px" }, save)),
        apps);
      if (s.id) fill(apps, async () => {
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
