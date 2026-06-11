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

  async function fetchSheetRows(sheetName) {
    if (cache[sheetName]) return cache[sheetName];
    if (!cfg.url || !cfg.anonKey || !cfg.rawTable) {
      throw new Error('Supabase 설정이 비어 있습니다.');
    }

    const endpoint = cfg.url.replace(/\/+$/, '') + '/rest/v1/' + cfg.rawTable;
    const url = endpoint
      + '?select=sheet_name,row_number,data'
      + '&sheet_name=eq.' + encodeURIComponent(sheetName)
      + '&order=row_number.asc';

    const res = await fetch(url, {
      headers: {
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + cfg.anonKey
      }
    });

    if (!res.ok) {
      throw new Error('Supabase HTTP ' + res.status + ' / ' + await res.text());
    }

    cache[sheetName] = await res.json();
    return cache[sheetName];
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

  window.ComswSupabase = {
    config: cfg,
    normalizeText: normalizeText,
    truthyCell: truthyCell,
    convertDriveUrl: convertDriveUrl,
    getRawValues: getRawValues,
    fetchSheetRows: fetchSheetRows,
    splitMultiValue: splitMultiValue,
    coursePrepCategoryKey: coursePrepCategoryKey,
    clearCache: function(sheetName) {
      if (sheetName) delete cache[sheetName];
      else Object.keys(cache).forEach(function(key) { delete cache[key]; });
    }
  };
})();
