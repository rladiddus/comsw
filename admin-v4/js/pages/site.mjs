// 사이트 편집: 메인 / 학과 대표 / 로딩 / 하단 메뉴. 바꾸면 떠 있는 창 [임시 저장] / [사이트 적용](그 탭만 공개).
// 고치기는 [수정] → 팝업(이미지는 파일 고르기·끌어다 놓기, 주소는 보이지 않음). 미리보기는 오른쪽.
// 하단 메뉴: 홈페이지처럼 왼쪽 | 가운데 버튼 | 오른쪽, 끌어서 좌우·순서 옮김, 이름은 [수정] 팝업. 이동할 페이지(name)는 그대로라 링크가 안 깨진다.
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, media, fill, empty, note, publishBanner, modal, toggleSwitch, pickImage } from "../ui.mjs";
import { track, check, canSwitch } from "../changes.mjs";

let state = { tab: "main", dept: null };
const clone = (x) => JSON.parse(JSON.stringify(x));

export async function render({ main }) {
  main.replaceChildren(head("사이트 편집", "메인 화면, 학과 대표 화면, 로딩 화면, 하단 메뉴를 고치고 미리 봅니다. 바꾸면 오른쪽 아래 창에서 그 탭만 반영합니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [mm, depts, loading, menus] = await Promise.all([data.mainMedia(), data.all("departments", (q) => q.order("sort_order", { nullsFirst: false })), data.loadingItems(), data.menus()]);
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    // 탭 하나 = 떠 있는 창에 편집기 하나. get()이 지금 입력, set(x)가 입력을 바꿔 다시 그림.
    const trackTab = (id, title, baseline, get, set, toPayload) => track({
      id: `site:${id}`, slot: "site", title, baseline,
      read: get, write: (x) => { set(clone(x)); },
      apply: (x) => data.call("comsw_v4_save_site", { p_tab: id.split(":")[0], p: toPayload(x) }),
      onApplied: () => render({ main }),
    });
    const draw = () => {
      let view;
      if (state.tab === "main") {
        const base = mm.map((m) => ({ id: m.id, url: m.url, caption: m.caption ?? "", is_active: m.is_active !== false }));
        view = listEditor(clone(base), { url: "url", text: "caption", textLabel: "문구", kind: "메인 이미지·영상", video: true,
          tracked: (items, redraw) => trackTab("main", "메인 화면", base, () => items, (x) => { items.splice(0, items.length, ...x); redraw(); }, (x) => ({ items: x })) });
      } else if (state.tab === "loading") {
        const base = loading.map((l) => ({ id: l.id, image_url: l.image_url, text: l.text ?? "", is_active: l.is_active !== false, font_family: l.font_family, font_size: l.font_size, font_weight: l.font_weight }));
        view = listEditor(clone(base), { url: "image_url", text: "text", textLabel: "로딩 문구", kind: "로딩 이미지",
          tracked: (items, redraw) => trackTab("loading", "로딩 화면", base, () => items, (x) => { items.splice(0, items.length, ...x); redraw(); }, (x) => ({ items: x })) });
      } else if (state.tab === "dept") {
        state.dept = depts.some((d) => d.id === state.dept) ? state.dept : depts[0]?.id;
        const d = depts.find((x) => x.id === state.dept);
        if (!d) { view = [empty("학과가 없습니다")]; } else {
          const base = { id: d.id, image_url: d.image_url ?? "", description: d.description ?? "", name_en: d.name_en ?? "" };
          const f = clone(base);
          const left = h("div");
          const prev = h("div");
          const show = () => {
            prev.replaceChildren(media(f.image_url), h("p", { style: "white-space:pre-wrap" }, f.description), h("p", { class: "muted" }, f.name_en));
            left.replaceChildren(
              h("div", { class: "row" }, h("h3", { style: "margin:0" }, `${d.name} 대표 화면`),
                h("button", { type: "button", class: "btn primary", onclick: edit }, "수정")),
              h("div", { class: "site-field" }, h("b", {}, "대표 이미지"), f.image_url ? media(f.image_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "이미지 없음"))),
              h("div", { class: "site-field" }, h("b", {}, "학과 소개"), h("p", { style: "white-space:pre-wrap;margin:0" }, f.description || "—")),
              h("div", { class: "site-field" }, h("b", {}, "영문 이름"), h("p", { style: "margin:0" }, f.name_en || "—")),
              note("학과 표지만 바뀝니다. 과목 단계 이미지·강사 사진과는 따로입니다."));
          };
          // [수정] 팝업: 이미지(파일 고르기·끌어다 놓기)·학과 소개·영문 이름 → [확인]하면 화면에 넣고 오른쪽 아래 창으로 반영
          const edit = () => editPopup(`${d.name} 대표 화면 수정`, [
            { key: "image_url", label: "대표 이미지", type: "image" },
            { key: "description", label: "학과 소개", type: "text", rows: 6 },
            { key: "name_en", label: "영문 이름", type: "line" },
          ], f, (x) => { Object.assign(f, x); show(); check(); });
          show();
          trackTab(`dept:${d.id}`, `${d.name} 대표 화면`, base, () => f, (x) => { Object.assign(f, x); show(); }, (x) => x);
          view = [tabs(depts.map((x) => [x.id, x.name]), state.dept, (id) => { if (!canSwitch()) return; state.dept = id; draw(); }, "chips"), h("div", { style: "height:14px" }),
            h("div", { class: "two" }, box(null, left), box("미리보기", prev))];
        }
      } else {
        view = [menuEditor(menus, trackTab)];
      }
      out.replaceChildren(banner, msg, tabs([["main", "메인 화면"], ["dept", "학과 대표 화면"], ["loading", "로딩 화면"], ["menu", "하단 메뉴"]], state.tab, (t) => { if (!canSwitch()) return; state.tab = t; msg.replaceChildren(); draw(); }), ...[view].flat());
    };
    draw();
    return out;
  });
}

