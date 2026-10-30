import { el, pick, chip, btn, locked, stats, panel, table, search, select, headActions, parseDate } from "../../../admin-v2/js/ui.mjs";
import { seminarState } from "../../../admin-v2/js/pages/seminars.mjs";
import { mountCardList } from "../../../admin/js/card-list.mjs";
import { seminarCard, drawRoster } from "../../../admin/js/pages/seminars.mjs";
import { mountImageUpload } from "../../../admin/js/image-upload.mjs";
import { mediaPreview } from "../../../admin/js/media-preview.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { modal } from "../v3.mjs";

// 특강·세미나(V3): 통계 + 특강 목록. 줄마다 [신청자 명단]을 누르면 그 줄 아래에 명단(엑셀 내려받기).
// 줄을 누르면 특강 카드 팝업(포스터 왼쪽, 공개 체크), [특강 만들기]는 빈 칸 팝업에서 채워 만든다.
// '공개'(seminars.is_listed)는 DB 칸 추가(20261030020000) 후 저장된다.
const PLACEHOLDER = {
  title: "예: AI활용 모션아트웍 치트키", subtitle: "예: 배우지 않아도 감각적으로", datetime_text: "예: 2026년 8월 5일 11:00-13:00",
  instructor: "예: 조혜원", place: "예: J강의장", capacity: "예: 16",
};

