// 학과·과목: 학과 구성(학과 추가·이름 수정, 끌어서 순서) / 전체 과목(넓은 목록) / 삭제된 과목.
// 과목을 누르면 팝업(강사 팝업과 같은 크기): 왼쪽 강사 넣기·빼기, 오른쪽 공통 4단계(문구·대표 이미지). 바꾸면 떠 있는 창으로 저장·적용.
// 학과 추가·이름 수정, 과목 삭제·복원은 팝업에서 눌러 바로 반영.
import * as data from "../data.mjs";
import { h, head, box, table, tabs, pill, fill, note, fail, busy, publishBanner, modal, filterBar, hasText, toggleSwitch } from "../ui.mjs";
import { baseName, curriculumUnits, deptOrder, stepState } from "../rules.mjs";
import { deptLayout, moveItem } from "./dept-layout.mjs";
import { assignedFirst, commonEditor, fillFrom } from "./common-editor.mjs";
import { prepEditor } from "./prep.mjs";
import { canSwitch, unsaved, untrack, track } from "../changes.mjs";

let state = { tab: "depts", dept: null };

export async function render({ main, params = [] }) {
  if (params[0]) state.tab = params[0];
  if (params[1]) state.dept = params[1];
  const reload = () => render({ main });
  main.replaceChildren(head("학과·과목", "학과마다 과목 구성과 순서를 정하고, 과목마다 공통 4단계 커리큘럼을 정리합니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const cat = await data.catalog();
    const subjects = data.general(cat); // 일반 과목만(방학 특강 과목은 방학 특강 메뉴)
    const [weeks, approved, isubs] = await Promise.all([
      data.weeks(),
      data.curricula((q) => q.eq("status", "approved").order("id")), // 페이지로 나눠 읽어도 겹치지 않게 id 순서
      data.all("instructor_subjects"),
    ]);
    const general = weeks.filter((w) => !w.set_id);
    const stepsOf = (id) => general.filter((w) => w.subject_id === id).sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    // 적용한 공통이 없는 과목 → 강사 자료 초안(과목 팝업에 보이는 것과 같은 4단계, 저장하지 않음)
    const vacIds = new Set(cat.vacations.map((v) => v.id));
    const units = curriculumUnits(approved).filter((u) => !vacIds.has(u.set_id));
    const mineOf = (id) => new Set(isubs.filter((x) => x.subject_id === id).map((x) => x.instructor_id));
    const drafts = new Map(subjects.filter((s) => !stepsOf(s.id).length)
      .map((s) => [s.id, fillFrom(assignedFirst(units.filter((u) => u.subject_id === s.id), mineOf(s.id))).filter((x) => x.summary)]));
    const draftOf = (id) => drafts.get(id) ?? [];
    const deptsOf = (id) => cat.links.filter((l) => l.subject_id === id).map((l) => cat.departments.find((d) => d.id === l.department_id)?.name).filter(Boolean);
    const vacsOf = (id) => cat.vacLinks.filter((l) => l.subject_id === id).map((l) => cat.vacations.find((v) => v.id === l.set_id)?.name).filter(Boolean);
    const out = h("div");
    const msg = h("div");
    const banner = await publishBanner(data.unpublished);
    const stepPill = (s) => {
      const draft = draftOf(s.id).length;
      if (draft) return pill(`초안 ${draft}단계 · 적용 전`, "neutral");
      const st = stepState(stepsOf(s.id).length);
      return pill(st.label, st.kind);
    };

    // 과목 팝업: 왼쪽 강사, 오른쪽 공통 4단계. 전체 과목에서 열면 [과목 삭제]도.
    const openSubject = (s, { withDelete = false } = {}) => {
      const popMsg = h("div");
      const steps = stepsOf(s.id);
      // 과목명 수정: 팝업 [수정]을 누른 동안만 보임(작은 팝업, 바로 반영)
      const renameBtn = h("button", { type: "button", class: "btn", hidden: true, style: "margin-bottom:8px", onclick: () => renamePopup(s, () => { pop.close(); reload(); }) }, "과목명 수정");
      const extra = [
        h("hr", { style: "border:0;border-top:1px solid var(--line);margin:14px 0" }),
        renameBtn,
        s.duration ? h("p", { class: "muted" }, `과정 기간 ${s.duration}`) : null,
        s.relink_needed ? note("복원한 과목입니다. 학과나 방학 특강에 다시 넣기 전에는 홈페이지에 나오지 않습니다.") : null,
        h("button", { type: "button", class: "btn", style: "white-space:nowrap", onclick: (e) => busy(e.currentTarget, popMsg, () => openPrep(baseName(s.name))) }, `공통 준비물(${baseName(s.name)})`),
        withDelete ? h("div", { style: "margin-top:10px" }, h("button", { type: "button", class: "btn danger", onclick: (e) => busy(e.currentTarget, popMsg, async () => {
          const d = deptsOf(s.id), v = vacsOf(s.id);
          const where = [d.length ? `학과: ${d.join(", ")}` : "", v.length ? `방학 특강: ${v.join(", ")}` : ""].filter(Boolean).join("\n") || "연결된 학과·방학 특강 없음";
          if (!confirm(`'${s.name}' 과목을 삭제할까요?\n\n빠지는 곳\n${where}\n\n자료는 보관되고 홈페이지에는 바로 반영됩니다.`)) return;
          await data.call("comsw_v4_delete_subject", { p_id: s.id });
          pop.close();
          state.tab = "deleted"; reload();
        }) }, "과목 삭제")) : null,
      ];
      const editor = commonEditor(s, cat, steps.length === 4 ? steps : [], { msg: popMsg, reload: () => { pop.close(); reload(); }, extraLeft: extra, startEditing: false });
      const st = stepState(steps.length);
      // [수정]: 보기 ↔ 고치기. 고치면 오른쪽 아래 창에서 [임시 저장]/[되돌리기]/[사이트 적용]
      const editBtn = h("button", { type: "button", class: "btn primary" }, "수정");
      const sync = () => { editBtn.textContent = editor.isEditing() ? "돌아가기" : "수정"; renameBtn.hidden = !editor.isEditing(); };
      editor.onEditing = sync;
      editBtn.onclick = () => {
        if (editor.isEditing() && unsaved(editor.trackId) && !confirm("임시 저장하지 않은 바뀐 설정이 있습니다. 수정을 끝내면 화면은 보기로 바뀌고, 바꾼 내용은 오른쪽 아래 창에 남습니다. 계속할까요?")) return;
        editor.setEditing(!editor.isEditing());
        sync();
      };
      const pop = modal(`${s.name} · 공통 커리큘럼(일반)`, h("div", { class: "modal-body" },
        popMsg, h("div", { class: "row" }, h("span", { class: "muted" }, deptsOf(s.id).join(", ") || "학과 없음"), pill(`공개 중 ${st.label}`, st.kind)),
        h("div", { class: "modal-main", style: "margin-top:10px" }, editor)), {
        beforeClose: () => !unsaved() || confirm("임시 저장하지 않은 바뀐 설정이 있습니다. 닫으면 사라집니다. 닫을까요?"),
        onClose: () => untrack(editor.trackId),
        actions: [editBtn],
      });
      // 왼쪽 칸은 '공통 준비물(과목)' 버튼이 한 줄에 들어갈 만큼 넓게(최소 240px)
      pop.dlg.style.setProperty("--picks", "minmax(240px, max-content)");
      pop.dlg.classList.add("modal-fit"); // 높이는 내용만큼(빈 아래쪽 없이), 화면보다 크면 안에서 스크롤
    };

    // 공통 준비물 팝업(과목 팝업 위에 하나 더). 준비물 메뉴와 같은 편집기, [사이트 적용]은 준비물만 공개.
    const openPrep = async (base) => {
      const [items, mats] = await Promise.all([data.prepItems(), data.materials()]);
      const prepMsg = h("div");
      let pop = null;
      const ed = prepEditor(base, { subjects, items, mats, departments: cat.departments, msg: prepMsg, onApplied: () => pop?.close() });
      pop = modal(`${base} · 공통 준비물`, h("div", { class: "modal-body" }, prepMsg, h("div", { class: "modal-main" }, ed.el)), {
        beforeClose: () => !unsaved(ed.trackId) || confirm("임시 저장하지 않은 준비물 변경이 있습니다. 닫으면 사라집니다. 닫을까요?"),
        onClose: () => untrack(ed.trackId),
      });
      pop.dlg.classList.add("modal-fit", "modal-mid");
    };

    const renamePopup = (s, done) => {
      const popMsg = h("div");
      const input = h("input", { value: s.name, "aria-label": "과목 이름", style: "width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:5px" });
      const ok = h("button", { type: "button", class: "btn primary" }, "수정");
      const pop = modal("과목명 수정", h("section", { class: "box", style: "margin:0" }, popMsg,
        h("label", { class: "form-field" }, h("b", {}, "과목 이름"), input),
        h("p", { class: "muted" }, "바꾸면 학과 커리큘럼·로드맵·강사 소개 등 사이트 전체에서 새 이름이 보입니다(바로 반영). 같은 종류(일반/방학 특강) 안에서 겹치는 이름은 쓸 수 없습니다."),
        h("div", { class: "actions" }, ok)));
      pop.dlg.classList.add("modal-small");
      ok.onclick = () => busy(ok, popMsg, async () => {
        if (!input.value.trim()) throw new Error("과목 이름을 입력해주세요");
        await data.call("comsw_v4_rename_subject", { p_id: s.id, p_name: input.value.trim() });
        pop.close();
        done();
      });
      input.focus();
    };

    // 학과 순서·공개: 알약을 끌어서 순서, 학과명 수정 옆 스위치로 공개/비공개 → 오른쪽 아래 창으로 반영
    const deptBase = { order: cat.departments.map((d) => d.id), active: Object.fromEntries(cat.departments.map((d) => [d.id, d.is_active !== false])) };
    const deptMeta = JSON.parse(JSON.stringify(deptBase));
    track({
      id: "departments", slot: "departments", title: "학과 순서·공개", baseline: deptBase,
      read: () => deptMeta, write: (x) => { deptMeta.order = [...x.order]; deptMeta.active = { ...x.active }; draw(); },
      apply: (x) => data.call("comsw_v4_save_departments", { p_items: x.order.map((id, i) => ({ id, sort_order: i, is_active: x.active[id] !== false })) }),
      onApplied: reload,
    });
    let dragDept = null;
    const deptChips = () => {
      const row = h("div", { class: "chips dept-chips" });
      const clear = () => row.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
      const byId = new Map(cat.departments.map((d) => [d.id, d]));
      deptMeta.order.forEach((id, i) => {
        const d = byId.get(id);
        if (!d) return;
        const b = h("button", {
          type: "button", draggable: "true", class: deptMeta.active[id] === false ? "off" : null, "aria-pressed": String(id === state.dept),
          title: `${d.name}${deptMeta.active[id] === false ? " (비공개)" : ""} · 끌어서 순서 바꾸기`,
          onclick: () => { if (!canSwitch()) return; state.dept = id; draw(); },
          ondragstart: (e) => { dragDept = id; b.classList.add("dragging"); e.dataTransfer?.setData("text/plain", id); },
          ondragend: () => { dragDept = null; b.classList.remove("dragging"); clear(); },
          ondragover: (e) => { if (!dragDept) return; e.preventDefault(); const r = b.getBoundingClientRect(); clear(); b.classList.add(e.clientX > r.left + r.width / 2 ? "drop-after" : "drop-before"); },
          ondrop: (e) => {
            e.preventDefault();
            if (!dragDept) return;
            const from = deptMeta.order.indexOf(dragDept);
            const to = i + (b.classList.contains("drop-after") ? 1 : 0);
            deptMeta.order = moveItem(deptMeta.order, from, to);
            dragDept = null;
            draw();
          },
        }, d.name);
        row.append(b);
      });
      row.append(h("button", { type: "button", class: "add-chip", onclick: () => deptPopup(null) }, "+ 학과 추가"));
      return row;
    };

    // 학과 추가·이름 수정 팝업(바로 반영)
    const deptPopup = (d) => {
      const popMsg = h("div");
      const input = h("input", { value: d?.name ?? "", "aria-label": "학과 이름", placeholder: "예: 게임학과", style: "width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:5px" });
      const ok = h("button", { type: "button", class: "btn primary" }, d ? "수정" : "추가");
      const pop = modal(d ? "학과명 수정" : "학과 추가", h("section", { class: "box", style: "margin:0" }, popMsg,
        h("label", { class: "step", style: "display:block" }, h("b", {}, "학과 이름"), input),
        h("p", { class: "muted" }, d ? "바꾸면 사이트 전체에서 새 이름이 보입니다(바로 반영)." : "추가하면 바로 반영되고, 학과 구성에서 과목을 넣을 수 있습니다."),
        h("div", { class: "actions" }, ok)));
      pop.dlg.classList.add("modal-small");
      ok.onclick = () => busy(ok, popMsg, async () => {
        if (!input.value.trim()) throw new Error("학과 이름을 입력해주세요");
        state.dept = await data.call("comsw_v4_save_department", { p_id: d?.id ?? null, p_name: input.value.trim() });
        pop.close();
        reload();
      });
      input.focus();
    };

    const draw = () => {
      const top = tabs([["depts", "학과 구성"], ["subjects", "전체 과목"], ["create", "과목 생성"], ["deleted", "삭제된 과목"]], state.tab, (t) => { if (!canSwitch()) return; state.tab = t; draw(); });
      let view;
      if (state.tab === "depts") {
        state.dept = cat.departments.some((d) => d.id === state.dept) ? state.dept : cat.departments[0]?.id;
        const dept = cat.departments.find((d) => d.id === state.dept);
        const ordered = deptOrder(cat.links.filter((l) => l.department_id === state.dept), subjects);
        view = [
          deptChips(),
          h("div", { style: "height:14px" }),
          dept ? deptLayout(dept, ordered, subjects, { msg, reload, stepPill, stepsOf, draftOf, openSubject: (id) => openSubject(subjects.find((x) => x.id === id)), rename: () => deptPopup(dept),
            activeSwitch: toggleSwitch(deptMeta.active[dept.id] !== false, `${dept.name} 홈페이지 공개`, (next) => { deptMeta.active[dept.id] = next; draw(); }) })
            : box(null, fail("학과가 없습니다. [+ 학과 추가]로 만들어주세요.")),
        ];
      } else if (state.tab === "subjects") {
        // 거르기: 과목(검색), 학과(드롭다운), 방학 특강(On/Off). 목록만 다시 그린다.
        const deptOpts = cat.departments.map((d) => d.name);
        const listBox = h("section", { class: "box" });
        const filter = filterBar([
          { key: "name", label: "과목" },
          { key: "dept", label: "학과", options: [["", "전체 학과"], ["-", "학과 없음"], ...deptOpts.map((d) => [d, d])] },
          { key: "vac", label: "방학 특강", options: [["", "전체"], ["on", "On"], ["off", "Off"]] },
        ], () => drawList());
        const drawList = () => {
          const f = filter.values;
          const now = subjects.filter((s) => hasText(s.name, f.name)
            && (!f.dept || (f.dept === "-" ? !deptsOf(s.id).length : deptsOf(s.id).includes(f.dept)))
            && (!f.vac || (f.vac === "on") === vacsOf(s.id).length > 0));
          listBox.replaceChildren(h("h3", {}, `${now.length === subjects.length ? `과목 ${subjects.length}개` : `과목 ${now.length}개 (전체 ${subjects.length}개)`} · 과목을 누르면 공통 커리큘럼 팝업`),
            now.length ? table([
              ["과목", (s) => h("span", { class: "subject-chip" }, s.name)],
              ["준비물 기준", (s) => (baseName(s.name) === s.name ? "—" : baseName(s.name))],
              ["학과", (s) => deptsOf(s.id).join(", ") || pill("학과 없음", "neutral")],
              ["방학 특강", (s) => vacsOf(s.id).join(", ") || "—"],
              ["공통", stepPill],
            ], now, { onPick: (s) => openSubject(s, { withDelete: true }) }) : h("p", { class: "muted" }, "조건에 맞는 과목이 없습니다"));
        };
        drawList();
        view = [filter.el, listBox];
      } else if (state.tab === "create") {
        // 일반 과목 만들기(방학 특강 과목과 이름이 같아도 다른 과목). 만든 뒤 학과 구성에서 학과에 넣는다.
        const m = h("div");
        const input = h("input", { "aria-label": "새 일반 과목 이름", placeholder: "예: AI포토샵", style: "width:100%" });
        const ok = h("button", { type: "button", class: "btn primary" }, "만들기");
        ok.onclick = () => busy(ok, m, async () => {
          if (!input.value.trim()) throw new Error("과목 이름을 입력해주세요");
          await data.call("comsw_v4_create_subject", { p_name: input.value.trim(), p_vacation: false });
          state.tab = "subjects"; reload();
        });
        view = [box("일반 과목 만들기", m,
          note("여기서 만든 과목은 일반 과목입니다. 방학 특강에서 만든 과목과 이름이 같아도 다른 과목입니다. 만들면 바로 저장되고, '학과 구성'에서 학과에 넣으면 학과 커리큘럼·로드맵에 나옵니다."),
          h("div", { class: "actions", style: "margin-top:10px" }, h("div", { style: "flex:1;min-width:220px" }, input), ok))];
      } else {
        const gone = cat.subjects.filter((s) => s.deleted_at);
        view = data.hasDeleteColumn(cat.subjects)
          ? [box(`삭제된 과목 ${gone.length}개`, note("복원하면 과목과 자료만 돌아옵니다. 학과·방학 특강·순서·홈페이지 노출은 다시 연결해야 합니다."),
            table([["과목", (s) => s.name], ["삭제한 때", (s) => new Date(s.deleted_at).toLocaleString("ko-KR")],
              ["", (s) => h("button", { type: "button", class: "btn", onclick: (e) => busy(e.currentTarget, msg, async () => {
                if (!confirm(`'${s.name}' 과목을 복원할까요? 과목과 자료만 돌아오고, 학과·방학 특강에는 다시 넣어야 합니다.`)) return;
                await data.call("comsw_v4_restore_subject", { p_id: s.id });
                state.tab = "subjects"; reload();
              }) }, "복원")]], gone))]
          : [box(null, note("삭제된 과목 보관은 DB 준비(V4 2단계 SQL) 뒤에 사용할 수 있습니다."))];
      }
      out.replaceChildren(banner, msg, top, ...view);
    };
    draw();
    return out;
  });
}
