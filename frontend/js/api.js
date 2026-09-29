/* Backend communication layer.
   Endpoints (FastAPI, proxied via /api):
     POST /session/start  {visitor_id}  -> {session_id, visitor_id, status}
     POST /chat           {message}     -> {response, session_id} | {error}
     POST /session/end                  -> {session_id, status}
     POST /tts            (future — TTS engine under development)          */
const API = (() => {
  let sessionId = null;
  let starting = null;
  let visitorId = CONFIG.VISITOR_ID;

  async function health() {
    const r = await fetch(CONFIG.API_BASE + '/');
    if (!r.ok) throw new Error(`Server error (HTTP ${r.status})`);
    return r.json();
  }

  async function post(path, body) {
    const r = await fetch(CONFIG.API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error(`Server error (HTTP ${r.status})`);
    return r.json();
  }

  function startSession() {
    if (sessionId) return Promise.resolve(sessionId);
    if (!starting) {
      starting = post('/session/start', { visitor_id: visitorId })
        .then(d => { sessionId = d.session_id; return sessionId; })
        .finally(() => { starting = null; });
    }
    return starting;
  }

  // Explicit session control for the reception panel: ends any active
  // session, then starts a fresh one for the given visitor.
  async function newSession(vid) {
    if (vid) visitorId = vid;
    if (sessionId) { try { await post('/session/end'); } catch (e) {} sessionId = null; }
    return startSession();
  }

  async function endSessionNow() {
    if (!sessionId) throw new Error('No active session');
    const data = await post('/session/end');
    sessionId = null;
    return data;
  }

  function createVisitor(profile) {
    return post('/visitor/create', profile);
  }

  async function sendMessage(message) {
    await startSession();
    let data = await post('/chat', { message });
    if (data.error) {
      // Backend restarted and lost the in-memory session — start a new one and retry once.
      sessionId = null;
      await startSession();
      data = await post('/chat', { message });
      if (data.error) throw new Error(data.error);
    }
    return data.response;
  }

  function endSession() {
    if (!sessionId) return;
    navigator.sendBeacon(
      CONFIG.API_BASE + '/session/end',
      new Blob(['{}'], { type: 'application/json' })
    );
    sessionId = null;
  }

  // Voice output. The TTS engine backend is still under development; until
  // CONFIG.TTS_BACKEND_READY is true this returns null and callers fall back
  // to the browser's speechSynthesis.
  async function synthesize(text) {
    if (!CONFIG.TTS_BACKEND_READY) return null;
    const r = await fetch(CONFIG.API_BASE + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error(`TTS error (HTTP ${r.status})`);
    return URL.createObjectURL(await r.blob());
  }

  window.addEventListener('pagehide', endSession);

  return {
    health, startSession, newSession, endSessionNow, createVisitor,
    sendMessage, endSession, synthesize,
    get sessionId() { return sessionId; },
    get visitorId() { return visitorId; },
  };
})();
