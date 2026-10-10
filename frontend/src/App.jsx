import { Component, useEffect, useReducer, useRef, useState } from 'react';
import authImage from '../assets/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdjc0MC10b29uLTI0XzFfMS5qcGc.jpg';
import nexusLogo from '../assets/nexus-book-logo.png';
import { formatPublishedDate, initialYoutubeState, safeYoutubeThumbnail, youtubeRecommendationsReducer, youtubeWatchUrl } from './youtubeRecommendations';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';
const GOOGLE_MEET_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
const DEMO_TEACHER_MEET_LINK = 'https://meet.google.com/iyd-eehk-xjp';
const scheduledTeacherMeetingsKey = 'nexus.scheduled-teacher-meetings';
const localKey = 'nexus-react-profile';
const sessionKey = 'nexus.session';
const activityKey = 'nexus.activity';
const askHistoryKey = 'nexus.ask-history';
const userIdKey = 'nexus.user-id';
const authRoleKey = 'nexus.auth-role';
const userStoreKeys = { student: 'nexus-student-users', teacher: 'nexus-teacher-users' };
const teacherSubjects = ['Computer Networks', 'Data Structures', 'Database Systems', 'Operating Systems', 'Software Engineering', 'Mathematics', 'Physics', 'Other'];
const QUIZ_QUESTION_TOTAL = 10;
const screenPaths = {
  landing: '/',
  signup: '/signup',
  login: '/login',
  home: '/home',
  learnerTwin: '/learner-twin',
  ask: '/ask',
  activity: '/activity',
  materials: '/materials',
  teacher: '/teacher',
  'teacher-session': '/teacher-session',
  studentCopilot: '/teacher-copilot',
  'student-meeting': '/student-meeting',
  account: '/account',
  notes: '/notes',
  labs: '/labs',
  liveTutor: '/live-tutor',
};
const pathScreens = Object.fromEntries(Object.entries(screenPaths).map(([screen, path]) => [path, screen]));
const protectedScreens = new Set(['home', 'learnerTwin', 'ask', 'activity', 'materials', 'teacher', 'teacher-session', 'studentCopilot', 'student-meeting', 'account', 'notes', 'labs', 'liveTutor']);
const teacherScreens = new Set(['teacher', 'teacher-session']);
const studentScreens = new Set(['home', 'learnerTwin', 'ask', 'activity', 'materials', 'studentCopilot', 'student-meeting', 'notes', 'labs', 'liveTutor']);
const authScreens = new Set(['landing', 'login', 'signup']);
const screenFromLocation = () => pathScreens[window.location.pathname.replace(/\/$/, '') || '/'] || 'notFound';
const hasSession = () => localStorage.getItem(sessionKey) === 'active';
const readStoredProfile = () => { try { return JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { return {}; } };
const requestIdentity = () => {
  const profile = readStoredProfile();
  const role = profile.role === 'teacher' ? 'teacher' : 'student';
  const fallbackId = `${role === 'teacher' ? 'teacher' : 'user'}-${(profile.email || 'local@nexus.demo').trim().toLowerCase()}`;
  return { userId: localStorage.getItem(userIdKey) || fallbackId, role };
};
const roleHome = (role) => role === 'teacher' ? 'teacher' : 'home';
const canRoleAccess = (screen, role) => !teacherScreens.has(screen) && !studentScreens.has(screen)
  ? true
  : teacherScreens.has(screen) ? role === 'teacher' : role === 'student';
const resolveScreenForSession = (requested, profile = readStoredProfile()) => {
  if (!hasSession()) return protectedScreens.has(requested) ? 'login' : requested;
  const role = profile.role === 'teacher' ? 'teacher' : 'student';
  if (authScreens.has(requested) || !canRoleAccess(requested, role)) return roleHome(role);
  return requested;
};
const readRoleUsers = (role) => {
  const key = userStoreKeys[role];
  let users = {};
  try { users = JSON.parse(localStorage.getItem(key) || '{}'); } catch { users = {}; }
  try {
    const legacyUsers = JSON.parse(localStorage.getItem('nexus-users') || '{}');
    Object.entries(legacyUsers).forEach(([email, user]) => {
      const legacyRole = user.role === 'teacher' ? 'teacher' : 'student';
      if (legacyRole === role && !users[email]) users[email] = { ...user, role };
    });
    localStorage.setItem(key, JSON.stringify(users));
  } catch { /* Ignore malformed legacy storage. */ }
  return users;
};
const saveRoleUsers = (role, users) => localStorage.setItem(userStoreKeys[role], JSON.stringify(users));
const hashPassword = async (password) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const readScheduledTeacherMeetings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(scheduledTeacherMeetingsKey) || '[]');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* Recreate the demo booking below. */ }
  const demoMeeting = [{
    id: 'amish-singh-google-meet-demo',
    topic: 'Teacher support with Amish Singh',
    course: 'Computer Networks',
    unit: 'Scheduled support',
    question: 'Join the scheduled teacher support meeting.',
    requested_at: new Date().toISOString(),
    status: 'READY',
    teacher_name: 'Amish Singh',
    meeting_uri: DEMO_TEACHER_MEET_LINK,
    local_only: true,
  }];
  localStorage.setItem(scheduledTeacherMeetingsKey, JSON.stringify(demoMeeting));
  return demoMeeting;
};

// Seed demo teacher accounts into localStorage so they can log in immediately.
const SEED_TEACHERS = [
  { name: 'Priya Sharma',  email: 'priya.sharma@gmail.com',  password: 'Teacher@123' },
  { name: 'Raghav Kumar',  email: 'raghav.kumar@gmail.com',  password: 'Teacher@123' },
  { name: 'Ananya Iyer',   email: 'ananya.iyer@gmail.com',   password: 'Teacher@123' },
  { name: 'Vikram Nair',   email: 'vikram.nair@gmail.com',   password: 'Teacher@123' },
  { name: 'Meera Reddy',   email: 'meera.reddy@gmail.com',   password: 'Teacher@123' },
  { name: 'Amish Singh', email: 'amishsingh2005@gmail.com', passwordHash: 'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646' },
];
(async () => {
  const key = userStoreKeys.teacher;
  let users = {};
  try { users = JSON.parse(localStorage.getItem(key) || '{}'); } catch { users = {}; }
  let dirty = false;
  for (const t of SEED_TEACHERS) {
    const emailKey = t.email.toLowerCase();
    if (!users[emailKey]) {
      const hash = t.passwordHash || await hashPassword(t.password);
      users[emailKey] = { name: t.name, email: t.email, role: 'teacher', passwordHash: hash };
      dirty = true;
    }
  }
  if (dirty) localStorage.setItem(key, JSON.stringify(users));
})();


const iconPaths = {
  home: <><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/></>,
  ask: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2.5V16A7.5 7.5 0 1 1 20 11.5Z"/><path d="M10 9.3a2.25 2.25 0 1 1 3.75 1.67c-.95.78-1.75 1.25-1.75 2.53"/><path d="M12 16.5h.01"/></>,
  activity: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  materials: <><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z"/><path d="M8 8h7M8 12h7M8 16h4"/></>,
  account: <><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6"/></>,
  teacher: <><path d="M3 9.5 12 4l9 5.5-9 5-9-5Z"/><path d="M7 12.2V16c2.8 1.8 7.2 1.8 10 0v-3.8"/></>,
  twin: <><circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10.5" r="2.5"/><path d="M3.5 20c.7-3.8 2.6-5.8 5.5-5.8 2.8 0 4.7 2 5.4 5.8"/><path d="M14.3 15.2c2.5.2 4.2 1.8 4.8 4.8"/></>,
  practice: <><path d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Z"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/></>,
  search: <><circle cx="10.7" cy="10.7" r="5.8"/><path d="m15.2 15.2 4 4"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  notes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
  labs: <><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></>,
  voice: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></>,
};
const icon = (name) => <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg></span>;
const initials = (name = 'U') => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'U';

async function api(path, options = {}) {
  const { timeoutMs, ...requestOptions } = options;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const identity = requestIdentity();
  try {
    const response = await fetch(`${API_URL}${path}`, { ...requestOptions, signal: controller?.signal || requestOptions.signal,
      headers: { 'X-User-ID': identity.userId, 'X-User-Role': identity.role, ...(requestOptions.headers || {}) } });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.detail || `Request failed (${response.status})`);
    if (body === null) throw new Error('The server returned no response. Please try again.');
    return body;
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw new Error('The request took too long. Please try again.');
    if (requestError instanceof TypeError) throw new Error('Could not reach the server. Check that Docker is running, then try again.');
    throw requestError;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function streamAsk(payload, onEvent) {
  let response;
  const identity = requestIdentity();
  try {
    response = await fetch(`${API_URL}/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'X-User-ID': identity.userId, 'X-User-Role': identity.role },
      body: JSON.stringify(payload),
    });
  } catch (requestError) {
    throw new Error('Could not reach the server. Check that Docker is running, then try again.');
  }
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const dispatch = (block) => {
    const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || 'message';
    const data = block.match(/^data:\s*(.+)$/m)?.[1];
    if (!data) return;
    let parsed;
    try { parsed = JSON.parse(data); } catch { return; }
    if (event === 'error') throw new Error(parsed.detail || 'NEXUS could not complete that answer. Please try again.');
    onEvent(event, parsed);
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    blocks.forEach(dispatch);
    if (done) break;
  }
  if (buffer.trim()) dispatch(buffer);
}

function RequestAlert({ title, message, onRetry, onDismiss }) {
  return <div className="request-alert" role="alert"><span className="request-alert-icon" aria-hidden="true">!</span><div><strong>{title}</strong><p>{message}</p></div><div className="request-alert-actions">{onRetry && <button type="button" onClick={onRetry}>Try again</button>}{onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss error">×</button>}</div></div>;
}

function ErrorPage({ code, title, message, onRetry }) {
  return <main className="error-page"><div className="error-page-card"><Brand /><span className="error-page-code">{code}</span><h1>{title}</h1><p>{message}</p><div className="error-page-actions">{onRetry && <button className="button primary" onClick={onRetry}>Try again</button>}<a className="button ghost" href="/">Back to overview →</a></div></div></main>;
}

export class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('NEXUS screen failed to render', error); }
  render() {
    return this.state.failed ? <ErrorPage code="ERROR" title="This page could not load." message="Your saved courses and conversations are safe. Reload the page to try again." onRetry={() => window.location.reload()} /> : this.props.children;
  }
}

function Landing({ go }) {
  return <main className="landing"><nav className="top-nav shell"><Brand /><div className="nav-links"><a href="#how">How it works</a><a href="#why">Why NEXUS</a></div><div className="nav-actions"><button className="button ghost" onClick={() => go('login')}>Log in</button><button className="button primary" onClick={() => go('signup')}>Create account <b>→</b></button></div></nav><section className="hero shell"><div className="hero-copy"><span className="pill">✦ Intelligence that learns how you learn</span><h1>The right help.<br /><em>Right when it clicks.</em></h1><p>NEXUS understands your doubt, learns from each interaction, and helps you make steady progress—starting with the first question you want to ask.</p><div className="hero-actions"><button className="button primary large" onClick={() => go('signup')}>Create your account <b>→</b></button><a className="button ghost large" href="#how">See how it works</a></div></div><HeroPreview /></section><section className="process-strip"><div className="shell process-grid"><Process label="Understand" text="Read the real doubt" /><Process label="Decide" text="Choose the next step" /><Process label="Teach" text="Use the right approach" /><Process label="Adapt" text="Learn from every outcome" /></div></section><section id="how" className="features shell"><span className="section-label">A learning system, not a chatbot</span><h2>Start with a question.<br />Build a clearer path forward.</h2><div className="feature-grid" id="why"><Feature number="01" title="Ask in your own words" text="NEXUS meets you where you are. No sample profile or fixed subject is required." symbol="✦" /><Feature number="02" title="Keep material organised" text="Build courses, name units your way, and attach every PDF that belongs there." symbol="▤" dark /><Feature number="03" title="Grow your learning context" text="Your real questions and activity shape future recommendations over time." symbol="◌" /></div></section></main>;
}

function Brand() { return <div className="brand"><span className="brand-mark"><img src={nexusLogo} alt="" /></span><span>NEXUS<small>Learning orchestrator</small></span></div>; }
function Process({ label, text }) { return <div><strong>{label}</strong><span>{text}</span></div>; }
function Feature({ number, title, text, symbol, dark }) { return <article className={`feature-card ${dark ? 'dark' : ''}`}><small>{number}</small><i>{symbol}</i><h3>{title}</h3><p>{text}</p></article>; }
function HeroPreview() { return <div className="hero-preview landing-visual"><img src={authImage} alt="A colourful study desk with books, a lamp, and a globe" /><div className="landing-visual-copy"><span>ONE PLACE FOR YOUR LEARNING</span><b>Courses, units, materials, and questions—kept together.</b></div></div>; }

function Auth({ type, go, setProfile }) {
  const isSignup = type === 'signup';
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState(() => localStorage.getItem(authRoleKey) === 'teacher' ? 'teacher' : 'student'); const [message, setMessage] = useState('');
  const chooseRole = (nextRole) => { setRole(nextRole); setMessage(''); localStorage.setItem(authRoleKey, nextRole); };
  const submit = async (event) => {
    event.preventDefault();
    if (isSignup && !name.trim()) return setMessage('Enter your name to create an account.');
    if (!email.trim() || password.length < 8) return setMessage('Use an email and a password with at least 8 characters.');

    const emailKey = email.trim().toLowerCase();
    const usersMap = readRoleUsers(role);
    const passwordHash = await hashPassword(password);

    if (isSignup) {
      if (usersMap[emailKey]) return setMessage(`A ${role} account with this email already exists.`);
      usersMap[emailKey] = { name: name.trim(), email: email.trim(), passwordHash, role };
      saveRoleUsers(role, usersMap);
      setMessage(`${role === 'teacher' ? 'Teacher' : 'Student'} account created successfully. Redirecting to login…`);
      setTimeout(() => { setMessage(''); go('login'); }, 1500);
      return;
    }

    const user = usersMap[emailKey];
    const validPassword = user && (user.passwordHash ? user.passwordHash === passwordHash : user.password === password);
    if (!validPassword || user.role !== role) return setMessage(`Invalid ${role} email or password. Check the selected workspace and try again.`);

    if (!user.passwordHash) {
      usersMap[emailKey] = { ...user, passwordHash, role };
      delete usersMap[emailKey].password;
      saveRoleUsers(role, usersMap);
    }

    const profile = { name: user.name, email: user.email, role };
    localStorage.setItem(localKey, JSON.stringify(profile));
    localStorage.setItem(userIdKey, role === 'teacher' ? `teacher-${emailKey}` : `user-${emailKey}`);
    localStorage.setItem(sessionKey, 'active');
    setProfile(profile);
    go(roleHome(role), { replace: true });
  };
  return <main className="auth-page">
    <section className="auth-art">
      <img className="auth-image" src={authImage} alt="A colourful study desk with books, a lamp, and a globe" />
      <div className="auth-copy">
        <span className="auth-kicker">{isSignup ? 'A workspace shaped around you' : 'Continue your learning journey'}</span>
        <h1>{isSignup ? 'Make learning feel more organised.' : 'Welcome back to your learning space.'}</h1>
        <p>{isSignup ? 'Keep courses, units, and study material together in one focused workspace.' : 'Continue with your courses, materials, and recent activity.'}</p>
      </div>
    </section>
    <section className="auth-form">
      <div className="auth-form-brand"><Brand /></div>
      <button className="auth-back" onClick={() => go('landing')}>← Back to overview</button>
      <div className="form-card">
        <div className="auth-heading"><span>{role === 'teacher' ? 'TEACHER PORTAL' : 'STUDENT PORTAL'}</span><h2>{isSignup ? `Create a ${role} account` : `${role === 'teacher' ? 'Teacher' : 'Student'} login`}</h2><p>{isSignup ? 'This account will only open the selected workspace.' : `Enter the credentials registered for the ${role} workspace.`}</p></div>
        <div className="role-toggle" role="group" aria-label="Choose your NEXUS workspace"><button type="button" className={role === 'student' ? 'active' : ''} onClick={() => chooseRole('student')}><b>Student</b><small>Learn and practise</small></button><button type="button" className={role === 'teacher' ? 'active' : ''} onClick={() => chooseRole('teacher')}><b>Teacher</b><small>Teacher Copilot portal</small></button></div>
        <form onSubmit={submit}>
          {isSignup && <Field label="Full name" value={name} onChange={setName} placeholder="Your name" />}
          <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Field label={isSignup ? 'Create password' : 'Password'} type="password" value={password} onChange={setPassword} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} />
          {isSignup && <label className="check"><input required type="checkbox" /><span>I agree to the terms of use</span></label>}
          <button className="button primary submit" type="submit">{isSignup ? 'Create account' : 'Log in'} <b>→</b></button>
          {message && <p className="form-message">{message}</p>}
        </form>
        <div className="switch-auth">{isSignup ? <>Already have an account? <button onClick={() => go('login')}>Log in</button></> : <>New to NEXUS? <button onClick={() => go('signup')}>Create your account</button></>}</div>
        <p className="auth-note">Your learning space stays private to your account.</p>
      </div>
    </section>
  </main>;
}
function Field({ label, value, onChange, type = 'text', placeholder, required = true }) { return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /></label>; }

function Sidebar({ go }) {
  const [recentChats, setRecentChats] = useState([]);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => api('/chat/turns').then((turns) => {
      if (active) setRecentChats(turns.slice().reverse());
    }).catch(() => { if (active) setRecentChats([]); });
    load();
    window.addEventListener('nexus:chat-updated', load);
    return () => { active = false; window.removeEventListener('nexus:chat-updated', load); };
  }, []);
  const openChat = (chat) => {
    setMobileHistoryOpen(false);
    go('ask', { courseId: chat.course_id, unitId: chat.unit_id, turnId: chat.id });
    window.dispatchEvent(new CustomEvent('nexus:open-chat', { detail: chat }));
  };
  const openAllChats = () => {
    go('ask', { showAllChats: true });
    window.dispatchEvent(new Event('nexus:show-all-chats'));
  };
  return <aside className="sidebar chat-sidebar"><section className={`sidebar-history ${mobileHistoryOpen ? 'mobile-open' : ''}`} aria-label="Chat history"><div className="sidebar-history-head"><span>Chat history</span><button type="button" className="mobile-history-toggle" onClick={() => setMobileHistoryOpen((open) => !open)} aria-label="Toggle chat history" aria-expanded={mobileHistoryOpen}>◷</button><button type="button" onClick={openAllChats} title="See all chats">View all</button></div><div className="sidebar-history-list">{recentChats.length ? recentChats.map((chat) => <button className="sidebar-chat" type="button" key={chat.id} onClick={() => openChat(chat)} title={chat.question}><span>{chat.question}</span><small>{chat.course || 'Course'} · {chat.unit || 'Unit'}</small></button>) : <p>Your questions will appear here.</p>}</div></section></aside>;
}

function GlassNavigation({ screen, go, profile, logout }) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const syncScrollState = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', syncScrollState, { passive: true });
    return () => window.removeEventListener('scroll', syncScrollState);
  }, []);
  const studentItems = [
    ['home', 'Home', 'home'],
    ['ask', 'Ask NEXUS', 'ask'],
    ['learnerTwin', 'Learner Twin', 'twin'],
    ['materials', 'Materials', 'materials'],
    ['notes', 'AI Notes', 'notes'],
    ['liveTutor', 'AI Tutor', 'voice'],
    ['studentCopilot', 'Teacher Copilot', 'teacher'],
  ];
  const items = profile.role === 'teacher'
    ? [['teacher', 'Teacher Copilot', 'materials']]
    : studentItems;
  return <nav className={`glass-navigation${scrolled ? ' scrolled' : ''}`} aria-label="Learning workspace navigation">
    <button className="glass-brand" type="button" onClick={() => go('home')} aria-label="Go to NEXUS home"><span className="glass-mark"><img src={nexusLogo} alt="" /></span><span>NEXUS</span></button>
    <div className="glass-links">{items.map(([key, label, iconName]) => { const active = key === screen; return <button type="button" key={key} onClick={() => go(key)} className={`glass-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>{icon(iconName)}<span>{label}</span></button>; })}</div>
    <div className="glass-utilities"><button type="button" className="glass-icon-button" onClick={logout} aria-label="Sign out" title="Sign out">{icon('logout')}</button><button type="button" className="glass-avatar" onClick={() => go('account')} aria-label="Open account details">{initials(profile.name)}</button></div>
  </nav>;
}

