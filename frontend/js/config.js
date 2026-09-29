const CONFIG = {
  // All requests go through the dev server proxy (server.py) to avoid CORS,
  // since the FastAPI backend does not send CORS headers.
  API_BASE: '/api',

  // Reception flow: the employee-created visitor profile decides the session.
  // Override per kiosk/tab with ?visitor=<id> in the URL.
  VISITOR_ID: new URLSearchParams(location.search).get('visitor') || 'visitor_001',

  // TTS engine is under development. When it ships (same request/response
  // pattern as /chat), flip this to true and voice replies will be fetched
  // from the backend instead of the browser's speechSynthesis fallback.
  TTS_BACKEND_READY: false,
};
