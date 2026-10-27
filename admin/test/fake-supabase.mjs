// 테스트용 메모리 Supabase: supabase-js 쿼리 빌더 중 관리 화면이 쓰는 부분만 흉내 낸다.
export function fakeSupabase(tables, { unique = {} } = {}) {
  const calls = [];
  return {
    calls,
    // 실제 DB 함수 중 화면이 저장에 쓰는 것만 흉내 낸다(테스트에서 rpc를 바꿔 끼울 수 있음).
    async rpc(name, args) {
      calls.push(["rpc", name, args]);
      if (name === "comsw_save_subject_layout") {
        const links = (tables.subject_departments ??= []);
        const same = (a, b) => a.subject_id === b.subject_id && a.department_id === b.department_id;
        for (const l of args.p_add) if (!links.some((x) => same(x, l))) links.push({ ...l });
        for (const e of args.p_subjects) Object.assign(tables.subjects.find((s) => s.id === e.id), e);
        for (const l of args.p_remove) {
          links.splice(links.findIndex((x) => same(x, l)), 1);
          // 트리거: 마지막 학과에서 빠지면 기타 과목(순서 없음)
          if (!links.some((x) => x.subject_id === l.subject_id)) tables.subjects.find((s) => s.id === l.subject_id).sort_order = null;
        }
      }
      return { data: null, error: null };
    },
    from(table) {
      const rows = (tables[table] ??= []);
      const query = (kind, payload, opts = {}) => {
        const filters = [];
        const eqs = [];
        let orderCol = null;
        const run = () => {
          const hit = rows.filter(r => filters.every(f => f(r)));
          if (kind === "select") {
            if (opts.head) return { count: hit.length, error: null };
            const key = r => r[orderCol] ?? Infinity;
            return { data: [...hit].sort((a, b) => (orderCol ? key(a) - key(b) : 0)).map(r => ({ ...r })), error: null };
          }
          const id = eqs.find(([k]) => k === "id")?.[1];
          if (kind === "update") {
            calls.push(["update", table, id, payload]);
            const u = unique[table];
            if (u && u in payload && rows.some(r => !hit.includes(r) && r[u] === payload[u]))
              return { error: { code: "23505", message: "duplicate" } };
            hit.forEach(r => Object.assign(r, payload));
            return { error: null };
          }
          calls.push(["delete", table, id ?? Object.fromEntries(eqs)]);
          for (const r of hit) rows.splice(rows.indexOf(r), 1);
          return { error: null };
        };
        const q = {
          // 참/거짓 칸은 실제 DB처럼 비어 있으면 false(기본값)로 본다.
          eq: (k, v) => { filters.push(r => (typeof v === "boolean" ? Boolean(r[k]) : r[k]) === v); eqs.push([k, v]); return q; },
          in: (k, vs) => { filters.push(r => vs.includes(r[k])); return q; },
          is: (k, v) => { filters.push(r => (r[k] ?? null) === v); return q; },
          not: (k, _op, v) => { filters.push(r => (r[k] ?? null) !== v); return q; },
          order: col => { orderCol = col; return q; },
          then: (ok, bad) => Promise.resolve().then(run).then(ok, bad),
        };
        return q;
      };
      return {
        select: (_cols, opts) => query("select", null, opts),
        update: patch => query("update", patch),
        delete: () => query("delete"),
        upsert: row => { calls.push(["upsert", table, row]); return Promise.resolve({ error: null }); },
        insert: row => {
          calls.push(["insert", table, row]);
          const added = (Array.isArray(row) ? row : [row]).map((r, i) => ({ id: `new${rows.length + i}`, ...r }));
          for (const r of added) rows.push(r);
          // insert(...).select().single()이면 넣은 줄을 돌려준다.
          return Object.assign(Promise.resolve({ error: null }), {
            select: () => ({ single: () => Promise.resolve({ data: { ...added[0] }, error: null }) }),
          });
        },
      };
    },
  };
}
