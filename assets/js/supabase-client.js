(function() {
  const cfg = window.COMSW_SUPABASE_CONFIG || {};
  const cache = {};

  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
  }

  function truthyCell(value) {
    if (value === true) return true;
    const text = normalizeText(value).toLowerCase();
    return text === 'true' || text === 'y' || text === 'yes' || text === '1' || text === 'checked';
  }

  function convertDriveUrl(url) {
    const raw = normalizeText(url);
    if (!raw) return '';

    let match = raw.match(/\/file\/d\/([^/]+)/);
    if (match && match[1]) {
      return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w1000';
    }

    match = raw.match(/[?&]id=([^&]+)/);
    if (match && match[1] && raw.indexOf('drive.google.com') !== -1) {
      return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w1000';
    }

    return raw;
  }

  function getRawValues(row) {
    const data = row && row.data ? row.data : {};
    if (Array.isArray(data.values)) return data.values;
    if (data.row && typeof data.row === 'object') {
      return Object.keys(data.row).map(function(key) { return data.row[key]; });
    }
    return [];
  }

  function defaultSourceId() {
    return (cfg.sources && cfg.sources.main) || 'main';
  }

  // 관리 플랫폼에서 '적용'한 내용(시트와 같은 모양의 행)을 RPC로 읽는다.
  async function rpc(name, args) {
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('Supabase 설정이 비어 있습니다.');
    }
    const res = await fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + cfg.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args || {})
    });
    if (!res.ok) {
      throw new Error('Supabase HTTP ' + res.status + ' / ' + await res.text());
    }
    return res.json();
  }

  // 전체수업 25번째 칸(인덱스 24) = 그 주차 강사 커리큘럼 이미지 후보. 방문마다 하나를 골라 H(대표 이미지)에 넣는다.
  function pickWeekImages(rows) {
    rows.forEach(function(row) {
      const vals = row && row.data && row.data.values;
      if (!Array.isArray(vals)) return;
      const candidates = normalizeText(vals[24]).split(/[\n\r,]+/).map(normalizeText).filter(Boolean);
      if (candidates.length) vals[7] = candidates[Math.floor(api._random() * candidates.length)];
    });
    return rows;
  }

  async function fetchSheetRows(sheetName, sourceId) {
    const source = normalizeText(sourceId) || defaultSourceId();
    const cacheKey = source + '::' + sheetName;
    if (cache[cacheKey]) return cache[cacheKey];
    const rows = (await rpc('comsw_site_rows', { p_source: source, p_sheet: sheetName })) || [];
    if (!rows.length) {
      // 관리 화면에서 아직 '적용'하지 않았거나 빈 시트. 다음 호출에서 다시 읽도록 캐시하지 않는다.
      if (window.console) console.warn('[ComswSupabase] 적용된 데이터 없음: ' + source + ' / ' + sheetName);
      return rows;
    }
    cache[cacheKey] = sheetName === '컴수원_전체수업' ? pickWeekImages(rows) : rows;
    return cache[cacheKey];
  }

  // 특강 신청(특강 id = 특강 및 세미나 행 인덱스 8): 응답 { ok, applied?, duplicate?, error? } (예전 Apps Script 응답과 같은 모양)
  function applySeminar(seminarId, name, phone) {
    return rpc('comsw_apply_seminar', { p_id: seminarId || null, p_name: name, p_phone: phone });
  }

  // { 특강 id: 신청 수 } — 스냅샷의 신청 수는 '적용' 시점 값이라 화면에서 최신 값으로 덮는다.
  async function fetchSeminarCounts() {
    const counts = {};
    ((await rpc('comsw_seminar_counts')) || []).forEach(function(r) { counts[r.id] = r.applied; });
    return counts;
  }

  function splitMultiValue(value) {
    return normalizeText(value)
      .split(/[,;\/\n\r]+/)
      .map(normalizeText)
      .filter(Boolean);
  }

  function coursePrepCategoryKey(value) {
    const text = normalizeText(value).replace(/\s+/g, '');
    if (text === '교재명' || text === '교재') return 'textbook';
    if (text === '준비물') return 'supply';
    if (text.toUpperCase() === 'AI툴'.toUpperCase() || text.toLowerCase() === 'aitool' || text === 'AI도구') return 'ai';
    return '';
  }

  const api = window.ComswSupabase = {
    config: cfg,
    _random: Math.random,
    applySeminar: applySeminar,
    fetchSeminarCounts: fetchSeminarCounts,
    normalizeText: normalizeText,
    truthyCell: truthyCell,
    convertDriveUrl: convertDriveUrl,
    getRawValues: getRawValues,
    fetchSheetRows: fetchSheetRows,
    splitMultiValue: splitMultiValue,
    coursePrepCategoryKey: coursePrepCategoryKey,
    clearCache: function(sheetName) {
      if (sheetName) {
        Object.keys(cache).forEach(function(key) {
          if (key.endsWith('::' + sheetName)) delete cache[key];
        });
      }
      else Object.keys(cache).forEach(function(key) { delete cache[key]; });
    }
  };
})();
