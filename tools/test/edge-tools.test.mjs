import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../../supabase/functions/comsw-tools/handler.mjs";
import { createDrive } from "../../supabase/functions/comsw-tools/drive.mjs";
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
test("드라이브 공개 이미지 업로드는 공유 설정을 완료한 뒤 링크 반환", async () => {
  const calls = [];
  const drive = createDrive({
    env: (name) => ({
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REFRESH_TOKEN: "refresh",
      GOOGLE_DRIVE_FOLDER_ID: "public",
    }[name]),
    fetcher: async (url, options) => {
      calls.push([url, options]);
      return Response.json(
        url.includes("oauth2")
          ? { access_token: "token", expires_in: 3600 }
          : url.includes("/upload/")
          ? { id: "new-file" }
          : { id: "permission" },
      );
    },
  });
  const saved = await drive.upload(new Uint8Array([1, 2]), {
    filename: "photo.png",
    mimeType: "image/png",
  });
  assert.equal(saved.url, "https://drive.google.com/file/d/new-file/view");
  const permission = calls.find(([url]) => url.endsWith("/permissions"));
  assert.equal(JSON.parse(permission[1].body).type, "anyone");
});
test("원본 사진 폴더가 공개면 파일 업로드 자체를 하지 않음", async () => {
  const calls = [];
  const drive = createDrive({
    env: (name) => ({
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REFRESH_TOKEN: "refresh",
      GOOGLE_DRIVE_FOLDER_ID: "public",
      GOOGLE_DRIVE_PRIVATE_FOLDER_ID: "private",
    }[name]),
    fetcher: async (url) => {
      calls.push(url);
      return Response.json(
        url.includes("oauth2")
          ? { access_token: "token" }
          : { permissions: [{ type: "anyone", role: "reader" }] },
      );
    },
  });
  await assert.rejects(
    drive.upload(new Uint8Array([1]), {
      filename: "photo.png",
      mimeType: "image/png",
      privateSource: true,
    }),
    /공개/,
  );
  assert.ok(!calls.some((url) => url.includes("/upload/")));
});
