import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../../supabase/functions/comsw-tools/handler.mjs";
import { createStorage } from "../../supabase/functions/comsw-tools/storage.mjs";
import {
  checkImage,
  requireMember,
  summaryReservation,
  usageCost,
} from "../../supabase/functions/comsw-tools/policy.mjs";

test("서버는 역할 없는 계정과 다른 사이트를 거절", async () => {
  const handler = createHandler({
    env: () => undefined,
    verifyToken: async () => ({ sub: "x" }),
    userClient: () => {
      throw Error("DB에 닿으면 안 됨");
    },
  });
  assert.equal(
    (await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { Authorization: "Bearer x" },
        body: "{}",
      }),
    )).status,
    401,
  );
  assert.equal(
    (await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { Origin: "https://other.example" },
      }),
    )).status,
    403,
  );
  assert.throws(
    () => requireMember({ sub: "x", comsw_role: "operations" }),
    /권한/,
  );
});

test("교사는 API를 직접 호출해도 요약·프로필 생성 불가", async () => {
  let requests = 0;
  const handler = createHandler({
    env: () => undefined,
    verifyToken: async () => ({ sub: "teacher", comsw_role: "teacher" }),
    userClient: () => ({}),
    serviceClient: () => ({}),
    fetcher: async () => {
      requests++;
      throw Error("외부 호출 금지");
    },
  });
  for (const action of ["summarize", "profile"]) {
    const response = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: {
          Authorization: "Bearer teacher",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, kind: "week", text: "원문" }),
      }),
    );
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /학과장/);
  }
  assert.equal(requests, 0);
});
test("MIME 위장 파일은 서버에서 거절", () => {
  assert.throws(
    () =>
      checkImage(new TextEncoder().encode("<script>bad</script>"), "image/png"),
    /이미지/,
  );
  assert.equal(
    checkImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    "image/png",
  );
});
test("토큰 비용 예약은 한글 원문과 출력 상한을 포함하고 응답 누락은 정산하지 않음", () => {
  assert.ok(summaryReservation("요약", "한글".repeat(100), 2000) > 1);
  assert.ok(usageCost({ input_tokens: 100, output_tokens: 100 }, 2000) > 0);
  assert.throws(() => usageCost({}, 2000), /사용량/);
});
test("공개 이미지는 Firebase에 1년 캐시로 올리고 공개 링크 반환", async () => {
  const calls = [];
  const storage = createStorage({
    env: () => undefined,
    supabase: () => {
      throw Error("공개 이미지는 Supabase에 올리지 않음");
    },
    firebaseToken: async () => "token",
    fetcher: async (url, options) => {
      calls.push([url, options]);
      return Response.json({ name: "x" });
    },
  });
  const saved = await storage.upload(new Uint8Array([1, 2]), {
    mimeType: "image/webp",
  });
  assert.match(saved.path, /^firebase:public\/\d{4}-\d{2}\/[0-9a-f-]+\.webp$/);
  assert.equal(
    saved.url,
    `https://firebasestorage.googleapis.com/v0/b/sbs-com-sw.firebasestorage.app/o/${
      encodeURIComponent(saved.path.slice("firebase:".length))
    }?alt=media`,
  );
  const [url, options] = calls[0];
  assert.ok(url.includes("/upload/storage/v1/b/sbs-com-sw.firebasestorage.app/o"));
  assert.equal(options.headers.Authorization, "Bearer token");
  assert.match(await options.body.text(), /max-age=31536000/);
});
test("본인 사진 원본은 Supabase 비공개 버킷에만 저장하고 링크를 만들지 않음", async () => {
  const uploads = [];
  const storage = createStorage({
    env: () => undefined,
    supabase: () => ({
      storage: {
        from: (bucket) => ({
          upload: async (name) => {
            uploads.push([bucket, name]);
            return { error: null };
          },
        }),
      },
    }),
    firebaseToken: async () => {
      throw Error("원본 사진은 Firebase에 올리지 않음");
    },
  });
  const saved = await storage.upload(new Uint8Array([1]), {
    mimeType: "image/png",
    privateSource: true,
  });
  assert.equal(saved.url, null);
  assert.equal(uploads[0][0], "comsw-private");
  assert.equal(saved.path, `supabase:${uploads[0][1]}`);
  await assert.rejects(storage.download("firebase:public/a.webp"), /본인 사진/);
});

test("커리큘럼 이미지는 픽셀 제한 없이: WebP로 못 바꿀 만큼 커도 올린 파일 그대로 저장", async () => {
  const saved = [];
  const handler = createHandler({
    env: () => undefined,
    verifyToken: async () => ({ sub: "t", comsw_role: "teacher" }),
    userClient: () => ({}),
    serviceClient: () => ({
      from: () => ({
        insert: (row) => (saved.push(row), {
          select: () => ({ single: async () => ({ data: { id: "a", filename: row.filename }, error: null }) }),
        }),
      }),
    }),
    storage: { ready: () => true, upload: async (_b, o) => ({ path: "firebase:x", url: "https://x", ...o }) },
    toWebp: async () => {
      throw Error("Image too large");
    },
  });
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const form = new FormData();
  form.append("kind", "curriculum");
  form.append("file", new File([png], "big.png", { type: "image/png" }));
  const response = await handler(new Request("https://example.com", {
    method: "POST", headers: { Authorization: "Bearer t" }, body: form,
  }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual([saved[0].mime_type, saved[0].filename], ["image/png", "big.png"]);
});
