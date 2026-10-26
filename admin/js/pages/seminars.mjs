import { mountCardList } from "../card-list.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { toCsv } from "../csv.mjs";
import { deleteSeminarMessage, formatSeoul } from "../format.mjs";
import { freeName } from "../order.mjs";

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 세지 못하면 0명으로 치지 않는다 — 경고 없이 신청자 명단이 지워지는 것을 막는다.
async function applicantCount(supabase, seminarId) {
  const { count, error } = await supabase.from("seminar_applications")
    .select("id", { count: "exact", head: true }).eq("seminar_id", seminarId);
  if (error || typeof count !== "number") throw new Error("신청자 수를 확인하지 못했습니다. 잠시 후 다시 시도해주세요");
  return count;
}

// 특강 목록은 다른 카드 목록처럼 포스터 왼쪽, 처음엔 접힘, '수정'으로 고치고, ⠿를 끌어 순서 = 사이트 순서.
export async function render(container, { supabase }) {
  const roster = el("section");
  container.append(el("h2", { textContent: "특강·세미나" }));

  async function showRoster(seminar) {
    const state = el("span", { className: "save-state" });
    const { data, error } = await supabase.from("seminar_applications")
      .select("id, name, phone, created_at").eq("seminar_id", seminar.id).order("created_at");
    if (error) {
      roster.replaceChildren(el("p", { className: "save-state err", textContent: dbErrorMessage(error) }));
      return;
    }
    const csvBtn = el("button", { type: "button", className: "ghost-btn", textContent: "엑셀(CSV) 내려받기" });
    csvBtn.addEventListener("click", () => download(`${seminar.title}_신청자.csv`,
      toCsv(["특강명", "이름", "연락처", "신청 시각"], data.map(a => [seminar.title, a.name, a.phone, formatSeoul(a.created_at)]))));
    const rows = data.map(a => {
      const cancel = el("button", { type: "button", className: "danger", textContent: "취소(삭제)" });
      cancel.addEventListener("click", async () => {
        if (!confirm(`${a.name}님의 신청을 삭제할까요?`)) return;
        const { error: e } = await supabase.from("seminar_applications").delete().eq("id", a.id);
        if (e) { state.textContent = dbErrorMessage(e); state.classList.add("err"); return; }
        await showRoster(seminar);
      });
      return el("tr", {}, [
        el("td", { textContent: a.name }), el("td", { textContent: a.phone }),
        el("td", { textContent: formatSeoul(a.created_at) }), el("td", { className: "actions" }, [cancel]),
      ]);
    });
    roster.replaceChildren(
      el("h3", { textContent: `신청자 명단 — ${seminar.title} (${data.length}명)` }),
      el("div", { className: "editor-bar" }, [csvBtn, state]),
      el("table", { className: "editor" }, [
        el("thead", {}, [el("tr", {}, ["이름", "연락처", "신청 시각", ""].map(t => el("th", { textContent: t })))]),
        el("tbody", {}, rows.length ? rows : [el("tr", {}, [el("td", { colSpan: 4, textContent: "신청자가 없습니다." })])]),
      ]),
    );
    roster.scrollIntoView({ behavior: "smooth" });
  }

  const list = el("div");
  container.append(list, roster);
  await mountCardList(list, {
    supabase,
    table: "seminars",
    title: "특강 목록",
    description: "일시는 '2026년 8월 18일 14:00-16:00'처럼 적어주세요. 날짜가 지나면 사이트에서 신청이 자동으로 마감됩니다. 왼쪽 ⠿를 끌어 놓은 순서가 사이트 순서입니다.",
    imageKey: "poster_url",
    imageLabel: "포스터",
    activeKey: null,
    fields: [
      // 윗줄: 특강명 / 소주제, 아랫줄: 일시 / 강사명 / 장소 / 정원
      { key: "title", label: "특강명", type: "text", required: true, span: 6 },
      { key: "subtitle", label: "소주제", type: "text", span: 6 },
      { key: "datetime_text", label: "일시", type: "text", span: 3 },
      { key: "instructor", label: "강사명", type: "text", span: 3 },
      { key: "place", label: "장소", type: "text", span: 3 },
      { key: "capacity", label: "정원", type: "text", placeholder: "숫자", span: 3 },
    ],
    defaults: (rows) => ({ title: freeName("새 특강", rows, "title") }),
    itemName: (row) => `'${row.title}'`,
    deleteConfirm: async (row) => deleteSeminarMessage(row.title, await applicantCount(supabase, row.id)),
    actions: [{ label: "신청자 명단", onClick: showRoster }],
  });
}
