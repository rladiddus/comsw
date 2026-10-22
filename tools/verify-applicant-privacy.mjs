import fs from 'node:fs';
import vm from 'node:vm';

const window={};
vm.runInNewContext(fs.readFileSync(new URL('../assets/js/supabase-config.js',import.meta.url),'utf8'),{window});
const {url,anonKey}=window.COMSW_SUPABASE_CONFIG;
async function query(params){
  const response=await fetch(`${url}/rest/v1/raw_sheet_rows?${params}`,{headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`,Prefer:'count=exact'}});
  if(!response.ok)throw new Error(`공개 읽기 확인 HTTP ${response.status}`);
  return await response.json();
}
const params=new URLSearchParams({select:'id',source_id:'eq.main',sheet_name:'in.(특강 신청,특강 신청자 명단)'});
const applicants=await query(params);
const keepAlive=await query(new URLSearchParams({select:'id',sheet_name:'not.in.(특강 신청,특강 신청자 명단)',limit:'1'}));
console.log(`익명 신청자 raw 조회: ${applicants.length}행`);
console.log(`매일 깨우기용 raw 1행 조회: ${keepAlive.length===1?'성공':'실패'}`);
if(applicants.length!==0||keepAlive.length!==1)process.exitCode=1;
