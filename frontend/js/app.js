/* Conversation controller — wires UI to the backend via API. */
const column = document.getElementById('column'), scroll = document.getElementById('scroll'), input = document.getElementById('input'), caption = document.getElementById('caption');
let mode = 'chat', handsfree = false, busy = false;
const svgCopy = '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';
const svgSpk = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>';

function esc(s) { return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function addTurn(role, text, isError) {
  document.body.classList.add('has-msgs');
  const el = document.createElement('div'); el.className = 'turn ' + role + (isError ? ' error' : '');
  if (role === 'user') el.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  else el.innerHTML = `<div class="who">UST</div><div><div class="text">${esc(text)}</div><div class="tools"><button class="cp">${svgCopy}Copy</button><button class="sp">${svgSpk}Read aloud</button></div></div>`;
  if (role === 'bot') { el.querySelector('.cp').onclick = () => { navigator.clipboard.writeText(text); toast('Copied'); }; el.querySelector('.sp').onclick = () => Speech.speak(text); }
  column.appendChild(el); scroll.scrollTop = scroll.scrollHeight;
  return el;
}
function showTyping() { const el = document.createElement('div'); el.className = 'turn bot'; el.innerHTML = '<div class="who">UST</div><span class="typing"><i></i><i></i><i></i></span>'; column.appendChild(el); scroll.scrollTop = scroll.scrollHeight; return el; }
function setCaption(text, cls) { caption.textContent = text || ''; caption.className = 'caption' + (cls ? ' ' + cls : ''); }

function speakReply(text) {
  Avatar.setAmpSource(() => Speech.ttsAmp);
  Speech.speak(text, {
    onStart: () => { Avatar.setState('speaking'); setCaption(text); },
    onEnd: () => { Avatar.setState('idle'); setCaption(''); if (mode === 'voice' && handsfree && !busy) startListening(); }
  });
}

async function submit(text) {
  text = text.trim(); if (!text || busy) return;
  busy = true; Speech.cancel(); Speech.stop();
  addTurn('user', text);
  let typing = null;
  if (mode === 'voice') { Avatar.setState('thinking'); setCaption(text, 'you'); } else typing = showTyping();
  let reply, failed = false;
  try {
    reply = await API.sendMessage(text);
  } catch (e) {
    failed = true;
    reply = "I'm sorry — I couldn't reach the server just now. Please check that the backend is running and try again.";
    setOnline(false);
  }
  if (!failed) setOnline(true);
  typing && typing.remove();
  addTurn('bot', reply, failed);
  busy = false;
  if (mode === 'voice') speakReply(reply);
}

function setOnline(ok) { document.querySelector('.brand .dot').classList.toggle('offline', !ok); }

/* ---- voice input ---- */
const micMain = document.getElementById('micMain'), micChat = document.getElementById('micChat');
function startListening() {
  if (busy) return; Speech.cancel();
  if (!Speech.start()) return;
  Avatar.setAmpSource(() => Speech.micAmp); if (mode === 'voice') Avatar.setState('listening');
  micMain.classList.add('live'); micChat.classList.add('live');
  if (mode === 'voice') setCaption('Listening…', 'interim');
}
Speech.onInterim = txt => { if (mode === 'voice') setCaption(txt, 'interim'); else { input.value = txt; autosize(); } };
Speech.onResult = txt => { if (mode === 'voice') submit(txt); else { input.value = txt; autosize(); input.focus(); } };
Speech.onEnd = () => { micMain.classList.remove('live'); micChat.classList.remove('live'); if (Avatar.state === 'listening') { Avatar.setState('idle'); if (caption.classList.contains('interim')) setCaption(''); } };
micMain.onclick = micChat.onclick = () => Speech.listening ? Speech.stop() : startListening();
document.getElementById('stopBtn').onclick = () => { Speech.cancel(); Speech.stop(); Avatar.setState('idle'); setCaption(''); };
document.getElementById('handsfree').onclick = e => { handsfree = !handsfree; e.currentTarget.classList.toggle('on', handsfree); toast(handsfree ? 'Hands-free on' : 'Hands-free off'); if (handsfree) startListening(); };

/* ---- text input ---- */
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(200, input.scrollHeight) + 'px'; }
input.addEventListener('input', autosize);
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.value); input.value = ''; autosize(); } });
document.getElementById('sendBtn').onclick = () => { submit(input.value); input.value = ''; autosize(); };
document.querySelectorAll('#chips button').forEach(b => b.onclick = () => submit(b.textContent));

