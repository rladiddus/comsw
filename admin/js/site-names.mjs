// 사이트 메뉴 이름 따라가기(2026-11-18 사용자 요청): 기본 설정 › 메뉴에서 알약 글자(menus.label)를 고치면
// 관리 화면·매뉴얼 안내 문구 속 사이트 메뉴 이름도 고친 이름으로 보인다(예: 사이트 '전체 수업' → 사이트 '로드맵').
// 문구는 코드에 원래 이름(menus.name)으로 적혀 있어서, 화면에 그려질 때 바꾼다(한 곳에서).
// 바꾸는 꼴:
// - 사이트에만 있는 이름(전체 수업·학과별 자료·강사별 커리큘럼·특강/세미나)은 어디에 있든
// - 관리 메뉴와 이름이 같은 것(학과 커리큘럼·수업별 준비물·방학 특강)은 "사이트 'X'" 꼴만(관리 메뉴 안내는 그대로)
// - 선택칸 글자가 원래 이름과 똑같으면(미리보기 페이지 고르기)
// 입력칸(알약 이름 고치기 등)은 건드리지 않는다.
// ponytail: 글자 바꾸기라 관리 메뉴와 같은 이름을 따옴표 없이 쓴 문구는 그대로 남는다. 새 문구는 사이트 'X' 꼴로 쓰면 된다.

const SITE_ONLY = new Set(["전체 수업", "학과별 자료", "강사별 커리큘럼", "특강/세미나"]);
const SKIP = /^(INPUT|TEXTAREA|SELECT|SCRIPT|STYLE)$/;
const ATTRS = ["title", "placeholder", "aria-label"];

export function renameText(text, labels) {
  let s = text;
  for (const [name, label] of labels) {
    if (!s.includes(name)) continue;
    s = SITE_ONLY.has(name) ? s.split(name).join(label) : s.split(`사이트 '${name}'`).join(`사이트 '${label}'`);
  }
  return s;
}

function fixNode(n, labels) {
  if (n.nodeType === 3) {
    const p = n.parentElement;
    if (!p || SKIP.test(p.tagName) || p.isContentEditable) return;
    const hit = p.tagName === "OPTION" && labels.find(([name]) => n.data.trim() === name);
    const next = hit ? hit[1] : renameText(n.data, labels);
    if (next !== n.data) n.data = next;
  } else if (n.nodeType === 1 && !SKIP.test(n.tagName)) {
    for (const a of ATTRS) {
      const v = n.getAttribute(a);
      if (v) { const next = renameText(v, labels); if (next !== v) n.setAttribute(a, next); }
    }
  }
}

// root 아래 글자·속성을 고친 이름으로.
export function renameTree(root, labels) {
  if (!labels.length || !root) return;
  fixNode(root, labels);
  const walk = root.ownerDocument.createTreeWalker(root, 5); // 요소 + 글자
  for (let n = walk.nextNode(); n; n = walk.nextNode()) fixNode(n, labels);
}

// 공개된 이름: '메인 페이지' 시트 E=원래 이름, K=고친 이름.
export const labelsFromRows = (rows) => (rows ?? []).map((r) => r.data?.values ?? []).map((v) => [v[4], v[10]])
  .filter(([name, label]) => name && label && label !== name);

// 관리 화면: 처음 한 번 켜면 이후 그려지는 화면을 계속 고친다. reload()는 메뉴 이름 저장 뒤 다시 읽기.
export function siteNames(supabase, doc = document) {
  const state = doc.__siteNames ??= { labels: [] };
  const load = async () => {
    // 관리자·학과장은 메뉴 표(반영 전 이름까지), 선생님은 표를 못 읽어 공개된 이름.
    const { data } = await supabase.from("menus").select("*");
    let labels = (data ?? []).map((m) => [m.name, m.label]).filter(([name, label]) => label && label !== name);
    if (!data?.length) labels = labelsFromRows((await supabase.rpc("comsw_site_rows", { p_sheet: "메인 페이지", p_source: "main" })).data);
    state.labels = labels;
    renameTree(doc.body, labels);
  };
  if (!state.observer) {
    state.observer = new doc.defaultView.MutationObserver((list) => {
      for (const m of list) m.addedNodes.forEach((n) => renameTree(n, state.labels));
    });
    state.observer.observe(doc.body, { childList: true, subtree: true });
  }
  state.reload = load;
  return load();
}
