// ============================================================
// admin.js — 관리자 페이지 기능
// ============================================================

// 관리자 인증 확인
auth.onAuthStateChanged(async (user) => {
  const container = document.getElementById('adminContainer');
  const denied = document.getElementById('accessDenied');

  if (!user || !isAdmin(user)) {
    container.style.display = 'none';
    denied.style.display = 'flex';
    return;
  }

  denied.style.display = 'none';
  container.style.display = 'block';

  // 데이터 로드
  loadUsers();
  loadDownloadStats();
  loadConfig();
  loadNotices();
  loadCSTickets();
});

// ────────────────────────────────────────
// 탭 전환
// ────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.admin-tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById('panel-' + tabName).classList.add('active');
}

// ────────────────────────────────────────
// 사용자 목록
// ────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  const countEl = document.getElementById('totalUsers');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(0,0,0,0.4);">로딩 중...</td></tr>';

  try {
    const snapshot = await db.collection('users').orderBy('loginAt', 'desc').get();
    countEl.textContent = snapshot.size;

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(0,0,0,0.4);">등록된 사용자가 없습니다.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    snapshot.forEach(doc => {
      const u = doc.data();
      const loginAt = u.loginAt ? u.loginAt.toDate().toLocaleString('ko-KR') : '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${u.photoURL || ''}" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:8px;">${u.name || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${loginAt}</td>
        <td>${u.downloadCount || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('사용자 로드 오류:', e);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#ff3b30;">데이터를 불러올 수 없습니다.</td></tr>';
  }
}

// ────────────────────────────────────────
// 다운로드 통계
// ────────────────────────────────────────
async function loadDownloadStats() {
  const totalEl = document.getElementById('totalDownloads');
  const macEl = document.getElementById('macDownloads');
  const winEl = document.getElementById('winDownloads');
  const chartEl = document.getElementById('downloadChart');

  try {
    const snapshot = await db.collection('downloads').orderBy('downloadedAt', 'desc').get();
    totalEl.textContent = snapshot.size;

    let macCount = 0;
    let winCount = 0;
    const dailyMap = {};

    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.platform === 'macOS') macCount++;
      else winCount++;

      if (d.downloadedAt) {
        const dateStr = d.downloadedAt.toDate().toISOString().slice(0, 10);
        dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
      }
    });

    macEl.textContent = macCount;
    winEl.textContent = winCount;

    // OS 비율 바
    const total = macCount + winCount;
    const macPct = total > 0 ? Math.round(macCount / total * 100) : 0;
    const winPct = total > 0 ? 100 - macPct : 0;
    document.getElementById('macBar').style.width = macPct + '%';
    document.getElementById('winBar').style.width = winPct + '%';
    document.getElementById('macPct').textContent = macPct + '%';
    document.getElementById('winPct').textContent = winPct + '%';

    // 일별 막대 차트 (최근 14일)
    renderDailyChart(dailyMap, chartEl);

  } catch (e) {
    console.error('다운로드 통계 오류:', e);
  }
}

