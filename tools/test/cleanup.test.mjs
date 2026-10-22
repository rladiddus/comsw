import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { freshDb } from "./pg.mjs";

test("구 신청자 복사본만 제거하고 깨우기용 raw와 새 신청 명단 보존", async () => {
  const db = await freshDb();
  try {
    await db.exec(`create table raw_sheet_rows(source_id text,sheet_name text);
      insert into raw_sheet_rows values ('main','특강 신청'),('main','특강 신청자 명단'),('main','컴수원_전체수업'),('other','특강 신청');
      insert into seminars(title) values('새 특강');
      insert into seminar_applications(seminar_id,name,phone) select id,'테스트','010-0000-0000' from seminars;`);
    await db.exec(
      readFileSync(
        new URL("../cleanup-applicants.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(
      (await db.query(
        "select source_id,sheet_name from raw_sheet_rows order by source_id",
      )).rows,
      [{ source_id: "main", sheet_name: "컴수원_전체수업" }, {
        source_id: "other",
        sheet_name: "특강 신청",
      }],
    );
    assert.equal(
      (await db.query("select count(*)::int as n from seminar_applications"))
        .rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("GAS 자동 복사 중지는 명시한 핸들러만 삭제하고 매일 깨우기 유지", () => {
  let triggers = ["syncAll", "keepSupabaseAlive", "otherTask"].map((name) => ({
    getHandlerFunction: () => name,
    getEventType: () => "CLOCK",
  }));
  const scope = {
    console: { log() {} },
    ScriptApp: {
      getProjectTriggers: () => [...triggers],
      deleteTrigger: (t) => {
        triggers = triggers.filter((x) => x !== t);
      },
    },
  };
  vm.createContext(scope);
  vm.runInContext(
    readFileSync(new URL("../gas-stop-sheet-sync.gs", import.meta.url), "utf8"),
    scope,
  );
  scope.COMSW_SYNC_HANDLERS = ["syncAll"];
  scope.stopSheetSyncOnly();
  assert.deepEqual(triggers.map((t) => t.getHandlerFunction()), [
    "keepSupabaseAlive",
    "otherTask",
  ]);
  scope.COMSW_SYNC_HANDLERS = ["keepSupabaseAlive"];
  assert.throws(() => scope.stopSheetSyncOnly(), /삭제할 수 없습니다/);
});

test("신청자 raw 읽기 차단은 기존 public 읽기를 제한하고 매일 깨우기용 행은 유지", async () => {
  const db = await freshDb();
  try {
    await db.exec(
      `create table raw_sheet_rows(source_id text,sheet_name text);grant select on raw_sheet_rows to anon,authenticated;
      alter table raw_sheet_rows enable row level security;create policy legacy_read on raw_sheet_rows for select using(true);
      insert into raw_sheet_rows values('main','특강 신청자 명단'),('main','컴수원_전체수업');`,
    );
    await db.exec(
      readFileSync(
        new URL("../protect-applicant-raw.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("set role anon");
    assert.deepEqual(
      (await db.query("select sheet_name from raw_sheet_rows")).rows,
      [{ sheet_name: "컴수원_전체수업" }],
    );
  } finally {
    await db.close();
  }
});
