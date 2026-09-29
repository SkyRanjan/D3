const CONFIG = {
  // All requests go through the dev server proxy (server.py) to avoid CORS:
  // /api/tts/* -> local Piper TTS service, everything else -> chat backend.
  API_BASE: '/api',

  // Reception flow: the employee-created visitor profile decides the session.
  // Override per kiosk/tab with ?visitor=<id> in the URL.
  VISITOR_ID: new URLSearchParams(location.search).get('visitor') || 'visitor_001',

  // Voice output: 'auto' uses the local Piper TTS service once it reports ready and
  // falls back to the browser's built-in voice while it loads or if it is down.
  // 'browser' always uses the built-in voice.
  TTS_ENGINE: 'auto',
  TTS_POLL_LOADING_MS: 5000,
  TTS_POLL_OFFLINE_MS: 15000,
};
