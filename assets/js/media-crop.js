/*
 * 커리큘럼 이미지: 관리 화면에서 원본을 올리고 썸네일 영역을 '#crop=x,y,w,h'(원본 대비 0~1)로 주소 뒤에 남긴다.
 * - 썸네일 칸(.img-box, .img-box-mini, 학과 커리큘럼의 .onepage-img-box) 안의 이미지는 그 영역만 보이게 배치한다.
 * - 크게 보기(#lightbox-media-wrapper)는 원본을 가로 폭에 맞춰 보여 주고, 위아래(확대하면 좌우도) 끌어서 보며,
 *   확대·축소·원래 크기 버튼을 둔다(태블릿은 손가락으로 밀어서 이동).
 * '#crop'이 없는 예전 이미지는 썸네일은 그대로, 크게 보기는 원본 보기로 바뀐다.
 */
(function () {
  var RE = /#crop=([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/;
  var THUMBS = '.img-box, .img-box-mini, .onepage-img-box';
  var WRAPPER = 'lightbox-media-wrapper';

  function cropThumb(img) {
    var m = (img.getAttribute('src') || '').match(RE);
    if (!m || img.dataset.cropped || img.closest('#' + WRAPPER)) return;
    var box = img.closest(THUMBS);
    if (!box) return;
    var x = +m[1], y = +m[2], w = +m[3], h = +m[4];
    if (!(w > 0 && h > 0)) return;
    img.dataset.cropped = '1';
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var s = img.style;
    s.position = 'absolute';
    s.maxWidth = 'none';
    s.objectFit = 'fill';
    s.width = (100 / w) + '%';
    s.height = (100 / h) + '%';
    s.left = (-100 * x / w) + '%';
    s.top = (-100 * y / h) + '%';
    // 마우스를 올리면 커지는 효과의 중심을 썸네일 가운데로
    s.transformOrigin = ((x + w / 2) * 100) + '% ' + ((y + h / 2) * 100) + '%';
  }

  var ICONS = {
    in: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6"/></svg>',
    fit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'
  };

  function viewer(wrapper, img) {
    wrapper.classList.add('original-view');
    img.src = img.getAttribute('src').replace(RE, '');
    var stage = document.createElement('div');
    stage.className = 'zoom-stage';
    var inner = document.createElement('div');
    inner.className = 'zoom-inner';
    inner.appendChild(img);
    stage.appendChild(inner);
    var zoom = 1;
    function apply(center) {
      var before = { w: stage.scrollWidth, h: stage.scrollHeight };
      var cx = stage.scrollLeft + stage.clientWidth / 2, cy = stage.scrollTop + stage.clientHeight / 2;
      inner.style.width = (zoom * 100) + '%';
      if (center !== false && before.w && before.h) {
        // 보고 있던 곳을 가운데에 두고 확대·축소
        stage.scrollLeft = cx * stage.scrollWidth / before.w - stage.clientWidth / 2;
        stage.scrollTop = cy * stage.scrollHeight / before.h - stage.clientHeight / 2;
      }
    }
    function button(kind, label, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zoom-btn';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = ICONS[kind];
      b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
      return b;
    }
    var controls = document.createElement('div');
    controls.className = 'zoom-controls';
    controls.appendChild(button('in', '확대', function () { zoom = Math.min(4, zoom * 1.5); apply(); }));
    controls.appendChild(button('out', '축소', function () { zoom = Math.max(1, zoom / 1.5); apply(); }));
    controls.appendChild(button('fit', '원래 크기', function () { zoom = 1; apply(false); stage.scrollTop = 0; }));
    wrapper.appendChild(stage);
    wrapper.appendChild(controls);

    // 마우스로 끌어서 이동(손가락은 브라우저 기본 스크롤)
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { stage: stage, x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
      stage.classList.add('dragging');
      e.preventDefault();
    });
  }
  var drag = null;
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    drag.stage.scrollLeft = drag.left - (e.clientX - drag.x);
    drag.stage.scrollTop = drag.top - (e.clientY - drag.y);
  });
  window.addEventListener('pointerup', function () {
    if (drag) drag.stage.classList.remove('dragging');
    drag = null;
  });

  function watchLightbox() {
    var wrapper = document.getElementById(WRAPPER);
    if (!wrapper) return;
    new MutationObserver(function () {
      var img = wrapper.querySelector(':scope > img');
      if (img) viewer(wrapper, img);
      else if (!wrapper.querySelector('.zoom-stage')) wrapper.classList.remove('original-view');
    }).observe(wrapper, { childList: true });
  }

  function addStyle() {
    var css = document.createElement('style');
    css.textContent = [
      '#' + WRAPPER + '.original-view { display:block; overflow:hidden; }',
      '#' + WRAPPER + '.original-view .zoom-stage { position:absolute; inset:0; overflow:auto; display:flex; align-items:safe center; justify-content:safe center; cursor:grab; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }',
      '#' + WRAPPER + '.original-view .zoom-stage.dragging { cursor:grabbing; }',
      '#' + WRAPPER + '.original-view .zoom-inner { flex:none; width:100%; }',
      '#' + WRAPPER + '.original-view .zoom-inner img { display:block; width:100%; height:auto; object-fit:initial; user-select:none; -webkit-user-drag:none; }',
      '#' + WRAPPER + ' .zoom-controls { position:absolute; right:12px; bottom:12px; display:flex; gap:6px; z-index:2; }',
      '#' + WRAPPER + ' .zoom-btn { width:40px; height:40px; border:0; border-radius:50%; background:rgba(20,20,20,.62); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; backdrop-filter:blur(4px); }',
      '#' + WRAPPER + ' .zoom-btn:hover { background:rgba(20,20,20,.82); }',
      '#' + WRAPPER + ' .zoom-btn svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }'
    ].join('\n');
    document.head.appendChild(css);
  }

  function start() {
    addStyle();
    document.querySelectorAll(THUMBS).forEach(function (box) {
      box.querySelectorAll('img').forEach(cropThumb);
    });
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        r.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'IMG') cropThumb(n);
          else n.querySelectorAll && n.querySelectorAll('img').forEach(cropThumb);
        });
        if (r.type === 'attributes' && r.target.tagName === 'IMG') {
          // 다른 이미지로 바뀌면 배치를 지우고 다시 계산
          if (r.target.dataset.cropped) {
            ['position', 'maxWidth', 'objectFit', 'width', 'height', 'left', 'top', 'transformOrigin'].forEach(function (k) { r.target.style[k] = ''; });
            delete r.target.dataset.cropped;
          }
          cropThumb(r.target);
        }
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    watchLightbox();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
