import test from "node:test";
import assert from "node:assert/strict";
import { resolveSyncedRole } from "../js/session-role.mjs";

test("옵저버 로그인은 갱신된 Firebase 토큰의 역할로 입장한다", async () => {
  const refreshes = [];
  const role = await resolveSyncedRole({
    refresh: async () => ({ role: "observer" }),
    user: { getIdTokenResult: async (force) => {
      refreshes.push(force);
      return { claims: { role: "authenticated", comsw_role: "observer" } };
    } },
  });
  assert.equal(role, "observer");
  assert.deepEqual(refreshes, [true]);
});

test("함수 응답과 토큰 역할이 다르면 입장을 거부한다", async () => {
  assert.equal(await resolveSyncedRole({
    refresh: async () => ({ role: "observer" }),
    user: { getIdTokenResult: async () => ({ claims: { comsw_role: "teacher" } }) },
  }), null);
});

test("서버에서 역할을 주지 않은 계정은 토큰을 갱신하지 않는다", async () => {
  assert.equal(await resolveSyncedRole({
    refresh: async () => ({ role: null }),
    user: { getIdTokenResult: async () => { throw new Error("호출되면 안 됨"); } },
  }), null);
});
