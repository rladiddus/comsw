// 내 프로필(강사): 사진·경력·한마디. 본인(로그인 UID와 연결된 강사)만. 작성·제출은 3단계.
import * as data from "../data.mjs";
import { h, head, box, pill, media, dl, fill, note } from "../ui.mjs";

export async function render({ main, session }) {
  main.replaceChildren(head("내 프로필", "사진, 경력, 수강생에게 건네는 한마디를 작성해 제출합니다."));
  const body = h("div");
  main.append(body);
  await fill(body, async () => {
    const me = await data.myInstructor(session.uid);
    if (!me) return box(null, note("이 계정과 연결된 강사 정보가 없습니다. 학과장에게 계정 연결을 요청해주세요."));
    const draft = (await data.all("instructor_profile_drafts", (q) => q.eq("instructor_id", me.id)))[0];
    const cur = draft ?? me;
    return h("div", { class: "two" },
      box(null,
        h("div", { class: "row" }, h("h3", {}, cur.name),
          draft ? pill(draft.status === "pending" ? "제출함 · 검수 전" : "확정됨") : pill("공개 중", "neutral")),
        dl([["경력", cur.career], ["한마디", cur.message]])),
      box("사진", media(cur.photo_url || me.photo_url)));
  });
}
