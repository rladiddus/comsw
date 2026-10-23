import { dbErrorMessage } from "./fields.mjs";
import { nextOrder, subsetReorderUpdates } from "./order.mjs";
import { mountImageUpload } from "./image-upload.mjs";
import { mediaPreview } from "./media-preview.mjs";

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// 끌어 놓은 자리로 옮긴 뒤 0..n-1로 다시 매기고, 순서가 바뀐 줄만 돌려준다.
// 끌어 놓기: 줄 위쪽 절반이면 그 줄 앞, 아래쪽 절반이면 뒤 경계에 점선을 긋고, 놓으면 move(from, to).
// 제자리(옮겨도 순서가 같은 곳)에는 점선을 긋지 않는다. 카드 목록·학과 커리큘럼·로드맵이 같이 쓴다.
// axis "x"면 왼쪽/오른쪽 절반으로 보고 세로 점선을 긋는다(로드맵 단계처럼 옆으로 놓인 목록).
export function dropTarget(box, index, from, move, axis = "y") {
  if (axis === "x") box.classList.add("drop-x");
  const clear = () => box.classList.remove("drop-before", "drop-after");
  const spot = (e) => {
    const r = box.getBoundingClientRect();
    const after = axis === "x" ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    const f = from();
    let to = after ? index + 1 : index;
    if (to > f) to -= 1;
    return { after, f, to };
  };
  box.addEventListener("dragover", (e) => {
    e.preventDefault();
    const { after, f, to } = spot(e);
    const show = f >= 0 && to !== f;
    box.classList.toggle("drop-after", show && after);
    box.classList.toggle("drop-before", show && !after);
  });
  box.addEventListener("dragleave", (e) => { if (!box.contains(e.relatedTarget)) clear(); });
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    clear();
    const { f, to } = spot(e);
    if (f >= 0 && to !== f) move(f, to);
  });
}

export function reorderUpdates(rows, from, to) {
  return subsetReorderUpdates(rows, rows.map((r) => r.id), from, to);
}