// 고치기 팝업: fields = [{key, label, type: image|text|line|video|switch}]. [확인]하면 onOk(바뀐 값). 이미지는 pickImage(주소는 안 보임).
function editPopup(title, fields, values, onOk) {
  const v = clone(values);
  const body = h("section", { class: "box", style: "margin:0" });
  const draw = () => body.replaceChildren(...fields.map((f) => {
    if (f.type === "image") {
      const pickBtn = h("button", { type: "button", class: "img-pick", title: "눌러서 이미지 바꾸기(파일 고르기·끌어다 놓기)", "aria-label": `${f.label} 바꾸기`,
        onclick: async () => { const url = await pickImage(`${f.label} 바꾸기`, "image"); if (url) { v[f.key] = url; draw(); } } },
      v[f.key] && !/youtu|\.mp4|\.webm|drive\.google/i.test(v[f.key]) ? media(v[f.key]) : h("div", { class: "media" }, h("span", { class: "muted" }, v[f.key] ? "영상(아래 주소)" : "이미지 없음 · 눌러서 올리기")));
      return h("div", { class: "site-field" }, h("b", {}, f.label), pickBtn, h("span", { class: "muted" }, "이미지를 누르면 파일을 고르거나 끌어다 놓을 수 있습니다."));
    }
    if (f.type === "switch") return h("div", { class: "row site-field" }, h("b", {}, f.label), toggleSwitch(v[f.key], f.label, (next) => { v[f.key] = next; draw(); }));
    const input = f.type === "text"
      ? h("textarea", { rows: f.rows ?? 3, value: v[f.key] ?? "", style: "width:100%", "aria-label": f.label, oninput: (e) => { v[f.key] = e.target.value; } })
      : h("input", { value: v[f.key] ?? "", style: "width:100%", "aria-label": f.label, placeholder: f.placeholder ?? "", oninput: (e) => { v[f.key] = f.type === "video" ? e.target.value.trim() : e.target.value; } });
    return h("label", { class: "site-field", style: "display:block" }, h("b", {}, f.label), input, f.hint ? h("span", { class: "muted" }, f.hint) : null);
  }));
  draw();
  const ok = h("button", { type: "button", class: "btn primary" }, "확인");
  const pop = modal(title, h("div", { class: "modal-body" }, h("div", { class: "modal-main" }, body)), { actions: [ok] });
  pop.dlg.classList.add("modal-fit", "modal-mid");
  ok.onclick = () => { onOk(v); pop.close(); };
}

