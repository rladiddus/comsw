const CONTENT_TABLES = [
  "departments", "site_categories", "subjects", "subject_departments", "subject_weeks",
  "instructors", "instructor_departments", "instructor_subjects", "curriculum_sets",
  "instructor_curricula", "roadmap_tracks", "roadmap_steps", "roadmap_step_subjects",
  "course_prep_items", "seminars", "seminar_applications", "recruitment_posts",
  "main_media", "menus", "loading_items", "site_settings",
];

const RECRUITMENT_COLUMNS = [
  "company", "job_title", "location", "employment_type", "requirements", "duties", "salary",
  "how_to_apply", "deadline", "contact", "experience", "notes", "link_url", "updated_text",
];

export function sqlLiteral(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  // 줄바꿈·탭을 그대로 두면 SQL Editor 붙여넣기 중 \r\n 등으로 바뀌므로 E'' 이스케이프로 적는다.
  if (/[\\\r\n\t]/.test(s)) {
    const escaped = s.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    return `E'${escaped}'`;
  }
  return `'${s.replace(/'/g, "''")}'`;
}

function insert(table, columns, rows) {
  if (!rows.length) return null;
  return {
    head: `insert into public.${table} (${columns.join(", ")}) values\n  `,
    tuples: rows.map(r => `(${r.map(sqlLiteral).join(", ")})`),
  };
}

const statement = (block, tuples) => `${block.head}${tuples.join(",\n  ")};`;
const unique = keys => [...new Set(keys)];

export function toSql(model, options = {}) {
  const { header, truncate, blocks } = buildParts(model, options);
  const inserts = blocks.flatMap(b => {
    const out = [];
    for (let i = 0; i < b.tuples.length; i += 500) out.push(statement(b, b.tuples.slice(i, i + 500)));
    return out;
  });
  return [header, "begin;", truncate, ...inserts, "commit;"].join("\n\n") + "\n";
}

// SQL Editor 붙여넣기 한도 때문에 나눈다. 첫 조각이 비우고 시작하므로, 실패하면 첫 조각부터 다시 실행하면 된다.
export function toSqlChunks(model, { maxChars = 60000, ...options } = {}) {
  const { header, truncate, blocks } = buildParts(model, options);
  const chunks = [];
  let done = [];
  let open = null;
  const size = () => done.reduce((n, s) => n + s.length + 2, 0) + (open ? statement(open.block, open.tuples).length : 0);
  const close = () => { if (open) done.push(statement(open.block, open.tuples)); open = null; };
  const flush = () => { close(); if (done.length) chunks.push(done.join("\n\n") + "\n"); done = []; };

  done.push(header, truncate);
  for (const block of blocks) {
    for (const tuple of block.tuples) {
      if (open && open.block === block && size() + tuple.length + 4 <= maxChars) {
        open.tuples.push(tuple);
        continue;
      }
      close();
      if (size() + statement(block, [tuple]).length + 2 > maxChars && done.length) flush();
      open = { block, tuples: [tuple] };
    }
  }
  flush();
  return chunks;
}

