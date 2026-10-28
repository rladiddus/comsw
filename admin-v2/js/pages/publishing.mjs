import { el } from "../../../admin/js/teacher-workspace.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { SITE_PAGES } from "../../../admin/js/preview.mjs";
import { card, panel } from "./dashboard.mjs";

const SOURCE = { main: "", instructor_curriculum: "강사 커리큘럼 · ", recruitment: "채용 공고 · " };

// 마지막 반영본과 지금 내용(미리보기와 같은 것)을 시트별로 비교해 바뀐 줄 수를 센다.
// ponytail: 마지막 반영본에 있던 시트만 비교한다. 새로 생긴 학과 탭·학과 시트는 '새 시트'로 잡지 못함 — 필요하면 시트 목록 RPC 추가.
export function diffSheets(snapshotRows, currentBySheet) {
  const sheets = new Map();
  for (const r of snapshotRows) {
    const key = `${r.source_id}|${r.sheet_name}`;
    if (!sheets.has(key)) sheets.set(key, { source: r.source_id, sheet: r.sheet_name, before: [] });
    sheets.get(key).before.push(r);
  }
  const out = [];
  for (const [key, s] of sheets) {
    const now = currentBySheet.get(key) ?? [];
    const before = new Map(s.before.map((r) => [r.row_number, JSON.stringify(r.data)]));
    const after = new Map(now.map((r) => [r.row_number, JSON.stringify(r.data)]));
    let changed = 0;
    for (const n of new Set([...before.keys(), ...after.keys()])) if (before.get(n) !== after.get(n)) changed += 1;
    if (changed) out.push({ label: `${SOURCE[s.source] ?? `${s.source} · `}${s.sheet}`, changed, rows: after.size });
  }
  return out;
}

