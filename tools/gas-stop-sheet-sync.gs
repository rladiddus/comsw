/** 기존 Apps Script 프로젝트에 별도 파일로 넣는다. 먼저 previewSheetSyncCleanup 실행.
 *  출력된 정확한 동기화 함수 이름만 COMSW_SYNC_HANDLERS에 입력한 뒤 stopSheetSyncOnly 실행.
 *  세 시트의 각 bound script에서 반복. 매일 깨우기 트리거는 절대로 삭제하지 않는다.
 */
var COMSW_SYNC_HANDLERS = []; // 실제 트리거 목록에서 확인한 이름만 적는다.

function previewSheetSyncCleanup() {
  return ScriptApp.getProjectTriggers().map(function (trigger) {
    var handler = trigger.getHandlerFunction();
    var row = {handler:handler, type:String(trigger.getEventType()), preserve:handler==='keepSupabaseAlive'};
    console.log(JSON.stringify(row));
    return row;
  });
}

function stopSheetSyncOnly() {
  if (!COMSW_SYNC_HANDLERS.length) throw new Error('미리보기에서 확인한 동기화 함수 이름을 먼저 입력하세요.');
  if (COMSW_SYNC_HANDLERS.indexOf('keepSupabaseAlive') !== -1) throw new Error('매일 깨우기는 삭제할 수 없습니다.');
  var triggers = ScriptApp.getProjectTriggers();
  var aliveBefore = triggers.filter(function(t){return t.getHandlerFunction()==='keepSupabaseAlive';}).length;
  var removed = 0;
  triggers.forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler !== 'keepSupabaseAlive' && COMSW_SYNC_HANDLERS.indexOf(handler)!==-1) {
      ScriptApp.deleteTrigger(trigger); removed++;
    }
  });
  var aliveAfter = ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='keepSupabaseAlive';}).length;
  if (aliveAfter!==aliveBefore) throw new Error('매일 깨우기 트리거를 다시 확인하세요.');
  console.log('시트 자동 복사 트리거 '+removed+'개 중지. 매일 깨우기 '+aliveAfter+'개 유지.');
}
