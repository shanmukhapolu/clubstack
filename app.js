import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_') && !!firebaseConfig.projectId && !firebaseConfig.projectId.startsWith('YOUR_');
let auth = null;
let db = null;
let user = null;
let userProfile = null;
let isSignup = false;
let pendingSignupProfile = null;
let clubs = [];
let joinedIds = new Set();
let selectedCategory = 'All';
let activeView = 'discover';
let selectedClub = null;
let toastTimer = null;

const demoClubs = [
  { id: 'demo-bio', name: 'BioBuzz', category: 'STEM', description: 'Explore biology, engineering, and practical science through team projects.', meetingInfo: 'Thursdays after school', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-deca', name: 'DECA', category: 'Academic', description: 'Practice business, marketing, and entrepreneurship through case studies and competitions.', meetingInfo: 'Wednesdays · Room 110', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-art', name: 'Art Collective', category: 'Arts', description: 'Make things, try new mediums, share work, and learn from other creative people.', meetingInfo: 'Mondays after school', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-sewa', name: 'SEWA Service Club', category: 'Service', description: 'Organize local volunteering, donation drives, and community projects.', meetingInfo: 'Twice a month', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-robotics', name: 'Robotics', category: 'STEM', description: 'Design, build, and program robots with a team that learns by doing.', meetingInfo: 'Tuesdays and Thursdays', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-mun', name: 'Model United Nations', category: 'Academic', description: 'Debate global issues, negotiate resolutions, and practice public speaking.', meetingInfo: 'Fridays · Room 204', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-photo', name: 'Photography Club', category: 'Arts', description: 'Practice photography and document familiar places from new perspectives.', meetingInfo: 'First Tuesday each month', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-cricket', name: 'Cricket Club', category: 'Recreation', description: 'Learn the game and play with students of every experience level.', meetingInfo: 'Fridays, weather permitting', status: 'approved', leaderIds: [], demo: true },
  { id: 'demo-med', name: 'Future Health Professionals', category: 'Academic', description: 'Explore healthcare careers through hands-on learning and peer-led preparation.', meetingInfo: 'Every other Wednesday', status: 'approved', leaderIds: [], demo: true }
];

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3000);
}
function refreshIcons(root = document) {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root, attrs: { 'stroke-width': 1.8 } });
  }
}
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function initials(name = '?') {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';
}
function categoryName(category) {
  return ({ Arts: 'Arts & culture', Recreation: 'Recreation', Other: 'Other' })[category] || category || 'Other';
}
function asDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateLabel(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = asDate(value);
  return date ? date.toLocaleDateString(undefined, options) : 'Date to be announced';
}
function dateParts(value) {
  const date = asDate(value);
  return date ? { day: String(date.getDate()), month: date.toLocaleDateString(undefined, { month: 'short' }) } : { day: '—', month: 'TBD' };
}
function timeLabel(value) {
  const date = asDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}