function renderDailyChart(dailyMap, container) {
  const today = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const counts = days.map(d => dailyMap[d] || 0);
  const max = Math.max(...counts, 1);

  container.innerHTML = days.map((day, i) => {
    const h = Math.max(4, (counts[i] / max) * 120);
    const label = day.slice(5); // MM-DD
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;">
        <span style="font-size:11px;font-weight:700;color:var(--accent);">${counts[i]}</span>
        <div style="width:100%;max-width:28px;height:${h}px;background:linear-gradient(180deg,#ff8c00,#ff6b00);border-radius:4px;"></div>
        <span style="font-size:9px;color:rgba(0,0,0,0.35);white-space:nowrap;">${label}</span>
      </div>
    `;
  }).join('');
}

// ────────────────────────────────────────
// 설정 (다운로드 URL + 버전)
// ────────────────────────────────────────
async function loadConfig() {
  try {
    const doc = await db.collection('config').doc('app').get();
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('cfgMacURL').value = data.macDownloadURL || DEFAULT_DOWNLOAD_URLS.macOS;
      document.getElementById('cfgWinURL').value = data.winDownloadURL || DEFAULT_DOWNLOAD_URLS.windows;
      document.getElementById('cfgVersion').value = data.latestVersion || DEFAULT_VERSION;
      document.getElementById('cfgChangelog').value = data.changelog || '';
    }
  } catch (e) {
    console.error('설정 로드 오류:', e);
  }
}

async function saveConfig() {
  const btn = document.getElementById('saveConfigBtn');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    await db.collection('config').doc('app').set({
      macDownloadURL: document.getElementById('cfgMacURL').value,
      winDownloadURL: document.getElementById('cfgWinURL').value,
      latestVersion: document.getElementById('cfgVersion').value,
      changelog: document.getElementById('cfgChangelog').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    btn.textContent = '저장 완료!';
    setTimeout(() => { btn.disabled = false; btn.textContent = '설정 저장'; }, 1500);
  } catch (e) {
    console.error('설정 저장 오류:', e);
    alert('설정 저장에 실패했습니다.');
    btn.disabled = false;
    btn.textContent = '설정 저장';
  }
}

// ────────────────────────────────────────
// 공지사항 관리
// ────────────────────────────────────────
async function loadNotices() {
  const list = document.getElementById('noticeList');
  list.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.4);">로딩 중...</div>';

  try {
    const snapshot = await db.collection('notices').orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.4);">등록된 공지사항이 없습니다.</div>';
      return;
    }

    list.innerHTML = '';
    snapshot.forEach(doc => {
      const n = doc.data();
      const createdAt = n.createdAt ? n.createdAt.toDate().toLocaleString('ko-KR') : '-';
      const div = document.createElement('div');
      div.style.cssText = 'padding:16px;background:rgba(255,140,0,0.04);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;';
      div.innerHTML = `
        <div>
          <div style="font-weight:700;margin-bottom:4px;">${n.title || ''}</div>
          <div style="font-size:13px;color:rgba(0,0,0,0.5);white-space:pre-wrap;">${n.content || ''}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:6px;">${createdAt}${n.active ? ' · 활성' : ' · 비활성'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="toggleNotice('${doc.id}', ${!n.active})" style="padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;background:#fff;cursor:pointer;font-size:12px;">${n.active ? '비활성' : '활성'}</button>
          <button onclick="deleteNotice('${doc.id}')" style="padding:6px 12px;border:1px solid rgba(255,59,48,0.2);border-radius:8px;background:#fff;color:#ff3b30;cursor:pointer;font-size:12px;">삭제</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (e) {
    console.error('공지 로드 오류:', e);
    list.innerHTML = '<div style="text-align:center;padding:24px;color:#ff3b30;">데이터를 불러올 수 없습니다.</div>';
  }
}

async function addNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const content = document.getElementById('noticeContent').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }

  try {
    await db.collection('notices').add({
      title,
      content,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    loadNotices();
  } catch (e) {
    console.error('공지 추가 오류:', e);
    alert('공지 추가에 실패했습니다.');
  }
}

async function toggleNotice(id, active) {
  try {
    await db.collection('notices').doc(id).update({ active });
    loadNotices();
  } catch (e) {
    console.error('공지 상태 변경 오류:', e);
  }
}

async function deleteNotice(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  try {
    await db.collection('notices').doc(id).delete();
    loadNotices();
  } catch (e) {
    console.error('공지 삭제 오류:', e);
  }
}

// ────────────────────────────────────────
// CS 관리
// ────────────────────────────────────────

const CS_CATEGORY_LABELS = {
  bug: '버그 신고',
  feature: '기능 요청',
  question: '사용법 질문',
  billing: '결제/환불',
  other: '기타'
};

const CS_STATUS_LABELS = {
  open: '접수',
  in_progress: '처리중',
  resolved: '완료',
  on_hold: '보류'
};

let allCSTickets = [];
let currentCSFilter = 'all';
let currentCSTicketId = null;

async function loadCSTickets() {
  const listEl = document.getElementById('csTicketList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.4);">로딩 중...</div>';

  try {
    const snapshot = await db.collection('tickets').orderBy('createdAt', 'desc').get();

    allCSTickets = [];
    snapshot.forEach(doc => {
      allCSTickets.push({ id: doc.id, ...doc.data() });
    });

    updateCSStats();
    renderCSTickets();

  } catch (e) {
    console.error('CS 문의 로드 오류:', e);
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#ff3b30;">데이터를 불러올 수 없습니다.</div>';
  }
}

function updateCSStats() {
  const totalEl = document.getElementById('csTotalTickets');
  const openEl = document.getElementById('csOpenTickets');
  const avgEl = document.getElementById('csAvgTime');
  const categoryEl = document.getElementById('csCategoryStats');

  if (totalEl) totalEl.textContent = allCSTickets.length;

  // 미처리 (open + in_progress)
  const openCount = allCSTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  if (openEl) openEl.textContent = openCount;

  // 평균 처리시간 (resolved 건만)
  const resolvedTickets = allCSTickets.filter(t => t.status === 'resolved' && t.createdAt && t.updatedAt);
  if (resolvedTickets.length > 0) {
    let totalHours = 0;
    resolvedTickets.forEach(t => {
      const created = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      const updated = t.updatedAt.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt);
      totalHours += (updated - created) / (1000 * 60 * 60);
    });
    const avgHours = totalHours / resolvedTickets.length;
    if (avgEl) {
      if (avgHours < 1) avgEl.textContent = Math.round(avgHours * 60) + '분';
      else if (avgHours < 24) avgEl.textContent = Math.round(avgHours) + '시간';
      else avgEl.textContent = Math.round(avgHours / 24) + '일';
    }
  } else {
    if (avgEl) avgEl.textContent = '-';
  }

  // 카테고리별 비율
  if (categoryEl) {
    const catCounts = {};
    allCSTickets.forEach(t => {
      catCounts[t.category] = (catCounts[t.category] || 0) + 1;
    });
    categoryEl.innerHTML = Object.entries(CS_CATEGORY_LABELS).map(([key, label]) => {
      const count = catCounts[key] || 0;
      return `<div class="category-stat-item"><div class="count">${count}</div><div class="label">${label}</div></div>`;
    }).join('');
  }
}

function renderCSTickets() {
  const listEl = document.getElementById('csTicketList');
  if (!listEl) return;

  const filtered = currentCSFilter === 'all'
    ? allCSTickets
    : allCSTickets.filter(t => t.status === currentCSFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.4);">해당 문의가 없습니다.</div>';
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(t => {
    const createdAt = t.createdAt ? (t.createdAt.toDate ? t.createdAt.toDate().toLocaleString('ko-KR') : '') : '';
    const div = document.createElement('div');
    div.className = 'cs-ticket-card';
    div.onclick = () => openCSModal(t);
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <span class="badge badge-category">${CS_CATEGORY_LABELS[t.category] || t.category}</span>
        <span class="badge badge-${t.status}">${CS_STATUS_LABELS[t.status] || t.status}</span>
        <span style="font-size:15px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtmlAdmin(t.title)}</span>
      </div>
      <div style="font-size:13px;color:rgba(0,0,0,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtmlAdmin(t.content)}</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.35);margin-top:6px;">
        ${t.userEmail || ''} · ${createdAt}${t.replies && t.replies.length > 0 ? ' · 답변 ' + t.replies.length + '건' : ''}
      </div>
    `;
    listEl.appendChild(div);
  });
}

function filterCSTickets(filter) {
  currentCSFilter = filter;
  document.querySelectorAll('.cs-filter').forEach(b => b.classList.remove('active'));
  document.querySelector(`.cs-filter[data-filter="${filter}"]`).classList.add('active');
  renderCSTickets();
}

// ── CS 상세 모달 ──

function openCSModal(ticket) {
  currentCSTicketId = ticket.id;

  document.getElementById('csModalCategory').textContent = CS_CATEGORY_LABELS[ticket.category] || ticket.category;
  document.getElementById('csModalStatus').textContent = CS_STATUS_LABELS[ticket.status] || ticket.status;
  document.getElementById('csModalStatus').className = 'badge badge-' + ticket.status;
  document.getElementById('csModalDate').textContent = ticket.createdAt ? (ticket.createdAt.toDate ? ticket.createdAt.toDate().toLocaleString('ko-KR') : '') : '';
  document.getElementById('csModalTitle').textContent = ticket.title;
  document.getElementById('csModalEmail').textContent = ticket.userEmail || '';
  document.getElementById('csModalName').textContent = ticket.userName || '';
  document.getElementById('csModalContent').textContent = ticket.content;
  document.getElementById('csModalStatusSelect').value = ticket.status;

  // 스크린샷
  const ssEl = document.getElementById('csModalScreenshot');
  if (ticket.screenshot) {
    ssEl.src = ticket.screenshot;
    ssEl.style.display = 'block';
  } else {
    ssEl.style.display = 'none';
  }

  // 답변 목록
  renderCSReplies(ticket.replies || []);

  document.getElementById('csReplyText').value = '';
  document.getElementById('csModal').classList.add('active');
}

function closeCSModal() {
  document.getElementById('csModal').classList.remove('active');
  currentCSTicketId = null;
}

function renderCSReplies(replies) {
  const el = document.getElementById('csModalReplies');
  if (replies.length === 0) {
    el.innerHTML = '<div style="padding:12px;font-size:13px;color:rgba(0,0,0,0.35);">아직 답변이 없습니다.</div>';
    return;
  }
  el.innerHTML = replies.map(r => {
    const replyDate = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate().toLocaleString('ko-KR') : new Date(r.createdAt).toLocaleString('ko-KR')) : '';
    return `
      <div class="reply-item ${r.isAdmin ? 'reply-admin' : 'reply-user'}">
        <div style="font-size:11px;color:rgba(0,0,0,0.4);margin-bottom:4px;font-weight:600;">${r.isAdmin ? '관리자' : r.author || '사용자'} · ${replyDate}</div>
        <div style="white-space:pre-wrap;">${escapeHtmlAdmin(r.content)}</div>
      </div>
    `;
  }).join('');
}

async function saveTicketStatus() {
  if (!currentCSTicketId) return;
  const newStatus = document.getElementById('csModalStatusSelect').value;

  try {
    await db.collection('tickets').doc(currentCSTicketId).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 로컬 데이터 갱신
    const ticket = allCSTickets.find(t => t.id === currentCSTicketId);
    if (ticket) ticket.status = newStatus;

    document.getElementById('csModalStatus').textContent = CS_STATUS_LABELS[newStatus] || newStatus;
    document.getElementById('csModalStatus').className = 'badge badge-' + newStatus;

    updateCSStats();
    renderCSTickets();
  } catch (e) {
    console.error('상태 변경 오류:', e);
    alert('상태 변경에 실패했습니다.');
  }
}

async function submitAdminReply() {
  if (!currentCSTicketId) return;

  const text = document.getElementById('csReplyText').value.trim();
  if (!text) { alert('답변 내용을 입력해주세요.'); return; }

  try {
    const newReply = {
      author: '관리자',
      content: text,
      createdAt: new Date().toISOString(),
      isAdmin: true
    };

    await db.collection('tickets').doc(currentCSTicketId).update({
      replies: firebase.firestore.FieldValue.arrayUnion(newReply),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 로컬 데이터 갱신
    const ticket = allCSTickets.find(t => t.id === currentCSTicketId);
    if (ticket) {
      if (!ticket.replies) ticket.replies = [];
      ticket.replies.push(newReply);
      renderCSReplies(ticket.replies);
    }

    document.getElementById('csReplyText').value = '';
    renderCSTickets();
  } catch (e) {
    console.error('답변 등록 오류:', e);
    alert('답변 등록에 실패했습니다.');
  }
}

// ESC로 CS 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCSModal();
});

// 모달 외부 클릭으로 닫기
document.addEventListener('click', (e) => {
  const modal = document.getElementById('csModal');
  if (e.target === modal) closeCSModal();
});

function escapeHtmlAdmin(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
