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
      const [requests, drafts, instructors] = await Promise.all([
        rows(supabase, "instructor_link_requests"),
        rows(
          supabase,
          "instructor_profile_drafts",
          (q) => q.eq("status", "pending"),
        ),
        rows(supabase, "instructors"),
      ]);
      if (!requests.length && !drafts.length) {
        box.append(
          el("p", {
            className: "desc",
            textContent: "새 연결 요청이나 승인 대기 프로필이 없습니다.",
          }),
        );
        return;
      }
      async function run(b, fn) {
        b.disabled = true;
        try {
          await fn();
          await onChanged();
          await draw("확인했습니다. '적용'을 눌러야 공개 사이트에 반영됩니다.");
        } catch (e) {
          setState(e.message, true);
        } finally {
          b.disabled = false;
        }
      }
      for (const r of requests) {
        const card = el("article", { className: "submission-card" }, [
          el("h4", { textContent: `강사 계정 연결 · ${r.requested_name}` }),
          el("p", {
            className: "muted",
            textContent: `연결 대상: ${
              instructors.find((i) => i.id === r.instructor_id)?.name || "강사"
            } / 계정: ${r.account_uid}`,
          }),
        ]);
        const approve = el("button", {
          type: "button",
          className: "publish-btn",
          textContent: "연결 승인",
        });
        approve.addEventListener("click", () => {
          if (confirm("요청자와 강사가 같은 사람인지 확인하셨나요?")) {
            run(
              approve,
              () =>
                rpc(supabase, "comsw_approve_instructor_link", { p_id: r.id }),
            );
          }
        });
        const reject = el("button", {
          type: "button",
          className: "ghost-btn danger",
          textContent: "연결 요청 반려",
        });
        reject.addEventListener("click", () => {
          if (confirm("이 연결 요청을 반려할까요?")) {
            run(reject, async () => {
              const { error } = await supabase.from("instructor_link_requests")
                .delete().eq("id", r.id);
              if (error) throw new Error(error.message);
            });
          }
        });
        card.append(approve, reject);
        box.append(card);
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
        card.append(approve);
        box.append(card);
      }
    } catch (e) {
      setState(e.message, true);
    }
  }
  await draw();
}
