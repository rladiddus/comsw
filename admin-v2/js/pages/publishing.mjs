import { el, pick, chip, hint, btn, locked, stats, panel, check, empty, table, select, headActions } from "../ui.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { SITE_PAGES } from "../../../admin/js/preview.mjs";

const SOURCE = { main: "", instructor_curriculum: "강사 커리큘럼 · ", recruitment: "채용 공고 · " };

// 마지막 반영본과 지금 내용(미리보기와 같은 것)을 시트별로 비교해 바뀐 줄 수를 센다.
// ponytail: 마지막 반영본에 있던 시트만 비교한다. 새로 생긴 학과 탭·학과 시트는 잡지 못함 — 필요하면 시트 목록 RPC 추가.
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
    const before = new Map(s.before.map((r) => [Number(r.row_number), JSON.stringify(r.data)]));
    const after = new Map(now.map((r) => [Number(r.row_number), JSON.stringify(r.data)]));
    let changed = 0;
    for (const n of new Set([...before.keys(), ...after.keys()])) if (before.get(n) !== after.get(n)) changed += 1;
    if (changed) out.push({ label: `${SOURCE[s.source] ?? `${s.source} · `}${s.sheet}`, changed, rows: after.size });
  }
  return out;
}

// 마지막 반영 이후 바뀐 시트 목록. 반영한 적이 없으면 null.
export async function computeChanges(supabase) {
  const { data, error } = await supabase.from("site_snapshots").select("id, rows").order("id", { ascending: false }).limit(1);
  if (error) throw new Error(dbErrorMessage(error));
  if (!data?.length) return null;
  const snapRows = data[0].rows;
  const keys = [...new Set(snapRows.map((r) => `${r.source_id}|${r.sheet_name}`))];
  const current = new Map(await Promise.all(keys.map(async (key) => {
    const [source, sheet] = key.split("|");
    const { data: now, error: e } = await supabase.rpc("comsw_preview_rows", { p_source: source, p_sheet: sheet });
    if (e) throw new Error(dbErrorMessage(e));
    return [key, now || []];
  })));
  return diffSheets(snapRows, current);
}

// 반영 전 검사: 지금 데이터로 알 수 있는 것만(막지는 않고 알려 준다).
export async function siteChecks(supabase) {
  const [pending, approved, instructors, links, weeks] = await Promise.all([
    pick(supabase, "instructor_curricula", "id", (q) => q.eq("status", "pending")),
    pick(supabase, "instructor_curricula", "summary", (q) => q.eq("status", "approved")),
    pick(supabase, "instructors", "is_listed, photo_url"),
    pick(supabase, "subject_departments", "subject_id"),
    pick(supabase, "subject_weeks", "subject_id"),
  ]);
  const noSummary = approved.filter((r) => !String(r.summary || "").trim()).length;
  const noPhoto = instructors.filter((i) => i.is_listed && !i.photo_url).length;
  const linked = new Set(links.map((l) => l.subject_id));
  const noWeeks = [...linked].filter((id) => !weeks.some((w) => w.subject_id === id)).length;
  return [
    ["승인 상태", pending.length ? `승인 대기 ${pending.length}단계는 반영되지 않습니다.` : "승인 대기 중인 커리큘럼이 없습니다.", false],
    ["사이트 문구", noSummary ? `승인된 강사 커리큘럼 ${noSummary}단계에 사이트 문구가 비어 있습니다.` : "승인된 강사 커리큘럼에 사이트 문구가 모두 있습니다.", noSummary > 0],
    ["강사 사진", noPhoto ? `사이트에 보이는 강사 ${noPhoto}명에게 사진이 없습니다.` : "사이트에 보이는 강사 모두 사진이 있습니다.", noPhoto > 0],
    ["과목 단계", noWeeks ? `학과에 연결된 과목 ${noWeeks}개에 단계가 없습니다.` : "학과 과목에 모두 단계가 있습니다.", noWeeks > 0],
    ["이전 반영본", "반영해도 이전 반영본은 그대로 남습니다.", false],
  ];
}

