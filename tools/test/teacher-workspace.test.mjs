import test from "node:test";
import assert from "node:assert/strict";
import { as, freshDb } from "./pg.mjs";

const teacher = { sub: "teacher-a", comsw_role: "teacher" };
const head = { sub: "head", comsw_role: "head" };

test('본인 원본 사진과 프로필 대기본은 다른 교사에게 보이지 않음',async()=>{
  const db=await freshDb();try{
    await db.exec(`insert into instructors(name,account_uid) values('다른강사','other');
      insert into media_assets(owner_uid,kind,storage_path,filename,mime_type,byte_size) values('other','profile-source','private-file','photo.png','image/png',100);
      insert into instructor_profile_drafts(instructor_id,name,source_asset_id) select i.id,i.name,a.id from instructors i,media_assets a;`);
    const asset=(await db.query('select id from media_assets')).rows[0].id;
    await as(db,'authenticated',teacher);
    await db.query("select comsw_create_my_instructor('나')");
    assert.equal((await db.query('select * from media_assets')).rows.length,0);
    assert.equal((await db.query('select * from instructor_profile_drafts')).rows.length,0);
    await assert.rejects(db.query("select comsw_save_my_profile('나','','',$1)",[asset]),/본인 사진/);
    await assert.rejects(db.query("update instructor_profile_drafts set status='approved'"),/permission denied/);
  }finally{await db.close();}
});

test('확인한 뒤 변경된 프로필은 오래된 화면에서 승인하지 않음',async()=>{
  const db=await freshDb();try{
    await as(db,'authenticated',teacher);await db.query("select comsw_create_my_instructor('나')");
    await db.query("select comsw_save_my_profile('나','이전','',null)");
    const d=(await db.query('select * from instructor_profile_drafts')).rows[0];
    await db.query("select comsw_save_my_profile('나','변경','',null)");
    await as(db,'authenticated',head);
    await assert.rejects(db.query('select comsw_approve_profile($1,$2)',[d.instructor_id,d.updated_at]),/변경/);
  }finally{await db.close();}
});

test("본인 프로필은 승인 대기 저장 후 학과장 승인으로만 강사 정보에 반영", async () => {
  const db = await freshDb();
  try {
    await as(db, "authenticated", teacher);
    const id =
      (await db.query("select comsw_create_my_instructor('새강사') as id"))
        .rows[0].id;
    await db.query(
      "select comsw_save_my_profile('새강사', '경력 5년', '함께 배웁니다', null)",
    );
    assert.equal(
      (await db.query("select career from instructors where id=$1", [id]))
        .rows[0].career,
      null,
    );
    await assert.rejects(
      db.query("select comsw_approve_profile($1)", [id]),
      /권한/,
    );
    await as(db, "authenticated", head);
    await db.query("select comsw_approve_profile($1)", [id]);
    assert.equal(
      (await db.query("select career from instructors where id=$1", [id]))
        .rows[0].career,
      "경력 5년",
    );
  } finally {
    await db.close();
  }
});

test("교사는 다른 강사의 프로필과 계정 식별자를 읽거나 바꿀 수 없음", async () => {
  const db = await freshDb();
  try {
    await db.exec(
      "insert into instructors(name, account_uid) values ('다른강사', 'other')",
    );
    await as(db, "authenticated", teacher);
    assert.equal((await db.query("select * from instructors")).rows.length, 0);
    await assert.rejects(
      db.query("select comsw_my_instructor_ids()").then(() =>
        db.query("select comsw_approve_instructor_link(gen_random_uuid())")
      ),
      /권한/,
    );
    await as(db, "authenticated", { sub: "outsider" });
    await assert.rejects(
      db.query("select comsw_create_my_instructor('침입')"),
      /권한/,
    );
  } finally {
    await db.close();
  }
});

test("기존 강사는 요청만으로 연결되지 않고 관리자 확인 필요", async () => {
  const db = await freshDb();
  try {
    const id = (await db.query(
      "insert into instructors(name) values ('동명이인') returning id",
    )).rows[0].id;
    await as(db, "authenticated", teacher);
    await db.query("select comsw_request_instructor_link($1, '동명이인')", [
      id,
    ]);
    assert.equal((await db.query("select * from instructors")).rows.length, 0);
    const req =
      (await db.query("select id from instructor_link_requests")).rows[0].id;
    await as(db, "authenticated", head);
    await db.query("select comsw_approve_instructor_link($1)", [req]);
    await as(db, "authenticated", teacher);
    assert.equal((await db.query("select id from instructors")).rows[0].id, id);
  } finally {
    await db.close();
  }
});

test("승인된 커리큘럼을 수정해 제출해도 승인본 보존, 대기본 반복 제출은 한 줄", async () => {
  const db = await freshDb();
  try {
    await db.exec(
      "insert into departments(name) values ('웹'); insert into subjects(name) values ('웹1'); insert into curriculum_sets(name, department_id) select name,id from departments",
    );
    const set = (await db.query("select id from curriculum_sets")).rows[0].id;
    const subject = (await db.query("select id from subjects")).rows[0].id;
    await as(db, "authenticated", teacher);
    await db.query("select comsw_create_my_instructor('강사')");
    const submit = (text) =>
      db.query(
        "select comsw_submit_my_curriculum($1,$2,'1주차',$3,'정리','') as id",
        [set, subject, text],
      );
    const first = (await submit("원본")).rows[0].id;
    await as(db, "authenticated", head);
    await db.query("select comsw_approve_curriculum($1)", [first]);
    await as(db, "authenticated", teacher);
    await submit("수정");
    await submit("다시 수정");
    const rows = (await db.query(
      "select status,written from instructor_curricula order by status",
    )).rows;
    assert.deepEqual(rows, [{ status: "approved", written: "원본" }, {
      status: "pending",
      written: "다시 수정",
    }]);
  } finally {
    await db.close();
  }
});

test("같은 이름 후보는 학과·담당 과목을 함께 주고, 연결 요청에는 로그인 이메일이 남는다", async () => {
  const db = await freshDb();
  try {
    await db.exec(`insert into departments(name, sort_order) values ('AI학과', 2), ('시각편집학과', 1);
      insert into subjects(name) values ('일러스트'), ('포토샵');
      insert into instructors(name) values ('김민주');
      insert into instructor_departments select i.id, d.id from instructors i, departments d;
      insert into instructor_subjects(instructor_id, subject_id, sort_order)
        select i.id, s.id, case s.name when '포토샵' then 1 else 2 end from instructors i, subjects s;`);
    await as(db, "authenticated", { ...teacher, email: "kim@example.com" });
    const [c] = (await db.query("select * from comsw_instructor_candidates('김민주')")).rows;
    assert.deepEqual(c.departments, ["시각편집학과", "AI학과"]);
    assert.deepEqual(c.subjects, ["포토샵", "일러스트"]);
    await db.query("select comsw_request_instructor_link($1, '김민주')", [c.id]);
    await as(db, "authenticated", head);
    assert.equal(
      (await db.query("select requester_email from instructor_link_requests")).rows[0].requester_email,
      "kim@example.com",
    );
  } finally {
    await db.close();
  }
});
