import { mountInstructorReview } from "../instructor-review.mjs";

// 선생님이 올린 프로필(승인 대기). 승인한 내용은 '강사' 탭을 다시 열면 보인다.
export async function render(container, { supabase }) {
  container.append(Object.assign(document.createElement("h2"), { textContent: "승인 대기" }));
  await mountInstructorReview(container, supabase);
}