// 메인·로딩: 항목 카드(이미지·문구·사용) + [수정] 팝업, [빼기], [+ 항목]. 순서는 상관없음. 오른쪽은 고른 항목 미리보기.
function listEditor(items, { url, text, textLabel, kind, video = false, tracked }) {
  let sel = 0;
  const listEl = h("div", { class: "site-cards" });
  const prev = h("div");
  const showPrev = () => prev.replaceChildren(...(items[sel] ? [media(items[sel][url]), h("p", { style: "white-space:pre-wrap" }, items[sel][text] || "")] : [empty("항목이 없습니다")]));
  const fields = [
    { key: url, label: video ? "이미지" : kind, type: "image" },
    ...(video ? [{ key: url, label: "또는 영상 주소", type: "video", placeholder: "유튜브·mp4 주소(영상일 때만)", hint: "이미지를 올리면 이 칸은 비워 두세요." }] : []),
    { key: text, label: textLabel, type: "text", rows: 3 },
    { key: "is_active", label: "사용", type: "switch" },
  ];
  const edit = (i, isNew = false) => editPopup(`${kind} ${isNew ? "추가" : `${i + 1} 수정`}`, fields, items[i], (x) => {
    Object.assign(items[i], x);
    sel = i; drawList(); showPrev(); check();
  });
  const drawList = () => {
    listEl.replaceChildren(...items.map((it, i) => h("div", { class: `step site-card${i === sel ? " on" : ""}`, onclick: () => { if (sel !== i) { sel = i; drawList(); showPrev(); } } },
      h("div", { class: "row" }, h("b", {}, `${kind} ${i + 1}`), it.is_active ? pill("사용") : pill("안 씀", "neutral")),
      it[url] ? media(it[url]) : h("div", { class: "media" }, h("span", { class: "muted" }, "이미지 없음")),
      h("p", { class: "muted", style: "white-space:pre-wrap;margin:6px 0" }, it[text] || "—"),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn primary small", onclick: (e) => { e.stopPropagation(); edit(i); } }, "수정"),
        h("button", { type: "button", class: "btn danger small", onclick: (e) => { e.stopPropagation(); items.splice(i, 1); sel = Math.max(0, Math.min(sel, items.length - 1)); drawList(); showPrev(); } }, "빼기")))));
  };
  drawList();
  showPrev();
  tracked(items, () => { sel = Math.min(sel, Math.max(0, items.length - 1)); drawList(); showPrev(); });
  return [h("div", { class: "two" },
    box(`${kind} ${items.length}개`, note("여러 개면 홈페이지가 돌아가며 보여 줍니다. 카드를 누르면 오른쪽에 미리보기, [수정]으로 고칩니다."), listEl,
      h("div", { class: "actions", style: "margin-top:10px" }, h("button", { type: "button", class: "btn", onclick: () => {
        items.push({ [url]: "", [text]: "", is_active: true });
        sel = items.length - 1; drawList(); showPrev();
        edit(items.length - 1, true);
      } }, "+ 항목"))),
    box("미리보기", prev))];
}

