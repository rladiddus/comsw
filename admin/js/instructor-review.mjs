import { el, rows, rpc, stateLine } from "./teacher-workspace.mjs";
import { driveThumbnail } from "./drive.mjs";
import { getServices } from "./services.mjs";

export async function mountInstructorReview(
  container,
  supabase,
  onChanged = async () => {},
) {
  const box = el("section", { className: "review-panel" });
  container.append(box);
  async function draw(message = "") {
    box.replaceChildren(el("h3", { textContent: "선생님 요청 확인" }));
    const setState = stateLine(box);
    if (message) setState(message);
    try {
      const drafts = await rows(
        supabase,
        "instructor_profile_drafts",
        (q) => q.eq("status", "pending"),
      );
      if (!drafts.length) {
        box.append(
          el("p", {
            className: "desc",
            textContent: "승인 대기 프로필이 없습니다.",
          }),
        );
        return;
      }
      async function run(b, fn) {
        b.disabled = true;
        try {
          await fn();
          await onChanged();
          await draw("확인했습니다. '사이트에 반영'을 눌러야 공개 사이트에 반영됩니다.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          b.disabled = false;
        }
      }
      for (const d of drafts) {
        const card = el("article", { className: "submission-card" }, [
          el("h4", { textContent: `프로필 승인 대기 · ${d.name}` }),
          el("p", { className: "submission-text", textContent: d.career }),
          el("p", { className: "submission-text", textContent: d.message }),
        ]);
        if (d.photo_url) {
          card.append(
            el("img", {
              className: "review-portrait",
              src: driveThumbnail(d.photo_url),
              alt: `${d.name} 생성 프로필`,
            }),
          );
        }
        if (d.source_asset_id) {
          const source = el("button", {
            type: "button",
            className: "ghost-btn",
            textContent: "본인 사진 확인",
          });
          source.addEventListener("click", async () => {
            source.disabled = true;
            try {
              const fn = getServices().source;
              if (!fn) throw new Error("사진 연결을 준비 중입니다");
              const result = await fn(d.source_asset_id);
              card.append(
                el("img", {
                  className: "review-portrait",
                  src: result.dataUrl,
                  alt: "비공개 본인 사진",
                }),
              );
            } catch (e) {
              setState(e.message, true);
            } finally {
              source.disabled = false;
            }
          });
          card.append(source);
          const generate = el("button", {
            type: "button",
            className: "ghost-btn",
            textContent: "AI 프로필 만들기",
            disabled: !d.source_consent,
          });
          if (!d.source_consent) {
            card.append(
              el("p", {
                className: "muted",
                textContent:
                  "선생님이 사진 사용 동의 후 다시 제출하면 프로필을 만들 수 있습니다.",
              }),
            );
          }
          generate.addEventListener("click", async () => {
            if (
              !confirm(
                `${d.name} 선생님의 제출 사진으로 표준 프로필을 만들까요?`,
              )
            ) return;
            const controls = [...card.querySelectorAll("button")];
            controls.forEach((b) => b.disabled = true);
            try {
              const fn = getServices().generateProfile;
              if (!fn) throw new Error("AI 연결을 준비 중입니다");
              setState(
                `${d.name} 선생님의 프로필 제작 중입니다. 1~2분 정도 걸릴 수 있습니다.`,
              );
              await fn(d.instructor_id);
              await onChanged();
              await draw(
                "프로필 사진을 만들었습니다. 결과를 확인한 뒤 승인해주세요.",
              );
            } catch (e) {
              setState(e.message, true);
            } finally {
              controls.forEach((b) => b.disabled = false);
            }
          });
          card.append(generate);
        }
        const approve = el("button", {
          type: "button",
          className: "publish-btn",
          textContent: "프로필 승인",
        });
        approve.addEventListener("click", () => {
          if (
            confirm(`${d.name} 선생님의 경력·한마디·프로필 사진을 승인할까요?`)
          ) {
            run(approve, () =>
              rpc(supabase, "comsw_approve_profile", {
                p_id: d.instructor_id,
                p_updated_at: d.updated_at,
              }));
          }
        });
        // 수정 요청: 메모를 적어 보내면 선생님 화면에 보이고, 선생님이 고쳐 다시 승인 요청한다.
        const ask = el("button", {
          type: "button",
          className: "ghost-btn",
          textContent: "수정 요청",
        });
        ask.addEventListener("click", () => {
          ask.disabled = true;
          const note = el("textarea", {
            rows: 3,
            maxLength: 2000,
            placeholder: "선생님께 고쳐 달라고 할 내용을 적어주세요.",
          });
          const send = el("button", {
            type: "button",
            className: "publish-btn",
            textContent: "수정 요청 보내기",
          });
          const cancel = el("button", {
            type: "button",
            className: "ghost-btn",
            textContent: "취소",
          });
          const form = el("div", { className: "review-note" }, [
            note,
            el("div", { className: "form-actions" }, [send, cancel]),
          ]);
          cancel.addEventListener("click", () => {
            form.remove();
            ask.disabled = false;
          });
          send.addEventListener("click", () => {
            if (!note.value.trim()) {
              setState("수정할 내용을 적어주세요", true);
              return;
            }
            run(send, () =>
              rpc(supabase, "comsw_request_profile_changes", {
                p_id: d.instructor_id,
                p_note: note.value.trim(),
                p_updated_at: d.updated_at,
              }));
          });
          card.append(form);
          note.focus?.();
        });
        card.append(approve, ask);
        box.append(card);
      }
    } catch (e) {
      setState(e.message, true);
    }
  }
  await draw();
}
