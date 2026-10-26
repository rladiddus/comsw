import {
  el,
  mountTabs,
  requireInstructor,
  rows,
  rpc,
  stateLine,
} from "../teacher-workspace.mjs";
import { mountImageUpload } from "../image-upload.mjs";
import { driveThumbnail } from "../drive.mjs";
import { applyCrop, stripCrop } from "../image-crop.mjs";
import { nextMonthName } from "../month.mjs";

// 이미지: 직접 업로드(원본 + 썸네일 영역 #crop) 또는 링크. 고른 방식의 값 하나만 제출한다.
function mediaPicker(container, initial = "") {
  let url = initial;
  // 첨부 이미지는 업로드 칸 오른쪽의 고정 크기 칸에 보여 준다(줄 높이가 바뀌지 않게).
  const preview = el("img", { alt: "커리큘럼 이미지", hidden: true });
  const empty = el("span", { textContent: "이미지 없음" });
  preview.addEventListener("error", () => {
    preview.hidden = true;
    empty.hidden = false;
  });
  const show = () => {
    preview.hidden = !url;
    empty.hidden = Boolean(url);
    // 썸네일은 고른 영역('#crop=…')만, 크게 보기는 원본.
    preview.removeAttribute("style");
    preview.classList.remove("thumb-cropped");
    if (url) applyCrop(Object.assign(preview, { src: driveThumbnail(url) }), url);
  };
  const link = el("input", {
    type: "url",
    placeholder: "https://… (구글 드라이브·이미지 주소)",
    value: initial,
  });
  link.addEventListener("change", () => {
    url = link.value.trim();
    show();
  });
  const uploadBox = el("div");
  const upload = mountImageUpload(uploadBox, {
    kind: "curriculum",
    label: "이미지 직접 올리기",
    onUploaded: (asset) => {
      url = asset.url;
      link.value = url;
      show();
    },
  });
  const linkBox = el("label", { className: "form-field media-link" }, [
    el("span", { textContent: "이미지 링크" }),
    link,
  ]);
  const modes = el("div", { className: "segmented", role: "group" });
  const choose = (mode) => {
    uploadBox.hidden = mode !== "upload";
    linkBox.hidden = mode !== "link";
    for (const b of modes.children) {
      b.classList.toggle("active", b.dataset.mode === mode);
    }
  };
  for (const [mode, text] of [["upload", "직접 업로드"], ["link", "링크로 업로드"]]) {
    const b = el("button", { type: "button", textContent: text });
    b.dataset.mode = mode;
    b.addEventListener("click", () => choose(mode));
    modes.append(b);
  }
  choose(initial ? "link" : "upload");
  container.append(
    el("div", { className: "media-picker" }, [
      el("span", { className: "field-label", textContent: "커리큘럼 이미지" }),
      el("div", { className: "media-body" }, [
        el("div", { className: "media-controls" }, [modes, uploadBox, linkBox]),
        el("div", { className: "media-thumb" }, [preview, empty]),
      ]),
    ]),
  );
  show();
  return { value: () => url, busy: () => upload.busy() };
}

const nextStep = (label) => {
  const n = Number(String(label).match(/\d+/)?.[0] ?? 0);
  return `${n + 1}단계`;
};