// 카드 목록 편집기(로딩 화면·학과 등).
// 줄마다 [⠿ 끌어 옮기기 | 이미지 미리보기 | 칸들(2열) / 사용·삭제·수정·접기]. imageSide:'right'면 이미지가 오른쪽.
// '수정'을 누르면 칸이 열리고 이미지 주소·직접 올리기가 나오며 버튼이 '저장'(주황). 사용 체크는 바로 저장.
// 처음에는 접힌 채로 보인다. 접으면 미리보기가 작아지고 칸들이 한 줄('이름 : 값 · …'), 접은 채로도 수정·저장(이미지는 펼쳐서).
// fields: [{ key, label, type: 'text'|'textarea'|'select'|'links', options?(values) => [[값, 글자]], fallback?, required?, wide?, placeholder? }]
// links(다대다, 예: 강사 학과·담당 과목): { through, own, other, ordered?, options: () => [[값, 글자]] }. 수정 중에만 ×·추가, 저장 때 한꺼번에 반영.
export async function mountCardList(container, {
  supabase,
  table,
  title,
  description,
  fields,
  imageKey = "image_url",
  imageLabel = "이미지",
  imageRequired = false,
  imageSide = "left",
  activeKey = "is_active", // null이면 사용 체크 없음
  query = (q) => q, // 불러올 조건
  sortRows = (rows) => rows, // 보이는 순서
  orderScope = null, // 순서를 따로 매기는 묶음(예: 학과 탭). 보이는 줄의 묶음이 하나일 때만 끌어 옮길 수 있다.
  canAdd = () => true, // true 또는 못 더하는 이유
  activeLabel = "사용",
  stageClass = "",
  defaults = () => ({}),
  deleteConfirm = async (row, index) => `${index + 1}번을 삭제할까요?`,
  preview = (values) => [mediaPreview(values[imageKey])],
  itemName = (row, index) => `${index + 1}번`,
}) {
  const state = el("span", { className: "save-state" });
  const list = el("div", { className: "card-list" });
  const add = el("button", { type: "button", className: "publish-btn", textContent: "+ 추가" });
  const foldAll = el("button", { type: "button", className: "ghost-btn", textContent: "모두 펼치기" });
  container.append(
    ...(title ? [el("h3", { textContent: title })] : []),
    ...(description ? [el("p", { className: "desc", textContent: description })] : []),
    el("div", { className: "editor-bar" }, [add, foldAll, state]),
    list,
  );
  const setState = (text, err = false) => {
    state.textContent = text;
    state.classList.toggle("err", err);
  };
  let rows = [];
  let dragFrom = -1;
  // 처음 보이는 카드는 접힌 채로. '+ 추가'로 만든 카드만 펼쳐서 바로 쓰게 한다.
  const collapsed = new Set();
  const seen = new Set();
  let expandNew = false;

  async function load() {
    const { data, error } = await query(supabase.from(table).select("*"))
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) return setState(dbErrorMessage(error), true);
    rows = data || [];
    await loadLinks();
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (!expandNew) collapsed.add(r.id);
    }
    expandNew = false;
    draw();
  }
  // 다대다 칸: 줄마다 연결된 값 목록(순서 있는 칸은 sort_order 순).
  const links = {};
  async function loadLinks() {
    for (const f of fields.filter((f) => f.type === "links")) {
      links[f.key] = new Map(rows.map((r) => [r.id, []]));
      if (!rows.length) continue;
      const cols = [f.own, f.other, ...(f.ordered ? ["sort_order"] : [])].join(", ");
      const { data, error } = await supabase.from(f.through).select(cols).in(f.own, rows.map((r) => r.id));
      if (error) {
        setState(dbErrorMessage(error), true);
        continue;
      }
      const sorted = f.ordered ? [...data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) : data;
      for (const l of sorted) links[f.key].get(l[f.own])?.push(l[f.other]);
    }
  }
  async function saveLinks(row, f, next) {
    const before = links[f.key].get(row.id);
    for (const v of before.filter((v) => !next.includes(v))) {
      const { error } = await supabase.from(f.through).delete().eq(f.own, row.id).eq(f.other, v);
      if (error) throw error;
    }
    const added = next.filter((v) => !before.includes(v));
    for (const v of added) {
      const { error } = await supabase.from(f.through).insert({
        [f.own]: row.id,
        [f.other]: v,
        // 새로 더한 것은 기존 것 뒤로(사이트 표시 순서).
        ...(f.ordered ? { sort_order: 1000 + next.indexOf(v) } : {}),
      });
      if (error) throw error;
    }
    links[f.key].set(row.id, [...next]);
  }

  async function update(row, patch) {
    setState("저장 중…");
    const { error } = await supabase.from(table).update(patch).eq("id", row.id);
    if (error) {
      setState(dbErrorMessage(error), true);
      return false;
    }
    Object.assign(row, patch);
    setState("저장됨");
    return true;
  }
  // 검색: 보이는 줄만 거른다(불러온 줄은 그대로).
  let match = () => true;
  // 검색 함수는 (줄, 다대다 칸 key → 연결된 값 목록)을 받는다.
  const visible = () => sortRows(rows).filter((r) => match(r, (key) => links[key]?.get(r.id) ?? []));
  // 끌기 가능 여부는 그릴 때 한 번만 계산한다(카드마다 다시 정렬하면 줄이 많을 때 멈춘다).
  let dragOk = true;
  // 줄이 많으면(예: 강사 커리큘럼 수백 개) 한 번에 PAGE개씩만 그린다.
  const PAGE = 30;
  let limit = PAGE;
  async function reorder(from, to) {
    const shown = visible();
    const scope = orderScope ? orderScope(shown[from]) : "";
    const pool = orderScope ? rows.filter((r) => orderScope(r) === scope) : rows;
    for (const u of subsetReorderUpdates(pool, shown.map((r) => r.id), from, to)) {
      const { error } = await supabase.from(table).update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) return setState(dbErrorMessage(error), true);
    }
    setState("순서를 바꿨습니다");
    await load();
  }
  add.addEventListener("click", async () => {
    const why = canAdd();
    if (why !== true) return setState(why, true);
    const { error } = await supabase.from(table).insert({
      ...defaults(rows),
      ...(activeKey ? { [activeKey]: false } : {}),
      sort_order: nextOrder(rows),
    });
    if (error) return setState(dbErrorMessage(error), true);
    expandNew = true;
    limit = Math.max(limit, visible().length + 1); // 맨 아래에 생긴 새 카드까지 보이게
    await load();
    setState("추가했습니다. 맨 아래에서 '수정'을 눌러 내용을 넣어주세요.");
  });
  foldAll.addEventListener("click", () => {
    const fold = foldAll.textContent === "모두 접기";
    for (const r of rows) {
      if (fold) collapsed.add(r.id);
      else collapsed.delete(r.id);
    }
    foldAll.textContent = fold ? "모두 펼치기" : "모두 접기";
    draw();
  });

  function card(row, index) {
    const stage = el("div", { className: `card-stage ${stageClass}`.trim() });
    const inputs = {};
    const plain = fields.filter((f) => f.type !== "links");
    const values = () => Object.fromEntries([...plain.map((f) => f.key), imageKey].map((k) => [k, inputs[k].value]));
    const chosen = {}; // links 칸: 수정 중인 값 목록
    let isEditing = false;
    function chipsFor(f) {
      const wrap = el("div", { className: "links card-links" });
      const labelOf = (v) => f.options().find(([x]) => x === v)?.[1] ?? v;
      const draw = () => {
        const chips = chosen[f.key].map((v) => {
          const chip = el("span", { className: "chip" }, [el("span", { textContent: labelOf(v) })]);
          if (isEditing) {
            const x = el("button", { type: "button", textContent: "×", title: "빼기" });
            x.addEventListener("click", () => {
              chosen[f.key] = chosen[f.key].filter((y) => y !== v);
              draw();
            });
            chip.append(x);
          }
          return chip;
        });
        const extra = [];
        if (isEditing) {
          const pick = el("select", { className: "link-pick" }, [
            el("option", { value: "", textContent: "+ 추가" }),
            ...f.options().filter(([v]) => !chosen[f.key].includes(v)).map(([v, l]) => el("option", { value: v, textContent: l })),
          ]);
          pick.setAttribute("aria-label", `${f.label} 추가`);
          pick.addEventListener("change", () => {
            if (!pick.value) return;
            chosen[f.key] = [...chosen[f.key], pick.value];
            draw();
          });
          extra.push(pick);
        } else if (!chips.length) {
          extra.push(el("span", { className: "muted", textContent: "없음" }));
        }
        wrap.replaceChildren(...chips, ...extra);
      };
      wrap.redraw = draw;
      return wrap;
    }
    // 선택 칸: 목록에 없는 예전 값은 '(현재) 값'으로 남긴다. 다른 칸 값에 따라 목록이 바뀔 수 있다.
    const fillSelect = (f, value) => {
      const select = inputs[f.key];
      const list = f.options(values());
      select.replaceChildren(...list.map(([v, label]) => el("option", { value: v, textContent: label })));
      if (value && !list.some(([v]) => v === value)) {
        select.prepend(el("option", { value, textContent: `(현재) ${value}` }));
      }
      select.value = value || f.fallback || list[0]?.[0] || "";
    };
    const paint = () => stage.replaceChildren(...preview(values()));
    const line = (label, input, wide = false) =>
      el("label", { className: `card-line${wide ? " wide" : ""}` }, [el("span", { textContent: label }), input]);
    const lines = fields.map((f) => {
      if (f.type === "links") {
        chosen[f.key] = [...(links[f.key]?.get(row.id) ?? [])];
        inputs[f.key] = chipsFor(f);
        inputs[f.key].redraw();
        return line(f.label, inputs[f.key], f.wide);
      }
      if (f.type === "select") {
        inputs[f.key] = el("select", { disabled: true });
      } else if (f.type === "textarea") {
        inputs[f.key] = el("textarea", { value: row[f.key] ?? "", placeholder: f.placeholder ?? "", readOnly: true, rows: 3 });
      } else {
        inputs[f.key] = el("input", { type: "text", value: row[f.key] ?? "", placeholder: f.placeholder ?? "", readOnly: true });
      }
      return line(f.label, inputs[f.key], f.wide);
    });
    inputs[imageKey] = el("input", { type: "text", value: row[imageKey] ?? "", placeholder: "https://… 이미지 주소", readOnly: true });
    for (const f of fields.filter((f) => f.type === "select")) fillSelect(f, row[f.key]);
    for (const f of plain) {
      inputs[f.key].addEventListener(f.type === "select" ? "change" : "input", () => {
        // 다른 칸에 따라 바뀌는 선택 칸(예: 폰트 → 두께)을 다시 채운다.
        for (const g of fields) if (g !== f && g.type === "select" && g.dependsOn === f.key) fillSelect(g, "");
        paint();
      });
    }
    inputs[imageKey].addEventListener("change", paint);
    const active = el("input", { type: "checkbox", checked: Boolean(activeKey && row[activeKey]) });
    active.setAttribute("aria-label", activeLabel);
    active.addEventListener("change", () => update(row, { [activeKey]: active.checked }));
    const upload = el("div", { className: "card-upload", hidden: true }, [line(`${imageLabel} 주소`, inputs[imageKey], true)]);
    mountImageUpload(upload, {
      label: "이미지 직접 올리기",
      onUploaded: (asset) => {
        inputs[imageKey].value = asset.url;
        paint();
      },
    });
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    const remove = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
    const fold = el("button", { type: "button", className: "ghost-btn fold-btn" });
    const editing = (on) => {
      upload.hidden = !on;
      isEditing = on;
      for (const f of fields.filter((f) => f.type === "links")) {
        if (!on) chosen[f.key] = [...(links[f.key]?.get(row.id) ?? [])];
        inputs[f.key].redraw();
      }
      for (const [key, input] of Object.entries(inputs)) {
        if (fields.find((f) => f.key === key)?.type === "links") continue;
        if (input.tagName === "SELECT") input.disabled = !on;
        else input.readOnly = !on;
      }
      edit.textContent = on ? "저장" : "수정";
      edit.className = on ? "publish-btn" : "ghost-btn";
    };
    edit.addEventListener("click", async () => {
      if (upload.hidden) return editing(true);
      const v = values();
      const missing = fields.find((f) => f.required && !v[f.key].trim());
      if (missing) return setState(`${missing.label}을(를) 입력해주세요`, true);
      if (imageRequired && !v[imageKey].trim()) return setState("이미지를 올리거나 주소를 넣어주세요", true);
      edit.disabled = true;
      const patch = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || null]));
      let ok = await update(row, patch);
      if (ok) {
        try {
          for (const f of fields.filter((f) => f.type === "links")) await saveLinks(row, f, chosen[f.key]);
        } catch (error) {
          setState(dbErrorMessage(error), true);
          ok = false;
        }
      }
      if (ok) editing(false);
      edit.disabled = false;
    });
    remove.addEventListener("click", async () => {
      if (!confirm(await deleteConfirm(row, index))) return;
      const { error } = await supabase.from(table).delete().eq("id", row.id);
      if (error) return setState(dbErrorMessage(error), true);
      await load();
      setState(`${itemName(row, index)}을(를) 삭제했습니다`);
    });
    paint();

    const handle = el("span", {
      className: `drag-handle${dragOk ? "" : " off"}`,
      textContent: "⠿",
      title: dragOk ? "끌어서 순서 바꾸기" : "한 묶음(예: 학과 탭)만 보일 때 순서를 바꿀 수 있습니다",
    });
    const side = el("div", { className: "card-side" }, [
      el("div", { className: "card-fields" }, lines),
      upload,
      el("div", { className: "media-actions" }, [
        ...(activeKey ? [el("label", { className: "consent" }, [active, el("span", { textContent: activeLabel })])] : []),
        remove,
        edit,
        fold,
      ]),
    ]);
    const box = el("article", { className: `card-item image-${imageSide}${stageClass ? ` stage-${stageClass}` : ""}` }, [
      handle,
      ...(imageSide === "right" ? [side, stage] : [stage, side]),
    ]);
    const setFolded = (on) => {
      box.classList.toggle("collapsed", on);
      fold.textContent = on ? "펼치기" : "접기";
      fold.setAttribute("aria-expanded", String(!on));
      if (on) collapsed.add(row.id);
      else collapsed.delete(row.id);
    };
    fold.addEventListener("click", () => setFolded(!box.classList.contains("collapsed")));
    setFolded(collapsed.has(row.id));
    // 끌어서 순서 바꾸기: 손잡이를 잡았을 때만 줄 전체가 끌린다.
    handle.addEventListener("pointerdown", () => { box.draggable = dragOk; });
    box.addEventListener("dragstart", (e) => {
      dragFrom = index;
      e.dataTransfer?.setData?.("text/plain", String(index));
      box.classList.add("dragging");
    });
    box.addEventListener("dragend", () => {
      dragFrom = -1;
      box.draggable = false;
      box.classList.remove("dragging");
    });
    dropTarget(box, index, () => dragFrom, reorder);
    return box;
  }

  function draw() {
    const shown = visible();
    dragOk = new Set(shown.map((r) => (orderScope ? orderScope(r) : ""))).size <= 1;
    list.replaceChildren(...shown.slice(0, limit).map(card));
    if (shown.length > limit) {
      const more = el("button", { type: "button", className: "ghost-btn more-btn", textContent: `더 보기 (${shown.length - limit}개 남음)` });
      more.addEventListener("click", () => {
        limit += PAGE;
        draw();
      });
      list.append(more);
    }
    if (!shown.length) {
      list.append(el("p", { className: "muted", textContent: rows.length ? "검색 결과가 없습니다." : "아직 항목이 없습니다." }));
    }
  }
  await load();
  return {
    reload: load,
    // 검색 조건을 바꿔 다시 그린다. 결과 개수를 돌려준다.
    setFilter(fn) {
      match = fn || (() => true);
      limit = PAGE;
      draw();
      return visible().length;
    },
  };
}
