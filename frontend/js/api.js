/* Backend communication layer (all proxied via /api).
   Chat backend (FastAPI :8000):
     POST /session/start  {visitor_id}  -> {session_id, visitor_id, status}
     POST /chat           {message}     -> {response, session_id} | {error}
     POST /session/end                  -> {session_id, status}
     POST /visitor/create {profile}     -> {visitor_id, status}
   TTS service (XTTS-v2 :8001):
     GET  /tts/health                   -> {status: loading|ready|error, ...}
     POST /tts/stream     {text}        -> NDJSON: start, chunk{audio: base64 WAV}..., end
     POST /tts/cancel                   -> stop in-flight synthesis             */
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

  // ---- TTS service ----
  async function ttsHealth() {
    const r = await fetch(CONFIG.API_BASE + '/tts/health');
    if (!r.ok) throw new Error(`TTS unreachable (HTTP ${r.status})`);
    return r.json();
  }

  function b64ToArrayBuffer(s) {
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  // Resolves true when the stream completes, false if the server cancelled it
  // (a newer request preempted it). onChunk receives {index, text, audio: ArrayBuffer}.
  async function ttsStream(text, { signal, onChunk } = {}) {
    const r = await fetch(CONFIG.API_BASE + '/tts/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!r.ok) throw new Error(`TTS error (HTTP ${r.status})`);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.type === 'chunk') onChunk && onChunk({ index: msg.index, text: msg.text, audio: b64ToArrayBuffer(msg.audio) });
        else if (msg.type === 'end') return true;
        else if (msg.type === 'cancelled') return false;
        else if (msg.type === 'error') throw new Error(msg.message);
      }
    }
    throw new Error('TTS stream ended unexpectedly');
  }

  function ttsCancel() {
    fetch(CONFIG.API_BASE + '/tts/cancel', { method: 'POST' }).catch(() => {});
  }

  window.addEventListener('pagehide', endSession);

  return {
    health, startSession, newSession, endSessionNow, createVisitor,
    sendMessage, endSession, ttsHealth, ttsStream, ttsCancel,
    get sessionId() { return sessionId; },
    get visitorId() { return visitorId; },
  };
})();
