// 매뉴얼 공통: 장(상황) 바꾸기, 모바일 목차 시트, 이전/다음, 화면 사진 크게 보기.
(function () {
  var views = Array.prototype.slice.call(document.querySelectorAll('[data-view-panel]'));
  var buttons = Array.prototype.slice.call(document.querySelectorAll('nav.toc button[data-view]'));
  var order = buttons.map(function (b) { return b.dataset.view; });
  var titleOf = {};
  buttons.forEach(function (b) { titleOf[b.dataset.view] = b.textContent.trim(); });

  var toc = document.querySelector('nav.toc');
  var backdrop = document.querySelector('.sheet-backdrop');
  var appTitle = document.querySelector('.appbar-title b');
  var menuBtn = document.querySelector('.appbar button');
  function sheet(open) {
    toc.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      var current = toc.querySelector('[aria-current="true"]');
      if (current) current.focus();
    }
  }
  menuBtn.addEventListener('click', function () { sheet(!toc.classList.contains('open')); });
  backdrop.addEventListener('click', function () { sheet(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sheet(false); });

  // 이전/다음
  var pager = document.createElement('nav');
  pager.className = 'pager';
  pager.setAttribute('aria-label', '이전·다음 장');
  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'prev';
  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'next';
  pager.append(prev, next);
  document.querySelector('main').append(pager);
  function label(btn, dir, name) {
    btn.hidden = !name;
    if (!name) return;
    btn.dataset.go = name;
    btn.innerHTML = '';
    var s = document.createElement('small');
    s.textContent = dir;
    var t = document.createElement('span');
    t.textContent = titleOf[name];
    btn.append(s, t);
  }
  [prev, next].forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.go, true); }); });

  function show(name, scroll) {
    if (order.indexOf(name) < 0) name = order[0];
    views.forEach(function (v) { v.hidden = v.dataset.viewPanel !== name; });
    buttons.forEach(function (b) { b.setAttribute('aria-current', String(b.dataset.view === name)); });
    if (appTitle) appTitle.textContent = titleOf[name];
    var i = order.indexOf(name);
    label(prev, '← 이전', order[i - 1]);
    label(next, '다음 →', order[i + 1]);
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
    if (scroll) window.scrollTo({ top: 0 });
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      show(b.dataset.view, true);
      sheet(false);
    });
  });
  show((location.hash || '').slice(1), false);

  // 화면 사진 크게 보기(모바일은 화면 가득, 손가락으로 확대)
  var zoom = document.getElementById('zoom');
  var zoomImg = zoom.querySelector('img');
  document.addEventListener('click', function (e) {
    var shot = e.target.closest('.shot');
    if (shot) {
      var img = shot.querySelector('img');
      zoomImg.src = img.src;
      zoomImg.alt = img.alt;
      if (zoom.showModal) zoom.showModal(); else zoom.setAttribute('open', '');
    } else if (e.target.closest('#zoom')) {
      if (zoom.close) zoom.close(); else zoom.removeAttribute('open');
    }
  });
})();
