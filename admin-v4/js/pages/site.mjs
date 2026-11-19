// 사이트 편집: 메인 / 학과 대표 / 로딩 / 하단 메뉴. 입력 옆에 미리보기. 바꾸면 떠 있는 창 [임시 저장] / [사이트 적용](그 탭만 공개).
// 메인·로딩은 여러 개 모두(순서·사용·빼기), 메뉴는 보이는 이름(label)·좌우·순서만 — 이동용 이름(name)은 그대로라 링크가 안 깨진다.
// 이미지는 올리기(기존 업로드), 영상은 주소(유튜브·mp4 등)로 넣는다.
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, media, fill, empty, note, busy, publishBanner } from "../ui.mjs";
import { track, check, canSwitch } from "../changes.mjs";

let state = { tab: "main", dept: null };

export async function render({ main }) {
  main.replaceChildren(head("사이트 편집", "메인 화면, 학과 대표 화면, 로딩 화면, 하단 메뉴를 고치고 미리 봅니다. 저장하면 그 탭만 바로 반영됩니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [mm, depts, loading, menus] = await Promise.all([data.mainMedia(), data.all("departments", (q) => q.order("sort_order", { nullsFirst: false })), data.loadingItems(), data.menus()]);
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    const clone = (x) => JSON.parse(JSON.stringify(x));
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
        view = listEditor(clone(base), { url: "url", text: "caption", textLabel: "문구", kind: "메인 이미지·영상", msg,
          tracked: (items, redraw) => trackTab("main", "메인 화면", base, () => items, (x) => { items.splice(0, items.length, ...x); redraw(); }, (x) => ({ items: x })) });
      } else if (state.tab === "loading") {
        const base = loading.map((l) => ({ id: l.id, image_url: l.image_url, text: l.text ?? "", is_active: l.is_active !== false, font_family: l.font_family, font_size: l.font_size, font_weight: l.font_weight }));
        view = listEditor(clone(base), { url: "image_url", text: "text", textLabel: "로딩 문구", kind: "로딩 이미지", msg,
          tracked: (items, redraw) => trackTab("loading", "로딩 화면", base, () => items, (x) => { items.splice(0, items.length, ...x); redraw(); }, (x) => ({ items: x })) });
      } else if (state.tab === "dept") {
        state.dept = depts.some((d) => d.id === state.dept) ? state.dept : depts[0]?.id;
        const d = depts.find((x) => x.id === state.dept);
        if (!d) { view = [empty("학과가 없습니다")]; } else {
          const base = { id: d.id, image_url: d.image_url ?? "", description: d.description ?? "", name_en: d.name_en ?? "" };
          const f = clone(base);
          const prev = h("div");
          const showPrev = () => prev.replaceChildren(media(f.image_url), h("p", { style: "white-space:pre-wrap" }, f.description), h("p", { class: "muted" }, f.name_en));
          showPrev();
          trackTab(`dept:${d.id}`, `${d.name} 대표 화면`, base, () => f, (x) => { Object.assign(f, x); draw(); }, (x) => x);
          view = [tabs(depts.map((x) => [x.id, x.name]), state.dept, (id) => { if (!canSwitch()) return; state.dept = id; draw(); }, "chips"), h("div", { style: "height:14px" }),
            h("div", { class: "two" },
              box(`${d.name} 대표 화면`,
                urlField(f, "image_url", "대표 이미지", msg, showPrev),
                h("label", { class: "step", style: "display:block;margin:8px 0" }, h("b", {}, "학과 소개"),
                  h("textarea", { rows: 6, value: f.description, style: "width:100%", oninput: (e) => { f.description = e.target.value; showPrev(); } })),
                h("label", { class: "step", style: "display:block" }, h("b", {}, "영문 이름"),
                  h("input", { value: f.name_en, style: "width:100%", oninput: (e) => { f.name_en = e.target.value; showPrev(); } })),
                note("학과 표지만 바뀝니다. 과목 단계 이미지·강사 사진과는 따로입니다.")),
              box("미리보기", prev))];
        }
      } else {
        // 메뉴 상태 = 좌우 순서대로 [{id, label, side}] (순서는 배열 순서)
        const norm = (arr) => ["left", "right"].flatMap((side) => arr.filter((m) => m.side === side).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((m, i) => ({ id: m.id, label: m.label ?? "", side, sort_order: i })));
        const base = norm(menus);
        const items = clone(base).map((m) => ({ ...m, name: menus.find((x) => x.id === m.id)?.name, is_active: menus.find((x) => x.id === m.id)?.is_active }));
        const cols = h("div", { class: "menucols" });
        const drawCols = () => cols.replaceChildren(...["left", "right"].map((side) => {
          const list = items.filter((m) => m.side === side).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          return h("div", {}, h("h4", {}, side === "left" ? "왼쪽" : "오른쪽"), list.length ? list.map((m, i) => h("div", { class: "step", style: "margin-bottom:8px" },
            h("div", { class: "row" }, h("b", {}, m.label || m.name), m.is_active === false ? pill("꺼짐", "neutral") : null),
            h("input", { value: m.label, placeholder: m.name, "aria-label": `${m.name} 보이는 이름`, style: "width:100%", oninput: (e) => { m.label = e.target.value; } }),
            h("p", { class: "muted" }, `이동: ${m.name}`),
            h("div", { class: "actions" },
              h("button", { type: "button", class: "btn", disabled: i === 0, onclick: () => { swap(list, i, -1); drawCols(); } }, "↑"),
              h("button", { type: "button", class: "btn", disabled: i === list.length - 1, onclick: () => { swap(list, i, 1); drawCols(); } }, "↓"),
              h("button", { type: "button", class: "btn", onclick: () => { m.side = side === "left" ? "right" : "left"; m.sort_order = 999; drawCols(); } }, side === "left" ? "오른쪽으로" : "왼쪽으로")))) : empty("메뉴 없음"));
        }));
        const swap = (list, i, d) => { const [a, b] = [list[i], list[i + d]]; [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order]; if (a.sort_order === b.sort_order) b.sort_order += d > 0 ? -1 : 1; };
        drawCols();
        trackTab("menu", "하단 메뉴", base, () => norm(items).map((m) => ({ ...m, label: m.label.trim() })),
          (x) => { for (const m of x) Object.assign(items.find((y) => y.id === m.id) ?? {}, m); drawCols(); }, (x) => ({ items: x }));
        view = [box("하단 메뉴 배치", note("보이는 이름만 바뀌고, 누르면 가는 페이지는 그대로입니다. 비우면 원래 이름이 보입니다."), cols)];
      }
      out.replaceChildren(banner, msg, tabs([["main", "메인 화면"], ["dept", "학과 대표 화면"], ["loading", "로딩 화면"], ["menu", "하단 메뉴"]], state.tab, (t) => { if (!canSwitch()) return; state.tab = t; msg.replaceChildren(); draw(); }), ...[view].flat());
    };
    draw();
    return out;
  });
}

