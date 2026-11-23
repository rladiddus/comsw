// 내 프로필(강사): 사진·경력·한마디. 본인(로그인 UID와 연결된 강사) 것만.
// 바꾸면 떠 있는 창: [임시 저장] = 본인 저장함, [학과장에게 제출] = 기존 comsw_save_my_profile(대기 프로필). AI 사진은 학과장이 검수 때 만든다.
import * as data from "../data.mjs";
import { h, head, box, pill, media, fill, note, fail } from "../ui.mjs";
import { track, check } from "../changes.mjs";

export async function render({ main, session }) {
  main.replaceChildren(head("내 프로필", "사진, 경력, 수강생에게 건네는 한마디를 작성해 제출합니다. 학과장이 확정하면 홈페이지에 나옵니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const me = await data.myInstructor(session.uid);
    if (!me) return box(null, note("이 계정과 연결된 강사 정보가 없습니다. 학과장에게 계정 연결을 요청해주세요."));
    const [sent] = await data.all("instructor_profile_drafts", (q) => q.eq("instructor_id", me.id));
    const from = sent ?? me;
    const baseline = { name: from.name, career: from.career ?? "", message: from.message ?? "", asset: null, consent: false };
    const f = { ...baseline };
    let preview = "";
    const msg = h("div");
    // 사진: 누르면 파일 고르기, 사진 칸에 끌어다 놓아도 됨(숨은 파일 칸)
    const shown = () => (preview || sent?.photo_url || me.photo_url ? media(preview || sent?.photo_url || me.photo_url) : h("div", { class: "media" }, h("span", { class: "muted" }, "사진 없음 · 눌러서 올리기")));
    const file = h("input", { type: "file", hidden: true, accept: "image/png,image/jpeg,image/webp", "aria-label": "본인 사진" });
    const photo = h("button", { type: "button", class: "img-pick", title: "눌러서 사진 올리기(끌어다 놓아도 됩니다)", "aria-label": "본인 사진 올리기", onclick: () => file.click() }, shown());
    file.onchange = async () => {
      const x = file.files[0];
      if (!x) return;
      photo.replaceChildren(h("div", { class: "muted" }, "올리는 중..."));
      try {
        const up = await data.upload(x, "profile-source");
        f.asset = up.id;
        preview = URL.createObjectURL(x);
      } catch (err) { msg.replaceChildren(fail(`사진: ${err.message}`)); }
      photo.replaceChildren(shown());
      file.value = "";
      check();
    };
    const field = (k, label, rows) => h("label", { class: "form-field" }, h("b", {}, label),
      rows ? h("textarea", { rows, value: f[k], style: "width:100%", oninput: (e) => { f[k] = e.target.value; } })
        : h("input", { value: f[k], style: "width:100%", oninput: (e) => { f[k] = e.target.value; } }));
    const consent = h("input", { type: "checkbox", checked: !!f.consent, onchange: (e) => { f.consent = e.target.checked; } });
    const form = h("div");
    const paint = () => form.replaceChildren(field("name", "이름"), field("career", "경력", 6), field("message", "수강생에게 한마디", 3));
    paint();
    track({
      id: "profile", slot: "profile", title: "내 프로필", baseline, applyLabel: "학과장에게 제출",
      store: {
        load: async () => (await data.teacherDraft(me.id, "profile", "me"))?.payload ?? null,
        save: (x) => data.saveTeacherDraft(me.id, "profile", "me", x),
        drop: () => data.dropTeacherDraft(me.id, "profile", "me"),
      },
      read: () => ({ ...f }),
      write: (x) => { Object.assign(f, x); consent.checked = !!f.consent; paint(); },
      apply: async (x) => {
        if (!x.name.trim()) throw new Error("이름을 입력해주세요");
        if (x.asset && !x.consent) throw new Error("본인 사진 사용 동의에 체크해주세요");
        await data.call("comsw_save_my_profile", { p_name: x.name.trim(), p_career: x.career, p_message: x.message, p_source_asset_id: x.asset, p_source_consent: !!x.consent });
      },
      onApplied: () => { msg.replaceChildren(note("제출했습니다. 학과장이 확정하면 홈페이지에 나옵니다.")); render({ main, session }); },
    });
    return [msg, h("div", { class: "two" },
      box(null,
        h("div", { class: "row" }, h("h3", {}, "프로필"),
          sent?.status === "pending" ? pill("제출함 · 검수 전") : pill(sent ? "확정됨" : "공개 중", "neutral")),
        form, h("p", { class: "muted" }, "고치면 오른쪽 아래 창에서 [임시 저장] 또는 [학과장에게 제출]을 누르세요.")),
      box("사진", h("div", { class: "photo-drop" }, photo, file),
        h("div", { class: "actions", style: "margin-top:8px" }, h("button", { type: "button", class: "btn small", onclick: () => file.click() }, "사진 올리기")),
        h("label", { class: "consent" }, consent, "프로필 사진을 만드는 데 본인 사진을 쓰는 것에 동의합니다"),
        h("p", { class: "muted" }, "올린 사진은 학과장만 보고, 홈페이지용 프로필 사진은 학과장이 검수 때 만듭니다.")))];
  });
}