// 하단 메뉴: 홈페이지처럼 [왼쪽 메뉴들] ● [오른쪽 메뉴들], 끌어서 좌우·순서(놓을 자리 경계에 점선), 이름은 [수정] 팝업
function menuEditor(menus, trackTab) {
  // 상태 = 좌우 순서대로 [{id, label, side, sort_order}] (양쪽 모두 왼쪽→오른쪽이 순서 0, 1, 2…)
  const norm = (arr) => ["left", "right"].flatMap((side) => arr.filter((m) => m.side === side).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((m, i) => ({ id: m.id, label: m.label ?? "", side, sort_order: i })));
  const base = norm(menus);
  const items = clone(base).map((m) => ({ ...m, name: menus.find((x) => x.id === m.id)?.name, is_active: menus.find((x) => x.id === m.id)?.is_active }));
  const side = (s) => items.filter((m) => m.side === s).sort((a, b) => a.sort_order - b.sort_order);
  let dragId = null;
  const bar = h("div", { class: "menu-bar" });
  const clearMarks = () => bar.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
  // id를 s쪽 at번째 자리로
  const place = (id, s, at) => {
    const m = items.find((x) => x.id === id);
    const target = side(s).filter((x) => x !== m);
    target.splice(Math.max(0, Math.min(at, target.length)), 0, m);
    const from = m.side;
    m.side = s;
    target.forEach((x, i) => { x.sort_order = i; });
    if (from !== s) side(from).forEach((x, i) => { x.sort_order = i; });
    drawBar(); check();
  };
  const rename = (m) => editPopup(`'${m.name}' 메뉴 이름 수정`, [{ key: "label", label: "보이는 이름", type: "line", placeholder: m.name, hint: `비우면 원래 이름(${m.name})이 보입니다. 누르면 가는 페이지는 그대로입니다.` }], m, (x) => { m.label = x.label; drawBar(); check(); });
  const chip = (m, s, i) => {
    const el = h("div", {
      class: "menu-chip", draggable: "true", title: `이동: ${m.name} · 끌어서 옮기기`,
      ondragstart: (e) => { dragId = m.id; el.classList.add("dragging"); e.dataTransfer?.setData("text/plain", m.id); },
      ondragend: () => { dragId = null; el.classList.remove("dragging"); clearMarks(); },
      ondragover: (e) => {
        if (!dragId) return;
        e.preventDefault(); e.stopPropagation();
        const r = el.getBoundingClientRect();
        clearMarks();
        el.classList.add(e.clientX > r.left + r.width / 2 ? "drop-after" : "drop-before");
      },
      ondrop: (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!dragId) return;
        const at = i + (el.classList.contains("drop-after") ? 1 : 0);
        const fromSame = items.find((x) => x.id === dragId).side === s && side(s).findIndex((x) => x.id === dragId) < at;
        const id = dragId; dragId = null;
        place(id, s, fromSame ? at - 1 : at);
      },
    },
    h("span", { class: "drag-handle", "aria-hidden": "true" }, "⠿"), h("b", {}, m.label || m.name), m.is_active === false ? pill("꺼짐", "neutral") : null,
    h("button", { type: "button", class: "btn small", onclick: () => rename(m) }, "수정"));
    return el;
  };
  const zone = (s) => h("div", {
    class: `menu-zone ${s}`, "aria-label": s === "left" ? "왼쪽 메뉴" : "오른쪽 메뉴",
    ondragover: (e) => { if (dragId) e.preventDefault(); },
    ondrop: (e) => { e.preventDefault(); if (!dragId) return; const id = dragId; dragId = null; place(id, s, side(s).length); },
  }, side(s).length ? side(s).map((m, i) => chip(m, s, i)) : h("span", { class: "muted" }, "여기로 끌어 놓기"));
  const drawBar = () => bar.replaceChildren(
    h("div", {}, h("h4", {}, "왼쪽"), zone("left")),
    h("div", { class: "menu-center", "aria-hidden": "true" }, "●"),
    h("div", {}, h("h4", {}, "오른쪽"), zone("right")));
  drawBar();
  trackTab("menu", "하단 메뉴", base, () => norm(items).map((m) => ({ ...m, label: m.label.trim() })),
    (x) => { for (const m of x) Object.assign(items.find((y) => y.id === m.id) ?? {}, m); drawBar(); }, (x) => ({ items: x }));
  return box("하단 메뉴 배치", note("홈페이지와 같은 모양입니다(가운데 ● = 메뉴 버튼). 메뉴를 끌어서 왼쪽·오른쪽과 순서를 바꾸고, 이름은 [수정]으로 고칩니다. 누르면 가는 페이지는 그대로입니다."), bar);
}