function buildParts(model, { uuid = () => crypto.randomUUID() } = {}) {
  const ids = new Map();
  const id = key => {
    if (!ids.has(key)) ids.set(key, uuid());
    return ids.get(key);
  };
  const steps = model.roadmap_tracks.flatMap(t => t.steps.map(s => ({ ...s, track_key: t.key, key: `${t.key}:${s.position}` })));

  const blocks = [
    insert("departments", ["id", "name", "name_en", "description", "image_url", "drive_folder_id", "is_active", "sort_order"],
      model.departments.map(d => [id(d.key), d.name, d.name_en, d.description, d.image_url, d.drive_folder_id, d.is_active, d.sort_order])),
    insert("site_categories", ["id", "name", "is_active", "sort_order"],
      model.categories.map(c => [id(c.key), c.name, c.is_active, c.sort_order])),
    insert("subjects", ["id", "name", "duration", "dept_curriculum", "program", "level", "sort_order"],
      model.subjects.map(s => [id(s.key), s.name, s.duration, s.dept_curriculum, s.program, s.level, s.sort_order])),
    insert("subject_departments", ["subject_id", "department_id"],
      model.subjects.flatMap(s => unique(s.department_keys).map(d => [id(s.key), id(d)]))),
    insert("subject_weeks", ["subject_id", "week_label", "written", "summary", "image_url", "sort_order"],
      model.weeks.map(w => [id(w.subject_key), w.week_label, w.written, w.summary, w.image_url, w.sort_order])),
    insert("instructors", ["id", "name", "gender", "career", "message", "photo_url", "is_listed", "sort_order"],
      model.instructors.map(i => [id(i.key), i.name, i.gender, i.career, i.message, i.photo_url, i.is_listed, i.sort_order])),
    insert("instructor_departments", ["instructor_id", "department_id"],
      model.instructors.flatMap(i => unique(i.department_keys).map(d => [id(i.key), id(d)]))),
    insert("instructor_subjects", ["instructor_id", "subject_id", "sort_order"],
      model.instructors.flatMap(i => unique(i.subject_keys).map((s, n) => [id(i.key), id(s), n]))),
    insert("curriculum_sets", ["id", "name", "department_id", "sort_order"],
      model.curriculum_sets.map(s => [id(s.key), s.name, s.department_key ? id(s.department_key) : null, s.sort_order])),
    insert("instructor_curricula", ["set_id", "instructor_id", "subject_id", "step_label", "written", "summary", "media_url", "supplies", "supplies_detail", "class_time", "status", "sort_order"],
      model.instructor_curricula.map(c => [id(c.set_key), id(c.instructor_key), id(c.subject_key), c.step_label, c.written, c.summary, c.media_url, c.supplies, c.supplies_detail, c.class_time, c.status, c.sort_order])),
    insert("roadmap_tracks", ["id", "name", "department_id", "sort_order"],
      model.roadmap_tracks.map(t => [id(t.key), t.name, t.department_key ? id(t.department_key) : null, t.sort_order])),
    insert("roadmap_steps", ["id", "track_id", "position", "source_text", "summary"],
      steps.map(s => [id(s.key), id(s.track_key), s.position, s.source_text, s.summary])),
    insert("roadmap_step_subjects", ["step_id", "subject_id", "sort_order"],
      steps.flatMap(s => unique(s.subject_keys).map((k, n) => [id(s.key), id(k), n]))),
    insert("course_prep_items", ["subject_id", "category", "content", "link_url", "image_url", "extra", "sort_order"],
      model.prep.map(p => [id(p.subject_key), p.category, p.content, p.link_url, p.image_url, p.extra, p.sort_order])),
    insert("seminars", ["id", "title", "subtitle", "datetime_text", "instructor", "place", "capacity", "poster_url", "sort_order"],
      model.seminars.map(s => [id(s.key), s.title, s.subtitle, s.datetime_text, s.instructor, s.place, s.capacity, s.poster_url, s.sort_order])),
    insert("seminar_applications", ["seminar_id", "name", "phone"],
      model.applications.map(a => [id(a.seminar_key), a.name, a.phone])),
    insert("recruitment_posts", ["department_id", ...RECRUITMENT_COLUMNS, "sort_order"],
      model.recruitment.map(p => [id(p.department_key), ...p.fields, p.sort_order])),
    insert("main_media", ["url", "caption", "is_active", "sort_order"],
      model.media.map(m => [m.url, m.caption, m.is_active, m.sort_order])),
    insert("menus", ["name", "is_active", "side", "sort_order"],
      model.menus.map(m => [m.name, m.is_active, m.side, m.sort_order])),
    insert("loading_items", ["image_url", "text", "is_active", "font_family", "font_size", "font_weight", "sort_order"],
      model.loading.map(l => [l.image_url, l.text, l.is_active, l.font_family, l.font_size, l.font_weight, l.sort_order])),
    insert("site_settings", ["key", "value"], [
      ["roadmap_logo_url", model.settings.roadmap_logo_url],
      ["vacation_set_id", model.settings.vacation_set_key ? id(model.settings.vacation_set_key) : null],
      ["vacation_background_url", model.settings.vacation_background_url],
    ]),
  ].filter(Boolean);
  return {
    header: "-- 컴수원 데이터 이전 (자동 생성). 신청자 개인정보 포함 — 공개 저장소에 넣지 말 것.",
    truncate: `truncate ${CONTENT_TABLES.map(t => `public.${t}`).join(", ")} cascade;`,
    blocks,
  };
}