function waitForGoogleIdentity(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
      if (Date.now() - startedAt >= timeoutMs) return reject(new Error('Google authorization could not load. Check your connection and try again.'));
      window.setTimeout(check, 100);
    };
    check();
  });
}

async function requestGoogleMeetAccessToken() {
  if (!GOOGLE_MEET_CLIENT_ID) throw new Error('Google Meet is not configured. Add GOOGLE_MEET_CLIENT_ID to the project .env file.');
  const oauth2 = await waitForGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_MEET_CLIENT_ID,
      scope: GOOGLE_MEET_SCOPE,
      callback: (response) => {
        if (response?.access_token) resolve(response.access_token);
        else reject(new Error(response?.error_description || 'Google authorization was not completed.'));
      },
      error_callback: (response) => reject(new Error(response?.message || 'The Google authorization window was closed.')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

async function ensureGoogleMeetRoom(sessionId, existingUri = '') {
  if (existingUri) return { meeting_uri: existingUri };
  const accessToken = await requestGoogleMeetAccessToken();
  return api(`/teacher-meetings/${sessionId}/google-meet`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

function useLearnerTwin() {
  const [twin, setTwin] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; const load = () => api('/learning/twin').then((value) => { if (active) setTwin(value); }).catch(() => { if (active) setTwin(null); }).finally(() => { if (active) setLoading(false); }); load(); window.addEventListener('nexus:learning-updated', load); return () => { active = false; window.removeEventListener('nexus:learning-updated', load); }; }, []);
  return { twin, loading };
}

function LearnerTwinCard({ twin, loading, go }) {
  const focus = twin?.focus; const strongest = twin?.strongest; const action = twin?.next_action;
  return <article className="panel learner-twin-card"><div className="twin-card-head"><div><span className="section-label">LEARNER TWIN</span><h2>Your learning state</h2></div><span className="twin-live">● Live</span></div>{loading ? <p className="twin-muted">Reading your learning signals…</p> : <><div className="twin-score"><strong>{twin?.overall_mastery ?? '—'}{twin?.overall_mastery !== null && twin?.overall_mastery !== undefined ? '%' : ''}</strong><span>estimated overall strength</span></div><div className="twin-mini-grid"><div><span>Focus now</span><b>{focus?.topic || 'First learning signal'}</b><small>{focus ? `${focus.mastery}% · ${focus.course}` : 'Ask NEXUS or take a quiz'}</small></div><div><span>Strongest</span><b>{strongest?.topic || 'Building profile'}</b><small>{strongest ? `${strongest.mastery}% estimated` : 'More signals reveal strengths'}</small></div></div><p className="twin-action">{action?.description}</p><button className="text-button" onClick={() => go('learnerTwin')}>Open learner twin →</button></>}</article>;
}

function Home({ go, profile, activity, logout }) {
  const { twin, loading } = useLearnerTwin(); const focus = twin?.focus; const action = twin?.next_action;
  return <DashboardShell title="Your learning space" go={go} profile={profile} logout={logout}>
    <section className="welcome"><span className="page-eyebrow">OVERVIEW</span><h1>Welcome back, {profile.name || 'there'}.</h1><p>Pick up a learning thread, review your next step, or organise your study material.</p></section>
    <section className="home-workspace"><div className="home-primary"><article className="recommendation"><small>{focus ? 'YOUR NEXT LEARNING STEP' : 'START LEARNING'}</small><h2>{action?.title || 'Ask the first thing you want to understand.'}</h2><p>{action?.description || 'NEXUS will build your learning context from your own questions and choices.'}</p><div className="rec-meta"><span>{focus ? 'Estimated strength' : 'Learning history'}<b>{focus ? `${focus.mastery}%` : activity.length ? 'In progress' : 'Just getting started'}</b></span><span>Suggested action<b>{action?.action || 'Ask NEXUS'}</b></span></div><button className="button light" onClick={() => go('ask')}>{focus ? 'Continue learning' : 'Ask a question'} <b>→</b></button></article><div className="feature-grid workspace-feature-grid"><LearnerTwinCard twin={twin} loading={loading} go={go} /><article className="panel workspace-action-card"><span className="workspace-card-icon">{icon('materials')}</span><div><small>KNOWLEDGE BASE</small><h2>Keep your material connected.</h2><p>Build courses, organise units, and make every PDF ready for the next explanation.</p></div><button className="text-button" onClick={() => go('materials')}>Open materials →</button></article></div></div><aside className="home-updates"><ActivityCard items={activity} /><section className="panel quick-links"><div className="panel-title"><h3>Quick actions</h3><span>Workspace</span></div><button onClick={() => go('ask')}>{icon('ask')}Ask a question</button><button onClick={() => go('materials')}>{icon('materials')}Manage material</button><button onClick={() => go('learnerTwin')}>{icon('twin')}View learner twin</button></section></aside></section>
  </DashboardShell>;
}

function LearnerTwin({ go, profile, logout }) {
  const { twin, loading } = useLearnerTwin(); const focus = twin?.focus; const strongest = twin?.strongest; const action = twin?.next_action;
  return <DashboardShell title="Learner Twin" go={go} profile={profile} screen="learnerTwin" logout={logout}><section className="page-heading"><span className="page-eyebrow">LEARNER TWIN</span><h1>Your evolving learning map.</h1><p>NEXUS updates this view from your conversations, understanding feedback, and every quiz answer.</p></section><section className="twin-overview"><article className="twin-overview-main"><span>OVERALL ESTIMATE</span><strong>{loading ? '…' : twin?.overall_mastery ?? '—'}{twin?.overall_mastery !== null && twin?.overall_mastery !== undefined ? '%' : ''}</strong><p>{twin?.signals?.topics_tracked ? `${twin.signals.topics_tracked} topic${twin.signals.topics_tracked === 1 ? '' : 's'} tracked across your learning journey.` : 'Your learner twin starts shaping itself with your first question or quiz.'}</p></article><article><span>FOCUS NOW</span><b>{focus?.topic || 'Create your first signal'}</b><p>{focus ? `${focus.mastery}% estimated strength · ${focus.course}` : 'Ask NEXUS or try a quiz from a unit with PDFs.'}</p></article><article><span>STRONGEST TOPIC</span><b>{strongest?.topic || 'Still learning'}</b><p>{strongest ? `${strongest.mastery}% estimated strength · ${strongest.course}` : 'Correct quiz answers and “I understand” feedback build this.'}</p></article></section><section className="twin-action-panel"><div><span className="section-label">NEXT BEST INTERVENTION</span><h2>{action?.title || 'Start learning with NEXUS'}</h2><p>{action?.description || 'Choose a course and unit, then ask your first question.'}</p></div><button className="button primary" onClick={() => go('ask')}>{action?.action || 'Ask NEXUS'} <b>→</b></button></section><section className="twin-detail-grid"><article className="panel twin-topics"><div className="panel-title"><h3>Topic signals</h3><span>{twin?.signals?.topics_tracked || 0} tracked</span></div>{loading ? <p className="twin-muted">Loading your learning map…</p> : twin?.topics?.length ? <div className="twin-topic-list">{twin.topics.map((topic) => <div key={`${topic.course_id}-${topic.topic}`}><div><b>{topic.topic}</b><small>{topic.course} · {topic.units.join(', ')}</small></div><span className={topic.status === 'NEEDS_PRACTICE' ? 'needs-practice' : topic.status === 'IMPROVING' ? 'improving' : ''}>{topic.status === 'NEEDS_PRACTICE' ? 'Needs focus' : topic.status === 'IMPROVING' ? 'Improving' : 'Exploring'} · {topic.mastery}%</span></div>)}</div> : <p className="twin-muted">No topics yet. Your next chat or quiz will create the first entry.</p>}</article><article className="panel twin-signals"><div className="panel-title"><h3>Learning evidence</h3><span>Updates automatically</span></div><div><b>{twin?.signals?.chats || 0}</b><span>learning chats</span></div><div><b>{twin?.signals?.quiz_answers || 0}</b><span>quiz answers</span></div><div><b>{twin?.signals?.incorrect || 0}</b><span>answers to revisit</span></div><p>Wrong answers and “Still confused” signals lower a topic estimate; correct answers and “I understand” signals raise it.</p></article></section></DashboardShell>;
}
function EmptyCard({ title, text, action, onClick, symbol }) { return <article className="panel empty-card"><i>{symbol}</i><h3>{title}</h3><p>{text}</p><button className="text-button" onClick={onClick}>{action} →</button></article>; }
function ActivityCard({ items }) { return <section className="panel activity-panel"><div className="panel-title"><h3>Activity</h3><span>{items.length ? 'Recent' : 'Waiting for your first step'}</span></div>{items.length ? items.map((item, index) => <div className="activity-row" key={`${item}-${index}`}><i>✦</i><div><b>{item}</b><small>Added just now</small></div></div>) : <div className="empty-activity"><span>◷</span><div><b>No activity yet</b><p>Courses, units, uploaded PDFs, and learning moments will show up here.</p></div></div>}</section>; }



function DashboardShell({ title, children, go, profile, screen = 'home', logout }) { return <div className="app-shell workspace-shell"><main className="dashboard"><GlassNavigation screen={screen} go={go} profile={profile} logout={logout} /><header className="workspace-header"><div><small>LEARNING WORKSPACE</small><b>{title}</b></div></header><div className="workspace-panel">{children}</div></main></div>; }

function Materials({ go, profile, courses, setCourses, addActivity, logout }) {
  const [courseTitle, setCourseTitle] = useState(''); const [courseDescription, setCourseDescription] = useState(''); const [activeCourse, setActiveCourse] = useState(null); const [unitTitle, setUnitTitle] = useState(''); const [notice, setNotice] = useState(''); const [viewingMaterial, setViewingMaterial] = useState(null);
  const selected = courses.find((course) => course.id === activeCourse);
  const hasActiveUploads = courses.some((course) => course.units.some((unit) => unit.materials.some((material) => ['QUEUED', 'PROCESSING'].includes(material.status))));
  useEffect(() => { if (courses.length && !courses.some((course) => course.id === activeCourse)) setActiveCourse(courses[0].id); }, [courses, activeCourse]);
  useEffect(() => {
    if (!hasActiveUploads) return undefined;
    const refresh = async () => { try { setCourses(await api('/courses')); } catch { /* Existing status remains visible until the next retry. */ } };
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [hasActiveUploads, setCourses]);
  const addCourse = async (event) => { event.preventDefault(); if (!courseTitle.trim()) return; const draft = { id: crypto.randomUUID(), title: courseTitle.trim(), description: courseDescription.trim(), units: [] }; try { const created = await api('/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draft.title, description: draft.description }) }); setCourses((old) => [created, ...old]); setActiveCourse(created.id); } catch { setCourses((old) => [draft, ...old]); setActiveCourse(draft.id); } addActivity(`Created course: ${draft.title}`); setCourseTitle(''); setCourseDescription(''); };
  const addUnit = async (event) => { event.preventDefault(); if (!selected || !unitTitle.trim()) return; const draft = { id: crypto.randomUUID(), title: unitTitle.trim(), materials: [] }; try { const created = await api(`/courses/${selected.id}/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draft.title }) }); updateCourse(selected.id, (course) => ({ ...course, units: [...course.units, created] })); } catch { updateCourse(selected.id, (course) => ({ ...course, units: [...course.units, draft] })); } addActivity(`Added unit: ${draft.title}`); setUnitTitle(''); };
  const updateCourse = (id, transform) => setCourses((all) => all.map((course) => course.id === id ? transform(course) : course));
  const upload = async (unit, fileList) => { const files = [...fileList]; if (!files.length) return; const queued = files.map((file) => ({ id: crypto.randomUUID(), name: file.name, status: 'QUEUED', chunk_count: 0 })); updateCourse(selected.id, (course) => ({ ...course, units: course.units.map((item) => item.id === unit.id ? { ...item, materials: [...item.materials, ...queued] } : item) })); const data = new FormData(); files.forEach((file) => data.append('files', file)); try { const stored = await api(`/units/${unit.id}/materials`, { method: 'POST', body: data }); updateCourse(selected.id, (course) => ({ ...course, units: course.units.map((item) => item.id === unit.id ? { ...item, materials: [...item.materials.filter((material) => !queued.some((queue) => queue.id === material.id)), ...stored] } : item) })); setNotice('PDFs uploaded. NEXUS is parsing and indexing them in the background.'); files.forEach((file) => addActivity(`Added PDF: ${file.name}`)); } catch (error) { updateCourse(selected.id, (course) => ({ ...course, units: course.units.map((item) => item.id === unit.id ? { ...item, materials: item.materials.filter((material) => !queued.some((queue) => queue.id === material.id)) } : item) })); setNotice(error.message || 'The PDFs could not be uploaded.'); } };
  const removeCourse = async () => { if (!selected || !window.confirm(`Delete “${selected.title}” and every unit and PDF inside it? This cannot be undone.`)) return; try { await api(`/courses/${selected.id}`, { method: 'DELETE' }); setCourses((all) => all.filter((course) => course.id !== selected.id)); setActiveCourse(''); addActivity(`Deleted course: ${selected.title}`); setNotice('Course and its contents were deleted.'); } catch (error) { setNotice(error.message || 'Could not delete the course.'); } };
  const removeUnit = async (unit) => { if (!selected || !window.confirm(`Delete “${unit.title}” and every PDF inside it? This cannot be undone.`)) return; try { await api(`/units/${unit.id}`, { method: 'DELETE' }); updateCourse(selected.id, (course) => ({ ...course, units: course.units.filter((item) => item.id !== unit.id) })); addActivity(`Deleted unit: ${unit.title}`); setNotice('Unit and its PDFs were deleted.'); } catch (error) { setNotice(error.message || 'Could not delete the unit.'); } };
  const removeMaterial = async (unit, material) => { if (!selected || !window.confirm(`Delete “${material.name}”? This will remove its stored PDF and vectors.`)) return; try { await api(`/materials/${material.id}`, { method: 'DELETE' }); updateCourse(selected.id, (course) => ({ ...course, units: course.units.map((item) => item.id === unit.id ? { ...item, materials: item.materials.filter((entry) => entry.id !== material.id) } : item) })); addActivity(`Deleted PDF: ${material.name}`); setNotice('PDF and its vectors were deleted.'); } catch (error) { setNotice(error.message || 'Could not delete the PDF.'); } };
  return <DashboardShell title="Study materials" go={go} profile={profile} screen="materials" logout={logout}>
    <section className="page-heading materials-heading">
      <div><span className="page-eyebrow">MATERIAL LIBRARY</span><h1>Build your knowledge base.</h1><p>Organise material by course, create your own units, and keep every PDF exactly where it belongs.</p></div>
      <div className="materials-summary"><b>{String(courses.length).padStart(2, '0')}</b><span>Courses</span></div>
    </section>

    <section className="course-create panel">
      <div className="course-create-intro"><span>01</span><div><b>Create a course</b><p>Start with a subject or course name. You can add units and PDFs next.</p></div></div>
      <form className="course-create-form" onSubmit={addCourse}>
        <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Course title" aria-label="Course title" />
        <input value={courseDescription} onChange={(event) => setCourseDescription(event.target.value)} placeholder="Short description (optional)" aria-label="Course description" />
        <button className="button primary" type="submit">Add course <b>→</b></button>
      </form>
    </section>

    {courses.length ? <div className="materials-layout">
      <aside className="course-list panel">
        <div className="panel-title"><h3>Your courses</h3><span>{courses.length}</span></div>
        {courses.map((course) => <button className={`course-item ${course.id === activeCourse ? 'selected' : ''}`} onClick={() => setActiveCourse(course.id)} key={course.id}><b>{course.title}</b><small>{course.units.length} unit{course.units.length === 1 ? '' : 's'}</small></button>)}
      </aside>
      <section className="course-workspace">{selected && <>
        <div className="course-header"><div><span className="section-label">ACTIVE COURSE</span><h2>{selected.title}</h2><p>{selected.description || 'Add a short description whenever you are ready.'}</p></div><button className="delete-button" type="button" onClick={removeCourse}>Delete course</button></div>
        <form className="new-unit panel" onSubmit={addUnit}><div><b>Add a unit</b><small>Use a custom title. Each unit can hold several PDFs.</small></div><input value={unitTitle} onChange={(event) => setUnitTitle(event.target.value)} placeholder="e.g. Week 1 — Foundations" /><button className="button primary" type="submit">Add unit</button></form>
        {selected.units.length ? <div className="unit-stack">{selected.units.map((unit) => <UnitCard unit={unit} onUpload={upload} onView={setViewingMaterial} onDeleteUnit={removeUnit} onDeleteMaterial={removeMaterial} onPractice={() => go('ask', { courseId: selected.id, unitId: unit.id })} key={unit.id} />)}</div> : <div className="blank-course compact"><span>02</span><h3>Add the first unit.</h3><p>Give the unit a useful title, then attach the PDFs that belong to it.</p></div>}
      </>}</section>
    </div> : <section className="materials-empty">
      <div className="materials-empty-primary"><span>READY WHEN YOU ARE</span><h2>Your library starts with one course.</h2><p>Use the form above to create the subject you are currently studying.</p></div>
      <div className="materials-empty-steps">
        <div><b>01</b><span>Name the course</span><p>Use the subject or course title you recognise.</p></div>
        <div><b>02</b><span>Create units</span><p>Break the course into chapters, weeks, or topics.</p></div>
        <div><b>03</b><span>Add PDFs</span><p>Attach one or several documents to each unit.</p></div>
      </div>
    </section>}
    {notice && <div className="toast">{notice}</div>}
    {viewingMaterial && <PdfViewer material={viewingMaterial} onClose={() => setViewingMaterial(null)} />}
  </DashboardShell>;
}
function UnitCard({ unit, onUpload, onView, onDeleteUnit, onDeleteMaterial, onPractice }) { return <article className="unit-card"><div className="unit-top"><div><small>CUSTOM UNIT</small><h3>{unit.title}</h3></div><button className="unit-practice-link" type="button" onClick={onPractice} disabled={!unit.materials.length}>Practice unit →</button><label className="upload-button"><input type="file" accept="application/pdf" multiple onChange={(event) => onUpload(unit, event.target.files)} />+ Add PDFs</label><button className="delete-button" type="button" onClick={() => onDeleteUnit(unit)}>Delete unit</button></div>{unit.materials.length ? <div className="material-list">{unit.materials.map((material) => <div className="material-row" key={material.id}><button className="material-open" type="button" onClick={() => onView(material)}><span>PDF</span><b>{material.name}</b><small>{material.status === 'INDEXED' ? `${material.chunk_count} vectors stored` : material.status === 'PARSED_AWAITING_EMBEDDINGS' ? 'Parsed — awaiting embeddings' : material.status === 'NO_EXTRACTABLE_TEXT' ? 'Scanned — AI reading ready' : material.status}</small><i>View →</i></button><button className="delete-button compact" type="button" onClick={() => onDeleteMaterial(unit, material)} aria-label={`Delete ${material.name}`}>Delete</button></div>)}</div> : <p className="unit-empty">No PDFs in this unit yet. Add as many as you need.</p>}</article>; }
function PdfViewer({ material, onClose }) { const source = `${API_URL}/materials/${material.id}/file`; return <div className="pdf-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Viewing ${material.name}`}><section className="pdf-viewer"><header><div><span>PDF MATERIAL</span><h2>{material.name}</h2></div><div><a href={source} target="_blank" rel="noreferrer">Open in new tab ↗</a><button type="button" onClick={onClose} aria-label="Close PDF viewer">×</button></div></header><iframe title={material.name} src={source} /></section></div>; }
function AskNexus({ go, profile, courses, addActivity, logout }) {
  const [question, setQuestion] = useState(''); const [courseId, setCourseId] = useState(''); const [unitId, setUnitId] = useState(''); const [response, setResponse] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const selectedCourse = courses.find((course) => course.id === courseId) || courses[0];
  const units = selectedCourse?.units || [];
  const selectedUnit = units.find((unit) => unit.id === unitId) || units[0];
  useEffect(() => { if (selectedCourse && courseId !== selectedCourse.id) setCourseId(selectedCourse.id); }, [selectedCourse, courseId]);
  useEffect(() => { if (selectedUnit && unitId !== selectedUnit.id) setUnitId(selectedUnit.id); }, [selectedUnit, unitId]);
  const selectCourse = (nextCourseId) => { const next = courses.find((course) => course.id === nextCourseId); setCourseId(nextCourseId); setUnitId(next?.units[0]?.id || ''); setResponse(null); setError(''); };
  const submit = async (event) => { event.preventDefault(); if (!question.trim() || !selectedCourse || !selectedUnit) return; setLoading(true); setError(''); setResponse(null); try { const result = await api('/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: question.trim(), course_id: selectedCourse.id, unit_id: selectedUnit.id }) }); setResponse(result); addActivity(`Asked NEXUS in ${selectedUnit.title}: ${question.trim()}`); } catch (requestError) { setError(requestError.message || 'NEXUS could not answer that question. Please try again.'); } finally { setLoading(false); } };
  const pdfCount = selectedUnit?.materials.length || 0;
  return <DashboardShell title="Ask NEXUS" go={go} profile={profile} screen="ask" logout={logout}><section className="page-heading"><h1>What would you like to understand?</h1><p>Select where your question comes from. NEXUS will search across every PDF inside that unit.</p></section><section className="panel ask-panel"><div className="ask-panel-head"><div><span className="section-label">ASK NEXUS</span><h2>Choose the material context first.</h2></div>{pdfCount ? <span className="material-ready">✓ {pdfCount} PDF{pdfCount === 1 ? '' : 's'} in this unit</span> : <button className="text-button" onClick={() => go('materials')}>Add materials →</button>}</div>{courses.length ? <form onSubmit={submit}><div className="ask-context"><label><span>COURSE</span><select value={selectedCourse?.id || ''} onChange={(event) => selectCourse(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label><span>UNIT</span><select value={selectedUnit?.id || ''} onChange={(event) => { setUnitId(event.target.value); setResponse(null); }}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select></label></div>{selectedUnit ? <><label><span>YOUR QUESTION</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`Ask about ${selectedUnit.title}...`} /></label><div><small>{pdfCount ? `All ${pdfCount} PDF${pdfCount === 1 ? '' : 's'} in “${selectedUnit.title}” will be considered.` : 'This unit has no PDFs yet.'}</small><button className="button primary" type="submit" disabled={loading || !pdfCount}>{loading ? 'Thinking…' : <>Ask NEXUS <b>→</b></>}</button></div></> : <p className="ask-message">Create a unit before asking a material-grounded question.</p>}</form> : <div className="ask-empty"><h3>Choose a course and unit first.</h3><p>Once a unit contains PDFs, NEXUS can answer against that material.</p><button className="button primary" onClick={() => go('materials')}>Go to materials <b>→</b></button></div>}{error && <p className="ask-message error">{error}</p>}{response && <article className="nexus-response"><div><span className="section-label">NEXUS RESPONSE</span><b>{response.unit.title}</b></div><p>{response.answer}</p><footer>{response.native_document_reading ? <>Read directly from scanned PDF{response.sources.length === 1 ? '' : 's'}: {response.sources.join(', ')}</> : response.sources.length ? <>Used relevant sections from: {response.sources.join(', ')}</> : <>No searchable text was available from the selected PDFs.</>}{!response.native_document_reading && <span>{response.retrieved_chunk_count} chunks retrieved</span>}</footer></article>}</section></DashboardShell>;
}

function readBrowserArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function normalizeChatMessage(entry = {}) {
  const sources = Array.isArray(entry.sources) ? entry.sources.filter((source) => typeof source === 'string') : [];
  return {
    ...entry,
    id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
    question: typeof entry.question === 'string' ? entry.question : '',
    answer: typeof entry.answer === 'string' ? entry.answer : 'NEXUS could not render this saved response.',
    course: typeof entry.course === 'string' ? entry.course : 'Selected course',
    unit: typeof entry.unit === 'string' ? entry.unit : 'Selected unit',
    sources,
    native_document_reading: Boolean(entry.native_document_reading),
    retrieved_chunk_count: Number.isFinite(entry.retrieved_chunk_count) ? entry.retrieved_chunk_count : 0,
    topic: typeof entry.topic === 'string' ? entry.topic : 'General',
    feedback_signal: typeof entry.feedback_signal === 'string' ? entry.feedback_signal : null,
    streaming: Boolean(entry.streaming),
  };
}

function inlineMarkdown(text) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function MarkdownText({ content }) {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\\\n/g, '\n')
    .replace(/\\([#*`])/g, '$1')
    .replace(/(\d)\\\./g, '$1.')
    .trim();
  const nodes = []; let paragraph = []; let list = null;
  const flushParagraph = () => { if (paragraph.length) { nodes.push({ type: 'paragraph', value: paragraph }); paragraph = []; } };
  const flushList = () => { if (list?.items.length) nodes.push(list); list = null; };
  normalized.split('\n').map((line) => line.trim()).forEach((line) => {
    if (!line) { flushParagraph(); flushList(); return; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); nodes.push({ type: `h${heading[1].length}`, value: heading[2] }); return; }
    const bullet = line.match(/^[-*]\s+(.+)$/); const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || ordered) { flushParagraph(); const type = bullet ? 'ul' : 'ol'; if (!list || list.type !== type) { flushList(); list = { type, items: [] }; } list.items.push((bullet || ordered)[1]); return; }
    flushList(); paragraph.push(line);
  });
  flushParagraph(); flushList();
  return <>{nodes.map((node, index) => {
    if (node.type === 'paragraph') return <p key={index}>{node.value.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{inlineMarkdown(line)}</span>)}</p>;
    if (node.type === 'ul' || node.type === 'ol') { const Tag = node.type; return <Tag key={index}>{node.items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}</Tag>; }
    const Tag = node.type; return <Tag key={index}>{inlineMarkdown(node.value)}</Tag>;
  })}</>;
}

class ChatHistoryBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Chat history render failed', error); }
  render() {
    if (this.state.failed) return <div className="chat-recovery"><h3>That chat message could not be displayed.</h3><p>Your conversation is still saved in the database.</p><button className="button primary" onClick={() => { this.props.onReset(); this.setState({ failed: false }); }}>Reload chat</button></div>;
    return this.props.children;
  }
}


function YoutubeRecommendations({ message }) {
  const [state, dispatch] = useReducer(youtubeRecommendationsReducer, initialYoutubeState);

  const requestVideos = async () => {
    if (state.status === 'loading') return;
    dispatch({ type: 'loading' });
    try {
      const result = await api('/youtube/recommendations', {
        method: 'POST',
        timeoutMs: 15000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: message.question, topic: message.topic, responseId: message.id })
      });
      dispatch({ type: 'success', videos: result.videos });
    } catch (err) {
      dispatch({ type: 'error', message: err.message || 'Could not fetch videos.' });
    }
  };

  const toggleVideos = () => {
    if (state.expanded || state.status === 'success' || state.status === 'empty') dispatch({ type: 'toggle' });
    else requestVideos();
  };

  return (
    <div className="youtube-recommendations-wrapper">
      <button className="youtube-toggle" type="button" onClick={toggleVideos} disabled={state.status === 'loading'} aria-expanded={state.expanded}>
        <span aria-hidden="true">▶</span> {state.expanded ? 'Hide Related Videos' : 'Find Related Videos'}
      </button>
      {state.expanded && (
        <section className="youtube-results" aria-live="polite">
          <div className="youtube-heading"><div><h4>Recommended Learning Videos</h4><p>Explore videos that help you understand this topic.</p></div><span>YouTube</span></div>

          {state.status === 'loading' && <div className="youtube-status"><i aria-hidden="true" />Finding relevant videos…</div>}

          {state.status === 'error' && (
            <div className="youtube-state youtube-error" role="alert">
              <p>{state.error}</p>
              <button className="text-button" type="button" onClick={requestVideos}>Retry</button>
            </div>
          )}

          {state.status === 'empty' && <div className="youtube-state"><p>No relevant videos were found for this topic.</p></div>}

          {state.status === 'success' && (
            <div className="youtube-video-list">
              {state.videos.map((video) => {
                const watchUrl = youtubeWatchUrl(video.videoId);
                const thumbnailUrl = safeYoutubeThumbnail(video.thumbnailUrl);
                const published = formatPublishedDate(video.publishedAt);
                if (!watchUrl) return null;
                return (
                <article key={video.videoId} className="youtube-video-card">
                  <a className="youtube-thumbnail" href={watchUrl} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title} on YouTube`}>
                    {thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" /> : <span>▶</span>}
                    {video.duration && <b>{video.duration}</b>}
                  </a>
                  <div className="video-info">
                    <b>{video.title || 'Untitled YouTube video'}</b>
                    <small>{[video.channelTitle, published].filter(Boolean).join(' · ')}</small>
                    {video.description && <p>{video.description}</p>}
                    <a href={watchUrl} target="_blank" rel="noopener noreferrer">Watch on YouTube <span aria-hidden="true">↗</span></a>
                  </div>
                </article>
              );})}
            </div>
          )}
        </section>
      )}
    </div>
  );
}


function ChatMessage({ message, onFeedback, onQuiz, onEscalate, busy, canQuiz = true }) {
  const item = normalizeChatMessage(message);
  const sourceLabel = item.sources.length ? item.sources.join(', ') : 'the selected PDF';
  const approach = item.strategy === 'WORKED_EXAMPLE' ? 'Worked example' : item.strategy === 'SIMPLE_EXPLANATION' ? 'Simpler follow-up' : item.strategy === 'PREREQUISITE_REMEDIATION' ? 'Foundation refresh' : 'Explanation';
  const videos = Array.isArray(item.recommended_videos) ? item.recommended_videos : [];
  return <div className="chat-turn" id={`turn-${item.id}`}>
    <div className="chat-user"><span>You</span><p>{item.question}</p></div>
    <article className="chat-answer"><div><span>NEXUS</span><small>{item.course} · {item.unit} · {item.topic} · {approach}</small></div>{item.answer ? <MarkdownText content={item.answer} /> : <p className="streaming-status">NEXUS is preparing a grounded answer…</p>}{item.streaming && <p className="streaming-status" aria-live="polite">Streaming response…</p>}{!item.streaming && item.recommendation?.reason && <div className="router-reason"><b>NEXUS chose this approach</b><span>{item.recommendation.reason}</span></div>}{!item.streaming && videos.length > 0 && <section className="video-recommendations"><span>TEACHER'S TUTORIAL FOR {item.topic.toUpperCase()}</span>{videos.map((video) => <article key={video.id}><div><b>{video.title}</b><small>{video.teacher_id.replace(/^teacher-/, '')} · {video.topic}</small>{video.description && <p>{video.description}</p>}</div><a className="button ghost" href={video.external_url || `${API_URL}/video-lectures/${video.id}/file`} target="_blank" rel="noreferrer">Open tutorial →</a></article>)}</section>}{!item.streaming && <><footer>{item.native_document_reading ? <>Read directly from: {sourceLabel}</> : item.sources.length ? <>Sources: {sourceLabel}</> : <>General response</>}{!item.native_document_reading && <b>{item.retrieved_chunk_count} chunks retrieved</b>}</footer><div className="learning-actions"><button disabled={busy || Boolean(item.feedback_signal)} onClick={() => onFeedback(item, 'STILL_CONFUSED')}>{item.feedback_signal === 'STILL_CONFUSED' ? 'Marked as confusing' : 'Still confused'}</button><button disabled={busy || Boolean(item.feedback_signal)} onClick={() => onFeedback(item, 'UNDERSTOOD')}>{item.feedback_signal === 'UNDERSTOOD' ? 'Understood ✓' : 'I understand'}</button>{canQuiz && <button disabled={busy} onClick={() => onQuiz(item)}>Test me on {item.topic}</button>}{onEscalate && <button disabled={busy || item.escalated} onClick={() => onEscalate(item)} style={{background: '#ef4444', color: 'white', borderColor: '#ef4444'}}>{item.escalated ? 'Escalated to Teacher' : 'Connect with a Teacher'}</button>}</div><YoutubeRecommendations message={item} /></>}</article>
  </div>;
}

function ChatAskNexus({ go, profile, courses, addActivity, logout }) {
  const [question, setQuestion] = useState('');
  const [courseId, setCourseId] = useState(() => new URLSearchParams(window.location.search).get('course') || '');
  const [unitId, setUnitId] = useState(() => new URLSearchParams(window.location.search).get('unit') || '');
  const [messages, setMessages] = useState([]);
  const [unitLearning, setUnitLearning] = useState(null);
  const [teacherTutorials, setTeacherTutorials] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [quizSession, setQuizSession] = useState(null);
  const [quizComplete, setQuizComplete] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizPending, setQuizPending] = useState(false);
  const [answerPending, setAnswerPending] = useState(false);
  const [quizError, setQuizError] = useState(null);
  const [lastQuizRequest, setLastQuizRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(() => new URLSearchParams(window.location.search).get('history') === 'all');
  const [targetTurnId, setTargetTurnId] = useState(() => new URLSearchParams(window.location.search).get('turn'));
  const selectedCourse = courses.find((course) => course.id === courseId) || courses[0];
  const units = selectedCourse?.units || [];
  const selectedUnit = units.find((unit) => unit.id === unitId) || units[0];
  useEffect(() => { if (selectedCourse && courseId !== selectedCourse.id) setCourseId(selectedCourse.id); }, [selectedCourse, courseId]);
  useEffect(() => { if (selectedUnit && unitId !== selectedUnit.id) setUnitId(selectedUnit.id); }, [selectedUnit, unitId]);
  useEffect(() => {
    if (!selectedCourse || !selectedUnit) return;
    const params = new URLSearchParams(window.location.search);
    const turn = params.get('turn');
    const next = `/ask?course=${encodeURIComponent(selectedCourse.id)}&unit=${encodeURIComponent(selectedUnit.id)}${turn ? `&turn=${encodeURIComponent(turn)}` : ''}${params.get('history') === 'all' ? '&history=all' : ''}`;
    if (window.location.pathname === '/ask' && window.location.pathname + window.location.search !== next)
      window.history.replaceState({ screen: 'ask' }, '', next);
  }, [selectedCourse?.id, selectedUnit?.id]);
  useEffect(() => {
    const openChat = (event) => {
      const chat = event.detail;
      setCourseId(chat.course_id);
      setUnitId(chat.unit_id);
      setTargetTurnId(chat.id);
      setShowAllHistory(false);
      setQuiz(null); setQuizSession(null); setQuizComplete(null);
      setQuizError(null);
    };
    window.addEventListener('nexus:open-chat', openChat);
    return () => window.removeEventListener('nexus:open-chat', openChat);
  }, []);
  useEffect(() => {
    const showAll = () => setShowAllHistory(true);
    window.addEventListener('nexus:show-all-chats', showAll);
    return () => window.removeEventListener('nexus:show-all-chats', showAll);
  }, []);
  useEffect(() => {
    if (!targetTurnId || !messages.some((message) => message.id === targetTurnId)) return;
    const targetMessage = messages.find((message) => message.id === targetTurnId);
    if (!showAllHistory && (targetMessage.course_id !== selectedCourse?.id || targetMessage.unit_id !== selectedUnit?.id)) {
      if (!courses.some((course) => course.id === targetMessage.course_id && course.units.some((unit) => unit.id === targetMessage.unit_id))) setShowAllHistory(true);
      return;
    }
    requestAnimationFrame(() => document.getElementById(`turn-${targetTurnId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [targetTurnId, messages, courses, selectedCourse?.id, selectedUnit?.id, showAllHistory]);
  const refreshHistory = () => api('/chat/turns').then((turns) => { setMessages(turns.map(normalizeChatMessage)); window.dispatchEvent(new Event('nexus:chat-updated')); });
  const refreshUnitLearning = (id = selectedUnit?.id) => id && id === selectedUnit?.id ? api(`/units/${id}/learning`).then(setUnitLearning) : Promise.resolve();
  useEffect(() => {
    if (!selectedUnit) { setUnitLearning(null); return; }
    let active = true;
    setUnitLearning(null);
    api(`/units/${selectedUnit.id}/learning`).then((state) => { if (active) setUnitLearning(state); })
      .catch(() => { if (active) setUnitLearning(null); });
    return () => { active = false; };
  }, [selectedUnit?.id]);
  useEffect(() => {
    const weak = (unitLearning?.topics || []).filter((item) => item.status === 'NEEDS_PRACTICE').slice(0, 4);
    if (!selectedCourse || !weak.length) { setTeacherTutorials([]); return; }
    let active = true;
    Promise.all(weak.map((item) => api(`/video-lectures?subject=${encodeURIComponent(selectedCourse.title)}&topic=${encodeURIComponent(item.topic)}`).catch(() => [])))
      .then((groups) => {
        if (!active) return;
        const unique = new Map();
        groups.flat().forEach((video) => unique.set(video.id, video));
        setTeacherTutorials([...unique.values()]);
      });
    return () => { active = false; };
  }, [selectedCourse?.id, unitLearning]);
  useEffect(() => {
    let active = true;
    api('/chat/turns')
      .then((turns) => { if (active) setMessages(turns.map(normalizeChatMessage)); })
      .catch((loadError) => { if (active) setError(loadError.message || 'Could not load saved learning history.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!courses.length) return;
    const oldTurns = readBrowserArray(askHistoryKey);
    const importable = oldTurns.map((turn) => {
      const course = courses.find((item) => item.title === turn.course);
      const unit = course?.units.find((item) => item.title === turn.unit);
      return course && unit && turn.id ? { id: turn.id, course_id: course.id, unit_id: unit.id,
        question: turn.question, answer: turn.answer, sources: turn.sources || [],
        native_document_reading: Boolean(turn.native_document_reading),
        retrieved_chunk_count: turn.retrieved_chunk_count || 0 } : null;
    }).filter(Boolean);
    if (!importable.length) return;
    api('/chat/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importable) })
      .then(refreshHistory).then(() => {
        const migrated = new Set(importable.map((turn) => turn.id));
        const remaining = oldTurns.filter((turn) => !migrated.has(turn.id));
        if (remaining.length) localStorage.setItem(askHistoryKey, JSON.stringify(remaining));
        else localStorage.removeItem(askHistoryKey);
      }).catch((importError) => setError(importError.message || 'Could not import older browser chat.'));
  }, [courses]);
  const selectCourse = (nextCourseId) => { const next = courses.find((course) => course.id === nextCourseId); setCourseId(nextCourseId); setUnitId(next?.units[0]?.id || ''); setQuiz(null); setQuizSession(null); setQuizComplete(null); setQuizError(null); setError(''); };
  const submit = async (event) => {
    event.preventDefault(); if (!question.trim() || !selectedCourse || !selectedUnit) return;
    const asked = question.trim(); const temporaryId = `stream-${crypto.randomUUID()}`; setLoading(true); setError(''); setQuestion('');
    setMessages((all) => [...all, normalizeChatMessage({ id: temporaryId, question: asked, answer: '', course_id: selectedCourse.id, unit_id: selectedUnit.id,
      course: selectedCourse.title, unit: selectedUnit.title, topic: 'Preparing context', sources: [], retrieved_chunk_count: 0, streaming: true })]);
    try {
      await streamAsk({ question: asked, course_id: selectedCourse.id, unit_id: selectedUnit.id }, (eventName, data) => {
        if (eventName === 'metadata') setMessages((all) => all.map((message) => message.id === temporaryId ? { ...message, ...data, topic: data.topic || message.topic } : message));
        if (eventName === 'delta') setMessages((all) => all.map((message) => message.id === temporaryId ? { ...message, answer: `${message.answer || ''}${data.text || ''}` } : message));
        if (eventName === 'done' && data.turn) {
          setMessages((all) => all.map((message) => message.id === temporaryId ? normalizeChatMessage(data.turn) : message));
          window.dispatchEvent(new Event('nexus:chat-updated'));
          window.dispatchEvent(new Event('nexus:learning-updated'));
          refreshUnitLearning(selectedUnit.id).catch(() => {});
          addActivity(`Asked NEXUS in ${selectedUnit.title}: ${asked}`);
        }
      });
    } catch (requestError) { setMessages((all) => all.filter((message) => message.id !== temporaryId)); setError(requestError.message || 'NEXUS could not answer that question. Please try again.'); }
    finally { setLoading(false); }
  };
  const escalateToTeacher = async (message) => {
    try {
      await api('/teacher/escalate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: message.id, reason: 'Student manually requested teacher escalation.' }) });
      setMessages(all => all.map(m => m.id === message.id ? { ...m, escalated: true } : m));
      alert("NEXUS has escalated this topic to a human teacher! They will review your session and follow up.");
    } catch (e) {
      alert("Failed to escalate: " + e.message);
    }
  };

  const giveFeedback = async (message, signal) => {
    setBusy(true); setError('');
    try {
      await api('/chat/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: message.id, signal }) });
      await Promise.all([refreshHistory(), refreshUnitLearning(message.unit_id)]);
      window.dispatchEvent(new Event('nexus:learning-updated'));
      if (signal === 'STILL_CONFUSED') setQuestion(`I still don't understand ${message.topic}. Please explain it another way with a simple example.`);
    } catch (feedbackError) { setError(feedbackError.message); }
    finally { setBusy(false); }
  };
  const startQuiz = async (message = null, topicOverride = null, continuing = false) => {
    setBusy(true); setQuizPending(true); setQuizError(null); setError('');
    setLastQuizRequest({ message, topicOverride, continuing });
    if (!continuing) {
      setQuizSession({ current: 1, total: QUIZ_QUESTION_TOTAL, correct: 0 });
      setQuizComplete(null);
    }
    try {
      const next = await api('/quiz', { method: 'POST', timeoutMs: 90000, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: message?.course_id || selectedCourse?.id,
          unit_id: message?.unit_id || selectedUnit?.id, topic: topicOverride || message?.topic || undefined }) });
      if (!next?.id || !next.question || !Array.isArray(next.options) || next.options.length !== 4)
        throw new Error('The quiz service returned an incomplete question. Please try again.');
      setQuiz(next); setQuizResult(null); setSelectedOption(null);
      if (continuing) setQuizSession((session) => session ? { ...session, current: Math.min(session.total, session.current + 1) } : session);
      requestAnimationFrame(() => document.querySelector('.quiz-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (requestError) { setQuizError({ kind: 'generate', message: requestError.message || 'Could not prepare a new question.' }); }
    finally { setBusy(false); setQuizPending(false); }
  };
  const answerQuiz = async (answerIndex) => {
    if (!quiz || quizResult || answerIndex === null || answerIndex === undefined) return;
    setBusy(true); setAnswerPending(true); setQuizError(null); setError('');
    try {
      const result = await api(`/quiz/${quiz.id}/answer`, { method: 'POST', timeoutMs: 20000, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_index: answerIndex }) });
      if (typeof result?.correct !== 'boolean' || !Number.isInteger(result.correct_index) || !result.explanation)
        throw new Error('The quiz service returned an incomplete answer. Please try again.');
      setQuizResult({ ...result, answer_index: answerIndex });
      if (result.correct) setQuizSession((session) => session ? { ...session, correct: session.correct + 1 } : session);
      refreshUnitLearning(quiz.unit_id).catch(() => {});
      window.dispatchEvent(new Event('nexus:learning-updated'));
      addActivity(`${result.correct ? 'Answered correctly' : 'Needs practice'}: ${result.topic}`);
    } catch (requestError) { setQuizError({ kind: 'answer', message: requestError.message || 'Could not check your answer.' }); }
    finally { setBusy(false); setAnswerPending(false); }
  };
  const pdfCount = selectedUnit?.materials.length || 0;
  const visibleMessages = showAllHistory ? messages : messages.filter((message) => message.course_id === selectedCourse?.id && message.unit_id === selectedUnit?.id);
  const weakTopics = (unitLearning?.topics || []).filter((item) => item.status === 'NEEDS_PRACTICE');
  const isFinalQuestion = Boolean(quizSession && quizSession.current === quizSession.total);
  const completeQuiz = () => {
    if (!quizSession) return;
    setQuizComplete(quizSession);
    addActivity(`Completed ${quizSession.total}-question quiz: ${quizSession.correct}/${quizSession.total} correct`);
    setQuiz(null); setQuizResult(null); setSelectedOption(null); setQuizSession(null); setQuizError(null);
  };
  const nextQuizQuestion = () => {
    if (!quiz || !quizSession) return;
    startQuiz({ course_id: quiz.course_id, unit_id: quiz.unit_id }, quizResult.unit_progress?.mastery < 70 ? quiz.topic : null, true);
  };
  return <DashboardShell title="Ask NEXUS" go={go} profile={profile} screen="ask" logout={logout}>
    <section className="page-heading"><h1>Ask NEXUS</h1><p>Ask follow-up questions in context. Your conversation and practice progress are saved in Postgres.</p></section>
    {weakTopics.length > 0 && <section className="learning-progress panel"><div><span className="section-label">THIS UNIT</span><h3>Topics to strengthen</h3></div><div className="topic-chips">{weakTopics.map((item) => <span key={item.topic}>{item.topic}<b>{item.mastery}%</b></span>)}</div><small>Practice focuses on these topics until your answers show improvement.</small></section>}
    {teacherTutorials.length > 0 && <section className="weak-topic-tutorials"><div><span className="section-label">TEACHER'S TUTORIAL</span><h3>A teacher has covered your current weak topic.</h3><p>These uploaded lessons match the concepts NEXUS recommends strengthening next.</p></div><div>{teacherTutorials.slice(0, 3).map((video) => <article key={video.id}><span>▶</span><div><small>{video.subject} · {video.topic}</small><b>{video.title}</b></div><a href={video.external_url || `${API_URL}/video-lectures/${video.id}/file`} target="_blank" rel="noreferrer">Open tutorial →</a></article>)}</div></section>}
    <section className="panel ask-panel chat-panel">
      <div className="ask-panel-head"><div><span className="section-label">LEARNING CHAT</span><h2>{selectedUnit ? `${selectedCourse.title} · ${selectedUnit.title}` : 'Choose your material context.'}</h2></div><div className="chat-actions"><button className="text-button" onClick={() => setShowAllHistory((current) => !current)}>{showAllHistory ? 'This unit' : `All chats (${messages.length})`}</button>{pdfCount ? <span className="material-ready">✓ {pdfCount} PDF{pdfCount === 1 ? '' : 's'} ready</span> : <button className="text-button" onClick={() => go('materials')}>Add materials →</button>}</div></div>
      {courses.length ? <>
        <div className="ask-context"><label><span>COURSE</span><select value={selectedCourse?.id || ''} onChange={(event) => selectCourse(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label><span>UNIT</span><select value={selectedUnit?.id || ''} onChange={(event) => { setUnitId(event.target.value); setQuiz(null); setQuizError(null); setError(''); }}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select></label></div>
        {selectedUnit && <section className="unit-practice"><div><span className="section-label">PERSONALIZED PRACTICE</span><h3>Quiz for {selectedUnit.title}</h3><p>{unitLearning?.recommended_topic ? `Next focus: ${unitLearning.recommended_topic}.` : 'Start with a key idea from your PDFs.'} Each answer shapes the next question.</p>{unitLearning?.answered_count > 0 && <small>{unitLearning.answered_count} question{unitLearning.answered_count === 1 ? '' : 's'} answered in this unit · next level: {unitLearning.recommended_difficulty.toLowerCase()}</small>}{unitLearning?.recent_results?.length > 0 && <div className="practice-history">{unitLearning.recent_results.slice(0, 3).map((result, index) => <span key={index} className={result.correct ? 'correct' : 'incorrect'}>{result.correct ? '✓' : '↺'} {result.topic} · {result.difficulty.toLowerCase()}</span>)}</div>}</div><button className="button primary" type="button" disabled={!pdfCount || busy} onClick={() => startQuiz()}>{busy ? 'Preparing…' : 'Start 10-question quiz →'}</button></section>}
        <ChatHistoryBoundary onReset={refreshHistory}><div className="chat-thread">{visibleMessages.length ? visibleMessages.map((message) => <ChatMessage key={message.id} message={message} onFeedback={giveFeedback} onQuiz={startQuiz} onEscalate={escalateToTeacher} busy={busy} canQuiz={courses.some((course) => course.id === message.course_id && course.units.some((unit) => unit.id === message.unit_id))} />) : <div className="chat-welcome"><span>✦</span><h3>Start with a question.</h3><p>{pdfCount ? `NEXUS will consider every PDF in ${selectedUnit.title}.` : 'Select a unit with PDFs to begin.'}</p></div>}{loading && !visibleMessages.some((message) => message.streaming) && <article className="chat-answer thinking"><span>NEXUS is reading your material…</span></article>}</div></ChatHistoryBoundary>
        {quizPending && <div className="quiz-status" role="status"><span className="quiz-status-dot" />Preparing your next question from this unit…</div>}
        {quizError?.kind === 'generate' && <RequestAlert title="Could not prepare the next question" message={quizError.message} onRetry={() => startQuiz(lastQuizRequest?.message, lastQuizRequest?.topicOverride, lastQuizRequest?.continuing)} onDismiss={() => setQuizError(null)} />}
        {quizComplete && <section className="quiz-complete" role="status"><span className="section-label">QUIZ COMPLETE</span><h3>Your score: {quizComplete.correct} / {quizComplete.total}</h3><p>{Math.round((quizComplete.correct / quizComplete.total) * 100)}% correct. Your answers have updated the next topics and difficulty NEXUS recommends.</p><button className="button primary" type="button" onClick={() => startQuiz()}>Start another quiz →</button></section>}
        {quiz && <section className="quiz-card">
          <div className="quiz-card-heading"><span>QUESTION {quizSession?.current || 1} / {quizSession?.total || QUIZ_QUESTION_TOTAL} · {quiz.difficulty} · {quiz.topic}</span><button onClick={() => { setQuiz(null); setQuizResult(null); setSelectedOption(null); setQuizSession(null); setQuizError(null); }} aria-label="Close quiz">×</button></div>
          <h3>{quiz.question}</h3>
          <div className="quiz-options">{quiz.options.map((option, index) => <button key={index} type="button" disabled={busy || Boolean(quizResult)} aria-pressed={selectedOption === index} className={quizResult ? index === quizResult.correct_index ? 'correct' : index === quizResult.answer_index ? 'incorrect' : '' : selectedOption === index ? 'selected' : ''} onClick={() => setSelectedOption(index)}><span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
          {quizError?.kind === 'answer' && <RequestAlert title="Could not check your answer" message={quizError.message} onRetry={() => answerQuiz(selectedOption)} onDismiss={() => setQuizError(null)} />}
          {!quizResult && <div className="quiz-submit"><span>{selectedOption === null ? 'Choose an option to continue.' : 'Ready to check your answer?'}</span><button type="button" className="button primary" disabled={busy || selectedOption === null} onClick={() => answerQuiz(selectedOption)}>{answerPending ? 'Checking…' : 'Next →'}</button></div>}
          {quizResult && <div className={`quiz-result ${quizResult.correct ? 'is-correct' : 'is-incorrect'}`} role="status"><h4>{quizResult.correct ? 'Correct answer' : 'Not quite — here is the correct answer'}</h4><p className="quiz-correct-answer"><b>{String.fromCharCode(65 + quizResult.correct_index)}.</b> {quiz.options[quizResult.correct_index]}</p><p className="quiz-explanation">{quizResult.explanation}</p>{isFinalQuestion && <div className="quiz-final-score"><span>FINAL SCORE</span><strong>{quizSession.correct} / {quizSession.total}</strong><small>{Math.round((quizSession.correct / quizSession.total) * 100)}% correct across this quiz</small></div>}<div className="quiz-next"><small>{isFinalQuestion ? 'Your final score is ready.' : `Question ${quizSession?.current || 1} of ${quizSession?.total || QUIZ_QUESTION_TOTAL} complete.`}</small><button className="button primary" disabled={busy} onClick={isFinalQuestion ? completeQuiz : nextQuizQuestion}>{isFinalQuestion ? 'Finish quiz →' : quizPending ? 'Preparing…' : 'Next question →'}</button></div></div>}
        </section>}
        {selectedUnit ? <form className="chat-composer" onSubmit={submit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`Ask about ${selectedUnit.title}...`} /><button className="button primary" type="submit" disabled={loading || !pdfCount || !question.trim()}>{loading ? 'Thinking…' : <>Send <b>↑</b></>}</button></form> : <p className="ask-message">Create a unit before asking a material-grounded question.</p>}
      </> : <div className="ask-empty"><h3>Choose a course and unit first.</h3><p>Once a unit contains PDFs, NEXUS can answer against that material. Your saved conversations remain below.</p><button className="button primary" onClick={() => go('materials')}>Go to materials <b>→</b></button>{messages.length > 0 && <div className="chat-thread">{messages.map((message) => <ChatMessage key={message.id} message={message} onFeedback={giveFeedback} onQuiz={startQuiz} onEscalate={escalateToTeacher} busy={busy} canQuiz={false} />)}</div>}</div>}
      {error && <RequestAlert title="Something went wrong" message={error} onDismiss={() => setError('')} />}
    </section>
  </DashboardShell>;
}

function TeacherStudio({ go, profile, logout }) {
  const [videos, setVideos] = useState([]); const [subject, setSubject] = useState(''); const [topic, setTopic] = useState(''); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [videoUrl, setVideoUrl] = useState(''); const [videoFile, setVideoFile] = useState(null); const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false);
  const loadVideos = () => api('/teacher/videos').then(setVideos).catch((error) => setNotice(error.message));
  useEffect(() => { loadVideos(); }, []);
  const submit = async (event) => {
    event.preventDefault(); if (!subject.trim() || !topic.trim() || !title.trim() || (!videoFile && !videoUrl.trim())) return setNotice('Add a subject, topic, title, and either a video file or link.');
    setSaving(true); setNotice('');
    try {
      let created;
      if (videoFile) { const data = new FormData(); data.append('subject', subject.trim()); data.append('topic', topic.trim()); data.append('title', title.trim()); data.append('description', description.trim()); data.append('file', videoFile); created = await api('/teacher/videos', { method: 'POST', body: data, timeoutMs: 120000 }); }
      else created = await api('/teacher/videos/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), topic: topic.trim(), title: title.trim(), description: description.trim(), external_url: videoUrl.trim() }) });
      setVideos((all) => [created, ...all]); setSubject(''); setTopic(''); setTitle(''); setDescription(''); setVideoUrl(''); setVideoFile(null); setNotice('Lecture published. Students asking about this topic can now receive it as a recommendation.');
    } catch (error) { setNotice(error.message || 'Could not publish the video lecture.'); } finally { setSaving(false); }
  };
  const remove = async (video) => { if (!window.confirm(`Remove “${video.title}”?`)) return; try { await api(`/teacher/videos/${video.id}`, { method: 'DELETE' }); setVideos((all) => all.filter((item) => item.id !== video.id)); } catch (error) { setNotice(error.message); } };
  return <DashboardShell title="Teacher studio" go={go} profile={profile} screen="teacher" logout={logout}><section className="page-heading"><span className="page-eyebrow">TEACHER COPILOT</span><h1>Share a lecture when it helps most.</h1><p>Tag a video by subject and topic. NEXUS can recommend it when a learner’s chat and practice signals show they need that explanation.</p></section><section className="teacher-grid"><form className="panel teacher-upload" onSubmit={submit}><div className="panel-title"><h3>Publish a video lecture</h3><span>Topic-aware</span></div><Field label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Computer Network" /><Field label="Topic" value={topic} onChange={setTopic} placeholder="e.g. VLSM" /><Field label="Lecture title" value={title} onChange={setTitle} placeholder="e.g. VLSM worked examples" /><label className="field"><span>Short description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will this lecture help the learner understand?" /></label><label className="field"><span>Upload video (MP4, WebM, MOV)</span><input type="file" accept="video/mp4,video/webm,video/quicktime,.m4v" onChange={(event) => { setVideoFile(event.target.files?.[0] || null); if (event.target.files?.[0]) setVideoUrl(''); }} /></label><div className="teacher-or">or use a hosted link</div><Field label="Video link" value={videoUrl} onChange={(value) => { setVideoUrl(value); if (value) setVideoFile(null); }} placeholder="https://…" required={false} /><button className="button primary" disabled={saving} type="submit">{saving ? 'Publishing…' : 'Publish lecture →'}</button>{notice && <p className="teacher-notice">{notice}</p>}</form><section className="panel teacher-library"><div className="panel-title"><h3>Your lecture library</h3><span>{videos.length} published</span></div>{videos.length ? <div className="teacher-video-list">{videos.map((video) => <article key={video.id}><span>{video.subject} · {video.topic}</span><h3>{video.title}</h3>{video.description && <p>{video.description}</p>}<div><a className="text-button" href={video.external_url || `${API_URL}/video-lectures/${video.id}/file`} target="_blank" rel="noreferrer">Open lecture →</a><button className="text-button danger" type="button" onClick={() => remove(video)}>Remove</button></div></article>)}</div> : <div className="teacher-empty"><b>No lectures yet.</b><p>Publish your first topic-tagged video and NEXUS will surface it to learners when it matches their need.</p></div>}</section></section></DashboardShell>;
}

function Account({ go, profile, setProfile, logout }) { const [name, setName] = useState(profile.name || ''); const [email, setEmail] = useState(profile.email || ''); const [password, setPassword] = useState(''); const [saved, setSaved] = useState(''); const submit = async (event) => { event.preventDefault(); const role = profile.role === 'teacher' ? 'teacher' : 'student'; const oldEmail = (profile.email || '').trim().toLowerCase(); const nextEmail = email.trim().toLowerCase(); const users = readRoleUsers(role); if (nextEmail !== oldEmail && users[nextEmail]) { setSaved(`Another ${role} account already uses that email.`); return; } const current = users[oldEmail] || { role }; const updated = { ...current, name: name.trim(), email: email.trim(), role }; if (password) { if (password.length < 8) { setSaved('Use at least 8 characters for the new password.'); return; } updated.passwordHash = await hashPassword(password); delete updated.password; } if (oldEmail && oldEmail !== nextEmail) delete users[oldEmail]; users[nextEmail] = updated; saveRoleUsers(role, users); const next = { ...profile, name: updated.name, email: updated.email, role }; localStorage.setItem(localKey, JSON.stringify(next)); localStorage.setItem(userIdKey, role === 'teacher' ? `teacher-${nextEmail}` : `user-${nextEmail}`); setProfile(next); setPassword(''); setSaved('Your account details and login credentials have been saved.'); }; return <DashboardShell title="Account details" go={go} profile={profile} screen="account" logout={logout}><section className="page-heading"><div><h1>Make this space yours.</h1><p>Update the details NEXUS uses to personalise your learning experience.</p></div></section><section className="account-grid"><article className="panel account-profile"><span className="avatar big">{initials(profile.name)}</span><h2>{profile.name || 'Your profile'}</h2><p>{profile.email || 'Your NEXUS account'}</p><span className="pill muted-pill">{profile.role === 'teacher' ? 'Teacher' : 'Student'}</span></article><article className="panel account-form"><div className="panel-title"><h3>Personal details</h3><span>{profile.role === 'teacher' ? 'Teacher credentials' : 'Student credentials'}</span></div><form onSubmit={submit}><Field label="Full name" value={name} onChange={setName} placeholder="Your name" /><Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" /><Field label="New password (optional)" type="password" value={password} onChange={setPassword} placeholder="Leave blank to keep your current password" required={false} /><button className="button primary" type="submit">Save changes <b>→</b></button>{saved && <p className="success-message">{saved}</p>}</form></article></section></DashboardShell>; }

function App() {
  const [profile, setProfile] = useState(readStoredProfile);
  const [screen, setScreen] = useState(() => resolveScreenForSession(screenFromLocation(), readStoredProfile()));
  const [courses, setCourses] = useState([]); const [activity, setActivity] = useState(() => readBrowserArray(activityKey));
  const activeScreen = resolveScreenForSession(screen, profile);
  const addActivity = (entry) => setActivity((all) => [entry, ...all].slice(0, 6));
  useEffect(() => {
    if (!hasSession() || profile.role !== 'student') { setCourses([]); return; }
    api('/courses').then((loadedCourses) => { setCourses(loadedCourses); setActivity((existing) => existing.length ? existing : loadedCourses.flatMap((course) => course.units.flatMap((unit) => unit.materials.map((material) => `Added PDF: ${material.name}`))).slice(0, 6)); }).catch(() => {});
  }, [profile.role]);
  useEffect(() => { localStorage.setItem(activityKey, JSON.stringify(activity)); }, [activity]);
  useEffect(() => {
    const requested = resolveScreenForSession(screenFromLocation(), readStoredProfile());
    const expectedPath = screenPaths[requested];
    if (expectedPath && window.location.pathname !== expectedPath) window.history.replaceState({ screen: requested }, '', expectedPath);
    setScreen(requested);
    const handlePopState = () => {
      const requestedScreen = screenFromLocation();
      const target = resolveScreenForSession(requestedScreen, readStoredProfile());
      if (target !== requestedScreen) window.history.replaceState({ screen: target }, '', screenPaths[target]);
      setScreen(target);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  useEffect(() => {
    if (activeScreen === screen) return;
    window.history.replaceState({ screen: activeScreen }, '', screenPaths[activeScreen] || '/');
    setScreen(activeScreen);
  }, [activeScreen, screen]);
  const go = (next, options = {}) => {
    const target = resolveScreenForSession(next, readStoredProfile());
    const suffix = target === 'ask' && options.courseId && options.unitId
      ? `?course=${encodeURIComponent(options.courseId)}&unit=${encodeURIComponent(options.unitId)}${options.turnId ? `&turn=${encodeURIComponent(options.turnId)}` : ''}`
      : target === 'ask' && options.showAllChats ? '?history=all'
      : target === 'ask' && screen === 'ask' ? window.location.search : '';
    const targetPath = (screenPaths[target] || '/') + suffix;
    if (window.location.pathname + window.location.search !== targetPath) {
      window.history[options.replace ? 'replaceState' : 'pushState']({ screen: target }, '', targetPath);
    }
    setScreen(target);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const logout = () => { localStorage.removeItem(sessionKey); localStorage.removeItem(localKey); localStorage.removeItem(userIdKey); setProfile({}); go('landing', { replace: true }); };
  if (activeScreen === 'signup' || activeScreen === 'login') return <Auth key={activeScreen} type={activeScreen} go={go} setProfile={setProfile} />;
  if (activeScreen === 'teacher-session') return <TeacherSession go={go} profile={profile} logout={logout} />;
  if (activeScreen === 'home') return <Home go={go} profile={profile} activity={activity} logout={logout} />;
  if (activeScreen === 'learnerTwin') return <LearnerTwin go={go} profile={profile} logout={logout} />;
  if (activeScreen === 'materials') return <Materials go={go} profile={profile} courses={courses} setCourses={setCourses} addActivity={addActivity} logout={logout} />;
  if (activeScreen === 'teacher') return <TeacherDashboard go={go} profile={profile} logout={logout} />;
  if (activeScreen === 'account') return <Account go={go} profile={profile} setProfile={setProfile} logout={logout} />;
  if (activeScreen === 'ask') return <ChatAskNexus go={go} profile={profile} courses={courses} addActivity={addActivity} logout={logout} />;
  if (activeScreen === 'notes') return <NotesWorkspace go={go} profile={profile} courses={courses} logout={logout} />;
  if (activeScreen === 'labs') return <InteractiveLabs go={go} profile={profile} logout={logout} />;
  if (activeScreen === 'liveTutor') return <LiveTutor go={go} profile={profile} courses={courses} logout={logout} />;
  if (activeScreen === 'studentCopilot') return <StudentTeacherCopilot go={go} profile={profile} logout={logout} />;
  if (activeScreen === 'student-meeting') return <StudentTeacherMeeting go={go} profile={profile} logout={logout} />;
  if (activeScreen === 'activity') return <DashboardShell title="Activity" go={go} profile={profile} screen="activity" logout={logout}><section className="page-heading"><h1>Your activity</h1><p>Your uploaded material, questions, and workspace changes appear here.</p></section><ActivityCard items={activity} /></DashboardShell>;
  if (activeScreen === 'notFound') return <ErrorPage code="404" title="This page isn't here." message="The address may have changed. Your learning space is still available." />;
  return <Landing go={go} />;
}


// ============================================================
// AI NOTES WORKSPACE
// ============================================================
function NotesWorkspace({ go, profile, courses, logout }) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || '');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const course = courses.find(c => c.id === selectedCourse);
  const materials = course ? course.units.flatMap(u => u.materials) : [];

  useEffect(() => {
    if (selectedMaterial) {
      setLoading(true);
      setError('');
      api(`/notes/material/${selectedMaterial}`)
        .then(res => setNotes(res))
        .catch(err => {
          if (err.message.includes('404')) {
            setNotes(null);
          } else {
            setError(err.message);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setNotes(null);
    }
  }, [selectedMaterial]);

  const generateNotes = async () => {
    if (!selectedMaterial) return;
    setGenerating(true);
    setError('');
    try {
      const materialObj = materials.find(m => m.id === selectedMaterial);
      const unitObj = course.units.find(u => u.materials.some(m => m.id === selectedMaterial));
      const res = await api('/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: selectedMaterial,
          unit_id: unitObj.id,
          course_id: course.id
        })
      });
      // Poll for status
      const poll = setInterval(async () => {
        try {
          const check = await api(`/notes/material/${selectedMaterial}`);
          if (check.status === 'READY' || check.status === 'FAILED') {
            clearInterval(poll);
            setNotes(check);
            setGenerating(false);
          }
        } catch (e) {}
      }, 2000);
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  };

  return <DashboardShell title="AI Notes" go={go} profile={profile} screen="notes" logout={logout}>
    <section className="page-heading">
      <span className="page-eyebrow">SMART STUDY</span>
      <h1>AI-Generated Notes</h1>
      <p>NEXUS extracts concepts, definitions, and flashcards directly from your PDFs.</p>
    </section>
    <div className="notes-controls panel" style={{ marginBottom: 20 }}>
      <label className="field"><span>Course</span>
        <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedMaterial(''); }}>
          <option value="">Select a course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      {course && <label className="field"><span>Material</span>
        <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)}>
          <option value="">Select a PDF</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>}
      {selectedMaterial && !notes && !loading && !generating && (
        <button className="button primary" onClick={generateNotes}>Generate Notes →</button>
      )}
      {generating && <div className="quiz-status-dot" style={{ display: 'inline-block', marginLeft: 15 }} />}
      {generating && <span style={{ marginLeft: 10, fontSize: 13 }}>NEXUS is generating your notes...</span>}
    </div>

    {error && <RequestAlert title="Notes Error" message={error} onDismiss={() => setError('')} />}

    {loading && !generating && <div className="empty-card">Loading notes...</div>}

    {notes && notes.status === 'READY' && (
      <div className="notes-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, alignItems: 'start' }}>
        <article className="panel">
          <div className="panel-title"><h2>{notes.title} Notes</h2></div>
          <p>{notes.overview}</p>
          
          <h3 style={{ marginTop: 25, fontSize: 16 }}>Key Concepts</h3>
          {notes.key_concepts?.map((kc, i) => (
            <div key={i} style={{ marginBottom: 15, padding: 15, background: '#f8fafc', borderRadius: 10 }}>
              <strong style={{ color: '#274fbd' }}>{kc.concept}</strong>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: '#4a5568' }}>{kc.explanation}</p>
            </div>
          ))}

          <h3 style={{ marginTop: 25, fontSize: 16 }}>Definitions</h3>
          <ul style={{ paddingLeft: 20 }}>
            {notes.definitions?.map((d, i) => (
              <li key={i} style={{ marginBottom: 8, fontSize: 13, color: '#4a5568' }}>
                <strong style={{ color: '#1a202c' }}>{d.term}:</strong> {d.definition}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-title"><h3>Exam Points</h3></div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {notes.exam_points?.map((p, i) => (
              <li key={i} style={{ marginBottom: 10, fontSize: 13, color: '#4a5568' }}>{p}</li>
            ))}
          </ul>
          
          <div className="panel-title" style={{ marginTop: 30 }}><h3>Practice Flashcards</h3></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {notes.flashcards?.map((f, i) => (
              <div key={i} style={{ padding: 15, border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <b style={{ display: 'block', fontSize: 13 }}>Q: {f.front}</b>
                <span style={{ display: 'block', fontSize: 12, color: '#718096', marginTop: 5 }}>A: {f.back}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    )}
    
    {notes && notes.status === 'FAILED' && (
      <div className="empty-card" style={{ color: '#c53030' }}>
        Generation failed: {notes.error}
        <br/><br/>
        <button className="button" onClick={generateNotes}>Try Again</button>
      </div>
    )}
  </DashboardShell>;
}

// ============================================================
// LIVE AI TUTOR
// ============================================================
function LiveTutor({ go, profile, courses, logout }) {
  const [subject, setSubject] = useState('Computer Networks');
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const messageAbortRef = useRef(null);
  const activeSessionIdRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionStartedAtRef = useRef(null);
  const submitMessageRef = useRef(null);

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    let active = true;
    api('/sessions')
      .then((items) => { if (active) setHistory(items); })
      .catch(() => { if (active) setHistory([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript.trim();
        setRecording(false);
        if (spokenText) submitMessageRef.current?.(spokenText);
      };
      recognition.onerror = () => setRecording(false);
      recognition.onend = () => setRecording(false);
      recognitionRef.current = recognition;
    }

    return () => {
      messageAbortRef.current?.abort();
      try { recognitionRef.current?.abort(); } catch { /* Browser already stopped it. */ }
      window.speechSynthesis?.cancel();
      activeSessionIdRef.current = null;
    };
  }, []);

  const stopTutorMedia = () => {
    messageAbortRef.current?.abort();
    messageAbortRef.current = null;
    try { recognitionRef.current?.abort(); } catch { /* Browser already stopped it. */ }
    window.speechSynthesis?.cancel();
    setRecording(false);
    setSpeaking(false);
    setLoading(false);
  };

  const toggleRecording = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("Microphone not supported in this browser. Try typing instead.");
      return;
    }
    if (recording) {
      recognition.abort();
      setRecording(false);
    } else {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      recognition.start();
      setRecording(true);
    }
  };

  const startSession = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject })
      });
      activeSessionIdRef.current = res.id;
      sessionStartedAtRef.current = Date.now();
      sessionRef.current = res;
      setSession(res);
      setSelectedHistory(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const endSession = async () => {
    const endingSession = sessionRef.current;
    if (!endingSession) return;
    const durationSeconds = sessionStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000))
      : 0;

    activeSessionIdRef.current = null;
    sessionRef.current = null;
    stopTutorMedia();
    setSession(null);
    setInput('');
    const completedPreview = { ...endingSession, status: 'COMPLETED', duration_seconds: durationSeconds, ended_at: new Date().toISOString() };
    setSelectedHistory(completedPreview);
    setHistory((items) => [completedPreview, ...items.filter((item) => item.id !== completedPreview.id)]);
    setError('Call ended. Your conversation has been saved.');

    try {
      const savedSession = await api(`/sessions/${endingSession.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: durationSeconds })
      });
      setSelectedHistory(savedSession);
      setHistory((items) => [savedSession, ...items.filter((item) => item.id !== savedSession.id)]);
    } catch (err) {
      setError(`Call ended and audio stopped. The server could not finish the session summary: ${err.message}`);
    }
  };

  const sendTutorMessage = async (rawMessage) => {
    const activeSession = sessionRef.current;
    const msg = rawMessage.trim();
    if (!msg || !activeSession || activeSessionIdRef.current !== activeSession.id) return;
    const sessionId = activeSession.id;
    setInput('');
    setLoading(true);
    setError('');
    const controller = new AbortController();
    messageAbortRef.current?.abort();
    messageAbortRef.current = controller;
    try {
      setSession((current) => current?.id === sessionId
        ? { ...current, transcript: [...(current.transcript || []), { role: 'student', text: msg }] }
        : current);
      const res = await api(`/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, duration_seconds: 0 }),
        signal: controller.signal,
      });
      if (activeSessionIdRef.current !== sessionId || controller.signal.aborted) return;
      setSession((current) => current?.id === sessionId
        ? { ...current, transcript: [...(current.transcript || []), { role: 'tutor', text: res.response }] }
        : current);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(res.response);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.onstart = () => {
          if (activeSessionIdRef.current === sessionId) setSpeaking(true);
        };
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      if (!controller.signal.aborted && activeSessionIdRef.current === sessionId) setError(err.message);
    } finally {
      if (activeSessionIdRef.current === sessionId) setLoading(false);
      if (messageAbortRef.current === controller) messageAbortRef.current = null;
    }
  };
  submitMessageRef.current = sendTutorMessage;

  const sendMessage = (event) => {
    event.preventDefault();
    sendTutorMessage(input);
  };

  const openSavedSession = async (savedSession) => {
    setSelectedHistory(savedSession);
    try {
      const latest = await api(`/sessions/${savedSession.id}`);
      setSelectedHistory(latest);
    } catch { /* The list response already contains the saved transcript. */ }
  };

  const suggestedTopics = courses?.length
    ? courses.slice(0, 3).map((course) => course.title)
    : ['Subnetting basics', 'Network security', 'Routing protocols'];

  return <DashboardShell title="AI Tutor" go={go} profile={profile} screen="liveTutor" logout={logout}>
    <section className="page-heading tutor-page-heading">
      <div><span className="page-eyebrow">PERSONAL AI TUTOR</span><h1>Learn through conversation.</h1><p>Talk, type, ask follow-up questions, and return to any saved tutoring session.</p></div>
      <div className="tutor-availability"><i />Available now</div>
    </section>

    {!session ? (
      <>
        <section className="tutor-start-layout">
          <form className="tutor-start-card" onSubmit={startSession}>
            <div className="tutor-start-visual"><span className="tutor-orbit tutor-orbit-one" /><span className="tutor-orbit tutor-orbit-two" /><div className="tutor-avatar"><span>✦</span></div><small>VOICE + CHAT</small></div>
            <div className="tutor-start-content">
              <span className="section-label">START A SESSION</span>
              <h2>What would you like to understand?</h2>
              <p>Choose a topic and your tutor will explain it conversationally, remember the context, and adapt to your questions.</p>
              <Field label="Topic to discuss" value={subject} onChange={setSubject} placeholder="e.g. Subnetting" />
              <div className="tutor-topic-chips">{suggestedTopics.map((topic) => <button type="button" key={topic} onClick={() => setSubject(topic)}>{topic}</button>)}</div>
              <button className="button primary tutor-join-button" disabled={loading || !subject.trim()} type="submit">{loading ? 'Connecting…' : 'Start tutoring session →'}</button>
            </div>
          </form>

          <aside className="panel tutor-history-panel">
            <div className="tutor-history-head"><div><span className="section-label">SAVED HISTORY</span><h2>Recent conversations</h2></div><span>{history.length}</span></div>
            {history.length ? <div className="tutor-history-list">{history.slice(0, 6).map((item) => <button type="button" key={item.id} className={selectedHistory?.id === item.id ? 'selected' : ''} onClick={() => openSavedSession(item)}><i>{item.status === 'ACTIVE' ? '●' : '✓'}</i><span><b>{item.subject}</b><small>{item.transcript?.length || 0} messages · {item.status === 'ACTIVE' ? 'Not completed' : 'Saved'}</small></span><strong>→</strong></button>)}</div> : <div className="tutor-history-empty"><span>◷</span><h3>Your conversations will stay here.</h3><p>Finish a tutoring session and its transcript will be available whenever you return.</p></div>}
          </aside>
        </section>

        {error && <p className="tutor-notice">{error}</p>}
        {selectedHistory && <section className="panel tutor-history-viewer"><div className="tutor-history-viewer-head"><div><span className="section-label">SAVED TRANSCRIPT</span><h2>{selectedHistory.subject}</h2><p>{selectedHistory.summary || 'Your complete conversation is saved below.'}</p></div><button type="button" onClick={() => setSelectedHistory(null)} aria-label="Close saved transcript">×</button></div><div className="tutor-saved-messages">{selectedHistory.transcript?.length ? selectedHistory.transcript.map((message, index) => <div key={`${message.timestamp || index}-${index}`} className={message.role === 'student' ? 'saved-student' : 'saved-tutor'}><b>{message.role === 'student' ? profile.name || 'You' : 'NEXUS Tutor'}</b><p>{message.text}</p></div>) : <p className="tutor-no-messages">This session ended before any messages were sent.</p>}</div></section>}
      </>
    ) : (
      <section className="video-call-workspace tutor-call-layout">
        <div className="tutor-stage">
          <div className="tutor-stage-top"><span><i />Session live</span><small>{session.subject}</small></div>
          <div className="tutor-stage-center"><div className={`tutor-live-avatar ${(loading || speaking || recording) ? 'active' : ''}`}><span>✦</span></div><h2>NEXUS AI Tutor</h2><p>{recording ? 'Listening to you…' : speaking ? 'Explaining now…' : loading ? 'Thinking about your question…' : 'Ready when you are'}</p><div className={`tutor-wave ${speaking ? 'active' : ''}`}>{[1,2,3,4,5,6,7].map((bar) => <i key={bar} />)}</div></div>
          <div className="call-controls tutor-call-controls"><button type="button" className={`tutor-control-button ${recording ? 'recording' : ''}`} onClick={toggleRecording}><span>{recording ? '■' : '●'}</span><small>{recording ? 'Stop listening' : 'Speak'}</small></button><button type="button" className="tutor-control-button hangup" onClick={endSession}><span>×</span><small>End call</small></button></div>
        </div>

        <div className="panel tutor-transcript-panel">
          <div className="tutor-transcript-head"><div><span className="section-label">LIVE TRANSCRIPT</span><h2>{session.subject}</h2></div><span>{session.transcript?.length || 0} messages</span></div>
          <div className="tutor-live-messages">{session.transcript?.length ? session.transcript.map((msg, index) => <div key={`${msg.timestamp || index}-${index}`} className={msg.role === 'student' ? 'tutor-message student' : 'tutor-message tutor'}><b>{msg.role === 'student' ? profile.name || 'You' : 'NEXUS Tutor'}</b><p>{msg.text}</p></div>) : <div className="tutor-call-empty"><span>✦</span><h3>Call connected</h3><p>Ask your first question with the microphone or type it below.</p><div><button type="button" onClick={() => setInput(`Explain ${session.subject} from the basics`)}>Start from the basics</button><button type="button" onClick={() => setInput(`Give me an example of ${session.subject}`)}>Show me an example</button></div></div>}{loading && <div className="tutor-thinking"><i /><i /><i /><span>NEXUS is thinking</span></div>}</div>
          <form className="chat-composer tutor-composer" onSubmit={sendMessage}><input type="text" value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask about ${session.subject}…`} /><button className="button primary" type="submit" disabled={loading || !input.trim()}>Send ↑</button></form>
        </div>
      </section>
    )}
  </DashboardShell>;
}

// ============================================================
// INTERACTIVE LABS
// ============================================================
function InteractiveLabs({ go, profile, logout }) {
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/labs').then(setLabs).catch(e => setError(e.message));
  }, []);

  const evaluate = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api('/labs/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: selectedLab.id, step, answer })
      });
      setResult(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return <DashboardShell title="Interactive Labs" go={go} profile={profile} screen="labs" logout={logout}>
    <section className="page-heading">
      <span className="page-eyebrow">HANDS-ON PRACTICE</span>
      <h1>Networking Scenarios</h1>
      <p>Test your knowledge with practical, scenario-based exercises evaluated by AI.</p>
    </section>

    {!selectedLab ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {labs.map(lab => (
          <div key={lab.id} className="panel" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setSelectedLab(lab)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className={`pill ${lab.difficulty === 'ADVANCED' ? '' : 'muted-pill'}`}>{lab.difficulty}</span>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>{lab.subject}</span>
            </div>
            <h3 style={{ margin: '15px 0 5px' }}>{lab.title}</h3>
            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>{lab.description}</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="panel" style={{ maxWidth: 800 }}>
        <div className="panel-title">
          <h2>{selectedLab.title}</h2>
          <button className="text-button" onClick={() => { setSelectedLab(null); setResult(null); setAnswer(''); }}>← Back to Labs</button>
        </div>
        
        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b' }}>SCENARIO</span>
          <p style={{ fontSize: 14, margin: '10px 0 0' }}>{selectedLab.description}</p>
          <p style={{ fontSize: 14, marginTop: 15 }}><strong>Task {step + 1}:</strong> Based on the scenario, explain how you would configure or troubleshoot this issue.</p>
        </div>

        {result ? (
          <div style={{ padding: 20, borderRadius: 12, background: result.correct ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.correct ? '#bbf7d0' : '#fecaca'}` }}>
            <h3 style={{ color: result.correct ? '#166534' : '#991b1b', margin: '0 0 10px' }}>
              {result.correct ? '✓ Excellent work!' : '↺ Not quite right'} (Score: {result.score}/100)
            </h3>
            <p style={{ fontSize: 14, color: '#1e293b' }}>{result.feedback}</p>
            {!result.correct && <p style={{ fontSize: 13, marginTop: 15 }}><strong>Hint:</strong> {result.hint}</p>}
            <p style={{ fontSize: 13, marginTop: 10 }}><strong>Explanation:</strong> {result.explanation}</p>
            <button className="button primary" style={{ marginTop: 20 }} onClick={() => {
              if (result.correct) {
                setStep(s => s + 1);
                setAnswer('');
              }
              setResult(null);
            }}>
              {result.correct ? 'Next Task →' : 'Try Again'}
            </button>
          </div>
        ) : (
          <form onSubmit={evaluate}>
            <label className="field">
              <span>Your solution</span>
              <textarea 
                style={{ minHeight: 120, padding: 15, width: '100%' }}
                value={answer} 
                onChange={e => setAnswer(e.target.value)} 
                placeholder="Explain your approach..."
              />
            </label>
            <div style={{ marginTop: 15 }}>
              <button className="button primary" type="submit" disabled={loading || !answer.trim()}>
                {loading ? 'Evaluating...' : 'Submit Solution'}
              </button>
              {error && <span style={{ color: '#c53030', marginLeft: 15, fontSize: 13 }}>{error}</span>}
            </div>
          </form>
        )}
      </div>
    )}
  </DashboardShell>;
}



// ============================================================
// STUDENT TEACHER COPILOT
// ============================================================

function StudentTeacherCopilot({ go, profile, logout }) {
  const [meetings, setMeetings] = useState([]);
  const [videos, setVideos] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoQuery, setVideoQuery] = useState('');
  const [connectingId, setConnectingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api('/student/teacher-meetings'),
      api('/video-lectures/library'),
      api('/teachers'),
    ])
      .then(([meetingResult, videoResult, teacherResult]) => {
        if (!active) return;
        const scheduled = readScheduledTeacherMeetings();
        const supportMeetings = meetingResult.status === 'fulfilled' ? meetingResult.value || [] : [];
        setMeetings([...scheduled, ...supportMeetings]);
        if (videoResult.status === 'fulfilled') setVideos(videoResult.value || []);
        if (teacherResult.status === 'fulfilled') setTeachers(teacherResult.value || []);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const joinMeeting = async (meeting) => {
    if (meeting.local_only && meeting.meeting_uri) {
      window.open(meeting.meeting_uri, '_blank', 'noopener,noreferrer');
      return;
    }
    setConnectingId(meeting.id); setError('');
    try {
      const room = await ensureGoogleMeetRoom(meeting.id, meeting.meeting_uri);
      const connectedMeeting = { ...meeting, meeting_uri: room.meeting_uri };
      setMeetings((items) => items.map((item) => item.id === meeting.id ? connectedMeeting : item));
      sessionStorage.setItem('nexus.student-meeting', JSON.stringify(connectedMeeting));
      go('student-meeting');
    } catch (requestError) {
      setError(requestError.message || 'Google Meet could not be prepared.');
    } finally { setConnectingId(''); }
  };
  const deleteMeeting = async (meeting) => {
    if (!window.confirm(`Delete the request for “${meeting.topic}”? This will remove it from your teacher-support meetings.`)) return;
    setDeletingId(meeting.id); setError('');
    try {
      if (meeting.local_only) {
        const remaining = readScheduledTeacherMeetings().filter((item) => item.id !== meeting.id);
        localStorage.setItem(scheduledTeacherMeetingsKey, JSON.stringify(remaining));
      } else {
        await api(`/student/teacher-meetings/${meeting.id}`, { method: 'DELETE' });
      }
      setMeetings((items) => items.filter((item) => item.id !== meeting.id));
    } catch (requestError) {
      setError(requestError.message || 'The meeting request could not be deleted.');
    } finally { setDeletingId(''); }
  };
  const normalizedQuery = videoQuery.trim().toLowerCase();
  const visibleVideos = normalizedQuery
    ? videos.filter((video) => [video.title, video.subject, video.topic, video.description].some((value) => (value || '').toLowerCase().includes(normalizedQuery)))
    : videos;
  const formatMeetingDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Recently requested' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  return <DashboardShell title="Teacher Copilot" go={go} profile={profile} screen="studentCopilot" logout={logout}>
    <section className="student-copilot-hero">
      <div><span className="page-eyebrow">TEACHER COPILOT</span><h1>Learn directly from your teachers.</h1><p>Join your support meetings, revisit reviewed sessions, and watch tutorials uploaded for your subjects.</p></div>
      <div className="student-copilot-summary"><article><strong>{meetings.length}</strong><span>My meetings</span></article><article><strong>{videos.length}</strong><span>Teacher tutorials</span></article></div>
    </section>

    {error && <RequestAlert title="Teacher Copilot is unavailable" message={error} onDismiss={() => setError('')} />}

    <section className="panel student-meetings-panel">
      <div className="student-section-head"><div><span className="section-label">MY MEETINGS</span><h2>Teacher support meetings</h2><p>Meetings created from your Ask NEXUS support requests appear here.</p></div><span>{meetings.length} total</span></div>
      {loading ? <div className="student-copilot-loading">Loading your meetings…</div> : meetings.length ? <div className="student-meeting-list">{meetings.map((meeting) => <article key={meeting.id}>
        <div className="student-meeting-date"><span>{new Date(meeting.requested_at).toLocaleDateString([], { day: '2-digit' })}</span><small>{new Date(meeting.requested_at).toLocaleDateString([], { month: 'short' }).toUpperCase()}</small></div>
        <div className="student-meeting-copy"><span>{meeting.meeting_uri ? 'GOOGLE MEET READY' : meeting.status === 'REVIEWED' ? 'SESSION REVIEWED' : 'CONNECT GOOGLE MEET'}</span><h3>{meeting.topic}</h3><p>{meeting.course} · {meeting.unit}</p><small>{formatMeetingDate(meeting.requested_at)}</small></div>
        {meeting.rating ? <div className="student-meeting-rating" aria-label={`${meeting.rating} out of 5 stars`}>{'★'.repeat(meeting.rating)}{'☆'.repeat(5 - meeting.rating)}</div> : null}
        <div className="student-meeting-actions"><button className="button primary" type="button" disabled={connectingId === meeting.id || deletingId === meeting.id} onClick={() => joinMeeting(meeting)}>{connectingId === meeting.id ? 'Connecting…' : meeting.status === 'REVIEWED' ? 'Rejoin with Meet →' : 'Join with Google Meet →'}</button><button className="delete-meeting-button" type="button" disabled={deletingId === meeting.id} onClick={() => deleteMeeting(meeting)}>{deletingId === meeting.id ? 'Deleting…' : 'Delete request'}</button></div>
      </article>)}</div> : <div className="student-copilot-empty"><span>✦</span><div><h3>No teacher meetings yet.</h3><p>When you choose “Connect with a Teacher” in Ask NEXUS, your meeting will be listed here.</p></div><button className="button ghost" type="button" onClick={() => go('ask')}>Go to Ask NEXUS →</button></div>}
    </section>

    <section className="panel student-tutorial-library">
      <div className="student-section-head tutorial-head"><div><span className="section-label">TEACHER TUTORIALS</span><h2>Uploaded video lessons</h2><p>Browse every lecture your teachers have published.</p></div><label><span aria-hidden="true">⌕</span><input value={videoQuery} onChange={(event) => setVideoQuery(event.target.value)} placeholder="Search subject or topic" /></label></div>
      {loading ? <div className="student-copilot-loading">Loading video lessons…</div> : visibleVideos.length ? <div className="student-tutorial-grid">{visibleVideos.map((video) => <article key={video.id}><div className="student-tutorial-cover"><span>▶</span><small>{video.subject}</small></div><div className="student-tutorial-copy"><span>{video.topic}</span><h3>{video.title}</h3><p>{video.description || 'A focused tutorial uploaded by your teacher.'}</p><small>By {video.teacher_id.replace(/^teacher-/, '')}</small><a href={video.external_url || `${API_URL}/video-lectures/${video.id}/file`} target="_blank" rel="noreferrer">Watch tutorial →</a></div></article>)}</div> : <div className="student-copilot-empty"><span>▶</span><div><h3>{videos.length ? 'No tutorials match your search.' : 'No teacher tutorials yet.'}</h3><p>{videos.length ? 'Try searching with a subject, topic, or lecture title.' : 'Videos published by teachers will appear in this library.'}</p></div></div>}
    </section>

    <TeacherDirectory teachers={teachers} loading={loading} onSchedule={(scheduledMeeting) => setMeetings((items) => [scheduledMeeting, ...items])} />
  </DashboardShell>;
}

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.4;
  return (
    <span className="teacher-dir-stars" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

function TeacherDirectory({ teachers, loading, onSchedule }) {
  const [notice, setNotice] = useState('');
  const visibleTeachers = teachers.filter((item) => item.email !== 'amishsingh2005@gmail.com').slice(0, 5);
  const schedule = (teacher) => {
    const meeting = {
      id: `teacher-scheduled-${Date.now()}`, topic: `Teacher support with ${teacher.name}`, course: (teacher.subjects || ['General support'])[0], unit: 'Scheduled support',
      question: 'Scheduled 1-on-1 teacher support session.', requested_at: new Date().toISOString(), status: 'READY',
      teacher_name: teacher.name, meeting_uri: DEMO_TEACHER_MEET_LINK, local_only: true,
    };
    const stored = readScheduledTeacherMeetings();
    localStorage.setItem(scheduledTeacherMeetingsKey, JSON.stringify([meeting, ...stored]));
    onSchedule(meeting);
    setNotice(`${teacher.name} has been added to your meetings. Your Google Meet link is ready.`);
  };

  return <section className="panel teacher-directory-panel simple-teacher-booking">
    <div className="teacher-dir-head"><div><span className="section-label">TEACHER SUPPORT</span><h2>Meet a teacher</h2><p>Choose a subject expert and start a Google Meet now, or schedule support for later.</p></div></div>
    {loading ? <div className="student-copilot-loading">Loading teacher support…</div> : <><div className="compact-teacher-grid action-cards">{visibleTeachers.map((item) => <article key={item.id}><div className="teacher-dir-avatar"><span>{item.avatar_initials}</span><i className={item.is_available ? 'online' : 'busy'} /></div><div><h4>{item.name}</h4><p>{(item.subjects || []).slice(0, 2).join(' · ')}</p><small className={item.is_available ? 'available' : ''}>{item.is_available ? '● Available now' : '○ Schedule a slot'}</small></div>{item.is_available ? <a className="teacher-card-action start" href={DEMO_TEACHER_MEET_LINK} target="_blank" rel="noopener noreferrer">Start Meet now →</a> : <button className="teacher-card-action" type="button" onClick={() => schedule(item)}>Schedule meeting →</button>}</article>)}</div>{notice && <p className="schedule-notice">{notice} <a href={DEMO_TEACHER_MEET_LINK} target="_blank" rel="noopener noreferrer">Open Google Meet</a></p>}</>}
  </section>;
}

function StudentTeacherMeeting({ go, profile, logout }) {
  const [meeting] = useState(() => { try { return JSON.parse(sessionStorage.getItem('nexus.student-meeting') || '{}'); } catch { return {}; } });
  const [meetingUri, setMeetingUri] = useState(meeting.meeting_uri || '');
  const [connecting, setConnecting] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [rating, setRating] = useState(meeting.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState(meeting.feedback || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const endCall = () => {
    setCallEnded(true);
    window.setTimeout(() => document.getElementById('student-meeting-review')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  const prepareMeet = async () => {
    setConnecting(true); setError('');
    try {
      const room = await ensureGoogleMeetRoom(meeting.id, meetingUri);
      setMeetingUri(room.meeting_uri);
      sessionStorage.setItem('nexus.student-meeting', JSON.stringify({ ...meeting, meeting_uri: room.meeting_uri }));
      window.open(room.meeting_uri, '_blank', 'noopener,noreferrer');
    } catch (requestError) { setError(requestError.message || 'Google Meet could not be opened.'); }
    finally { setConnecting(false); }
  };
  const submitReview = async (event) => {
    event.preventDefault();
    if (!rating) { setError('Choose a star rating before submitting your review.'); return; }
    setSubmitting(true); setError('');
    try {
      await api(`/student/teacher-meetings/${meeting.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, feedback: feedback.trim() || null }) });
      setSubmitted(true);
      sessionStorage.removeItem('nexus.student-meeting');
    } catch (requestError) { setError(requestError.message || 'Could not save your review.'); }
    finally { setSubmitting(false); }
  };

  if (!meeting.id) return <DashboardShell title="Teacher meeting" go={go} profile={profile} screen="studentCopilot" logout={logout}><section className="panel missing-student-meeting"><span>⌁</span><h1>No meeting selected</h1><p>Choose a meeting from Teacher Copilot before opening the call.</p><button className="button primary" type="button" onClick={() => go('studentCopilot', { replace: true })}>View my meetings →</button></section></DashboardShell>;

  return <DashboardShell title="Teacher meeting" go={go} profile={profile} screen="studentCopilot" logout={logout}>
    <section className="student-call-heading"><div><span className="page-eyebrow">TEACHER COPILOT MEETING</span><h1>{callEnded ? 'Call ended' : `Live help with ${meeting.topic}`}</h1><p>{callEnded ? 'Thanks for joining. Share a quick review below.' : `${meeting.course} · ${meeting.unit}`}</p></div><span className={callEnded ? 'ended' : ''}><i />{callEnded ? 'ENDED' : 'GOOGLE MEET READY'}</span></section>

    <section className={`student-call-shell ${callEnded ? 'call-ended' : ''}`}>
      <div className="student-call-stage google-meet-stage">
        <div className="student-call-status"><span><i />{callEnded ? 'Meeting finished' : 'Secure Google Meet room'}</span><small>{meeting.topic}</small></div>
        <div className="google-meet-launch"><div className="google-meet-mark" aria-hidden="true"><span>▰</span></div><span className="section-label">GOOGLE MEET</span><h2>{callEnded ? 'Your meeting has finished.' : 'Your teacher support room is ready.'}</h2><p>{callEnded ? 'The NEXUS session is closed. You can now review your experience below.' : 'Google Meet opens in a secure tab with its full camera, microphone, captions, and screen-sharing controls.'}</p>{!callEnded && <button className="button google-meet-button" type="button" disabled={connecting} onClick={prepareMeet}>{connecting ? 'Preparing Google Meet…' : 'Open Google Meet →'}</button>}{meetingUri && !callEnded && <small className="google-meet-code">Shared room: {meetingUri.replace('https://meet.google.com/', '')}</small>}</div>
        {!callEnded && <div className="google-meet-footer"><span>Signed in as {profile.name || 'Student'}</span><button type="button" onClick={endCall}>I ended the call</button></div>}
      </div>
      <aside className="student-call-context"><section className="panel" style={{ fontSize: '1.05rem' }}><span className="section-label">MEETING TOPIC</span><h2 style={{ fontSize: '1.25rem', marginTop: 8 }}>{meeting.topic}</h2><blockquote style={{ fontSize: '1rem', lineHeight: 1.65 }}>{meeting.question}</blockquote><div style={{ fontSize: '1rem', marginTop: 12 }}><span>Course</span><strong style={{ fontSize: '1.1rem', marginLeft: 8 }}>{meeting.course}</strong></div><div style={{ fontSize: '1rem', marginTop: 8 }}><span>Unit</span><strong style={{ fontSize: '1.1rem', marginLeft: 8 }}>{meeting.unit}</strong></div><p className="meet-context-help" style={{ fontSize: '1rem', lineHeight: 1.65, marginTop: 16 }}>Explain where you became stuck. Your teacher receives this learning context before joining the same Google Meet room.</p></section></aside>
    </section>

    {error && <RequestAlert title="Google Meet could not start" message={error} onDismiss={() => setError('')} />}

    {callEnded && <section id="student-meeting-review" className="panel student-review-card">
      {submitted ? <div className="student-review-thanks"><span>✓</span><h2>Thank you for your feedback.</h2><p>Your {rating}-star review has been saved with this meeting.</p><button className="button primary" type="button" onClick={() => go('studentCopilot', { replace: true })}>Back to Teacher Copilot →</button></div> : <form onSubmit={submitReview}><div><span className="section-label">QUICK REVIEW</span><h2>How was your meeting?</h2><p>Select a rating, then add an optional note about what helped.</p></div><div className="student-star-rating" onMouseLeave={() => setHoverRating(0)}>{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} star${star === 1 ? '' : 's'}`} aria-pressed={rating === star} onMouseEnter={() => setHoverRating(star)} onFocus={() => setHoverRating(star)} onBlur={() => setHoverRating(0)} onClick={() => { setRating(star); setError(''); }}>{star <= (hoverRating || rating) ? '★' : '☆'}</button>)}</div><label><span>Feedback <small>(optional)</small></span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What worked well, or what could be improved?" maxLength={2000} /></label>{error && <p className="student-review-error">{error}</p>}<div className="student-review-actions"><button className="button ghost" type="button" onClick={() => go('studentCopilot', { replace: true })}>Skip for now</button><button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Saving review…' : 'Submit review →'}</button></div></form>}
    </section>}
  </DashboardShell>;
}


// ============================================================
// TEACHER DASHBOARD & COPILOT
// ============================================================

function TeacherDashboard({ go, profile, logout }) {
  const [escalations, setEscalations] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [subject, setSubject] = useState(teacherSubjects[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectingId, setConnectingId] = useState('');

  useEffect(() => {
    Promise.allSettled([api('/teacher/escalations'), api('/teacher/videos')]).then(([requestsResult, videosResult]) => {
      if (requestsResult.status === 'fulfilled') setEscalations(requestsResult.value);
      if (videosResult.status === 'fulfilled') setVideos(videosResult.value);
      if (requestsResult.status === 'rejected' || videosResult.status === 'rejected') setNotice('Some teacher workspace data could not be loaded. Check that the backend is running.');
    });
  }, []);

  const viewBrief = async (sessionId) => {
    try {
      const brief = await api(`/teacher/copilot-brief/${sessionId}`);
      setSelectedBrief(brief);
    } catch (error) {
      setNotice(error.message || 'Could not load the teaching brief.');
    }
  };

  const joinMeeting = async (request) => {
    setConnectingId(request.id); setNotice('');
    try {
      const knownUri = request.meeting_uri || (selectedBrief?.session_id === request.id ? selectedBrief.meeting_uri : '');
      const room = await ensureGoogleMeetRoom(request.id, knownUri);
      let brief = selectedBrief?.session_id === request.id ? selectedBrief : null;
      if (!brief) {
        try { brief = await api(`/teacher/copilot-brief/${request.id}`); }
        catch { brief = { session_id: request.id, student_name: request.student, detected_concept: request.topic, original_question: `Help requested with ${request.topic}`, current_mastery: 31, recommended_approach: 'Begin by asking the student to explain what they understand so far.' }; }
      }
      const connectedBrief = { ...brief, meeting_uri: room.meeting_uri };
      setEscalations((items) => items.map((item) => item.id === request.id ? { ...item, meeting_uri: room.meeting_uri } : item));
      if (selectedBrief?.session_id === request.id) setSelectedBrief(connectedBrief);
      sessionStorage.setItem('nexus.teacher-meeting', JSON.stringify(connectedBrief));
      go('teacher-session');
    } catch (requestError) {
      setNotice(requestError.message || 'Google Meet could not be prepared.');
    } finally { setConnectingId(''); }
  };

  const publishLecture = async (event) => {
    event.preventDefault();
    const finalSubject = subject === 'Other' ? customSubject.trim() : subject;
    if (!finalSubject || !topic.trim() || !title.trim() || (!videoFile && !videoUrl.trim())) {
      setNotice('Select a subject, enter a topic and title, then add a video file or hosted link.');
      return;
    }
    setSaving(true); setNotice('');
    try {
      let created;
      if (videoFile) {
        const data = new FormData();
        data.append('subject', finalSubject); data.append('topic', topic.trim()); data.append('title', title.trim()); data.append('description', description.trim()); data.append('file', videoFile);
        created = await api('/teacher/videos', { method: 'POST', body: data, timeoutMs: 120000 });
      } else {
        created = await api('/teacher/videos/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: finalSubject, topic: topic.trim(), title: title.trim(), description: description.trim(), external_url: videoUrl.trim() }) });
      }
      setVideos((items) => [created, ...items]);
      setTopic(''); setTitle(''); setDescription(''); setVideoUrl(''); setVideoFile(null); setCustomSubject('');
      setNotice('Lecture published. NEXUS can now recommend it to students learning this topic.');
    } catch (error) { setNotice(error.message || 'Could not publish the lecture.'); }
    finally { setSaving(false); }
  };

  const removeVideo = async (video) => {
    if (!window.confirm(`Remove “${video.title}”?`)) return;
    try { await api(`/teacher/videos/${video.id}`, { method: 'DELETE' }); setVideos((items) => items.filter((item) => item.id !== video.id)); }
    catch (error) { setNotice(error.message || 'Could not remove the lecture.'); }
  };

  return <DashboardShell title="Teacher Workspace" go={go} profile={profile} screen="teacher" logout={logout}>
    <section className="teacher-portal-hero">
      <div><span className="page-eyebrow">TEACHER WORKSPACE</span><h1>Welcome, {profile.name || 'Teacher'}.</h1><p>Publish focused lessons, review students who need help, and join a guided support meeting from one workspace.</p></div>
      <div className="teacher-portal-stats"><article><strong>{String(videos.length).padStart(2, '0')}</strong><span>Published lectures</span></article><article><strong>{String(escalations.length).padStart(2, '0')}</strong><span>Student requests</span></article><article><strong>●</strong><span>Available to teach</span></article></div>
    </section>

    <section className="teacher-portal-grid">
      <form className="panel teacher-publish-card" onSubmit={publishLecture}>
        <div className="teacher-section-heading"><span>01</span><div><small>LECTURE STUDIO</small><h2>Publish a video lecture</h2><p>Tag each lecture precisely so it reaches students studying the same concept.</p></div></div>
        <label className="field"><span>Select subject</span><select value={subject} onChange={(event) => setSubject(event.target.value)}>{teacherSubjects.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        {subject === 'Other' && <Field label="Subject name" value={customSubject} onChange={setCustomSubject} placeholder="Enter the subject name" />}
        <Field label="Topic name" value={topic} onChange={setTopic} placeholder="e.g. Variable Length Subnet Masking" />
        <Field label="Lecture title" value={title} onChange={setTitle} placeholder="e.g. VLSM explained with worked examples" />
        <label className="field"><span>Short description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will students learn from this lecture?" /></label>
        <label className={`teacher-video-drop ${videoFile ? 'has-file' : ''}`}><input type="file" accept="video/mp4,video/webm,video/quicktime,.m4v" onChange={(event) => { const file = event.target.files?.[0] || null; setVideoFile(file); if (file) setVideoUrl(''); }} /><span>↑</span><div><b>{videoFile ? videoFile.name : 'Upload a video lecture'}</b><small>MP4, WebM, MOV or M4V</small></div></label>
        <div className="teacher-or">or add a hosted lecture</div>
        <Field label="Video link" value={videoUrl} onChange={(value) => { setVideoUrl(value); if (value) setVideoFile(null); }} placeholder="https://…" required={false} />
        <button className="button primary teacher-publish-button" disabled={saving} type="submit">{saving ? 'Publishing lecture…' : 'Publish lecture →'}</button>
      </form>

      <section className="panel teacher-requests-card">
        <div className="teacher-section-heading compact"><span>02</span><div><small>TEACHER COPILOT</small><h2>Students requesting help</h2><p>Review their learning context before joining.</p></div></div>
        {escalations.length ? <div className="teacher-request-list">{escalations.map((request) => <article key={request.id}><div className="teacher-request-icon">{initials(request.student)}</div><div className="teacher-request-copy"><span>{request.meeting_uri ? 'GOOGLE MEET READY' : 'NEEDS TEACHER SUPPORT'}</span><h3>{request.student}</h3><p>{request.topic}</p><small>Waiting since {request.time}</small></div><div className="teacher-request-actions"><button type="button" onClick={() => viewBrief(request.id)}>View brief</button><button type="button" className="join" disabled={connectingId === request.id} onClick={() => joinMeeting(request)}>{connectingId === request.id ? 'Connecting…' : 'Join with Meet →'}</button></div></article>)}</div> : <div className="teacher-request-empty"><span>✓</span><h3>No students are waiting.</h3><p>New escalations from Ask NEXUS will appear here with their topic and learning context.</p></div>}
      </section>
    </section>

    {notice && <p className="teacher-portal-notice">{notice}</p>}

    {selectedBrief && <section className="panel teacher-brief-card"><div className="teacher-brief-head"><div><span className="section-label">COPILOT BRIEF</span><h2>{selectedBrief.student_name}</h2><p>Prepared from the student's recent learning signals.</p></div><button type="button" onClick={() => setSelectedBrief(null)} aria-label="Close teaching brief">×</button></div><div className="teacher-brief-grid"><article><span>CONCEPT</span><strong>{selectedBrief.detected_concept}</strong><p>{selectedBrief.original_question}</p></article><article><span>ESTIMATED MASTERY</span><strong>{selectedBrief.current_mastery}%</strong><p>{selectedBrief.previous_attempts || 0} previous attempts</p></article><article><span>DETECTED MISCONCEPTION</span><strong>What to address</strong><p>{selectedBrief.detected_misconception || 'Ask the student to explain their current understanding first.'}</p></article><article><span>RECOMMENDED APPROACH</span><strong>Suggested intervention</strong><p>{selectedBrief.recommended_approach}</p></article></div><button className="button primary teacher-brief-join" type="button" onClick={() => joinMeeting({ id: selectedBrief.session_id, student: selectedBrief.student_name, topic: selectedBrief.detected_concept })}>Join student meeting →</button></section>}

    <section className="panel teacher-lecture-library"><div className="teacher-library-head"><div><span className="section-label">LECTURE LIBRARY</span><h2>Your published lessons</h2></div><span>{videos.length} total</span></div>{videos.length ? <div className="teacher-lecture-grid">{videos.map((video) => <article key={video.id}><div className="teacher-lecture-preview"><span>▶</span><small>{video.subject}</small></div><div className="teacher-lecture-copy"><span>{video.topic}</span><h3>{video.title}</h3><p>{video.description || 'A focused video lesson for this topic.'}</p><div><a href={video.external_url || `${API_URL}/video-lectures/${video.id}/file`} target="_blank" rel="noreferrer">Open lecture →</a><button type="button" onClick={() => removeVideo(video)}>Remove</button></div></div></article>)}</div> : <div className="teacher-library-empty"><span>▤</span><div><h3>Your first lecture will appear here.</h3><p>Select a subject and topic in the studio above, then upload the lesson students should receive.</p></div></div>}</section>
  </DashboardShell>;
}


// ============================================================
// TEACHER SESSION
// ============================================================
function TeacherSession({ go, profile, logout }) {
  const [meetingUri, setMeetingUri] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [meeting] = useState(() => { try { return JSON.parse(sessionStorage.getItem('nexus.teacher-meeting') || '{}'); } catch { return {}; } });
  useEffect(() => { if (meeting.meeting_uri) setMeetingUri(meeting.meeting_uri); }, []);

  const openMeet = async () => {
    setConnecting(true); setError('');
    try {
      const sessionId = meeting.session_id || meeting.id || '';
      const room = await ensureGoogleMeetRoom(sessionId, meetingUri);
      setMeetingUri(room.meeting_uri);
      sessionStorage.setItem('nexus.teacher-meeting', JSON.stringify({ ...meeting, meeting_uri: room.meeting_uri }));
      window.open(room.meeting_uri, '_blank', 'noopener,noreferrer');
    } catch (requestError) { setError(requestError.message || 'Google Meet could not be opened.'); }
    finally { setConnecting(false); }
  };

  const endMeeting = () => { sessionStorage.removeItem('nexus.teacher-meeting'); go('teacher', { replace: true }); };

  return <DashboardShell title="Student Meeting" go={go} profile={profile} screen="teacher" logout={logout}>
    <section className="teacher-meeting-heading">
      <div><span className="page-eyebrow">TEACHER COPILOT MEETING</span><h1>{meeting.student_name ? `Meeting with ${meeting.student_name}` : 'Student support meeting'}</h1><p>{meetingEnded ? 'Meeting ended. Return to your dashboard.' : 'Open Google Meet to join the session — your student is waiting in the same room.'}</p></div>
      <span className={`teacher-preview-badge${meetingEnded ? '' : ''}`}><i />{meetingEnded ? 'ENDED' : 'GOOGLE MEET'}</span>
    </section>

    <section className={`teacher-meeting-shell${meetingEnded ? ' call-ended' : ''}`}>
      <div className="teacher-meeting-stage google-meet-stage">
        <div className="teacher-meeting-status"><span><i />{meetingEnded ? 'Meeting finished' : 'Secure Google Meet room'}</span><small>{meeting.detected_concept || 'General support'}</small></div>
        <div className="google-meet-launch">
          <div className="google-meet-mark" aria-hidden="true"><span>▰</span></div>
          <span className="section-label">GOOGLE MEET</span>
          <h2>{meetingEnded ? 'Your meeting has finished.' : 'Your student support room is ready.'}</h2>
          <p>{meetingEnded ? 'The NEXUS session is closed. Return to your dashboard.' : 'Google Meet opens in a secure tab with full camera, microphone, captions, and screen-sharing. Your student joins the same room.'}</p>
          {!meetingEnded && <button className="button google-meet-button" type="button" disabled={connecting} onClick={openMeet}>{connecting ? 'Preparing Google Meet…' : 'Open Google Meet →'}</button>}
          {meetingUri && !meetingEnded && <small className="google-meet-code">Shared room: {meetingUri.replace('https://meet.google.com/', '')}</small>}
          {meetingEnded && <button className="button primary" style={{ marginTop: 24 }} type="button" onClick={endMeeting}>Return to Teacher Dashboard →</button>}
        </div>
        {!meetingEnded && <div className="google-meet-footer"><span>Signed in as {profile.name || 'Teacher'}</span><button type="button" onClick={() => setMeetingEnded(true)}>I ended the call</button></div>}
        {error && <RequestAlert title="Google Meet could not start" message={error} onDismiss={() => setError('')} />}
      </div>

      <aside className="teacher-meeting-sidebar">
        <section className="panel teacher-context-card" style={{ fontSize: '1.05rem' }}>
          <span className="section-label">STUDENT CONTEXT</span>
          <h2 style={{ fontSize: '1.25rem', marginTop: 8 }}>{meeting.detected_concept || 'Learning support'}</h2>
          <blockquote style={{ fontSize: '1rem', lineHeight: 1.65 }}>{meeting.original_question || 'The student requested help from their NEXUS learning conversation.'}</blockquote>
          <div style={{ fontSize: '1rem', marginTop: 12 }}><span>Estimated mastery</span><strong style={{ fontSize: '1.1rem', marginLeft: 8 }}>{meeting.current_mastery ?? '—'}{meeting.current_mastery !== undefined ? '%' : ''}</strong></div>
          <p style={{ fontSize: '1rem', lineHeight: 1.65, marginTop: 10 }}>{meeting.recommended_approach || 'Ask the student what they understand, then work through one simple example together.'}</p>
        </section>
        <section className="panel teacher-notes-card">
          <label htmlFor="teacher-meeting-notes" style={{ fontSize: '1rem' }}>Private teaching notes</label>
          <textarea id="teacher-meeting-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Write a reminder or next step…" style={{ fontSize: '1rem' }} />
          <small style={{ fontSize: '0.9rem' }}>Notes stay private and are not sent to the student.</small>
        </section>
      </aside>
    </section>
  </DashboardShell>;
}


export default App;

