// 쌤톡(ssamtalk-sbs) 교육부 승인 회원 목록. 쌤톡 규칙상 승인 회원은 회원 목록을 읽을 수 있다. 읽기만 한다.
import { app } from "./firebase.mjs";

const firestore = () =>
  import("https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js");

async function me(uid) {
  const { getFirestore, doc, getDoc } = await firestore();
  return (await getDoc(doc(getFirestore(app), "users", uid))).data() || {};
}

// 본인 쌤톡 이름(회원 문서는 본인이 읽을 수 있다).
export async function loadMyName(uid) {
  const u = await me(uid);
  return u.name || u.displayName || "";
}

// 본인 쌤톡 학과. 쌤톡 규칙상 본인은 majors를 직접 고칠 수 있다(쌤톡 프로필 화면과 같은 방식).
export async function loadMyMajors(uid) {
  return [].concat((await me(uid)).majors || []).filter(Boolean);
}
export async function saveMyMajors(uid, majors) {
  const { getFirestore, doc, updateDoc } = await firestore();
  await updateDoc(doc(getFirestore(app), "users", uid), { majors });
}

export async function loadTeacherMembers() {
  const { getFirestore, collection, query, where, getDocs } = await firestore();
  const snap = await getDocs(query(
    collection(getFirestore(app), "users"),
    where("department", "==", "교육부"),
    where("approved", "==", true),
  ));
  return snap.docs.map((d) => {
    const u = d.data();
    return {
      uid: d.id,
      name: u.name || u.displayName || "",
      username: u.username || "",
      majors: [].concat(u.majors || []).filter(Boolean),
    };
  });
}
