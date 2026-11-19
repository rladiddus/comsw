// 내 프로필(강사): 사진·경력·한마디. 본인(로그인 UID와 연결된 강사) 것만.
// [저장] = 본인 저장함. [학과장에게 제출] = 기존 comsw_save_my_profile(대기 프로필). AI 사진은 학과장이 검수 때 만든다.
import * as data from "../data.mjs";
import { h, head, box, pill, media, fill, note, fail, busy } from "../ui.mjs";

export async function render({ main, session }) {
  main.replaceChildren(head("내 프로필", "사진, 경력, 수강생에게 건네는 한마디를 작성해 제출합니다. 학과장이 확정하면 홈페이지에 나옵니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const me = await data.myInstructor(session.uid);
    if (!me) return box(null, note("이 계정과 연결된 강사 정보가 없습니다. 학과장에게 계정 연결을 요청해주세요."));
    const [sent] = await data.all("instructor_profile_drafts", (q) => q.eq("instructor_id", me.id));
    const saved = await data.teacherDraft(me.id, "profile", "me");
    const base = sent ?? me;
    const f = saved?.payload ?? { name: base.name, career: base.career ?? "", message: base.message ?? "", asset: null, preview: "", consent: false };
    const msg = h("div");
    const photo = h("div", {}, media(f.preview || sent?.photo_url || me.photo_url));
    const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": "본인 사진" });
    file.onchange = async () => {
      const x = file.files[0];
      if (!x) return;
      photo.replaceChildren(h("div", { class: "muted" }, "올리는 중..."));
      try {
        const up = await data.upload(x, "profile-source");
        Object.assign(f, { asset: up.id, preview: URL.createObjectURL(x) });
      } catch (err) { msg.replaceChildren(fail(`사진: ${err.message}`)); }
      photo.replaceChildren(media(f.preview || sent?.photo_url || me.photo_url));
      file.value = "";
    };
    const field = (k, label, rows) => h("label", { class: "step" }, h("b", {}, label),
      rows ? h("textarea", { rows, value: f[k], style: "width:100%", oninput: (e) => { f[k] = e.target.value; } })
        : h("input", { value: f[k], style: "width:100%", oninput: (e) => { f[k] = e.target.value; } }));
    const consent = h("input", { type: "checkbox", checked: !!f.consent, onchange: (e) => { f.consent = e.target.checked; } });
    const save = h("button", { type: "button", class: "btn" }, "저장");
    const send = h("button", { type: "button", class: "btn primary" }, "학과장에게 제출");
    save.onclick = () => busy(save, msg, async () => {
      await data.saveTeacherDraft(me.id, "profile", "me", { ...f, preview: "" });
      msg.replaceChildren(note("저장했습니다(아직 제출 전, 홈페이지에는 나오지 않습니다)."));
    });
    send.onclick = () => busy(send, msg, async () => {
      if (!f.name.trim()) throw new Error("이름을 입력해주세요");
      if (f.asset && !f.consent) throw new Error("본인 사진 사용 동의에 체크해주세요");
      if (!confirm("프로필을 학과장에게 제출할까요? 학과장이 확정하면 홈페이지에 나옵니다.")) return;
      await data.call("comsw_save_my_profile", { p_name: f.name.trim(), p_career: f.career, p_message: f.message, p_source_asset_id: f.asset, p_source_consent: !!f.consent });
      await data.dropTeacherDraft(me.id, "profile", "me").catch(() => {});
      msg.replaceChildren(note("제출했습니다. 학과장이 확정하면 홈페이지에 나옵니다."));
    });
    return [msg, h("div", { class: "two" },
      box(null,
        h("div", { class: "row" }, h("h3", {}, "프로필"),
          sent?.status === "pending" ? pill("제출함 · 검수 전") : pill(sent ? "확정됨" : "공개 중", "neutral")),
        field("name", "이름"), field("career", "경력", 6), field("message", "수강생에게 한마디", 3),
        h("div", { class: "actions" }, save, send)),
      box("사진", photo, file,
        h("label", { class: "muted" }, consent, " 프로필 사진을 만드는 데 본인 사진을 쓰는 것에 동의합니다"),
        h("p", { class: "muted" }, "올린 사진은 학과장만 보고, 홈페이지용 프로필 사진은 학과장이 검수 때 만듭니다.")))];
  });
}
