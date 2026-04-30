// ============================================================
// auth.js — Google 로그인 / 로그아웃 / 상태 관리
// ============================================================

const authProvider = new firebase.auth.GoogleAuthProvider();
// 항상 계정 선택 화면 표시 (기본 프로필 자동 선택 방지)
authProvider.setCustomParameters({ prompt: 'select_account' });

// DOM 요소
function getAuthElements() {
  return {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userProfile: document.getElementById('userProfile'),
    userPhoto: document.getElementById('userPhoto'),
    userName: document.getElementById('userName'),
  };
}

// Google 로그인
async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(authProvider);
    const user = result.user;

    // Firestore에 사용자 정보 저장/갱신
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      photoURL: user.photoURL || '',
      loginAt: firebase.firestore.FieldValue.serverTimestamp(),
      downloadCount: firebase.firestore.FieldValue.increment(0)
    }, { merge: true });

  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('로그인 오류:', error);
      alert('로그인에 실패했습니다. 다시 시도해주세요.');
    }
  }
}

// 로그아웃
async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('로그아웃 오류:', error);
  }
}

// 로그아웃 (전역 함수)
async function logoutUser() {
  try { await auth.signOut(); } catch(e) { console.error('로그아웃 오류:', e); }
}

// UI 업데이트
function updateAuthUI(user) {
  const els = getAuthElements();
  if (!els.loginBtn) return;

  const adminLink = document.getElementById('adminLink');

  if (user) {
    els.loginBtn.style.display = 'none';
    els.userProfile.style.display = 'flex';
    els.userPhoto.src = user.photoURL || '';
    els.userPhoto.alt = user.displayName || '프로필';
    els.userName.textContent = user.displayName || user.email;
    if (els.logoutBtn) els.logoutBtn.style.display = 'inline-flex';
    // 관리자면 관리자 링크 표시
    if (adminLink) adminLink.style.display = isAdmin(user) ? 'inline-flex' : 'none';
  } else {
    els.loginBtn.style.display = 'inline-flex';
    els.userProfile.style.display = 'none';
    if (els.logoutBtn) els.logoutBtn.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';
  }
}

// 로그인 상태 감시
auth.onAuthStateChanged((user) => {
  updateAuthUI(user);
  if (user) saveAppToken(user);
});

// 관리자 여부 확인
function isAdmin(user) {
  return user && ADMIN_EMAILS.includes(user.email);
}

// 앱 연동용 토큰 저장 (로그인 시 Firestore에 토큰 저장 → 앱에서 조회)
async function saveAppToken(user) {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await db.collection('app_tokens').doc(user.uid).set({
      token,
      email: user.email,
      name: user.displayName || '',
      photoURL: user.photoURL || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch(e) { console.log('[Auth] 앱 토큰 저장 실패:', e); }
}
