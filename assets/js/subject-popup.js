/*
 * 과목 커리큘럼 팝업(2026-11-26): 로드맵에서 과목 블록을 누르면 학과 커리큘럼 페이지(Curriculum_onepage)의
 * 과목 팝업과 같은 모양(단계 카드 + 이미지, 이미지를 누르면 크게 보기)으로 그 과목의 공통 커리큘럼을 보여 준다.
 * 한 단계에 묶인 과목(예: 'AI포토샵' + 'AI일러스트', 'AI웹툰 1~6')은 과목마다 슬라이드를 이어 붙인다(점·휠·화살표로 넘김).
 *
 * window.ComswSubjectPopup.open({ deptName, engName, labels, index, rows })
 *   rows: '컴수원_전체수업' 시트의 값 배열들(B 학과, C 과목, D 단계, F 내용, H 이미지)
 *   labels: 그 학과 로드맵 블록 이름들(순서대로). 쉼표·줄바꿈으로 여러 과목, 'AI웹툰 1~6'처럼 합친 이름도 됨
 *   index: 누른 블록 번호 → 그 과목 화면부터 보이고, ‹ › 버튼·좌우 방향키·밀기(태블릿)로 학과 전체 과목을 오간다(2026-11-26)
 *   (예전처럼 label 하나만 줘도 된다)
 */