export async function render(container, ctx) {
  const { supabase } = ctx;
  const [seminars, apps] = await Promise.all([
    pick(supabase, "seminars", "*", (q) => q.order("sort_order", { nullsFirst: false })),
    pick(supabase, "seminar_applications", "seminar_id, created_at"),
  ]);
  const card = seminarCard(supabase);
  // '공개' 칸은 SQL(20261030020000) 실행 뒤에 생긴다. 그 전에는 공개 체크 없이 동작한다.
  const hasListed = seminars.some((x) => "is_listed" in x);
  const reload = () => { container.replaceChildren(); return render(container, ctx); };

  // 특강 카드 팝업(강사 팝업과 같은 고정 크기)
  async function open(s) {
    const box = el("div", { className: "v3-tpopbody" });
    const d = modal(s.title, [box], [], "닫기");
    d.classList.add("v3-tpop", "v3-spop");
    d.addEventListener("close", reload);
    const list = await mountCardList(box, { ...card, activeKey: hasListed ? "is_listed" : null, activeLabel: "공개", query: (q) => q.eq("id", s.id), toolbar: false, sortable: false });
    list.setFold(false);
  }

  // 특강 만들기: 빈 칸(예시 글) 팝업 → [만들기]로 저장
  function create() {
    const inputs = Object.fromEntries(card.fields.map((f) => [f.key, el("input", { type: "text", placeholder: PLACEHOLDER[f.key] ?? "" })]));
    let poster = "";
    const stage = el("div", { className: "card-stage" });
    const showPoster = () => stage.replaceChildren(poster ? mediaPreview(poster) : el("span", { className: "muted", textContent: "포스터 없음" }));
    showPoster();
    const upload = el("div");
    mountImageUpload(upload, { label: "포스터 올리기", onUploaded: (a) => { poster = a.url; showPoster(); } });
    const listed = el("input", { type: "checkbox", checked: true });
    const say = el("span", { className: "save-state" });
    const make = btn("만들기", async () => {
      const row = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim() || null]));
      if (!row.title) { say.textContent = "특강명을 입력해주세요"; say.classList.add("err"); return; }
      if (row.capacity && !/^\d+$/.test(row.capacity)) { say.textContent = "정원은 숫자로 입력해주세요"; say.classList.add("err"); return; }
      const minOrder = Math.min(0, ...seminars.map((x) => x.sort_order ?? 0));
      make.disabled = true;
      const { error } = await supabase.from("seminars").insert({ ...row, capacity: row.capacity ? Number(row.capacity) : null, poster_url: poster || null, ...(hasListed ? { is_listed: listed.checked } : {}), sort_order: minOrder - 1 });
      make.disabled = false;
      if (error) { say.textContent = dbErrorMessage(error, { duplicate: "같은 이름의 특강이 이미 있습니다" }); say.classList.add("err"); return; }
      d.close?.(); d.remove(); reload();
    }, true);
    const body = el("div", { className: "v3-tpopbody" }, [el("article", { className: "card-item no-sort v3-newcard" }, [
      el("div", { className: "v3-newstage" }, [stage, upload]),
      el("div", { className: "card-side" }, [
        el("div", { className: "card-fields span-grid" }, card.fields.map((f) => Object.assign(
          el("label", { className: "card-line" }, [el("span", { textContent: f.label }), inputs[f.key]]), { style: `grid-column: span ${f.span}` }))),
        el("div", { className: "media-actions" }, [...(hasListed ? [el("label", { className: "consent" }, [listed, el("span", { textContent: "공개" })])] : []), make, say]),
      ]),
    ])]);
    const d = modal("특강 만들기", [body], [], "닫기");
    d.classList.add("v3-tpop", "v3-spop");
  }
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), btn("특강 만들기", create, true));

  const now = new Date();
  const items = seminars.map((s) => {
    const date = parseDate(s.datetime_text, now);
    const applied = apps.filter((a) => a.seminar_id === s.id).length;
    return { s, applied, state: seminarState(date, applied, s.capacity, now) };
  });
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const by = (name) => items.filter((i) => i.state[0] === name).length;
  const q = search("특강 검색");
  const statePick = select("상태", [["", "모든 상태"], ...["모집 중", "마감 임박", "정원 마감", "종료", "날짜 확인"].map((x) => [x, x])]);
  const count = el("span", { className: "muted" });
  const listBox = el("div");
  let openRoster = ""; // 명단을 펼친 특강 id
  function draw() {
    const shown = items.filter((i) => i.s.title.includes(q.value.trim()) && (!statePick.value || i.state[0] === statePick.value));
    count.textContent = `${shown.length}개`;
    const t = table(["특강", "날짜", "장소", "신청/정원", "공개", "상태", ""], shown, (i) => [
      i.s.title, i.s.datetime_text || "—", i.s.place || "—", `${i.applied} / ${i.s.capacity ?? "—"}`,
      i.s.is_listed === false ? chip("비공개") : chip("공개", "vacation"), chip(...i.state),
      Object.assign(btn(openRoster === i.s.id ? "명단 닫기" : "신청자 명단", () => {}), {
        onclick: (e) => { e.stopPropagation(); openRoster = openRoster === i.s.id ? "" : i.s.id; draw(); },
      }),
    ], (i) => open(i.s));
    // 펼친 특강 줄 바로 아래에 명단
    const at = shown.findIndex((i) => i.s.id === openRoster);
    if (at >= 0) {
      const box = el("div", { className: "v3-roster" }, [el("p", { className: "muted", textContent: "불러오는 중…" })]);
      t.node.querySelectorAll("tbody tr")[at].after(el("tr", { className: "v3-rosterrow" }, [el("td", { colSpan: 7 }, [box])]));
      drawRoster(box, supabase, shown[at].s);
    }
    t.node.classList.add("v3-semtable");
    listBox.replaceChildren(panel("특강 목록", [t.node], "", [el("div", { className: "v2-row v2-gap" }, [q, statePick, count])]));
  }
  q.addEventListener("input", draw);
  statePick.addEventListener("change", draw);
  container.append(
    stats([
      ["모집 중", `${by("모집 중") + by("마감 임박")}`, "날짜가 지나지 않은 특강"],
      ["마감 임박", `${by("마감 임박")}`, "14일 안에 열림", by("마감 임박") > 0],
      ["종료·정원 마감", `${by("종료") + by("정원 마감")}`, "날짜가 지났거나 정원이 찬 특강"],
      ["이번 달 신청", `${apps.filter((a) => String(a.created_at).startsWith(month)).length}`, `${month} 신청 수`],
    ]),
    listBox,
  );
  draw();
}