// 학과장·관리자는 '타강사 커리큘럼'에 체크하고 강사를 고르면(as) 그 강사의 학과·과목으로 대신 등록·조회한다.
// 대신 낸 줄도 그 강사의 승인 대기 줄이 되어 '신청 과목'(방특이면 '방학 특강')에서 승인한다.
export async function render(container, ctx, { tab, as } = {}) {
  const { supabase } = ctx;
  container.replaceChildren(
    el("h2", { textContent: "내 커리큘럼" }),
    el("p", {
      className: "desc",
      textContent:
        "나의 수업을 단계별로 소개해주세요. 제출 후 학과장 승인과 적용을 거쳐 사이트에 반영됩니다.",
    }),
  );
  const setState = stateLine(container);
  try {
    const own = await requireInstructor(ctx);
    const staff = ["admin", "head"].includes(ctx.role);
    const target = staff && as
      ? (await rows(supabase, "instructors", (q) => q.eq("id", as)))[0] ?? own
      : own;
    const proxy = target.id !== own.id; // 다른 강사 대신
    const loadMyMajors = ctx.loadMyMajors ??
      (await import("../ssamtalk-members.mjs")).loadMyMajors;
    const [depts, subjects, links, sets, submitted, mySubjects, myDepts, majors, materials] = await Promise.all([
      rows(supabase, "departments", (q) => q.order("sort_order")),
      rows(supabase, "subjects", (q) => q.order("sort_order")),
      rows(supabase, "subject_departments"),
      rows(supabase, "curriculum_sets", (q) => q.order("sort_order")),
      rows(
        supabase,
        "instructor_curricula",
        (q) => q.eq("instructor_id", target.id).order("sort_order"),
      ),
      rows(supabase, "instructor_subjects", (q) => q.eq("instructor_id", target.id)),
      rows(supabase, "instructor_departments", (q) => q.eq("instructor_id", target.id)),
      // 대신 쓸 때는 그 강사의 컴수원 학과(쌤톡 학과는 본인 것만 읽을 수 있음).
      proxy ? null : loadMyMajors(ctx.uid).catch(() => null),
      rows(supabase, "instructor_subject_materials", (q) => q.eq("instructor_id", target.id)),
    ]);
    // 내 학과 = 쌤톡 학과(이름이 같은 컴수원 학과). 못 불러오면 컴수원에 저장된 내 학과.
    const myDeptList = majors
      ? depts.filter((d) => majors.includes(d.name))
      : depts.filter((d) => myDepts.some((x) => x.department_id === d.id));
    const myIds = new Set(mySubjects.map((x) => x.subject_id));
    const goSettings = () => {
      try {
        sessionStorage.setItem("comsw_profile_tab", "classes");
      } catch {
        // 탭 기억이 안 되면 내 프로필 첫 탭이 열린다.
      }
      location.hash = "#/profile";
    };
    const subjectName = (id) =>
      subjects.find((s) => s.id === id)?.name || "과목";
    // 대신 낼 때: 제출 함수(본인 전용)와 같은 규칙으로 직접 넣는다 — 같은 학과 탭·과목·단계·방특 여부의 대기 줄이 있으면 고친다.
    const submitAs = async (row) => {
      const stepLabel = String(row.step_label || "").trim();
      const { data: same, error } = await supabase.from("instructor_curricula").select("id, sort_order")
        .eq("instructor_id", target.id).eq("set_id", row.set_id).eq("subject_id", row.subject_id)
        .eq("step_label", stepLabel).eq("status", "pending").eq("vacation", Boolean(row.vacation));
      if (error) throw new Error(error.message);
      const values = { written: String(row.written || "").trim(), media_url: row.media_url || null };
      if (same?.length) {
        const { error: e } = await supabase.from("instructor_curricula").update(values).eq("id", same[0].id);
        if (e) throw new Error(e.message);
        return same[0].id;
      }
      const { data: inSet } = await supabase.from("instructor_curricula").select("sort_order").eq("set_id", row.set_id);
      const { error: e } = await supabase.from("instructor_curricula").insert({
        ...values, instructor_id: target.id, set_id: row.set_id, subject_id: row.subject_id, step_label: stepLabel,
        status: "pending", vacation: Boolean(row.vacation),
        sort_order: (inSet || []).reduce((m, r) => Math.max(m, r.sort_order ?? -1), -1) + 1,
      });
      if (e) throw new Error(e.message);
    };
    const submit = (row) => proxy ? submitAs(row) :
      rpc(supabase, "comsw_submit_my_curriculum", {
        p_set_id: row.set_id,
        p_subject_id: row.subject_id,
        p_step_label: row.step_label,
        p_written: row.written,
        p_summary: "",
        p_media_url: row.media_url,
        p_vacation: Boolean(row.vacation),
      });
    const done = async (message) => {
      await render(container, ctx, { tab: "list", as: proxy ? target.id : undefined });
      container.querySelector(".save-state").before(
        el("p", { className: "notice", textContent: message }),
      );
    };

    // ── 등록하기 ──
    const form = el("form", { className: "workspace-card curriculum-form" });
    // 제목: 본인이면 'OOO 선생님의 수업'. 학과장·관리자는 '타강사 커리큘럼'에 체크하면 강사 검색·선택으로 바뀐다.
    const heading = el("h3", { textContent: `${target.name} 선생님의 수업` });
    const titleRow = el("div", { className: "box-title proxy-title" }, [heading]);
    if (staff) {
      const others = (await rows(supabase, "instructors", (q) => q.order("name"))).filter((i) => i.id !== own.id);
      const toggle = el("input", { type: "checkbox", checked: proxy });
      toggle.setAttribute("aria-label", "타강사 커리큘럼");
      const find = el("input", { type: "search", placeholder: "강사 이름 검색" });
      find.setAttribute("aria-label", "강사 검색");
      const pickTeacher = el("select");
      pickTeacher.setAttribute("aria-label", "강사 선택");
      const fillTeachers = () => {
        const word = find.value.trim();
        pickTeacher.replaceChildren(
          el("option", { value: "", textContent: "강사 고르기" }),
          ...others.filter((i) => !word || i.name.includes(word)).map((i) => el("option", { value: i.id, textContent: `${i.name} 선생님` })),
        );
        pickTeacher.value = proxy && others.some((i) => i.id === target.id && (!word || i.name.includes(word))) ? target.id : "";
      };
      find.addEventListener("input", fillTeachers);
      pickTeacher.addEventListener("change", () => {
        if (pickTeacher.value) render(container, ctx, { tab: "write", as: pickTeacher.value });
      });
      const showPicker = (on) => titleRow.replaceChildren(...(on ? [find, pickTeacher] : [heading]), toggleLabel);
      const toggleLabel = el("label", { className: "consent proxy-toggle" }, [toggle, el("span", { textContent: "타강사 커리큘럼" })]);
      toggle.addEventListener("change", () => {
        if (toggle.checked) {
          fillTeachers();
          showPicker(true);
        } else if (proxy) render(container, ctx, { tab: "write" });
        else showPicker(false);
      });
      fillTeachers();
      showPicker(proxy);
    }
    form.append(
      titleRow,
      el("p", {
        className: "desc",
        textContent:
          "기본 4단계로 작성해주세요. 이미지는 가로·세로 모두 1000px 이상이면 어떤 비율도 괜찮습니다. 첨부 후 사이트 카드에 보일 부분(세로 직사각형)을 고르고, 크게 볼 때는 원본이 보입니다. 요약은 학과장이 정리합니다.",
      }),
    );
    const select = (label, name) => {
      const input = el("select", { name, required: true });
      return [
        input,
        el("label", { className: "form-field" }, [
          el("span", { textContent: label }),
          input,
        ]),
      ];
    };
    const [dept, deptField] = select("내 학과", "department");
    const [set, setField] = select("선택 학과", "set_id");
    // '방특'에 체크하면 학과 승인 대신 관리 화면 '방학 특강'에서 그룹에 담는다.
    const vacation = el("input", { type: "checkbox", name: "vacation" });
    const vacationField = el("div", { className: "form-field vacation-check" }, [
      el("span", { textContent: "방학 특강" }),
      el("label", { className: "consent" }, [vacation, el("span", { textContent: "방특" })]),
    ]);
    form.append(el("div", { className: "form-row curriculum-head-row" }, [deptField, setField, vacationField]));
    const settingsLink = el("button", {
      type: "button",
      className: "link-btn",
      textContent: "내 프로필 > 수업 설정에서 학과·과목 바꾸기",
    });
    settingsLink.addEventListener("click", goSettings);
    const subjectHint = el("p", { className: "muted" });
    form.append(el("p", { className: "muted" }, [settingsLink]), subjectHint);
    const options = (input, list) =>
      input.replaceChildren(
        ...list.map((x) => el("option", { value: x.id, textContent: x.name })),
      );
    options(dept, myDeptList);
    // 단계의 과목 = 수업 설정에서 고른 내 과목 중 이 학과 과목.
    // '+ 개월 추가'로 연 다음 달 과목 탭(학과별). DB에 없는 과목은 id가 'new:이름'이고 제출할 때 만든다.
    const months = [];
    const deptSubjects = () => {
      const ids = links.filter((l) => l.department_id === dept.value).map((l) =>
        l.subject_id
      );
      const base = subjects.filter((s) => ids.includes(s.id) && myIds.has(s.id));
      const extra = months.filter((m) => m.dept === dept.value && !base.some((b) => b.id === m.id));
      return [...base, ...extra];
    };
    // 다음 달 과목 이름: '웹툰1' → '웹툰2'(이미 있는 과목·열린 탭 번호 다음).
    function addMonth(subject) {
      const name = nextMonthName(subject.name, [...subjects, ...months].map((x) => x.name));
      const found = subjects.find((x) => x.name === name);
      const month = found
        ? { ...found, dept: dept.value }
        : { id: `new:${name}`, name, from: subject.from ?? subject.id, dept: dept.value, isNew: true };
      months.push(month);
      refill();
      openSubject(month.id);
    }
    // 과목마다 탭 하나. 탭 안에서 그 과목의 단계를 쓴다(과목이 많아도 아래로 길어지지 않게).
    // 학과를 바꿔도 이미 쓴 과목 탭 내용은 남겨 두고, 제출은 지금 학과의 과목만 한다.
    const subjectTabs = el("div", { className: "subject-tabs", role: "tablist" });
    const panelsBox = el("div", { className: "subject-panels" });
    const panels = new Map(); // 과목 id → { panel, steps }
    let current = null;
    function panelFor(subject) {
      if (panels.has(subject.id)) return panels.get(subject.id);
      const steps = [];
      const list = el("div", { className: "step-list" });
      const panel = el("section", { className: "subject-panel" });
      // 과목에서 쓰는 프로그램·준비물. 승인되면 학과 커리큘럼의 프로그램·준비물에 합쳐진다.
      const saved = materials.find((m) => m.subject_id === subject.id);
      const tools = el("textarea", {
        name: "tools", rows: 2, maxLength: 2000, value: saved?.tools ?? "",
        placeholder: "예: Photoshop, Illustrator",
      });
      const supplies = el("textarea", {
        name: "supplies", rows: 2, maxLength: 2000, value: saved?.supplies ?? "",
        placeholder: "예: 멘토시리즈 포토샵, 이어폰",
      });
      panel.append(el("div", { className: "form-row materials-row" }, [
        el("label", { className: "form-field" }, [el("span", { textContent: "사용 프로그램" }), tools]),
        el("label", { className: "form-field" }, [el("span", { textContent: "준비물" }), supplies]),
      ]));
      const entry = { panel, steps, list, tools, supplies, saved };
      function addStep(label) {
        const box = el("section", { className: "step-row" });
        const stepInput = el("input", {
          name: "step_label",
          type: "text",
          value: label,
          maxLength: 80,
          required: true,
        });
        const remove = el("button", {
          type: "button",
          className: "ghost-btn danger",
          textContent: "단계 삭제",
        });
        const written = el("textarea", {
          name: "written",
          rows: 5,
          maxLength: 12000,
          placeholder: "이 단계에서 배우는 내용과 결과물을 적어주세요.",
        });
        // 한 줄: 단계 | 개인 수업 커리큘럼 | 커리큘럼 이미지 | 삭제 (과목은 위 탭)
        const mediaBox = el("div", { className: "step-media" });
        box.append(
          el("label", { className: "form-field" }, [
            el("span", { textContent: "단계" }),
            stepInput,
          ]),
          el("label", { className: "form-field" }, [
            el("span", { textContent: "개인 수업 커리큘럼" }),
            written,
          ]),
          mediaBox,
          remove,
        );
        const step = { box, stepInput, written, media: mediaPicker(mediaBox) };
        remove.addEventListener("click", () => {
          if (steps.length === 1) {
            setState("단계는 하나 이상 있어야 합니다", true);
            return;
          }
          steps.splice(steps.indexOf(step), 1);
          box.remove();
        });
        steps.push(step);
        list.append(box);
      }
      const add = el("button", {
        type: "button",
        className: "ghost-btn add-step",
        textContent: "+ 단계 추가",
      });
      add.addEventListener("click", () => addStep(nextStep(steps.at(-1)?.stepInput.value)));
      // 과정이 여러 달이면 다음 달 과목(예: 웹툰1 → 웹툰2) 탭을 연다. 없는 과목은 제출할 때 만들어 승인 대기로.
      const addMonthBtn = el("button", {
        type: "button",
        className: "ghost-btn add-step",
        textContent: "+ 개월 추가",
      });
      addMonthBtn.addEventListener("click", () => addMonth(subject));
      panel.append(list, el("div", { className: "step-add-row" }, [add, addMonthBtn]));
      addStep("1단계");
      panels.set(subject.id, entry);
      panelsBox.append(panel);
      return entry;
    }
    function openSubject(id) {
      current = id;
      for (const [sid, { panel }] of panels) panel.hidden = sid !== id;
      for (const b of subjectTabs.children) {
        b.classList.toggle("active", b.dataset.subject === id);
        b.setAttribute("aria-selected", String(b.dataset.subject === id));
      }
    }
    const refill = () => {
      const mine = deptSubjects();
      subjectHint.textContent = !myDeptList.length
        ? "내 학과가 없습니다. 수업 설정에서 학과를 추가해주세요."
        : mine.length
        ? ""
        : "이 학과에서 고른 과목이 없습니다. 수업 설정에서 수업하는 과목을 체크해주세요.";
      options(
        set,
        // 방학 특강 그룹은 '방특' 체크로 내므로 선택 학과 목록에서 뺀다.
        sets.filter((s) =>
          !s.is_vacation && (s.department_id === dept.value || s.department_id == null)
        ),
      );
      subjectTabs.replaceChildren(...mine.map((s) => {
        panelFor(s);
        const b = el("button", { type: "button", role: "tab", textContent: s.name });
        b.dataset.subject = s.id;
        b.addEventListener("click", () => openSubject(s.id));
        return b;
      }));
      openSubject(mine.some((s) => s.id === current) ? current : mine[0]?.id ?? null);
    };
    refill();
    dept.addEventListener("change", refill);
    const send = el("button", {
      type: "submit",
      className: "publish-btn",
      textContent: "승인 요청하기",
    });
    form.append(
      subjectTabs,
      panelsBox,
      el("div", { className: "form-actions" }, [send]),
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (send.disabled) return;
      send.disabled = true;
      let sent = 0;
      try {
        // 지금 학과의 과목 탭에서 내용을 쓴 단계만 보낸다(빈 단계는 건너뜀).
        const filled = deptSubjects().flatMap((s) =>
          (panels.get(s.id)?.steps ?? [])
            .filter((st) => st.written.value.trim() || st.media.value())
            .map((st) => ({ subject: s, st }))
        );
        if (filled.some(({ st }) => st.media.busy())) {
          throw new Error("이미지 업로드가 끝난 후 제출해주세요");
        }
        // 프로그램·준비물은 바뀐 과목만 저장한다.
        const changed = deptSubjects().map((s) => ({ subject: s, entry: panels.get(s.id) }))
          .filter(({ entry }) => entry && (
            entry.tools.value.trim() !== (entry.saved?.tools ?? "") ||
            entry.supplies.value.trim() !== (entry.saved?.supplies ?? "")
          ));
        if (!set.value) throw new Error("선택 학과를 골라주세요");
        if (!filled.length && !changed.length) throw new Error("커리큘럼 내용을 입력해주세요");
        const missing = filled.find(({ st }) =>
          !st.stepInput.value.trim() || !st.written.value.trim()
        );
        if (missing) {
          openSubject(missing.subject.id);
          throw new Error(`${missing.subject.name}: 단계와 커리큘럼 내용을 모두 입력해주세요`);
        }
        // 새 달 과목은 먼저 만든다(이미 있으면 그 과목).
        for (const subject of new Set([...filled.map((f) => f.subject), ...changed.map((c) => c.subject)].filter((x) => x.isNew))) {
          subject.realId = await rpc(supabase, "comsw_create_month_subject", { p_from: subject.from, p_name: subject.name });
        }
        for (const { subject, entry } of changed) {
          if (proxy) {
            // 대신 쓸 때는 그 강사의 프로그램·준비물로 저장(학과장·관리자 권한)
            const { error } = await supabase.from("instructor_subject_materials").upsert({
              instructor_id: target.id, subject_id: subject.realId ?? subject.id,
              tools: entry.tools.value.trim() || null, supplies: entry.supplies.value.trim() || null,
            });
            if (error) throw new Error(error.message);
          } else {
            await rpc(supabase, "comsw_save_my_materials", {
              p_subject_id: subject.realId ?? subject.id,
              p_tools: entry.tools.value,
              p_supplies: entry.supplies.value,
            });
          }
          entry.saved = { tools: entry.tools.value.trim(), supplies: entry.supplies.value.trim() };
        }
        for (const { subject, st } of filled) {
          await submit({
            set_id: set.value,
            subject_id: subject.realId ?? subject.id,
            step_label: st.stepInput.value.trim(),
            written: st.written.value,
            media_url: st.media.value(),
            vacation: vacation.checked,
          });
          sent++;
        }
        await done(
          sent
            ? `${sent}개 단계를 제출했습니다. ${vacation.checked ? "방학 특강 담당자가 확인합니다." : "학과장 승인 대기 중입니다."}`
            : "프로그램·준비물을 저장했습니다. 이 과목 커리큘럼이 승인될 때 함께 반영됩니다.",
        );
      } catch (err) {
        setState(
          sent ? `${sent}개 단계는 제출했습니다. 나머지: ${err.message}` : err.message,
          true,
        );
      } finally {
        send.disabled = false;
      }
    });

    // ── 조회하기 ──
    const list = el("section", { className: "workspace-card submission-list" }, [
      el("h3", { textContent: "등록한 커리큘럼" }),
    ]);
    if (!submitted.length) {
      list.append(
        el("p", {
          className: "desc",
          textContent: "아직 등록한 커리큘럼이 없습니다. '등록하기'에서 작성해주세요.",
        }),
      );
    }
    // 이미지를 누르면 크게 보여 준다(바깥이나 이미지를 누르면 닫힘).
    const zoom = el("dialog", { className: "image-zoom" });
    zoom.addEventListener("click", () => zoom.close?.());
    const openZoom = (url, alt) => {
      zoom.replaceChildren(el("img", { src: driveThumbnail(stripCrop(url)), alt }));
      if (zoom.showModal) zoom.showModal();
      else zoom.setAttribute("open", "");
    };
    list.append(zoom);
    for (const row of submitted) {
      const pending = row.status === "pending";
      const card = el("article", { className: "submission-card" });
      const title = `${subjectName(row.subject_id)} · ${row.step_label}`;
      // 보기: 왼쪽 내용, 오른쪽 이미지(한 화면에 여러 단계가 보이게).
      const view = () => {
        card.className = "submission-card submission-row";
        const edit = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: "수정",
        });
        edit.addEventListener("click", editor);
        const actions = el("div", { className: "card-actions" }, [edit]);
        const info = el("div", { className: "submission-info" }, [
          el("span", {
            className: `status-pill ${pending ? "pending" : "approved"}`,
            textContent: pending ? "승인 대기" : "승인됨",
          }),
          el("h4", { textContent: title }),
          el("p", {
            className: "muted",
            textContent: [sets.find((s) => s.id === row.set_id)?.name, row.vacation && "방특"].filter(Boolean).join(" · "),
          }),
          el("p", { className: "submission-text", textContent: row.written || "" }),
          actions,
        ]);
        const thumb = row.media_url
          ? el("button", {
            type: "button",
            className: "submission-thumb",
            title: "크게 보기",
          }, [applyCrop(el("img", { src: driveThumbnail(row.media_url), alt: `${title} 이미지` }), row.media_url)])
          : el("div", { className: "submission-thumb empty", textContent: "이미지 없음" });
        if (row.media_url) {
          thumb.addEventListener("click", () => openZoom(row.media_url, `${title} 이미지`));
        }
        card.replaceChildren(info, thumb);
        if (pending) {
          const del = el("button", {
            type: "button",
            className: "ghost-btn danger",
            textContent: "대기본 삭제",
          });
          del.addEventListener("click", async () => {
            if (!confirm("승인 대기 중인 이 제출물을 삭제할까요?")) return;
            del.disabled = true;
            try {
              const { error } = await supabase.from("instructor_curricula")
                .delete().eq("id", row.id).eq("instructor_id", target.id).eq(
                  "status",
                  "pending",
                );
              if (error) throw new Error(error.message);
              await render(container, ctx, { tab: "list", as: proxy ? target.id : undefined });
            } catch (e) {
              setState(e.message, true);
              del.disabled = false;
            }
          });
          actions.append(del);
        }
      };
      // 수정: 등록하기와 같은 한 줄 배치. 과목·단계는 바꿀 수 없다(바꾸려면 새로 등록).
      function editor() {
        card.className = "submission-card";
        const fixed = (label, value) =>
          el("label", { className: "form-field" }, [
            el("span", { textContent: label }),
            el("input", { type: "text", value, readOnly: true }),
          ]);
        const written = el("textarea", {
          name: "written",
          maxLength: 12000,
          value: row.written || "",
        });
        const mediaBox = el("div", { className: "step-media" });
        card.replaceChildren(
          el("h4", { textContent: `${title} 수정` }),
          el("p", {
            className: "muted",
            textContent: pending
              ? "저장하면 승인 대기 내용이 바뀝니다."
              : "승인된 내용은 그대로 두고, 수정본을 승인 요청합니다.",
          }),
          el("section", { className: "step-row" }, [
            fixed("과목", subjectName(row.subject_id)),
            fixed("단계", row.step_label),
            el("label", { className: "form-field" }, [
              el("span", { textContent: "개인 수업 커리큘럼" }),
              written,
            ]),
            mediaBox,
            el("span"),
          ]),
        );
        const media = mediaPicker(mediaBox, row.media_url || "");
        const save = el("button", {
          type: "button",
          className: "publish-btn",
          textContent: "저장 및 승인 요청",
        });
        const cancel = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: "되돌리기",
        });
        cancel.addEventListener("click", view);
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            if (media.busy()) throw new Error("이미지 업로드가 끝난 후 저장해주세요");
            if (!written.value.trim()) throw new Error("커리큘럼 내용을 입력해주세요");
            await submit({ ...row, written: written.value, media_url: media.value() });
            await done("수정본을 제출했습니다. 학과장 승인 대기 중입니다.");
          } catch (e) {
            setState(e.message, true);
            save.disabled = false;
          }
        });
        card.append(el("div", { className: "form-actions" }, [save, cancel]));
      }
      view();
      list.append(card);
    }

    // ── 탭 ──
    mountTabs(container, [
      ["write", "등록하기", form],
      ["list", `조회하기 (${submitted.length})`, list],
    ], tab ?? (submitted.length ? "list" : "write"));
    container.append(el("div", { className: "workspace-single" }, [form, list]));
  } catch (e) {
    setState(e.message, true);
  }
}