(function() {
  'use strict';
  if (window.ComswSubjectPopup) return;

  var CSS = ''
    + '#sp-popup{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.28);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s ease,visibility 0s linear .3s}'
    + '#sp-popup.visible{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .3s ease,visibility 0s linear 0s}'
    + '.sp-panel{position:absolute;top:50%;left:50%;width:min(1512px,90vw);height:min(851px,86vh);transform:translate(-50%,-50%) scale(.96);background:#f6f6f6;border-radius:8px;box-shadow:0 28px 90px rgba(0,0,0,.38);overflow:hidden;transition:transform .35s cubic-bezier(.4,0,.2,1)}'
    + '#sp-popup.visible .sp-panel{transform:translate(-50%,-50%) scale(1)}'
    + '.sp-view{position:absolute;top:5%;left:5%;right:5%;bottom:5%;overflow:hidden}'
    + '.sp-scale{position:absolute;transform-origin:top left;width:1920px;height:1080px}'
    + '.sp-slide{width:1920px;height:1080px;background:#f6f6f6;padding:60px 100px;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;position:absolute;top:0;left:0;opacity:0;pointer-events:none;transition:opacity .35s ease;color:#111;box-sizing:border-box}'
    + '.sp-slide.active{opacity:1;pointer-events:auto}'
    + '.sp-head{display:flex;justify-content:space-between;padding-bottom:16px;margin-bottom:100px}'
    + '.sp-head span{font-weight:900;font-size:28px;letter-spacing:.5px;color:#111;text-transform:uppercase}'
    + '.sp-body{display:grid;grid-template-columns:340px 1fr;gap:80px;align-items:start}'
    + '.sp-title-area{position:relative;padding-left:24px;display:flex;flex-direction:column;align-items:flex-start}'
    + '.sp-circle{width:110px;height:110px;background:#ff512f;border-radius:50%;position:absolute;left:0;top:0;z-index:1}'
    + '.sp-title,.sp-sub{font-weight:900;font-size:64px;line-height:1.15;color:#111;position:relative;z-index:2;white-space:nowrap;display:block;max-width:310px;overflow:hidden}'
    + '.sp-badge{font-size:28px;font-weight:700;color:#aaa;margin-top:10px;position:relative;z-index:2}'
    + '.sp-weeks{display:grid;grid-template-columns:repeat(4,1fr);gap:30px;width:100%}'
    + '.sp-weeks.cols-3{display:flex;justify-content:space-between;gap:30px}'
    + '.sp-weeks.cols-3 .sp-card{width:calc(25% - 22px);flex-shrink:0}'
    + '.sp-card{display:flex;flex-direction:column}'
    + '.sp-img{width:100%;aspect-ratio:269/391;background:#eaeaea;border-top-right-radius:30px;border-bottom-left-radius:30px;overflow:hidden;margin-bottom:20px;display:flex;justify-content:center;align-items:center;box-shadow:0 6px 15px rgba(0,0,0,.08);position:relative;cursor:pointer;transition:box-shadow .3s ease}'
    + '.sp-img:hover{box-shadow:0 10px 25px rgba(0,0,0,.15)}'
    + '.sp-img img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease;pointer-events:none}'
    + '.sp-img:hover img{transform:scale(1.1)}'
    + '.sp-noimg{font-size:16px;color:#aaa;font-weight:500;pointer-events:none}'
    + '.sp-label{font-size:26px;font-weight:800;margin-bottom:10px;color:#111}'
    + '.sp-line{width:100%;height:3px;background:#ff512f;border-radius:2px;margin-bottom:14px}'
    + '.sp-text{font-size:18px;color:#555;line-height:1.6;word-break:keep-all;font-weight:500;white-space:pre-line}'
    + '.sp-foot{padding-top:24px;margin-top:20px;font-size:20px;font-weight:300;color:#777;letter-spacing:.5px}'
    + '.sp-dots{position:absolute;bottom:3.5%;left:56.7%;transform:translateX(-50%);display:flex;gap:10px;z-index:20}'
    + '.sp-dot{width:8px;height:8px;border-radius:50%;background:rgba(0,0,0,.2);cursor:pointer;border:0;padding:0}'
    + '.sp-dot.active{background:#ff512f;transform:scale(1.3)}'
    + '.sp-close{position:absolute;right:18px;top:18px;z-index:30;width:48px;height:48px;border:none;border-radius:50%;background:#2a2a2a;color:#f6f6f6;font-size:22px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center}'
    + '.sp-close:hover{background:#444}'
    + '.sp-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:25;width:52px;height:52px;border:none;border-radius:50%;background:rgba(0,0,0,.08);color:#222;font-size:30px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}'
    + '.sp-nav:hover{background:rgba(0,0,0,.16)}'
    + '.sp-nav:disabled{opacity:.25;cursor:default}'
    + '.sp-nav.prev{left:14px}.sp-nav.next{right:14px}'
    + '.sp-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#999;font-size:20px}'
    + '#sp-lightbox{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.7);backdrop-filter:blur(50px);-webkit-backdrop-filter:blur(50px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s ease,visibility 0s linear .3s}'
    + '#sp-lightbox.visible{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .3s ease,visibility 0s linear 0s}'
    + '.sp-lb-content{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:80px}'
    + '.sp-lb-media{width:70vh;height:70vh;max-width:45vw;background:#2a2a2a;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
    + '.sp-lb-media img{width:100%;height:100%;object-fit:cover}'
    + '.sp-lb-media iframe{width:100%;height:100%;border:none}'
    + '.sp-lb-media .no-img{color:#aaa;font-size:18px}'
    + '.sp-lb-text{width:min(35vw,560px);flex-shrink:0;color:#fff}'
    + '.sp-lb-title{display:flex;align-items:baseline;gap:20px;font-size:36px;font-weight:700;letter-spacing:-.02em;margin-bottom:24px;padding-bottom:24px;border-bottom:3px solid #ff512f}'
    + '.sp-lb-body{font-size:22px;line-height:1.7;color:rgba(255,255,255,.9);word-break:keep-all;white-space:pre-line}'
    + '.sp-lb-nav{position:fixed;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1201;font-size:26px}'
    + '.sp-lb-nav:hover{background:rgba(255,255,255,.2)}'
    + '.sp-lb-nav:disabled{opacity:.3;cursor:not-allowed}'
    + '.sp-lb-nav.prev{left:40px}.sp-lb-nav.next{right:40px}';

  var popup, scaleBox, dotsBox, msgBox, lightbox, lbMedia, lbSubject, lbWeek, lbBody, lbPrev, lbNext;
  var slides = [], current = 0, weeks = [], lbIndex = -1;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function T(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function drive(url) {
    return window.ComswSupabase && window.ComswSupabase.convertDriveUrl ? window.ComswSupabase.convertDriveUrl(url) : url;
  }

  function mount() {
    if (popup) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    popup = document.createElement('div');
    popup.id = 'sp-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.innerHTML = '<div class="sp-panel"><div class="sp-view"><div class="sp-scale"></div><div class="sp-msg"></div></div>'
      + '<button type="button" class="sp-nav prev" aria-label="이전 과목 화면">‹</button><button type="button" class="sp-nav next" aria-label="다음 과목 화면">›</button>'
      + '<div class="sp-dots"></div><button type="button" class="sp-close" aria-label="닫기" title="닫기">×</button></div>';
    document.body.appendChild(popup);
    scaleBox = popup.querySelector('.sp-scale');
    dotsBox = popup.querySelector('.sp-dots');
    msgBox = popup.querySelector('.sp-msg');
    popup.querySelector('.sp-close').addEventListener('click', close);
    popup.querySelector('.sp-nav.prev').addEventListener('click', function() { go(current - 1); });
    popup.querySelector('.sp-nav.next').addEventListener('click', function() { go(current + 1); });
    // 태블릿: 좌우로 밀어서 넘기기
    var touchX = null;
    popup.addEventListener('touchstart', function(e) { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    popup.addEventListener('touchend', function(e) {
      if (touchX == null || lightbox.classList.contains('visible')) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
    popup.addEventListener('click', function(e) { if (e.target === popup) close(); });
    popup.addEventListener('wheel', function(e) {
      if (!popup.classList.contains('visible') || slides.length <= 1 || Math.abs(e.deltaY) < 20) return;
      e.preventDefault();
      go(current + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });

    lightbox = document.createElement('div');
    lightbox.id = 'sp-lightbox';
    lightbox.innerHTML = '<button type="button" class="sp-lb-nav prev" aria-label="이전 단계">‹</button>'
      + '<div class="sp-lb-content"><div class="sp-lb-media"></div><div class="sp-lb-text"><div class="sp-lb-title"><span class="sp-lb-subject"></span><span class="sp-lb-week"></span></div><div class="sp-lb-body"></div></div></div>'
      + '<button type="button" class="sp-lb-nav next" aria-label="다음 단계">›</button>';
    document.body.appendChild(lightbox);
    lbMedia = lightbox.querySelector('.sp-lb-media');
    lbSubject = lightbox.querySelector('.sp-lb-subject');
    lbWeek = lightbox.querySelector('.sp-lb-week');
    lbBody = lightbox.querySelector('.sp-lb-body');
    lbPrev = lightbox.querySelector('.prev');
    lbNext = lightbox.querySelector('.next');
    lbPrev.addEventListener('click', function(e) { e.stopPropagation(); showLightbox(lbIndex - 1); });
    lbNext.addEventListener('click', function(e) { e.stopPropagation(); showLightbox(lbIndex + 1); });
    lightbox.querySelector('.sp-lb-content').addEventListener('click', function(e) { e.stopPropagation(); });
    lightbox.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', function(e) {
      if (lightbox.classList.contains('visible')) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); showLightbox(lbIndex - 1); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); showLightbox(lbIndex + 1); }
        e.stopImmediatePropagation();
        return;
      }
      if (!popup.classList.contains('visible')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(current - 1); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(current + 1); }
      else return;
      e.stopImmediatePropagation();
    }, true);
    window.addEventListener('resize', fit);
  }

  // 학과의 과목별 단계(B열에 학과 이름(학과 뗀 것)이 들어 있는 줄만)
  function subjectsOf(deptName, rows) {
    var key = T(deptName).replace(/학과$/, '');
    var map = {}, order = [];
    rows.forEach(function(v) {
      var dept = T(v[1]), name = T(v[2]), title = T(v[3]);
      if (!dept || dept.indexOf(key) < 0 || !name || !title) return;
      if (!map[name]) { map[name] = { name: name, weeks: [] }; order.push(name); }
      var img = T(v[7]);
      map[name].weeks.push({ title: title, content: String(v[5] == null ? '' : v[5]).trim(), img: img ? drive(img) : '' });
    });
    return order.map(function(n) { return map[n]; });
  }

  // 블록 이름 → 과목들. 'AI웹툰 1~6'·'캐드 1~2'처럼 합친 이름은 끝 숫자(또는 범위)가 그 안에 드는 과목으로 펼친다.
  function resolve(label, subjects) {
    var out = [];
    function add(s) { if (s && out.indexOf(s) < 0) out.push(s); }
    String(label || '').split(/[,\n\r/]+/).map(T).filter(Boolean).forEach(function(part) {
      var exact = subjects.filter(function(s) { return s.name === part || s.name.replace(/\s+/g, '') === part.replace(/\s+/g, ''); });
      if (exact.length) { exact.forEach(add); return; }
      var m = part.match(/^(.*?)\s*(\d+)\s*~\s*(\d+)$/);
      if (!m) return;
      var base = m[1].replace(/\s+/g, ''), lo = +m[2], hi = +m[3];
      subjects.map(function(s) {
        var n = s.name.match(/^(.*?)\s*(\d+)(?:\s*~\s*(\d+))?$/);
        return n && n[1].replace(/\s+/g, '') === base ? { s: s, a: +n[2], b: +(n[3] || n[2]) } : null;
      }).filter(function(x) { return x && x.a >= lo && x.b <= hi; })
        .sort(function(x, y) { return x.a - y.a; })
        .forEach(function(x) { add(x.s); });
    });
    return out;
  }

  function slideFor(engName, subject, chunk, badge, weekOffset) {
    var el = document.createElement('div');
    el.className = 'sp-slide';
    el.innerHTML = '<div class="sp-head"><span>' + esc(engName) + '</span><span>CURRICULUM</span></div>'
      + '<div class="sp-body"><div class="sp-title-area"><div class="sp-circle"></div>'
      + '<span class="sp-title">' + esc(subject.name) + '</span><span class="sp-sub">커리큘럼</span>'
      + (badge ? '<span class="sp-badge">' + esc(badge) + '</span>' : '') + '</div>'
      + '<div class="sp-weeks' + (chunk.length === 3 ? ' cols-3' : '') + '">'
      + chunk.map(function(w, i) {
        var media = w.img
          ? '<img src="' + esc(w.img) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';"><span class="sp-noimg" style="display:none">참고 이미지 없음</span>'
          : '<span class="sp-noimg">참고 이미지 없음</span>';
        return '<div class="sp-card"><div class="sp-img" data-i="' + (weekOffset + i) + '" role="button" tabindex="0" aria-label="' + esc(subject.name + ' ' + w.title + ' 크게 보기') + '">' + media + '</div>'
          + '<div class="sp-label">' + esc(w.title) + '</div><div class="sp-line"></div><div class="sp-text">' + esc(w.content) + '</div></div>';
      }).join('')
      + '</div></div><div class="sp-foot">SBS ACADEMY AIX SUWON</div>';
    el.querySelectorAll('.sp-img').forEach(function(box) {
      box.addEventListener('click', function() { showLightbox(+box.dataset.i); });
      box.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showLightbox(+box.dataset.i); } });
    });
    var title = el.querySelector('.sp-title');
    setTimeout(function() {
      var size = 64;
      while (title.scrollWidth > 310 && size > 20) { size -= 2; title.style.fontSize = size + 'px'; }
    }, 0);
    return el;
  }

  function build(engName, list) {
    slides = [];
    weeks = [];
    var firstSlide = {};
    list.forEach(function(s) {
      var start = weeks.length;
      firstSlide[s.name] = slides.length;
      s.weeks.forEach(function(w) { weeks.push({ subject: s.name, week: w }); });
      if (s.weeks.length <= 4) { slides.push(slideFor(engName, s, s.weeks, '', start)); return; }
      var chunks = [];
      for (var i = 0; i < s.weeks.length; i += 3) chunks.push(s.weeks.slice(i, i + 3));
      chunks.forEach(function(c, i) { slides.push(slideFor(engName, s, c, (i + 1) + ' / ' + chunks.length, start + i * 3)); });
    });
    scaleBox.innerHTML = '';
    slides.forEach(function(el) { scaleBox.appendChild(el); });
    current = 0;
    if (slides[0]) slides[0].classList.add('active');
    dotsBox.innerHTML = '';
    if (slides.length > 1) slides.forEach(function(_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'sp-dot';
      d.setAttribute('aria-label', (i + 1) + '번째 화면');
      d.addEventListener('click', function() { go(i); });
      dotsBox.appendChild(d);
    });
    paintDots();
    fit();
    return firstSlide;
  }
  function paintDots() {
    [].forEach.call(dotsBox.children, function(d, i) { d.classList.toggle('active', i === current); });
    popup.querySelector('.sp-nav.prev').disabled = current <= 0;
    popup.querySelector('.sp-nav.next').disabled = current >= slides.length - 1;
    popup.querySelectorAll('.sp-nav').forEach(function(b) { b.hidden = slides.length <= 1; });
  }
  function go(i) {
    if (i < 0 || i >= slides.length || i === current) return;
    slides[current].classList.remove('active');
    current = i;
    slides[current].classList.add('active');
    paintDots();
  }
  function fit() {
    if (!popup) return;
    var view = popup.querySelector('.sp-view');
    var s = Math.min(view.clientWidth / 1920, view.clientHeight / 1080) || 1;
    scaleBox.style.transform = 'scale(' + s + ')';
    scaleBox.style.left = ((view.clientWidth - 1920 * s) / 2) + 'px';
    scaleBox.style.top = ((view.clientHeight - 1080 * s) / 2) + 'px';
  }

  function youtubeId(url) {
    var m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return m ? m[1] : null;
  }
  function showLightbox(i) {
    if (i < 0 || i >= weeks.length) return;
    lbIndex = i;
    var it = weeks[i], url = it.week.img, yt = youtubeId(url);
    lbMedia.innerHTML = '';
    if (yt) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube.com/embed/' + yt + '?autoplay=1&mute=1&loop=1&playlist=' + yt + '&controls=1&playsinline=1&rel=0&modestbranding=1';
      f.allow = 'autoplay; encrypted-media';
      f.allowFullscreen = true;
      lbMedia.appendChild(f);
    } else if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.onerror = function() { lbMedia.innerHTML = '<span class="no-img">참고 이미지 없음</span>'; };
      lbMedia.appendChild(img);
    } else {
      lbMedia.innerHTML = '<span class="no-img">참고 이미지 없음</span>';
    }
    lbSubject.textContent = it.subject;
    lbWeek.textContent = it.week.title;
    lbBody.textContent = it.week.content || '';
    lbPrev.disabled = i === 0;
    lbNext.disabled = i >= weeks.length - 1;
    lightbox.classList.add('visible');
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('visible');
    lbMedia.innerHTML = '';
    lbIndex = -1;
  }
  function close() {
    if (!popup) return;
    popup.classList.remove('visible');
    closeLightbox();
  }

  function message(text) {
    scaleBox.innerHTML = '';
    dotsBox.innerHTML = '';
    slides = [];
    msgBox.textContent = text;
    msgBox.style.display = 'block';
  }

  window.ComswSubjectPopup = {
    resolve: resolve,
    subjectsOf: subjectsOf,
    loading: function() {
      mount();
      message('커리큘럼을 불러오는 중...');
      popup.classList.add('visible');
    },
    open: function(opts) {
      mount();
      var all = subjectsOf(opts.deptName, opts.rows || []);
      var labels = opts.labels || [opts.label];
      var index = opts.labels ? (opts.index || 0) : 0;
      var list = [];
      labels.forEach(function(l) { resolve(l, all).forEach(function(s) { if (list.indexOf(s) < 0) list.push(s); }); });
      var picked = resolve(labels[index], all);
      popup.classList.add('visible');
      if (!picked.length) { message('해당 과목의 상세 커리큘럼이 없습니다.'); return; }
      msgBox.style.display = 'none';
      var firstSlide = build(opts.engName || '', list);
      go(firstSlide[picked[0].name] || 0); // 누른 과목 화면부터
      popup.querySelector('.sp-close').focus();
    },
    error: function(text) { mount(); message(text); popup.classList.add('visible'); },
    close: close
  };
})();
