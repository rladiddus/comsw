// 홈페이지 AI 챗봇(2026-11-25): 모든 페이지에 떠 있는 아이콘. 누르면 채팅창, 닫으면 다시 아이콘. 끌어서 어디로든 옮긴다.
// 대화·위치는 이 탭(sessionStorage)에만 둔다: 페이지를 옮겨 다녀도 이어지고, 브라우저를 닫으면 지워진다. 서버에는 저장하지 않는다.
// 페이지의 키보드·휠 동작(슬라이드 넘기기 등)보다 먼저 듣도록 <head>에서 불러온다.
(function() {
  if (window.top !== window.self || window.ComswChat) return; // 다른 화면 안에 끼워 넣은 페이지에는 띄우지 않음
  var KEY = 'comsw_chat';
  var ICON = new URL('../img/chat.webp', document.currentScript.src).href;
  var MAX_SAVED = 40;
  var DRAG = 6; // 이만큼 움직이기 전까지는 '누르기'
  var HELLO = '안녕하세요! 컴수원 수업을 안내해 드리는 AI입니다.\n배우고 싶은 것을 편하게 물어보세요.\n예) AI로 이미지를 만드는 수업을 알려줘';
  var FAIL = '지금은 답변을 받지 못했습니다. 잠시 뒤 다시 시도하거나 멘토님께 문의해주세요.';

  var state = { open: false, r: 24, b: /_tablet\./.test(location.pathname) ? 200 : 110, msgs: [] };
  try {
    var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.msgs)) {
      state.open = saved.open === true;
      if (isFinite(saved.r) && isFinite(saved.b)) { state.r = Number(saved.r); state.b = Number(saved.b); }
      state.msgs = saved.msgs.filter(function(m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      });
    }
  } catch (e) {}
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify({ open: state.open, r: state.r, b: state.b, msgs: state.msgs.slice(-MAX_SAVED) })); } catch (e) {}
  }

  var CSS = ':host{all:initial}'
    + '*{box-sizing:border-box;font-family:"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif}'
    + '[hidden]{display:none!important}'
    + '.icon,.win{position:fixed;z-index:9990}'
    + '.icon{width:68px;height:68px;padding:0;border:0;background:none;cursor:grab;touch-action:none;filter:drop-shadow(0 6px 14px rgba(40,40,90,.3));transition:transform .15s ease}'
    + '.icon:hover{transform:scale(1.06)}.icon:active{cursor:grabbing}'
    + '.icon img{width:100%;height:100%;display:block;pointer-events:none}'
    + '.win{width:min(380px,calc(100vw - 16px));height:min(580px,var(--vh,100vh));display:flex;flex-direction:column;background:#fff;color:#1b1b2b;border-radius:18px;overflow:hidden;box-shadow:0 14px 44px rgba(20,20,60,.32)}'
    + '.bar{flex:none;display:flex;align-items:center;gap:10px;padding:10px 10px 10px 14px;background:linear-gradient(90deg,#7c3aed,#2563eb);color:#fff;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}'
    + '.bar img{width:30px;height:30px;pointer-events:none}'
    + '.bar b{flex:1;font-size:16px;font-weight:700}'
    + '.x{width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:22px;line-height:1;cursor:pointer}'
    + '.x:hover{background:rgba(255,255,255,.32)}'
    + '.log{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px 14px;display:flex;flex-direction:column;gap:10px;background:#f4f5fb}'
    + '.msg{max-width:86%;padding:10px 13px;border-radius:14px;font-size:15px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;user-select:text;-webkit-user-select:text}'
    + '.assistant{align-self:flex-start;background:#fff;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.08)}'
    + '.user{align-self:flex-end;background:#5b3fe0;color:#fff;border-bottom-right-radius:4px}'
    + '.assistant a{color:#2451c7;text-decoration:underline;word-break:break-all}.user a{color:#fff}.wait{color:#5f6072}.err{background:#fff1f0;color:#a4241b}'
    + 'form{flex:none;display:flex;gap:8px;align-items:flex-end;padding:10px 12px 6px;background:#fff;border-top:1px solid #e4e5f0}'
    + 'textarea{flex:1;height:44px;max-height:110px;padding:10px 12px;border:1px solid #c9cbdd;border-radius:12px;font-size:16px;line-height:1.4;color:#1b1b2b;background:#fff;resize:none}'
    + '.send{flex:none;height:44px;padding:0 16px;border:0;border-radius:12px;background:#5b3fe0;color:#fff;font-size:15px;font-weight:700;cursor:pointer}'
    + '.send:disabled{background:#b9b6cf;cursor:default}'
    + '.tip{margin:0;padding:0 14px 10px;background:#fff;color:#5f6072;font-size:12px;line-height:1.4}'
    + ':focus-visible{outline:3px solid #2bb3ff;outline-offset:2px}';

  var host = document.createElement('div');
  host.id = 'comsw-chat';
  host.setAttribute('data-html2canvas-ignore', 'true'); // 페이지를 이미지로 저장할 때는 빼기
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + CSS + '</style>'
    + '<button type="button" class="icon" aria-label="AI 수업 상담 열기"><img alt="" draggable="false"></button>'
    + '<section class="win" role="dialog" aria-label="AI 수업 상담" hidden>'
    + '<div class="bar"><img alt="" draggable="false"><b>AI 수업 상담</b><button type="button" class="x" aria-label="채팅창 닫기">×</button></div>'
    + '<div class="log" role="log" aria-live="polite"></div>'
    + '<form><textarea rows="1" maxlength="500" placeholder="궁금한 수업을 물어보세요" aria-label="질문"></textarea><button type="submit" class="send">보내기</button></form>'
    + '<p class="tip">AI 답변은 틀릴 수 있습니다. 이름·연락처 같은 개인정보는 쓰지 마세요.</p>'
    + '</section>';
  var $ = function(s) { return root.querySelector(s); };
  var icon = $('.icon'), win = $('.win'), bar = $('.bar'), log = $('.log'), form = $('form'), input = $('textarea'), sendBtn = $('.send');
  root.querySelectorAll('img').forEach(function(img) { img.src = ICON; });

  // 자리: 화면 오른쪽 아래에서 떨어진 거리(r, b). 아이콘과 채팅창이 같은 모서리를 쓴다. 화면 밖으로는 안 나간다.
  function view() {
    var v = window.visualViewport;
    return v ? { w: v.width, h: v.height, x: v.offsetLeft, y: v.offsetTop } : { w: innerWidth, h: innerHeight, x: 0, y: 0 };
  }
  function put(el, left, top) {
    var v = view(), m = 8;
    left = Math.max(m, Math.min(left, v.w - el.offsetWidth - m));
    top = Math.max(m, Math.min(top, v.h - el.offsetHeight - m));
    el.style.left = v.x + left + 'px';
    el.style.top = v.y + top + 'px';
    return { r: v.w - left - el.offsetWidth, b: v.h - top - el.offsetHeight };
  }
  function place() {
    var v = view(), el = state.open ? win : icon;
    win.style.setProperty('--vh', (v.h - 16) + 'px');
    put(el, v.w - state.r - el.offsetWidth, v.h - state.b - el.offsetHeight);
  }
  function draggable(handle, el) {
    var from = null;
    handle.addEventListener('pointerdown', function(e) {
      if (e.button || e.target.closest('.x')) return;
      var box = el.getBoundingClientRect(), v = view();
      from = { id: e.pointerId, x: e.clientX, y: e.clientY, left: box.left - v.x, top: box.top - v.y, moved: false };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', function(e) {
      if (!from || e.pointerId !== from.id) return;
      var dx = e.clientX - from.x, dy = e.clientY - from.y;
      if (!from.moved && Math.abs(dx) + Math.abs(dy) < DRAG) return;
      from.moved = true;
      var at = put(el, from.left + dx, from.top + dy);
      state.r = at.r;
      state.b = at.b;
    });
    function end(e) {
      if (!from || e.pointerId !== from.id) return;
      handle._dragged = from.moved && e.type === 'pointerup';
      from = null;
      save();
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  draggable(icon, icon);
  draggable(bar, win);

  function show(open) {
    state.open = open;
    icon.hidden = open;
    win.hidden = !open;
    place();
    if (open) log.scrollTop = log.scrollHeight;
    save();
  }
  function close() { show(false); icon.focus(); }
  icon.addEventListener('click', function() {
    if (icon._dragged) { icon._dragged = false; return; } // 옮긴 것이지 누른 것이 아님
    show(true);
    input.focus();
  });
  $('.x').addEventListener('click', close);

  function bubble(role, text, extra) {
    var el = document.createElement('div');
    el.className = 'msg ' + role + (extra ? ' ' + extra : '');
    // 글자로만 넣는다(HTML로 읽지 않음). http(s) 주소만 새 창으로 열리는 링크로.
    text.split(/(https?:\/\/[^\s<>"'()\[\]가-힣]+)/).forEach(function(part, i) {
      if (i % 2 === 0) { el.append(part); return; }
      var a = document.createElement('a');
      a.href = a.textContent = part;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      el.append(a);
    });
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  bubble('assistant', HELLO);
  state.msgs.forEach(function(m) { bubble(m.role, m.content); });

  var busy = false;
  async function ask() {
    var text = input.value.trim();
    if (!text || busy) return;
    busy = sendBtn.disabled = true;
    input.value = '';
    bubble('user', text);
    var wait = bubble('assistant', '답변을 찾고 있습니다…', 'wait');
    var question = { role: 'user', content: text };
    try {
      var cfg = window.COMSW_SUPABASE_CONFIG;
      var res = await fetch(cfg.url.replace(/\/+$/, '') + '/functions/v1/comsw-chat', {
        method: 'POST',
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.msgs.slice(-7).concat(question) }),
        signal: AbortSignal.timeout(60000)
      });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok || !data.reply) throw { say: res.status === 429 || res.status === 503 ? data.error : '' };
      state.msgs.push(question, { role: 'assistant', content: data.reply });
      wait.remove();
      bubble('assistant', data.reply);
      save();
    } catch (e) {
      wait.remove();
      bubble('assistant', (e && e.say) || FAIL, 'err');
      if (!input.value) input.value = text; // 다시 보내기 쉽게
    }
    busy = sendBtn.disabled = false;
  }
  form.addEventListener('submit', function(e) { e.preventDefault(); ask(); });

  // 채팅창 안의 키보드·휠·손가락 동작이 페이지(슬라이드 넘기기, 팝업 닫기)로 새지 않게 맨 먼저 막는다.
  function inside(e) { return e.composedPath().indexOf(host) >= 0; }
  window.addEventListener('keydown', function(e) {
    if (!inside(e)) return;
    e.stopImmediatePropagation();
    if (e.isComposing || e.keyCode === 229) return; // 한글을 쓰는 중
    if (e.key === 'Escape' && state.open) { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && !e.shiftKey && e.composedPath()[0] === input) { e.preventDefault(); ask(); }
  }, true);
  ['keyup', 'keypress', 'wheel', 'touchstart', 'touchmove', 'touchend'].forEach(function(type) {
    window.addEventListener(type, function(e) { if (inside(e)) e.stopImmediatePropagation(); }, { capture: true, passive: true });
  });
  ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(function(type) {
    host.addEventListener(type, function(e) { e.stopPropagation(); });
  });

  function mount() {
    document.body.append(host);
    show(state.open);
    window.addEventListener('resize', place);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', place);
      window.visualViewport.addEventListener('scroll', place);
    }
  }
  window.ComswChat = { host: host };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
