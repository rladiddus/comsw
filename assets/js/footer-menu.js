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
  const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const DOWNLOAD_ICON_SVG = '<svg viewBox="0 0 400 500" aria-hidden="true" focusable="false"><g><path d="M358.8,272.2v70.3c0,1.4-0.2,2.7-0.5,3.9v0c0,0,0,0,0,0c-1.4,6.9-7.5,12.1-14.7,12.1H56.3c-7.7,0-14.1-5.9-14.9-13.4c-0.2-0.9-0.2-1.7-0.2-2.7v-70.3c0-8.3,6.8-15,15-15c4.1,0,7.9,1.7,10.6,4.4c2.7,2.7,4.4,6.5,4.4,10.6v56.3h257.7v-56.3c0-8.3,6.8-15,15-15c4.1,0,7.9,1.7,10.6,4.4C357.1,264.3,358.8,268.1,358.8,272.2z"/><path d="M286.5,201.8l-73.7,73.7c-0.1,0.2-0.3,0.3-0.4,0.4c-2.7,2.7-6.2,4.4-9.7,4.9c-0.3,0-0.6,0.1-0.9,0.1c-0.6,0.1-1.2,0.1-1.8,0.1h0l-1.7-0.1c-0.3,0-0.6-0.1-0.9-0.1c-3.6-0.5-7-2.2-9.7-4.9c-0.1-0.1-0.3-0.3-0.4-0.4l-73.7-73.7c-3.4-3.4-5.1-7.9-5.1-12.4c0-4.5,1.7-9,5.1-12.4c6.8-6.8,17.9-6.8,24.8,0l44.3,44.3V59c0-9.6,7.9-17.5,17.5-17.5c4.8,0,9.2,2,12.4,5.1c3.2,3.2,5.1,7.5,5.1,12.4v162.3l44.3-44.3c6.8-6.8,17.9-6.8,24.8,0C293.3,183.9,293.3,195,286.5,201.8z"/></g></svg>';
  let html2canvasLoader = null;

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
      + '  border: 0;'
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
      + '}'
      + '#comsw-footer-menu .comsw-download-item {'
      + '  width: 48px;'
      + '  height: 44px;'
      + '  padding: 0;'
      + '  display: inline-flex;'
      + '  align-items: center;'
      + '  justify-content: center;'
      + '}'
      + '#comsw-footer-menu .comsw-download-item svg {'
      + '  width: 23px;'
      + '  height: 29px;'
      + '  display: block;'
      + '  fill: currentColor;'
      + '}'
      + '#comsw-footer-menu .comsw-download-item.is-busy {'
      + '  pointer-events: none;'
      + '  opacity: 0.68;'
      + '}'
      + '#comsw-footer-menu .comsw-download-label {'
      + '  position: absolute;'
      + '  width: 1px;'
      + '  height: 1px;'
      + '  padding: 0;'
      + '  margin: -1px;'
      + '  overflow: hidden;'
      + '  clip: rect(0, 0, 0, 0);'
      + '  white-space: nowrap;'
      + '  border: 0;'
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

  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (html2canvasLoader) return html2canvasLoader;

    html2canvasLoader = new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = HTML2CANVAS_URL;
      script.async = true;
      script.onload = function() {
        if (window.html2canvas) resolve(window.html2canvas);
        else reject(new Error('html2canvas not available'));
      };
      script.onerror = function() {
        reject(new Error('html2canvas load failed'));
      };
      document.head.appendChild(script);
    });

    return html2canvasLoader;
  }

  function waitForPageAssets() {
    const fontReady = document.fonts && document.fonts.ready
      ? document.fonts.ready.catch(function() {})
      : Promise.resolve();
    const imageReady = Promise.all(Array.prototype.slice.call(document.images || []).map(function(img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function(resolve) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
    const timeout = new Promise(function(resolve) { setTimeout(resolve, 1800); });
    return Promise.race([Promise.all([fontReady, imageReady]), timeout]);
  }

  function getCaptureFileName() {
    const raw = (document.title || currentPage || 'comsw-page')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0')
    ].join('');
    return (raw || 'comsw-page') + '-' + stamp + '.png';
  }

  function saveCanvas(canvas) {
    return new Promise(function(resolve, reject) {
      if (!canvas.toBlob) {
        try {
          const link = document.createElement('a');
          link.download = getCaptureFileName();
          link.href = canvas.toDataURL('image/png');
          link.click();
          resolve();
        } catch (err) {
          reject(err);
        }
        return;
      }

      canvas.toBlob(function(blob) {
        if (!blob) {
          reject(new Error('image export failed'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = getCaptureFileName();
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
        resolve();
      }, 'image/png');
    });
  }

  async function downloadFullPage(button) {
    if (!button || button.classList.contains('is-busy')) return;
    const originalTitle = button.getAttribute('title') || '이미지로 다운로드';
    button.classList.add('is-busy');
    button.setAttribute('title', '이미지 생성 중...');
    button.setAttribute('aria-busy', 'true');

    try {
      const html2canvas = await loadHtml2Canvas();
      await waitForPageAssets();

      const doc = document.documentElement;
      const body = document.body;
      const width = Math.max(
        doc.scrollWidth, body.scrollWidth,
        doc.offsetWidth, body.offsetWidth,
        doc.clientWidth
      );
      const height = Math.max(
        doc.scrollHeight, body.scrollHeight,
        doc.offsetHeight, body.offsetHeight,
        doc.clientHeight
      );
      const scale = Math.min(2, window.devicePixelRatio || 1.5);

      const canvas = await html2canvas(body, {
        backgroundColor: window.getComputedStyle(body).backgroundColor || '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: scale,
        x: 0,
        y: 0,
        width: width,
        height: height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
        ignoreElements: function(el) {
          return el && el.getAttribute && el.getAttribute('data-html2canvas-ignore') === 'true';
        }
      });

      await saveCanvas(canvas);
    } catch (err) {
      if (window.console) console.error('[footer-menu capture]', err);
      alert('이미지 다운로드에 실패했습니다. 외부 이미지 권한(CORS)이나 영상 요소 때문에 캡처가 제한됐을 수 있습니다.');
    } finally {
      button.classList.remove('is-busy');
      button.setAttribute('title', originalTitle);
      button.removeAttribute('aria-busy');
    }
  }

  function createDownloadButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'comsw-menu-item comsw-download-item';
    button.setAttribute('title', '현재 페이지 전체를 이미지로 다운로드');
    button.setAttribute('aria-label', '현재 페이지 전체를 이미지로 다운로드');
    button.setAttribute('data-html2canvas-ignore', 'true');
    button.innerHTML = DOWNLOAD_ICON_SVG + '<span class="comsw-download-label">이미지 다운로드</span>';
    button.addEventListener('click', function() {
      downloadFullPage(button);
    });
    return button;
  }

  function renderMenus(container, menus) {
    container.innerHTML = '';
    container.appendChild(createDownloadButton());
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
    renderMenus(container, []);
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