export async function render(container, ctx) {
  const { supabase, uid, publish, preview } = ctx;
  const snaps = await pick(supabase, "site_snapshots", "id, created_at, published_by", (q) => q.order("id", { ascending: false }).limit(20));
  const [last, prev] = snaps;
  const publishBtn = btn("사이트에 반영", async () => {
    if (await publish()) { container.replaceChildren(); await render(container, ctx); }
  }, true);
  headActions(ctx, locked("변경 이력", "수정 이력은 DB 추가가 필요합니다"), publishBtn);

  const statBox = el("div");
  const drawStats = (changes, warns) => statBox.replaceChildren(stats([
    ["현재 반영본", last ? `${last.id}번` : "없음", last ? formatSeoul(last.created_at) : "아직 반영한 적 없음"],
    ["반영 전 바뀐 곳", changes === undefined ? "확인 중…" : changes === null ? "—" : `${changes.length}곳`,
      changes?.length ? `바뀐 줄 ${changes.reduce((n, d) => n + d.changed, 0)}개` : "마지막 반영과 비교", changes?.length > 0],
    ["검사 경고", warns === undefined ? "확인 중…" : `${warns}건`, "아래 '반영 전 검사' 참고", warns > 0],
    ["이전 반영본", prev ? `${prev.id}번` : "없음", prev ? formatSeoul(prev.created_at) : ""],
  ]));
  drawStats();

  const changeBox = el("div", {}, [el("p", { className: "muted", textContent: "마지막 반영본과 비교하는 중…" })]);
  const checkBox = el("div", {}, [el("p", { className: "muted", textContent: "검사하는 중…" })]);
  const pagePick = select("미리볼 페이지", SITE_PAGES.map((p) => [p.name, p.name]));

  container.append(
    statBox,
    el("div", { className: "v2-steps" }, [["① 변경 확인", "바뀐 곳 파악", true], ["② 내용 검사", "빠진 것 확인", true], ["③ 화면 미리보기", "PC·태블릿"], ["④ 사이트 반영", "공개 사이트에 적용"]]
      .map(([t, s, on]) => el("div", { className: `v2-step${on ? " active" : ""}` }, [el("strong", { textContent: t }), el("span", { textContent: s })]))),
    el("div", { className: "v2-grid2" }, [
      el("div", { className: "v2-stack" }, [
        panel("반영 전 바뀐 곳", [changeBox], "승인·수정했지만 아직 공개 사이트에 반영하지 않은 내용입니다."),
        panel("반영 기록", [table(["번호", "반영 시각", "반영한 사람", ""], snaps, (s) => [
          `${s.id}번`, formatSeoul(s.created_at), s.published_by === uid ? "나" : "다른 관리자",
          s === last ? chip("공개 중", "good") : locked("되돌리기", "되돌리기는 DB 함수 추가가 필요합니다"),
        ]).node], "되돌리기는 DB 함수가 필요해 잠가 두었습니다."),
      ]),
      panel("반영 전 검사", [
        checkBox,
        el("div", { className: "v2-actions" }, [pagePick, btn("PC 미리보기", () => preview(pagePick.value, false)), btn("태블릿 미리보기", () => preview(pagePick.value, true))]),
        hint("반영하면 지금 내용이 바로 공개 사이트에 나갑니다. 이 화면은 운영 데이터에 연결되어 있습니다."),
        btn("검사 후 사이트에 반영", () => publishBtn.click(), true),
      ]),
    ]),
  );

  let changes, warns;
  await Promise.all([
    computeChanges(supabase).then((d) => {
      changes = d;
      changeBox.replaceChildren(d === null ? empty("아직 반영한 적이 없어 비교할 반영본이 없습니다.")
        : d.length ? table(["사이트 데이터", "바뀐 줄", "검토"], d, (x) => [x.label, `${x.changed}줄`, chip("확인 필요", "warn")]).node
          : empty("마지막 반영 이후 바뀐 내용이 없습니다."));
    }).catch((err) => { changes = null; changeBox.replaceChildren(el("p", { className: "save-state err", textContent: err.message })); }),
    siteChecks(supabase).then((list) => {
      warns = list.filter(([, , w]) => w).length;
      checkBox.replaceChildren(el("div", { className: "v2-row v2-gap" }, [chip("막는 것 0건", "good"), chip(`경고 ${warns}건`, warns ? "warn" : "good")]),
        ...list.map(([t, d, w]) => check(t, d, w)));
    }).catch((err) => { warns = 0; checkBox.replaceChildren(el("p", { className: "save-state err", textContent: err.message })); }),
  ]);
  drawStats(changes, warns);
}