function isAdmin() {
  return userProfile?.role === 'admin' && userProfile?.suspended !== true;
}
function isLeader() {
  return userProfile?.role === 'leader' && userProfile?.suspended !== true;
}
function canCreateClub() {
  return !!user && (isAdmin() || isLeader());
}
function canManage(club) {
  return !!user && (isAdmin() || (club?.leaderIds || []).includes(user.uid) || club?.createdBy === user.uid);
}
function getClub(id) {
  return clubs.find((club) => club.id === id) || demoClubs.find((club) => club.id === id) || null;
}
function renderEmpty(title, body, action = '', actionLabel = '') {
  return '<div class="empty-panel"><strong>' + escapeHTML(title) + '</strong><p>' + escapeHTML(body) + '</p>' +
    (action ? '<button class="button button-secondary" data-empty-action="' + escapeHTML(action) + '">' + escapeHTML(actionLabel || 'Continue') + '</button>' : '') +
    '</div>';
}
function showView(view) {
  if (view === 'manage' && !canCreateClub()) view = 'discover';
  if (view === 'admin' && !isAdmin()) view = 'discover';
  activeView = view;
  $$('.view').forEach((node) => node.classList.toggle('active', node.id === 'view-' + view));
  $$('.nav-item[data-view]').forEach((node) => node.classList.toggle('active', node.dataset.view === view));
  const titles = { discover: 'Discover clubs', 'my-clubs': 'My clubs', calendar: 'Events', manage: 'Club workspace', admin: 'Admin tools' };
  $('#breadcrumb-current').textContent = titles[view] || 'Discover clubs';
  $('#sidebar').classList.remove('open');
  if (view === 'discover') renderClubs();
  if (view === 'my-clubs') renderMyClubs();
  if (view === 'calendar') renderCalendar();
  if (view === 'manage') renderManage();
  if (view === 'admin') renderAdmin();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateAccountUI() {
  const mini = $('#user-mini');
  const role = userProfile?.role || 'student';
  const name = userProfile?.name || user?.displayName || user?.email || 'Guest';
  $('#manage-nav').classList.toggle('hidden', !canCreateClub());
  $('#admin-nav').classList.toggle('hidden', !isAdmin());
  $('#manage-label').classList.toggle('hidden', !canCreateClub() && !isAdmin());
  $('#create-club-top').classList.toggle('hidden', !canCreateClub());
  $('#role-pill').classList.toggle('hidden', !user);
  $('#role-pill').textContent = user ? ({ admin: 'Admin', leader: 'Club leader', student: 'Student' }[role] || 'Student') : '';
  $('#account-action').textContent = user ? 'Sign out' : 'Sign in';
  if (user) {
    mini.innerHTML = '<div class="avatar">' + escapeHTML(initials(name)) + '</div><div class="user-copy"><strong>' + escapeHTML(name) + '</strong><span>' + escapeHTML(user.email || '') + '</span></div><button class="icon-button" id="sign-out-side" aria-label="Sign out"><i data-lucide="log-out"></i></button>';
    $('#sign-out-side').addEventListener('click', () => signOut(auth));
  } else {
    mini.innerHTML = '<div class="avatar">?</div><div class="user-copy"><strong>Guest</strong><span>Browse the directory</span></div><button class="icon-button" id="sign-in-side" aria-label="Sign in"><i data-lucide="log-in"></i></button>';
    $('#sign-in-side').addEventListener('click', openAuth);
  }
  refreshIcons(mini);
  if (isAdmin()) {
    const pending = clubs.filter((club) => club.status === 'pending').length;
    $('#pending-count').textContent = String(pending);
    $('#pending-count').classList.toggle('hidden', pending === 0);
  } else {
    $('#pending-count').classList.add('hidden');
  }
}
function clubCard(club) {
  const joined = joinedIds.has(club.id);
  return '<article class="club-card" data-open-club="' + escapeHTML(club.id) + '" tabindex="0" role="button" aria-label="Open ' + escapeHTML(club.name) + '">' +
    '<div class="club-card-top"><span class="club-glyph">' + escapeHTML(initials(club.name).slice(0, 2)) + '</span><span class="category-label">' + escapeHTML(categoryName(club.category)) + '</span>' +
    (canManage(club) && club.status === 'pending' ? '<span class="status-pill">Pending</span>' : '') + '</div>' +
    '<h3>' + escapeHTML(club.name) + '</h3><p class="club-description">' + escapeHTML(club.description || 'Club details coming soon.') + '</p>' +
    '<div class="card-bottom"><span class="meeting-line"><i data-lucide="calendar-clock"></i>' + escapeHTML(club.meetingInfo || 'Meeting details not set') + '</span>' +
    '<button class="join-mini ' + (joined ? 'joined' : '') + '" data-card-join="' + escapeHTML(club.id) + '">' + (joined ? '<i data-lucide="check"></i> Joined' : '<i data-lucide="plus"></i> Join') + '</button></div></article>';
}
function renderClubs() {
  const input = $('#search-input');
  if (!input) return;
  const term = input.value.trim().toLowerCase();
  const visible = clubs.filter((club) => club.status === 'approved' &&
    (selectedCategory === 'All' || club.category === selectedCategory) &&
    (!term || [club.name, club.description, club.category, club.meetingInfo || ''].join(' ').toLowerCase().includes(term)));
  $('#club-grid').innerHTML = visible.length ? visible.map(clubCard).join('') : '';
  $('#club-grid').classList.toggle('hidden', !visible.length);
  $('#empty-state').classList.toggle('hidden', !!visible.length);
  $('#result-count').textContent = visible.length + (visible.length === 1 ? ' club' : ' clubs');
  $('#club-count').textContent = String(clubs.filter((club) => club.status === 'approved').length);
  refreshIcons($('#club-grid'));
}
async function syncData() {
  if (!configured || !db) {
    clubs = demoClubs;
    joinedIds = new Set(JSON.parse(localStorage.getItem('clubstack-demo-joined') || '[]'));
    renderClubs();
    updateAccountUI();
    return;
  }
  try {
    let loaded = [];
    if (isAdmin()) {
      const snap = await getDocs(collection(db, 'clubs'));
      loaded = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    } else {
      const approved = await getDocs(query(collection(db, 'clubs'), where('status', '==', 'approved')));
      loaded = approved.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (user && !isAdmin() && isLeader()) {
        const [owned, assigned] = await Promise.all([
          getDocs(query(collection(db, 'clubs'), where('createdBy', '==', user.uid))),
          getDocs(query(collection(db, 'clubs'), where('leaderIds', 'array-contains', user.uid)))
        ]);
        const byId = new Map(loaded.map((club) => [club.id, club]));
        [...owned.docs, ...assigned.docs].forEach((item) => byId.set(item.id, { id: item.id, ...item.data() }));
        loaded = [...byId.values()];
      }
    }
    clubs = loaded;
    if (user) {
      const memberships = await getDocs(query(collection(db, 'memberships'), where('userId', '==', user.uid)));
      joinedIds = new Set(memberships.docs.map((item) => item.data().clubId));
    } else {
      joinedIds = new Set();
    }
    renderClubs();
    updateAccountUI();
  } catch (error) {
    console.error(error);
    toast('Could not load club data. Check Firestore rules.');
    clubs = [];
    renderClubs();
  }
}
async function getClubPosts(clubId) {
  if (!configured || !db) return { posts: [], events: [] };
  const [postSnap, eventSnap] = await Promise.all([
    getDocs(query(collection(db, 'clubs', clubId, 'announcements'), orderBy('createdAt', 'desc'), limit(8))),
    getDocs(query(collection(db, 'clubs', clubId, 'events'), orderBy('date', 'asc'), limit(8)))
  ]);
  return {
    posts: postSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    events: eventSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
  };
}
function eventRow(event, clubName = '') {
  const parts = dateParts(event.date);
  return '<div class="event-row"><div class="event-date"><strong>' + escapeHTML(parts.day) + '</strong><span>' + escapeHTML(parts.month) + '</span></div>' +
    '<div class="event-copy"><h4>' + escapeHTML(event.title || 'Club meeting') + '</h4><p>' + escapeHTML(clubName ? clubName + ' · ' : '') + escapeHTML(timeLabel(event.date)) + (event.location ? ' · ' + escapeHTML(event.location) : '') + '</p>' +
    (event.description ? '<p>' + escapeHTML(event.description) + '</p>' : '') + '</div></div>';
}
async function openClub(id) {
  const club = getClub(id);
  if (!club) return;
  selectedClub = club;
  let posts = [];
  let events = [];
  if (!club.demo && configured && db) {
    try {
      const data = await getClubPosts(id);
      posts = data.posts;
      events = data.events;
    } catch (error) {
      console.error(error);
      toast('Some club details could not be loaded.');
    }
  }
  const joined = joinedIds.has(id);
  const manageable = canManage(club);
  const postMarkup = posts.length ? posts.map((post) =>
    '<article class="feed-item"><h4>' + escapeHTML(post.title || 'Club update') + '</h4><p>' + escapeHTML(post.body || '') + '</p><span class="feed-date">' + escapeHTML(dateLabel(post.createdAt)) + '</span></article>'
  ).join('') : renderEmpty('No announcements yet', 'Updates from club leaders will appear here.');
  const eventMarkup = events.length ? events.map((item) => eventRow(item, club.name)).join('') : renderEmpty('No upcoming events', 'New meetings and events will appear here.');
  $('#club-detail').innerHTML =
    '<div class="club-detail-header"><div class="club-glyph club-glyph-large">' + escapeHTML(initials(club.name).slice(0, 2)) + '</div>' +
    '<div class="club-detail-copy"><span class="category-label">' + escapeHTML(categoryName(club.category)) + (club.status === 'pending' ? ' · Pending approval' : '') + '</span><h2>' + escapeHTML(club.name) + '</h2><p>' + escapeHTML(club.description || 'Club details coming soon.') + '</p></div>' +
    '<div class="club-detail-actions">' +
    (club.status === 'approved' ? '<button class="button ' + (joined ? 'button-secondary' : 'button-primary') + '" data-detail-join="' + escapeHTML(id) + '">' + (joined ? '<i data-lucide="check"></i> Joined' : '<i data-lucide="plus"></i> Join club') + '</button>' : '') +
    (manageable ? '<button class="icon-button" data-edit-club="' + escapeHTML(id) + '" aria-label="Edit club"><i data-lucide="pencil"></i></button>' : '') +
    '</div></div>' +
    '<div class="club-detail-meta"><div><i data-lucide="calendar-clock"></i><span>' + escapeHTML(club.meetingInfo || 'Meeting details not set') + '</span></div>' +
    '<div><i data-lucide="users"></i><span>' + (joinedIds.has(id) ? 'You are a member' : 'Open to students') + '</span></div></div>' +
    (manageable ? '<div class="detail-toolbar"><button class="button button-secondary button-small" data-new-post="' + escapeHTML(id) + '"><i data-lucide="megaphone"></i> Post update</button><button class="button button-secondary button-small" data-edit-club="' + escapeHTML(id) + '"><i data-lucide="pencil"></i> Edit page</button></div>' : '') +
    '<section class="detail-section"><div class="section-title"><h3>Announcements</h3></div>' + postMarkup + '</section>' +
    '<section class="detail-section"><div class="section-title"><h3>Upcoming events</h3></div>' + eventMarkup + '</section>';
  refreshIcons($('#club-detail'));
  $('#club-modal').showModal();
}
async function joinClub(id) {
  const club = getClub(id);
  if (!club || club.status !== 'approved') return;
  if (!configured || club.demo) {
    if (joinedIds.has(id)) joinedIds.delete(id); else joinedIds.add(id);
    localStorage.setItem('clubstack-demo-joined', JSON.stringify([...joinedIds]));
    renderClubs();
    if (activeView === 'my-clubs') renderMyClubs();
    if (selectedClub?.id === id && $('#club-modal').open) openClub(id);
    toast(joinedIds.has(id) ? 'Added to My clubs (preview).' : 'Removed from My clubs (preview).');
    return;
  }
  if (!user) {
    openAuth();
    toast('Sign in to join a club.');
    return;
  }
  try {
    const membershipRef = doc(db, 'memberships', id + '_' + user.uid);
    if (joinedIds.has(id)) {
      await deleteDoc(membershipRef);
      joinedIds.delete(id);
      toast('Left ' + club.name + '.');
    } else {
      await setDoc(membershipRef, { clubId: id, userId: user.uid, joinedAt: serverTimestamp() });
      joinedIds.add(id);
      toast('Joined ' + club.name + '.');
    }
    renderClubs();
    if (activeView === 'my-clubs') renderMyClubs();
    if (selectedClub?.id === id && $('#club-modal').open) openClub(id);
  } catch (error) {
    console.error(error);
    toast('Could not update membership. Check your access.');
  }
}
async function renderMyClubs() {
  const root = $('#my-clubs-content');
  if (!user && configured) {
    root.innerHTML = renderEmpty('Sign in to see your clubs', 'Joined clubs and their updates will appear here.', 'signin', 'Sign in');
    return;
  }
  const joined = clubs.filter((club) => joinedIds.has(club.id) && club.status === 'approved');
  if (!joined.length) {
    root.innerHTML = renderEmpty('No clubs yet', 'Browse the directory and join a club to see it here.', 'discover', 'Discover clubs');
    return;
  }
  root.innerHTML = '<div class="content-grid"><section class="panel"><div class="panel-heading"><h3>Joined clubs</h3><span>' + joined.length + '</span></div><div class="club-list-grid">' + joined.map(clubCard).join('') + '</div></section>' +
    '<section class="panel"><div class="panel-heading"><h3>Recent updates</h3></div><div id="my-feed"><div class="loading-state">Loading updates…</div></div></section></div>';
  refreshIcons(root);
  const feed = [];
  if (configured && db) {
    const recent = await Promise.all(joined.slice(0, 15).map(async (club) => {
      try {
        const snap = await getDocs(query(collection(db, 'clubs', club.id, 'announcements'), orderBy('createdAt', 'desc'), limit(3)));
        return snap.docs.map((item) => ({ clubName: club.name, ...item.data() }));
      } catch (error) { console.warn(error); return []; }
    }));
    recent.flat().forEach((post) => feed.push(post));
  }
  feed.sort((a, b) => ((b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
  $('#my-feed').innerHTML = feed.length ? feed.slice(0, 10).map((post) =>
    '<article class="feed-item"><div class="feed-meta"><span>' + escapeHTML(post.clubName) + '</span><span>' + escapeHTML(dateLabel(post.createdAt)) + '</span></div><h4>' + escapeHTML(post.title || 'Club update') + '</h4><p>' + escapeHTML(post.body || '') + '</p></article>'
  ).join('') : renderEmpty('Nothing new', 'Announcements from your clubs will show up here.');
}
async function renderCalendar() {
  const root = $('#calendar-content');
  const approved = clubs.filter((club) => club.status === 'approved');
  if (!configured) {
    root.innerHTML = '<section class="panel">' + renderEmpty('Preview calendar', 'Connect Firebase to see real club events.') + '</section>';
    return;
  }
  root.innerHTML = '<section class="panel"><div class="panel-heading"><h3>Upcoming events</h3></div><div class="loading-state">Loading events…</div></section>';
  let events = [];
  const eventResults = await Promise.all(approved.map(async (club) => {
    try {
      const snap = await getDocs(query(collection(db, 'clubs', club.id, 'events'), orderBy('date', 'asc'), limit(8)));
      return snap.docs.map((item) => ({ id: item.id, clubId: club.id, clubName: club.name, ...item.data() }));
    } catch (error) { console.warn(error); return []; }
  }));
  eventResults.flat().forEach((item) => events.push(item));
  events = events.filter((item) => {
    const date = asDate(item.date);
    return date && date >= new Date(Date.now() - 86400000);
  }).sort((a, b) => asDate(a.date) - asDate(b.date));
  root.innerHTML = '<section class="panel"><div class="panel-heading"><h3>Upcoming events</h3><span>' + events.length + '</span></div>' +
    (events.length ? events.map((item) => eventRow(item, item.clubName)).join('') : renderEmpty('Nothing scheduled yet', 'Club leaders can add meetings and events from their workspace.')) + '</section>';
  refreshIcons(root);
}
function adminClubRow(club, allRows = false) {
  const pending = club.status === 'pending';
  return '<div class="admin-row"><div class="club-glyph">' + escapeHTML(initials(club.name).slice(0, 2)) + '</div><div class="admin-row-copy"><strong>' + escapeHTML(club.name) + '</strong><span>' + escapeHTML(categoryName(club.category)) + ' · ' + escapeHTML(club.status || 'pending') + '</span></div><div class="row-actions">' +
    (pending ? '<button class="button button-primary button-small" data-approve="' + escapeHTML(club.id) + '">Approve</button><button class="button button-danger button-small" data-reject="' + escapeHTML(club.id) + '">Reject</button>' : '') +
    '<button class="button button-secondary button-small" data-open-club="' + escapeHTML(club.id) + '">View</button>' +
    (allRows && !pending ? '<button class="button button-danger button-small" data-delete-club="' + escapeHTML(club.id) + '">Remove</button>' : '') +
    '</div></div>';
}
function renderManage() {
  const root = $('#manage-content');
  if (!user || !canCreateClub()) {
    root.innerHTML = renderEmpty('Leader access required', 'An admin must assign your account the club leader role.');
    return;
  }
  const manageable = clubs.filter((club) => canManage(club));
  const active = manageable.filter((club) => club.status === 'approved');
  const pending = manageable.filter((club) => club.status === 'pending');
  root.innerHTML = '<div class="summary-grid"><div class="summary-card"><span>Club pages</span><strong>' + manageable.length + '</strong></div><div class="summary-card"><span>Published</span><strong>' + active.length + '</strong></div><div class="summary-card"><span>Awaiting approval</span><strong>' + pending.length + '</strong></div></div>' +
    '<section class="panel"><div class="panel-heading"><h3>Your clubs</h3><button class="button button-primary button-small" data-create-club><i data-lucide="plus"></i> New club</button></div>' +
    (manageable.length ? manageable.map((club) => '<div class="admin-row"><div class="club-glyph">' + escapeHTML(initials(club.name).slice(0, 2)) + '</div><div class="admin-row-copy"><strong>' + escapeHTML(club.name) + '</strong><span>' + escapeHTML(categoryName(club.category)) + ' · <span class="status-pill ' + (club.status === 'approved' ? 'approved' : '') + '">' + escapeHTML(club.status || 'pending') + '</span></span></div><div class="row-actions"><button class="button button-secondary button-small" data-open-club="' + escapeHTML(club.id) + '">Open</button><button class="button button-secondary button-small" data-edit-club="' + escapeHTML(club.id) + '">Edit</button>' + (club.status === 'approved' ? '<button class="button button-secondary button-small" data-new-post="' + escapeHTML(club.id) + '">Post update</button>' : '') + '</div></div>').join('') : renderEmpty('No club pages yet', 'Create a club page to get started.', 'create-club', 'Create a club')) + '</section>' +
    '<section class="panel"><div class="panel-heading"><h3>Quick guide</h3></div><div class="guide-list"><div><i data-lucide="file-check-2"></i><span><strong>Submit a club</strong><small>New pages are reviewed before they appear in Discover.</small></span></div><div><i data-lucide="megaphone"></i><span><strong>Post updates</strong><small>Members see announcements and upcoming events on the club page.</small></span></div></div></section>';
  refreshIcons(root);
}
async function renderAdmin() {
  const root = $('#admin-content');
  if (!isAdmin()) {
    root.innerHTML = renderEmpty('Admin access required', 'Admin permissions are assigned in the Firebase user profile.');
    return;
  }
  const pending = clubs.filter((club) => club.status === 'pending');
  const all = clubs.filter((club) => club.status === 'approved');
  root.innerHTML = '<div class="summary-grid"><div class="summary-card"><span>Awaiting review</span><strong>' + pending.length + '</strong></div><div class="summary-card"><span>Published clubs</span><strong>' + all.length + '</strong></div><div class="summary-card"><span>Access control</span><strong><i data-lucide="shield-check"></i></strong></div></div>' +
    '<section class="panel"><div class="panel-heading"><h3>Pending club submissions</h3><span>' + pending.length + '</span></div>' +
    (pending.length ? pending.map((club) => adminClubRow(club)).join('') : renderEmpty('All caught up', 'New submissions will appear here.')) + '</section>' +
    '<section class="panel"><div class="panel-heading"><h3>Published clubs</h3><span>' + all.length + '</span></div>' +
    (all.length ? all.map((club) => adminClubRow(club, true)).join('') : renderEmpty('No published clubs yet', 'Approved clubs will appear here.')) + '</section>' +
    '<section class="panel"><div class="panel-heading"><h3>User access</h3><span id="user-count">Loading…</span></div><div id="user-list"><div class="loading-state">Loading accounts…</div></div></section>';
  refreshIcons(root);
  try {
    const userSnap = await getDocs(collection(db, 'users'));
    const users = userSnap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')));
    $('#user-count').textContent = String(users.length);
    $('#user-list').innerHTML = users.length ? users.map((account) => {
      const self = account.id === user.uid;
      const suspended = account.suspended === true;
      return '<div class="admin-row admin-user" data-user-id="' + escapeHTML(account.id) + '"><div class="avatar">' + escapeHTML(initials(account.name || account.email || '?')) + '</div><div class="admin-row-copy"><strong>' + escapeHTML(account.name || 'Unnamed user') + (self ? ' (you)' : '') + '</strong><span>' + escapeHTML(account.email || '') + ' · ' + (suspended ? '<span class="danger-text">Suspended</span>' : 'Active') + '</span></div>' +
        '<div class="row-actions user-actions"><select aria-label="Role for ' + escapeHTML(account.name || account.email || 'user') + '" data-user-role ' + (self ? 'disabled' : '') + '><option value="student" ' + (account.role === 'student' ? 'selected' : '') + '>Student</option><option value="leader" ' + (account.role === 'leader' ? 'selected' : '') + '>Leader</option><option value="admin" ' + (account.role === 'admin' ? 'selected' : '') + '>Admin</option></select>' +
        '<button class="button button-secondary button-small" data-save-user-role ' + (self ? 'disabled' : '') + '>Save</button>' +
        '<button class="button ' + (suspended ? 'button-secondary' : 'button-danger') + ' button-small" data-toggle-user ' + (self ? 'disabled' : '') + '>' + (suspended ? 'Restore' : 'Suspend') + '</button></div></div>';
    }).join('') : renderEmpty('No user profiles', 'New accounts appear here after sign-up.');
  } catch (error) {
    console.error(error);
    $('#user-list').innerHTML = renderEmpty('Could not load accounts', 'Confirm admin permissions in Firestore rules.');
  }
  refreshIcons(root);
}
function openAuth() {
  isSignup = false;
  $('#auth-title').textContent = 'Sign in to ClubStack';
  $('#auth-description').textContent = "Join clubs and keep up with what's happening.";
  $('#auth-submit').textContent = 'Sign in';
  $('#auth-switch').innerHTML = 'New to ClubStack? <button id="toggle-auth" class="inline-link" type="button">Create an account</button>';
  $('#name-field').classList.add('hidden');
  $('#auth-name').required = false;
  $('#auth-modal').showModal();
}
function toggleAuthMode() {
  isSignup = !isSignup;
  $('#auth-title').textContent = isSignup ? 'Create your account' : 'Sign in to ClubStack';
  $('#auth-description').textContent = isSignup ? 'New accounts start with student access.' : "Join clubs and keep up with what's happening.";
  $('#auth-submit').textContent = isSignup ? 'Create account' : 'Sign in';
  $('#auth-switch').innerHTML = isSignup ? 'Already registered? <button id="toggle-auth" class="inline-link" type="button">Sign in</button>' : 'New to ClubStack? <button id="toggle-auth" class="inline-link" type="button">Create an account</button>';
  $('#name-field').classList.toggle('hidden', !isSignup);
  $('#auth-name').required = isSignup;
}
function openCreateClub(id = '') {
  if (!user || !canCreateClub()) {
    openAuth();
    toast('Club leader access is required to create a club.');
    return;
  }
  const club = id ? getClub(id) : null;
  if (club && !canManage(club)) {
    toast('You do not have permission to edit this club.');
    return;
  }
  $('#create-club-form').reset();
  $('#editing-club-id').value = club?.id || '';
  $('#create-title').textContent = club ? 'Edit club page' : 'Create a club';
  $('#create-description').textContent = club ? 'Keep your club details accurate.' : (isAdmin() ? 'Create a published club page.' : 'Your submission will be reviewed by an admin.');
  $('#create-submit').textContent = club ? 'Save changes' : (isAdmin() ? 'Create club' : 'Submit for approval');
  if (club) {
    $('#new-club-name').value = club.name || '';
    $('#new-club-category').value = club.category || 'Other';
    $('#new-club-description').value = club.description || '';
    $('#new-club-meeting').value = club.meetingInfo || '';
  }
  $('#create-modal').showModal();
}
async function submitClub(event) {
  event.preventDefault();
  if (!user || !canCreateClub()) {
    toast('Club leader access is required.');
    return;
  }
  if (!configured) {
    toast('Connect Firebase to save club pages.');
    return;
  }
  const id = $('#editing-club-id').value;
  const payload = {
    name: $('#new-club-name').value.trim(),
    category: $('#new-club-category').value,
    description: $('#new-club-description').value.trim(),
    meetingInfo: $('#new-club-meeting').value.trim(),
    glyph: initials($('#new-club-name').value.trim()).slice(0, 2),
    updatedAt: serverTimestamp()
  };
  try {
    if (id) {
      const club = getClub(id);
      if (!club || !canManage(club)) throw new Error('You cannot edit this club.');
      await updateDoc(doc(db, 'clubs', id), payload);
      toast('Club page updated.');
    } else {
      payload.status = isAdmin() ? 'approved' : 'pending';
      payload.createdBy = user.uid;
      payload.leaderIds = [user.uid];
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, 'clubs'), payload);
      toast(isAdmin() ? 'Club created and published.' : 'Submitted for admin approval.');
    }
    $('#create-modal').close();
    $('#create-club-form').reset();
    await syncData();
    if (activeView === 'manage') renderManage();
    if (activeView === 'admin') renderAdmin();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Could not save the club. Check Firestore permissions.');
  }
}
function openPost(id) {
  const club = getClub(id);
  if (!club || !canManage(club)) {
    toast('Only this club’s leaders or an admin can post updates.');
    return;
  }
  if (!configured || club.demo) {
    toast('Connect Firebase to publish updates.');
    return;
  }
  $('#post-form').reset();
  $('#post-club-id').value = id;
  $('#post-modal-title').textContent = 'Update ' + club.name;
  $('#event-date-wrap').classList.add('hidden');
  $('#event-location-wrap').classList.add('hidden');
  $('#post-date').required = false;
  $('#post-modal').showModal();
}
async function submitPost(event) {
  event.preventDefault();
  const id = $('#post-club-id').value;
  const club = getClub(id);
  if (!club || !canManage(club) || !configured) return;
  const title = $('#post-title').value.trim();
  const body = $('#post-body').value.trim();
  const type = $('#post-type').value;
  try {
    if (type === 'event') {
      const value = $('#post-date').value;
      if (!value) {
        toast('Choose the event date and time.');
        return;
      }
      await addDoc(collection(db, 'clubs', id, 'events'), {
        title, description: body, date: new Date(value), location: $('#post-location').value.trim(),
        createdBy: user.uid, createdAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'clubs', id, 'announcements'), {
        title, body, createdBy: user.uid, createdAt: serverTimestamp()
      });
    }
    $('#post-modal').close();
    $('#post-form').reset();
    toast(type === 'event' ? 'Event added.' : 'Announcement published.');
    if (selectedClub?.id === id && $('#club-modal').open) openClub(id);
    if (activeView === 'calendar') renderCalendar();
    if (activeView === 'my-clubs') renderMyClubs();
  } catch (error) {
    console.error(error);
    toast('Could not publish. Check Firestore permissions.');
  }
}
async function moderateClub(id, action) {
  if (!isAdmin() || !configured) {
    toast('Only an admin can moderate club pages.');
    return;
  }
  try {
    if (action === 'approve') {
      await updateDoc(doc(db, 'clubs', id), { status: 'approved', approvedAt: serverTimestamp(), approvedBy: user.uid });
      toast('Club approved.');
    } else {
      await deleteDoc(doc(db, 'clubs', id));
      toast(action === 'reject' ? 'Submission rejected.' : 'Club removed.');
    }
    await syncData();
    renderAdmin();
    if (activeView === 'manage') renderManage();
  } catch (error) {
    console.error(error);
    toast('Could not update the club. Check admin permissions.');
  }
}
async function saveUserRole(row) {
  if (!isAdmin()) return;
  const targetId = row.dataset.userId;
  const role = $('[data-user-role]', row).value;
  if (targetId === user.uid) {
    toast('Your own admin role cannot be changed here.');
    return;
  }
  try {
    await updateDoc(doc(db, 'users', targetId), { role, updatedAt: serverTimestamp() });
    toast('User role updated.');
    if (activeView === 'admin') renderAdmin();
  } catch (error) {
    console.error(error);
    toast('Could not update role. Check Firestore permissions.');
  }
}
async function toggleUserSuspension(row) {
  if (!isAdmin()) return;
  const targetId = row.dataset.userId;
  if (targetId === user.uid) {
    toast('You cannot suspend your own account.');
    return;
  }
  const text = $('[data-toggle-user]', row).textContent.trim();
  const suspended = text !== 'Restore';
  try {
    await updateDoc(doc(db, 'users', targetId), { suspended, updatedAt: serverTimestamp() });
    toast(suspended ? 'Account suspended.' : 'Account restored.');
    if (activeView === 'admin') renderAdmin();
  } catch (error) {
    console.error(error);
    toast('Could not update account status.');
  }
}
async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!configured) {
    toast('Firebase is not configured yet.');
    return;
  }
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const submit = $('#auth-submit');
  submit.disabled = true;
  try {
    if (isSignup) {
      const name = $('#auth-name').value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      pendingSignupProfile = { uid: credential.user.uid, name, email };
      await updateProfile(credential.user, { displayName: name });
      await setDoc(doc(db, 'users', credential.user.uid), { name, email, role: 'student', suspended: false, createdAt: serverTimestamp() });
      pendingSignupProfile = null;
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    $('#auth-modal').close();
    $('#auth-form').reset();
    toast(isSignup ? 'Account created.' : 'Signed in.');
  } catch (error) {
    console.error(error);
    const messages = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/weak-password': 'Use at least 6 characters for the password.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/operation-not-allowed': 'Enable Email/Password in Firebase Authentication.',
      'permission-denied': 'Firestore denied this action. Check the published rules.'
    };
    toast(messages[error.code] || error.message || 'Could not sign in.');
  } finally {
    submit.disabled = false;
  }
}
async function initializeAccount(currentUser) {
  user = currentUser;
  userProfile = null;
  if (user) {
    try {
      const reference = doc(db, 'users', user.uid);
      let profile = await getDoc(reference);
      if (!profile.exists()) {
        const pendingProfile = pendingSignupProfile && pendingSignupProfile.uid === user.uid ? pendingSignupProfile : null;
        await setDoc(reference, {
          name: (pendingProfile && pendingProfile.name) || user.displayName || user.email || 'Student',
          email: (pendingProfile && pendingProfile.email) || user.email || '',
          role: 'student',
          suspended: false,
          createdAt: serverTimestamp()
        });
        profile = await getDoc(reference);
      }
      userProfile = profile.exists() ? profile.data() : { name: user.displayName || user.email, role: 'student' };
      if (userProfile.suspended === true) {
        toast('This account is suspended. Contact a school administrator.');
        await signOut(auth);
        return;
      }
    } catch (error) {
      console.error(error);
      userProfile = { name: user.displayName || user.email, role: 'student' };
    }
  }
  updateAccountUI();
  await syncData();
  if (activeView === 'my-clubs') renderMyClubs();
  if (activeView === 'manage') renderManage();
  if (activeView === 'admin') renderAdmin();
}

