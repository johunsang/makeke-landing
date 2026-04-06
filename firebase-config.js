// ============================================================
// Firebase 설정 — 실제 프로젝트 값으로 교체하세요
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCI4Fd70_zqXcrC7FCz1p01EvPtgllIfhI",
  authDomain: "makeke-landing.firebaseapp.com",
  projectId: "makeke-landing",
  storageBucket: "makeke-landing.firebasestorage.app",
  messagingSenderId: "224070668376",
  appId: "1:224070668376:web:0569782636f0e93d0b7a2d"
};

// 관리자 이메일 목록
const ADMIN_EMAILS = [
  "johunsang@gmail.com"
];

// 다운로드 URL 기본값 — GitHub Releases (public repo)
const RELEASES_BASE = "https://github.com/johunsang/makeke-releases/releases/download";

const DEFAULT_DOWNLOAD_URLS = {
  macOS: `${RELEASES_BASE}/v1.1.13/Makeke-mac-v1.1.13.zip`,
  "macOS-intel": `${RELEASES_BASE}/v1.1.13/Makeke-mac-intel-v1.1.13.zip`,
  windows: `${RELEASES_BASE}/v1.1.13/Makeke-win-v1.1.13.exe`
};

// 현재 버전 기본값 (Firestore config 컬렉션에 저장된 값이 우선)
const DEFAULT_VERSION = "1.1.32";

// ============================================================
// Firebase 초기화
// ============================================================
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