export async function render(container, ctx) {
  const { supabase, uid, publish, preview } = ctx;
  const { data: snaps, error } = await supabase.from("site_snapshots")
    .select("id, created_at, published_by").order("id", { ascending: false }).limit(20);
  if (error) throw new Error(dbErrorMessage(error));
  const last = snaps[0];
  const changeBox = el("div");
  const changeStat = card("반영 전 바뀐 곳", "확인 전", "① '바뀐 곳 확인'을 누르세요", "#/publishing");

  async function check(btn) {
    btn.disabled = true;
    changeBox.replaceChildren(el("p", { className: "muted", textContent: "비교하는 중… (시트가 많으면 몇 초 걸립니다)" }));
    try {
      if (!last) { changeBox.replaceChildren(el("p", { className: "v2-hint", textContent: "아직 반영한 적이 없어 비교할 반영본이 없습니다." })); return; }
      const { data, error: e } = await supabase.from("site_snapshots").select("rows").eq("id", last.id).single();
      if (e) throw new Error(dbErrorMessage(e));
      const snapRows = data.rows.map((r) => ({ ...r, row_number: Number(r.row_number) }));
      const keys = [...new Set(snapRows.map((r) => `${r.source_id}|${r.sheet_name}`))];
      const current = new Map(await Promise.all(keys.map(async (key) => {
        const [source, sheet] = key.split("|");
        const { data: now, error: pe } = await supabase.rpc("comsw_preview_rows", { p_source: source, p_sheet: sheet });
        if (pe) throw new Error(dbErrorMessage(pe));
        return [key, now || []];
      })));
      const diff = diffSheets(snapRows, current);
      changeStat.querySelector(".v2-stat-num").textContent = `${diff.length}곳`;
      changeStat.querySelector(".v2-stat-hint").textContent = diff.length ? `바뀐 줄 ${diff.reduce((n, d) => n + d.changed, 0)}개` : "마지막 반영과 같습니다";
      changeStat.classList.toggle("alert", diff.length > 0);
      changeBox.replaceChildren(diff.length
        ? el("table", { className: "v2-table" }, [
          el("thead", {}, [el("tr", {}, ["사이트 데이터", "바뀐 줄"].map((t) => el("th", { textContent: t })))]),
          el("tbody", {}, diff.map((d) => el("tr", {}, [el("td", { className: "v2-strong", textContent: d.label }), el("td", { textContent: `${d.changed}줄` })]))),
        ])
        : el("p", { className: "v2-hint", textContent: "마지막 반영 이후 바뀐 내용이 없습니다. 반영하지 않아도 됩니다." }));
    } catch (err) {
      changeBox.replaceChildren(el("p", { className: "save-state err", textContent: err.message }));
    } finally { btn.disabled = false; }
  }

  const checkBtn = el("button", { type: "button", className: "ghost-btn", textContent: "① 바뀐 곳 확인" });
  checkBtn.addEventListener("click", () => check(checkBtn));
  const pagePick = el("select", { className: "v2-field" }, SITE_PAGES.map((p) => el("option", { value: p.name, textContent: p.name })));
  pagePick.setAttribute("aria-label", "미리볼 페이지");
  const pv = (text, tablet) => Object.assign(el("button", { type: "button", className: "ghost-btn", textContent: text }), { onclick: () => preview(pagePick.value, tablet) });
  const publishBtn = el("button", { type: "button", className: "publish-btn", textContent: "③ 사이트에 반영" });
  publishBtn.addEventListener("click", async () => {
    if (await publish()) { container.replaceChildren(); await render(container, ctx); }
  });

  container.append(
    el("div", { className: "v2-stats" }, [
      card("지금 공개 중인 반영본", last ? `${last.id}번` : "없음", last ? formatSeoul(last.created_at) : "아직 반영한 적 없음", "#/publishing"),
      changeStat,
      card("반영 기록", `${snaps.length >= 20 ? "20+" : snaps.length}회`, "아래 '반영 기록'에서 확인", "#/publishing"),
    ]),
    el("div", { className: "v2-steps" }, [["① 바뀐 곳 확인", "마지막 반영과 비교"], ["② 미리보기", "PC·태블릿 화면 확인"], ["③ 사이트에 반영", "공개 사이트에 적용"]]
      .map(([t, s]) => el("div", { className: "v2-step" }, [el("strong", { textContent: t }), el("span", { textContent: s })]))),
    el("div", { className: "v2-grid2" }, [
      el("div", { className: "v2-stack" }, [
        panel("반영 전 바뀐 곳", [el("div", { className: "v2-actions" }, [checkBtn]), changeBox], "승인·수정했지만 아직 공개 사이트에 반영하지 않은 내용입니다."),
        panel("반영 기록", [el("table", { className: "v2-table" }, [
          el("thead", {}, [el("tr", {}, ["번호", "반영 시각", "반영한 사람", ""].map((t) => el("th", { textContent: t })))]),
          el("tbody", {}, snaps.map((s, i) => el("tr", {}, [
            el("td", { className: "v2-strong", textContent: `${s.id}번` }),
            el("td", { textContent: formatSeoul(s.created_at) }),
            el("td", { textContent: s.published_by === uid ? "나" : "다른 관리자" }),
            el("td", {}, [i === 0 ? el("span", { className: "v2-chip good", textContent: "공개 중" })
              : el("button", { type: "button", className: "ghost-btn", textContent: "되돌리기", disabled: true, title: "되돌리기는 DB 함수 추가가 필요해 다음 단계에서 엽니다" })]),
          ]))),
        ])], "되돌리기는 다음 단계(DB 함수 추가)에서 엽니다."),
      ]),
      el("div", { className: "v2-stack" }, [
        panel("② 미리보기", [el("div", { className: "v2-actions" }, [pagePick, pv("PC", false), pv("태블릿", true)])], "반영 전 내용을 공개 사이트 모양으로 봅니다."),
        panel("③ 사이트에 반영", [
          el("p", { className: "v2-hint", textContent: "반영하면 지금 내용이 바로 공개 사이트에 나갑니다. 이 화면은 운영 데이터에 연결되어 있습니다." }),
          publishBtn,
        ]),
      ]),
    ]),
  );
}