$('#auth-form').addEventListener('submit', handleAuthSubmit);
$('#auth-switch').addEventListener('click', (event) => {
  if (event.target.closest('#toggle-auth')) toggleAuthMode();
});
$('#create-club-form').addEventListener('submit', submitClub);
$('#post-form').addEventListener('submit', submitPost);
$('#post-type').addEventListener('change', () => {
  const isEvent = $('#post-type').value === 'event';
  $('#event-date-wrap').classList.toggle('hidden', !isEvent);
  $('#event-location-wrap').classList.toggle('hidden', !isEvent);
  $('#post-date').required = isEvent;
  $('#post-location').required = false;
});
$('#search-input').addEventListener('input', renderClubs);
$('#category-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  selectedCategory = button.dataset.category;
  $$('[data-category]').forEach((item) => item.classList.toggle('selected', item === button));
  renderClubs();
});
$('#clear-filters').addEventListener('click', () => {
  $('#search-input').value = '';
  selectedCategory = 'All';
  $$('[data-category]').forEach((item) => item.classList.toggle('selected', item.dataset.category === 'All'));
  renderClubs();
});
$('#create-club-top').addEventListener('click', () => openCreateClub());
$('#create-club-workspace').addEventListener('click', () => openCreateClub());
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#account-action').addEventListener('click', () => user ? signOut(auth) : openAuth());
$$('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    showView('discover');
    $('#search-input').focus();
  }
});
document.addEventListener('click', (event) => {
  const cardJoin = event.target.closest('[data-card-join]');
  if (cardJoin) {
    event.stopPropagation();
    joinClub(cardJoin.dataset.cardJoin);
    return;
  }
  const detailJoin = event.target.closest('[data-detail-join]');
  if (detailJoin) {
    joinClub(detailJoin.dataset.detailJoin);
    return;
  }
  const open = event.target.closest('[data-open-club]');
  if (open) {
    openClub(open.dataset.openClub);
    return;
  }
  const create = event.target.closest('[data-create-club]');
  if (create) { openCreateClub(); return; }
  const edit = event.target.closest('[data-edit-club]');
  if (edit) { openCreateClub(edit.dataset.editClub); return; }
  const post = event.target.closest('[data-new-post]');
  if (post) { openPost(post.dataset.newPost); return; }
  const approve = event.target.closest('[data-approve]');
  if (approve) { moderateClub(approve.dataset.approve, 'approve'); return; }
  const reject = event.target.closest('[data-reject]');
  if (reject) {
    if (confirm('Reject and delete this club submission?')) moderateClub(reject.dataset.reject, 'reject');
    return;
  }
  const removeClub = event.target.closest('[data-delete-club]');
  if (removeClub) {
    if (confirm('Remove this published club? This cannot be undone.')) moderateClub(removeClub.dataset.deleteClub, 'delete');
    return;
  }
  const saveRole = event.target.closest('[data-save-user-role]');
  if (saveRole) { saveUserRole(saveRole.closest('.admin-user')); return; }
  const toggleUser = event.target.closest('[data-toggle-user]');
  if (toggleUser) { toggleUserSuspension(toggleUser.closest('.admin-user')); return; }
  const empty = event.target.closest('[data-empty-action]');
  if (empty) {
    const action = empty.dataset.emptyAction;
    if (action === 'discover') showView('discover');
    if (action === 'signin') openAuth();
    if (action === 'create-club') openCreateClub();
  }
});
document.addEventListener('keydown', (event) => {
  const card = event.target.closest('.club-card');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    if (event.target.closest('button')) return;
    event.preventDefault();
    openClub(card.dataset.openClub);
  }
});
$('#auth-modal').addEventListener('click', (event) => { if (event.target === $('#auth-modal')) $('#auth-modal').close(); });
$('#create-modal').addEventListener('click', (event) => { if (event.target === $('#create-modal')) $('#create-modal').close(); });

refreshIcons();
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, initializeAccount);
} else {
  clubs = demoClubs;
  joinedIds = new Set(JSON.parse(localStorage.getItem('clubstack-demo-joined') || '[]'));
  renderClubs();
  updateAccountUI();
  toast('Preview mode · connect Firebase to enable accounts and live data.');
}