// 주소 칸 + [이미지 올리기]. 올리기가 끝나야 주소가 바뀐다.
function urlField(obj, key, label, msg, onChange) {
  const input = h("input", { value: obj[key] ?? "", placeholder: "https://", "aria-label": `${label} 주소`, style: "width:100%", oninput: (e) => { obj[key] = e.target.value.trim(); onChange(); } });
  const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": `${label} 올리기` });
  file.onchange = () => busy(file, msg, async () => {
    if (!file.files[0]) return;
    obj[key] = (await data.upload(file.files[0], "image")).url;
    input.value = obj[key];
    file.value = "";
    onChange();
    check();
  });
  return h("label", { class: "step", style: "display:block" }, h("b", {}, label), input, file);
}

// 메인·로딩: 여러 항목(순서·사용·빼기·더하기) + 고른 항목 미리보기
function listEditor(items, { url, text, textLabel, kind, msg, tracked }) {
  let sel = 0;
  const listEl = h("div");
  const prev = h("div");
  const showPrev = () => prev.replaceChildren(items[sel] ? [media(items[sel][url]), h("p", { style: "white-space:pre-wrap" }, items[sel][text])] : empty("항목이 없습니다"));
  const drawList = () => {
    listEl.replaceChildren(...items.map((it, i) => h("div", { class: "step", style: `margin-bottom:10px${i === sel ? ";border-color:var(--green)" : ""}`, onclick: () => { if (sel !== i) { sel = i; drawList(); showPrev(); } } },
      h("div", { class: "row" }, h("b", {}, `${kind} ${i + 1}`),
        h("label", {}, h("input", { type: "checkbox", checked: it.is_active, onchange: (e) => { it.is_active = e.target.checked; } }), " 사용")),
      urlField(it, url, "주소", msg, () => { if (i === sel) showPrev(); }),
      h("label", { class: "step", style: "display:block;margin-top:6px" }, h("b", {}, textLabel),
        h("textarea", { rows: 2, value: it[text], style: "width:100%", oninput: (e) => { it[text] = e.target.value; if (i === sel) showPrev(); } })),
      h("div", { class: "actions", style: "margin-top:6px" },
        h("button", { type: "button", class: "btn", disabled: i === 0, onclick: (e) => { e.stopPropagation(); [items[i - 1], items[i]] = [items[i], items[i - 1]]; sel = i - 1; drawList(); showPrev(); } }, "↑"),
        h("button", { type: "button", class: "btn", disabled: i === items.length - 1, onclick: (e) => { e.stopPropagation(); [items[i + 1], items[i]] = [items[i], items[i + 1]]; sel = i + 1; drawList(); showPrev(); } }, "↓"),
        h("button", { type: "button", class: "btn danger", onclick: (e) => { e.stopPropagation(); items.splice(i, 1); sel = Math.max(0, Math.min(sel, items.length - 1)); drawList(); showPrev(); } }, "빼기")))));
  };
  drawList();
  showPrev();
  tracked(items, () => { sel = Math.min(sel, Math.max(0, items.length - 1)); drawList(); showPrev(); });
  return [h("div", { class: "two" },
    box(`${kind} ${items.length}개`, note("여러 개면 지금처럼 홈페이지가 돌아가며 보여 줍니다."), listEl,
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn", onclick: () => { items.push({ [url]: "", [text]: "", is_active: true }); sel = items.length - 1; drawList(); showPrev(); } }, "+ 항목"))),
    box("미리보기", prev))];
}
