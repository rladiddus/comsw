/**
 * 컴수원 GitHub Pages 공통 하단 메뉴
 *
 * 사용법: 메뉴를 띄울 페이지의 </body> 직전에 한 줄만 추가.
 *   <script src="./assets/js/footer-menu.js"></script>
 *
 * 동작:
 *  - DOM ready 시 자동 실행
 *  - Supabase "메인 페이지" 시트(E열=이름, F열=체크, H열=순서)에서 메뉴 목록 fetch
 *  - 항상 보이는 하단 중앙 알약 그리드 렌더링 (index.html의 +/펼치기 토글 없음)
 *  - location.pathname으로 현재 페이지 자동 감지 → 해당 알약은 주황 활성 상태 + 클릭 무시
 *  - 시트 기준으로 메뉴/순서가 정해지므로 페이지마다 따로 관리할 필요 없음
 *
 * 의존성: supabase-config.js + supabase-client.js (페이지에서 먼저 로드되어 있어야 함)
 */
(function() {
  // 페이지 파일명 → 메뉴 이름 매핑
  const PAGE_TO_MENU = {
    'roadmap_supabase_test.html':          '전체 수업',
    'Curriculum_full_supabase_test.html':  '학과별 자료',
    'Curriculum_onepage_supabase_test.html':'학과 커리큘럼',
    'seminar.html':                        '특강/세미나',
    'item_supabase_test.html':             '수업별 준비물',
    'vacation.html':                       '방학 특강'
  };
  // 메뉴 이름 → 페이지 파일명 (클릭 시 이동용)
  const MENU_TO_PAGE = {};
  Object.keys(PAGE_TO_MENU).forEach(function(p) {
    MENU_TO_PAGE[PAGE_TO_MENU[p]] = p;
  });

  function getCurrentPageFile() {
    const path = location.pathname || '';
    const trimmed = path.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    const file = idx >= 0 ? trimmed.substring(idx + 1) : trimmed;
    return file || 'index.html';
  }
  const currentPage = getCurrentPageFile();
  const currentMenuName = PAGE_TO_MENU[currentPage] || '';

  function injectCSS() {
    if (document.getElementById('comsw-footer-menu-css')) return;
    const css = ''
      + '#comsw-footer-menu {'
      + '  position: fixed;'
      + '  bottom: 4vh;'
      + '  left: 50%;'
      + '  transform: translateX(-50%);'
      + '  z-index: 9000;'
      + '  display: flex;'
      + '  flex-wrap: wrap;'
      + '  align-items: center;'
      + '  justify-content: center;'
      + '  gap: 12px;'
      + '  max-width: calc(100vw - 40px);'
      + '  pointer-events: none;'
      + '  font-family: \'Pretendard Variable\', \'Pretendard\', sans-serif;'
      + '}'
      + '#comsw-footer-menu .comsw-menu-item {'
      + '  background: #ffffff;'
      + '  color: #000;'
      + '  font-weight: 500;'
      + '  font-size: 14px;'
      + '  padding: 12px 20px;'
      + '  border-radius: 24px;'
      + '  cursor: pointer;'
      + '  white-space: nowrap;'
      + '  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);'
      + '  pointer-events: auto;'
      + '  user-select: none;'
      + '  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;'
      + '  letter-spacing: -0.01em;'
      + '}'
      + '#comsw-footer-menu .comsw-menu-item:hover {'
      + '  background: #f0f0f0;'
      + '  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);'
      + '  transform: translateY(-1px);'
      + '}'
      + '#comsw-footer-menu .comsw-menu-item.active {'
      + '  background: #fa491d;'
      + '  color: #ffffff;'
      + '  pointer-events: none;'
      + '  cursor: default;'
      + '}'
      + '#comsw-footer-menu .comsw-menu-item.active:hover {'
      + '  background: #fa491d;'
      + '  transform: none;'
      + '  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);'
      + '}';
    const style = document.createElement('style');
    style.id = 'comsw-footer-menu-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectContainer() {
    let div = document.getElementById('comsw-footer-menu');
    if (div) return div;
    div = document.createElement('div');
    div.id = 'comsw-footer-menu';
    document.body.appendChild(div);
    return div;
  }

  /** Supabase "메인 페이지" 시트에서 체크된 메뉴 목록 가져오기. */
  async function fetchMenus() {
    if (!window.ComswSupabase || !window.COMSW_SUPABASE_CONFIG) {
      throw new Error('ComswSupabase / config not loaded');
    }
    const cfg = window.COMSW_SUPABASE_CONFIG;
    const sheetName = (cfg.sheets && cfg.sheets.main) || '메인 페이지';
    const rows = await window.ComswSupabase.fetchSheetRows(sheetName);
    const list = [];
    rows.forEach(function(row) {
      const vals = window.ComswSupabase.getRawValues(row);
      const name = window.ComswSupabase.normalizeText(vals[4]);    // E열
      const checked = vals[5];                                      // F열
      const order = Number(vals[7]) || 999;                         // H열
      if (!name) return;
      if (!window.ComswSupabase.truthyCell(checked)) return;
      list.push({ name: name, order: order });
    });
    list.sort(function(a, b) { return a.order - b.order; });
    return list;
  }

  function renderMenus(container, menus) {
    container.innerHTML = '';
    menus.forEach(function(menu) {
      const item = document.createElement('div');
      item.className = 'comsw-menu-item';
      item.textContent = menu.name;
      if (menu.name === currentMenuName) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.addEventListener('click', function() {
          const target = MENU_TO_PAGE[menu.name];
          if (target) {
            location.href = './' + target;
          } else {
            // 미지원 메뉴는 메인으로 폴백 (예: 시트에 새 메뉴가 추가됐는데 페이지가 없을 때)
            location.href = './index.html';
          }
        });
      }
      container.appendChild(item);
    });
  }

  function start() {
    injectCSS();
    const container = injectContainer();
    fetchMenus()
      .then(function(menus) { renderMenus(container, menus); })
      .catch(function(err) {
        // 메뉴 fetch 실패해도 본문 동작은 영향 없음. 콘솔에만 경고.
        if (window.console) console.warn('[footer-menu]', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