/* ---- mode switching ---- */
function setMode(m) {
  mode = m; document.body.classList.remove('chat', 'voice'); document.body.classList.add(m);
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  Speech.stop(); Speech.cancel(); setCaption('');
  if (m === 'voice') { Avatar.start(); Avatar.setState('idle'); }
  else { Avatar.setState('idle'); Avatar.stop(); scroll.scrollTop = scroll.scrollHeight; input.focus(); }
}
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
window.addEventListener('keydown', e => {
  if (e.target === input) return;
  if (e.code === 'Space' && mode === 'voice') { e.preventDefault(); if (!Speech.listening) startListening(); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space' && mode === 'voice' && Speech.listening && !handsfree) Speech.stop(); });

/* ---- reception panel (employee-facing) ---- */
const panel = document.getElementById('panel'), scrim = document.getElementById('scrim');
const sessStatus = document.getElementById('sessStatus'), sessVisitor = document.getElementById('sessVisitor');
const visitorForm = document.getElementById('visitorForm');
sessVisitor.value = CONFIG.VISITOR_ID;

function updateSessStatus() {
  const id = API.sessionId;
  sessStatus.textContent = id ? `Active · ${id}` : 'No active session';
  sessStatus.classList.toggle('active', !!id);
}
function openPanel() { panel.classList.add('open'); scrim.classList.add('open'); updateSessStatus(); }
function closePanel() { panel.classList.remove('open'); scrim.classList.remove('open'); }
document.getElementById('recepBtn').onclick = openPanel;
document.getElementById('panelClose').onclick = closePanel;
scrim.onclick = closePanel;
window.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) closePanel(); });

function clearChat() { column.innerHTML = ''; document.body.classList.remove('has-msgs'); }

document.getElementById('startSess').onclick = async () => {
  const vid = sessVisitor.value.trim();
  if (!vid) { toast('Enter a visitor ID'); return; }
  try {
    await API.newSession(vid);
    clearChat();
    updateSessStatus(); setOnline(true);
    toast(`Session started for ${vid}`);
  } catch (e) { setOnline(false); toast('Could not start session — is the backend running?'); }
};

document.getElementById('endSess').onclick = async () => {
  if (!API.sessionId) { toast('No active session'); return; }
  try {
    await API.endSessionNow();
    updateSessStatus();
    toast('Session ended');
  } catch (e) { toast('Could not end session'); }
};

visitorForm.onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(visitorForm);
  const profile = {
    visitor_id: (f.get('visitor_id') || '').trim(),
    name: (f.get('name') || '').trim(),
    organization: (f.get('organization') || '').trim(),
    role: (f.get('role') || '').trim(),
    meeting_with: (f.get('meeting_with') || '').trim(),
    purpose: (f.get('purpose') || '').trim(),
    areas_of_interest: (f.get('areas_of_interest') || '').split(',').map(s => s.trim()).filter(Boolean),
    previous_context: (f.get('previous_context') || '').trim(),
  };
  if (!profile.visitor_id || !profile.name) { toast('Visitor ID and name are required'); return; }
  try {
    await API.createVisitor(profile);
    sessVisitor.value = profile.visitor_id;
    visitorForm.reset();
    setOnline(true);
    toast(`Visitor ${profile.visitor_id} created — ready to start session`);
  } catch (err) { setOnline(false); toast('Could not create visitor — is the backend running?'); }
};

function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
if (window.speechSynthesis) speechSynthesis.getVoices();
input.focus();

/* ---- voice engine indicator ---- */
const engineLabel = document.getElementById('engineLabel');
function showEngine(engine, note) {
  if (engine === 'xtts') engineLabel.textContent = `Voice · XTTS-v2 (${note})`;
  else engineLabel.textContent = {
    checking: 'Voice · Browser', forced: 'Voice · Browser',
    loading: 'Voice · Browser — neural voice loading…',
    offline: 'Voice · Browser — neural voice offline',
    error: 'Voice · Browser — neural voice failed to load',
  }[note] || 'Voice · Browser';
  engineLabel.classList.toggle('neural', engine === 'xtts');
}
Speech.onEngine = showEngine;
showEngine(Speech.engine, Speech.engineNote);
Speech.pollEngine();

/* Health check on load; sessions start lazily on first message or explicitly from the reception panel. */
API.health().then(() => setOnline(true)).catch(() => { setOnline(false); toast('Backend not reachable — start the FastAPI server'); });
