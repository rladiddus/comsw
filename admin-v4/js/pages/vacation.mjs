// 방학 특강(2026-11-20 정리): 위 = 특강 고르기(+ 새 방학 특강, 과목 생성), 아래 왼쪽 = 이 특강 과목 목록(넣기·빼기), 오른쪽 = 고른 과목의 이 특강 공통 커리큘럼.
// 과목 생성에서 만든 과목은 '방학 특강 과목'(is_vacation) — 학과·과목의 일반 과목과 이름이 같아도 다른 과목이고, 여기서만 넣을 수 있다.
// 특강 설정(이름·홈페이지 노출·과목 구성)을 바꾸면 오른쪽 아래 창 [임시 저장]/[사이트 적용]. 커리큘럼은 [수정]으로 고치고 같은 창으로 반영.
import * as data from "../data.mjs";
import { h, head, box, tabs, pill, fill, empty, note, busy, publishBanner, toggleSwitch, modal } from "../ui.mjs";
import { commonEditor } from "./common-editor.mjs";
import { subjectPicker } from "../subject-picker.mjs";
import { track, canSwitch, untrack, unsaved } from "../changes.mjs";

let pick = null;
let open = null; // 오른쪽에 연 과목
const edits = new Map();

export async function render({ main }) {
  edits.clear(); // 화면을 새로 열면 편집 상태도 새로(떠 있는 창 등록이 다시 되도록)
  main.replaceChildren(head("방학 특강", "방학 특강을 고르고, 특강 과목을 넣고, 과목마다 이 특강의 공통 커리큘럼을 정리합니다. 방학 특강 과목은 '과목 생성'에서 만듭니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const [cat, settings, rows, vsteps] = await Promise.all([data.catalog(), data.settings(), data.curricula((q) => q.eq("status", "approved")),
      data.all("v4_vacation_steps", (q) => q.order("step")).catch(() => [])]);
    const shown = settings.find((s) => s.key === "vacation_set_id")?.value;
    // 방학 특강 과목 = 방학 특강에서 만든 과목(is_vacation) + 이미 어느 특강에 들어 있는 과목(예전 자료)
    const all = data.live(cat.subjects);
    const vacSubjects = all.filter((s) => s.is_vacation || cat.vacLinks.some((l) => l.subject_id === s.id)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const byId = new Map(all.map((s) => [s.id, s]));
    const msg = h("div");
    const out = h("div");
    const banner = await publishBanner(data.unpublished);
    const draw = () => {
      const opts = [...cat.vacations.map((v) => [v.id, v.name]), ["create", "과목 생성"]];
      pick = opts.some(([v]) => v === pick) ? pick : opts[0][0];
      const tabRow = tabs(opts, pick, (id) => { if (!canSwitch()) return; if (editor) untrack(editor.trackId); editor = null; pane = null; pick = id; open = null; edits.clear(); msg.replaceChildren(); draw(); }, "chips");
      // [+ 새 방학 특강]은 학과 추가처럼 팝업(이름 받아 바로 만들기)
      tabRow.insertBefore(h("button", { type: "button", class: "add-chip", onclick: () => namePopup(null) }, "+ 새 방학 특강"), tabRow.lastElementChild);
      const top = tabRow;
      if (pick === "create") {
        out.replaceChildren(banner, msg, top, h("div", { style: "height:14px" }), createBox());
        return;
      }
      const v = cat.vacations.find((x) => x.id === pick);
      if (!v) { out.replaceChildren(banner, msg, top, h("div", { style: "height:14px" }), box(null, note("방학 특강이 없습니다. [+ 새 방학 특강]으로 만들어주세요."))); return; }
      const ekey = v.id;
      // 특강 설정: 바꾸면 떠 있는 창. 화면을 다시 그려도 지금 편집 상태(edits)를 쓴다.
      if (!edits.has(ekey)) {
        const base = { name: v?.name ?? "", subjects: cat.vacLinks.filter((l) => l.set_id === v?.id).map((l) => l.subject_id).sort(), show: v ? v.id === shown : false };
        const st = JSON.parse(JSON.stringify(base));
        edits.set(ekey, st);
        track({
          id: `vacation:${ekey}`, slot: "vacation", title: v ? `${v.name} 구성` : "새 방학 특강", baseline: base,
          read: () => ({ ...st, subjects: [...st.subjects].sort() }), write: (x) => { Object.assign(st, JSON.parse(JSON.stringify(x))); draw(); },
          apply: async (x) => {
            if (!x.name.trim()) throw new Error("특강 이름을 입력해주세요");
            pick = await data.call("comsw_v4_save_vacation", { p_id: v?.id ?? null, p_name: x.name.trim(), p_subjects: x.subjects, p_show: x.show });
          },
          onApplied: () => { edits.clear(); render({ main }); },
        });
      }
      const st = edits.get(ekey);
      // 제목 옆 [이름 수정](학과명 수정과 같은 팝업, 바로 반영), 오른쪽 '공개' 스위치(오른쪽 아래 창으로 반영)
      // 학과 구성 제목 줄처럼 한 줄 왼쪽부터: 제목 · [이름 수정] · 공개 스위치 · [과목 추가](2026-11-27)
      const settingsBox = box(null,
        h("div", { class: "actions", style: "flex-wrap:wrap" },
          h("h3", { style: "margin:0" }, `${v.name} 설정`),
          h("button", { type: "button", class: "btn", onclick: () => namePopup(v) }, "이름 수정"),
          h("div", { class: "actions", style: "margin-left:8px" }, h("span", { class: "muted" }, "공개"),
            toggleSwitch(st.show, "홈페이지 방학 특강 페이지에 이 특강 공개", (next) => { st.show = next; draw(); }),
            // [과목 추가]: 학과 구성의 과목 추가와 같은 팝업, 방학 특강 과목만(체크하면 넣고 풀면 뺌, 2026-11-27)
            h("button", { type: "button", class: "btn", onclick: () => subjectPicker(`${v.name} 과목 고르기`, cat, vacSubjects, st.subjects,
              (ids) => { st.subjects = ids; draw(); }) }, "과목 추가"))));
      // 왼쪽: 이 특강 과목(넣기·빼기)
      const count = (sid) => new Set(rows.filter((r) => r.set_id === v?.id && r.subject_id === sid).map((r) => r.instructor_id)).size;
      const linked = (sid) => cat.vacLinks.some((l) => l.set_id === v?.id && l.subject_id === sid);
      const mine = st.subjects.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (!mine.some((s) => s.id === open)) open = mine.find((s) => linked(s.id))?.id ?? null;
      const picks = h("div", { class: "picks" }, mine.length ? mine.map((s) => h("div", { class: "vac-pick" },
        h("button", { type: "button", "aria-pressed": String(s.id === open), title: s.name, onclick: () => { if (s.id === open || !leaveEditor()) return; open = s.id; draw(); } },
          s.name, " ", !linked(s.id) ? pill("적용 전", "neutral") : count(s.id) ? pill(`강사 ${count(s.id)}`, "neutral") : null,
          v && vsteps.some((x) => x.set_id === v.id && x.subject_id === s.id) ? pill("공통 확정") : null),
        h("button", { type: "button", class: "btn danger small", title: "이 특강에서 빼기(과목과 자료는 그대로)", onclick: () => { st.subjects = st.subjects.filter((x) => x !== s.id); draw(); } }, "빼기")))
        : empty("이 특강에 넣은 과목이 없습니다"));
      const left = box(`과목 · ${mine.length}개`, picks,
        vacSubjects.length ? null : note("방학 특강 과목이 없습니다. 위 '과목 생성'에서 먼저 만들어주세요."));
      // 오른쪽: 고른 과목의 이 특강 공통 커리큘럼(학과·과목 팝업과 같은 모양, [수정]으로 고침)
      out.replaceChildren(banner, msg, top, h("div", { style: "height:14px" }), settingsBox,
        h("div", { class: "side-list vac-body" }, left, rightPane(v, open ? byId.get(open) : null, linked)));
    };
    // 특강 이름: 새로 만들기·이름 수정 팝업(학과 추가·학과명 수정과 같은 방식, 바로 반영). 과목·공개는 공개 중인 그대로 둔다.
    const namePopup = (v) => {
      const popMsg = h("div");
      const input = h("input", { value: v?.name ?? "", "aria-label": "방학 특강 이름", placeholder: "예: 2027년 여름방학특강", style: "width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:5px" });
      const ok = h("button", { type: "button", class: "btn primary" }, v ? "수정" : "추가");
      const pop = modal(v ? "방학 특강 이름 수정" : "새 방학 특강", h("section", { class: "box", style: "margin:0" }, popMsg,
        h("label", { class: "step", style: "display:block" }, h("b", {}, "방학 특강 이름"), input),
        h("p", { class: "muted" }, v ? "바꾸면 사이트 전체에서 새 이름이 보입니다(바로 반영)." : "추가하면 바로 만들어지고, 과목을 넣어 구성할 수 있습니다(공개는 꺼진 채로)."),
        h("div", { class: "actions" }, ok)));
      pop.dlg.classList.add("modal-small");
      ok.onclick = () => busy(ok, popMsg, async () => {
        const name = input.value.trim();
        if (!name) throw new Error("방학 특강 이름을 입력해주세요");
        pick = await data.call("comsw_v4_save_vacation", {
          p_id: v?.id ?? null, p_name: name,
          p_subjects: v ? cat.vacLinks.filter((l) => l.set_id === v.id).map((l) => l.subject_id) : [],
          p_show: v ? v.id === shown : false,
        });
        pop.close();
        edits.clear();
        render({ main });
      });
      input.focus();
    };
    let editor = null;
    let pane = null; // 같은 과목이면 다시 그려도 같은 편집기(고치던 내용 유지)
    // 다른 과목·특강으로 가기 전에: 공통 커리큘럼에 임시 저장 안 한 변경이 있으면 묻고, 떠 있는 창 등록을 뺀다
    const leaveEditor = () => {
      if (editor && unsaved(editor.trackId) && !confirm("임시 저장하지 않은 커리큘럼 변경이 있습니다. 다른 과목으로 가면 사라집니다. 계속할까요?")) return false;
      if (editor) untrack(editor.trackId);
      editor = null;
      pane = null;
      return true;
    };
    const rightPane = (v, sub, linked) => {
      if (!v) return box(null, note("특강을 [사이트 적용]으로 만든 뒤 과목을 넣고 커리큘럼을 정리할 수 있습니다."));
      if (!sub) return box(null, empty("왼쪽에서 과목을 고르세요"));
      if (!linked(sub.id)) return box(sub.name, note("이 특강에 넣은 과목입니다. 오른쪽 아래 창에서 [사이트 적용]하면 커리큘럼을 정리할 수 있습니다."));
      if (pane?.key === `${v.id}|${sub.id}`) return pane.el;
      if (editor) untrack(editor.trackId);
      const cur = vsteps.filter((x) => x.set_id === v.id && x.subject_id === sub.id).map((x) => ({ summary: x.summary, image_url: x.image_url ?? "" }));
      editor = commonEditor(sub, cat, cur.length === 4 ? cur : [], { msg, reload: () => render({ main }), set: v, startEditing: false });
      const editBtn = h("button", { type: "button", class: "btn primary" }, "수정");
      const sync = () => { editBtn.textContent = editor.isEditing() ? "돌아가기" : "수정"; };
      editor.onEditing = sync;
      editBtn.onclick = () => {
        if (editor.isEditing() && unsaved(editor.trackId) && !confirm("임시 저장하지 않은 바뀐 설정이 있습니다. 수정을 끝내도 바꾼 내용은 오른쪽 아래 창에 남습니다. 계속할까요?")) return;
        editor.setEditing(!editor.isEditing());
        sync();
      };
      const el = h("div", { class: "vac-right" },
        h("div", { class: "row" }, h("h3", { style: "margin:0" }, `${sub.name} · ${v.name} 공통 커리큘럼`), editBtn),
        note("이 특강에 확정된 강사 자료만 참고합니다. 반영하면 홈페이지 방학 특강에서 이 과목은 공통 4단계로 보입니다."),
        editor);
      pane = { key: `${v.id}|${sub.id}`, el };
      return el;
    };
    // 과목 생성: 방학 특강 과목(학과·과목의 일반 과목과 이름이 같아도 다른 과목)
    const createBox = () => {
      const m = h("div");
      const input = h("input", { "aria-label": "새 방학 특강 과목 이름", placeholder: "예: 여름방학 포토샵", style: "width:100%" });
      // 넣을 방학 특강(선택): 고르면 만들자마자 그 특강 과목 구성에 넣어 바로 반영
      const into = h("select", { "aria-label": "넣을 방학 특강" }, h("option", { value: "" }, "특강에 넣지 않음"), cat.vacations.map((v) => h("option", { value: v.id }, `${v.name}에 넣기`)));
      const ok = h("button", { type: "button", class: "btn primary" }, "만들기");
      ok.onclick = () => busy(ok, m, async () => {
        if (!input.value.trim()) throw new Error("과목 이름을 입력해주세요");
        const id = await data.call("comsw_v4_create_subject", { p_name: input.value.trim(), p_vacation: true });
        const v = cat.vacations.find((x) => x.id === into.value);
        if (v) {
          // 공개 중인 그 특강 구성 + 새 과목(이름·공개는 그대로)
          await data.call("comsw_v4_save_vacation", {
            p_id: v.id, p_name: v.name, p_show: v.id === shown,
            p_subjects: [...cat.vacLinks.filter((l) => l.set_id === v.id).map((l) => l.subject_id), id],
          });
          pick = v.id; open = id;
        }
        render({ main });
      });
      return box("방학 특강 과목 만들기", m,
        note("여기서 만든 과목은 방학 특강 과목입니다. 학과·과목에서 만든 일반 과목과 이름이 같아도 다른 과목이며, 방학 특강에서만 넣을 수 있습니다. 만들면 바로 저장되고, 특강을 고르면 그 특강에도 바로 들어갑니다."),
        h("div", { class: "actions", style: "margin:10px 0" }, h("div", { style: "flex:1;min-width:220px" }, input), into, ok),
        h("h4", {}, `방학 특강 과목 ${vacSubjects.length}개`),
        vacSubjects.length ? h("div", { class: "chips" }, vacSubjects.map((s) => h("span", { class: "subject-chip" }, s.name))) : empty("아직 없습니다"));
    };
    draw();
    return out;
  });
}
