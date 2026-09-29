/* Speech — recognition (input) + synthesis (output).
   Output: XTTS-v2 service (streamed sentence chunks, played gaplessly via Web
   Audio) when it reports ready; the browser's speechSynthesis otherwise. */
const Speech = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, micAmp = () => 0, analyser = null, buf = null, onResult = null, onInterim = null, onEnd = null;
  let ttsAmp = 0, ttsOn = true;

  /* ---------------- input ---------------- */
  async function ensureMicAnalyser() {
    if (analyser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream); analyser = ac.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
      buf = new Uint8Array(512);
      micAmp = () => { analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < 512; i++) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / 512) * 6); };
    } catch (e) { toast('Microphone access denied'); }
  }

  function start() {
    if (!SR) { toast('Speech recognition not supported in this browser — try Chrome or Edge'); return false; }
    if (listening) return true;
    ensureMicAnalyser();
    rec = new SR(); rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US';
    rec.onresult = e => { let fin = '', inter = '';
      for (const r of e.results) (r.isFinal ? fin += r[0].transcript : inter += r[0].transcript);
      if (inter && onInterim) onInterim(inter); if (fin && onResult) onResult(fin.trim()); };
    rec.onend = () => { listening = false; onEnd && onEnd(); };
    rec.onerror = e => { listening = false; if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Mic error: ' + e.error); onEnd && onEnd(); };
    rec.start(); listening = true; return true;
  }
  function stop() { if (rec && listening) rec.stop(); }

  /* ---------------- engine selection ---------------- */
  let engine = 'browser', engineNote = 'checking', onEngine = null, pollTimer = null;

  function setEngine(e, note) {
    const changed = e !== engine || note !== engineNote;
    engine = e; engineNote = note;
    if (changed && onEngine) onEngine(engine, engineNote);
  }

  async function pollEngine() {
    clearTimeout(pollTimer);
    if (CONFIG.TTS_ENGINE === 'browser') { setEngine('browser', 'forced'); return; }
    try {
      const h = await API.ttsHealth();
      if (h.status === 'ready') { setEngine('piper', h.voice || h.speaker); return; }
      setEngine('browser', h.status);
      pollTimer = setTimeout(pollEngine, h.status === 'error' ? CONFIG.TTS_POLL_OFFLINE_MS : CONFIG.TTS_POLL_LOADING_MS);
    } catch (e) {
      setEngine('browser', 'offline');
      pollTimer = setTimeout(pollEngine, CONFIG.TTS_POLL_OFFLINE_MS);
    }
  }

  /* ---------------- XTTS playback ---------------- */
  let ctx = null, outAnalyser = null, outBuf = null, sources = [], streamAbort = null, token = 0;

  function audioCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      outAnalyser = ctx.createAnalyser(); outAnalyser.fftSize = 512; outAnalyser.connect(ctx.destination);
      outBuf = new Uint8Array(512);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Browsers only allow audio after a user gesture; unlock on the first one.
  const unlock = () => { audioCtx(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

  function speakViaXTTS(text, onStart, done) {
    const ac = audioCtx(), my = ++token, ctrl = new AbortController();
    streamAbort = ctrl;
    let nextAt = 0, started = false, pending = 0, streamDone = false, finished = false, chain = Promise.resolve();

    const finish = () => { if (finished || my !== token) return; finished = true; ttsAmp = 0; done && done(); };
    const tick = () => {
      if (my !== token || finished) return;
      outAnalyser.getByteTimeDomainData(outBuf);
      let s = 0; for (let i = 0; i < 512; i++) { const v = (outBuf[i] - 128) / 128; s += v * v; }
      ttsAmp = Math.min(1, Math.sqrt(s / 512) * 5);
      requestAnimationFrame(tick);
    };
    const schedule = audioBuf => {
      if (my !== token) return;
      const src = ac.createBufferSource(); src.buffer = audioBuf; src.connect(outAnalyser);
      const at = Math.max(ac.currentTime + 0.04, nextAt);
      src.start(at); nextAt = at + audioBuf.duration;
      sources.push(src); pending++;
      src.onended = () => { pending--; sources = sources.filter(x => x !== src); if (streamDone && pending === 0) finish(); };
      if (!started) { started = true; onStart && onStart(); tick(); }
    };

    return API.ttsStream(text, {
      signal: ctrl.signal,
      // decodeAudioData is async; chaining keeps chunks in order.
      onChunk: ({ audio }) => { chain = chain.then(() => ac.decodeAudioData(audio)).then(schedule); },
    }).then(async completed => {
      if (streamAbort === ctrl) streamAbort = null;
      await chain;
      streamDone = true;
      if (!completed || pending === 0) finish();
    }).catch(err => {
      if (streamAbort === ctrl) streamAbort = null;
      if (err.name === 'AbortError' || my !== token) return;
      if (started) { streamDone = true; if (pending === 0) finish(); return; }
      throw err;  // nothing played yet — caller falls back to browser voice
    });
  }

  /* ---------------- browser fallback ---------------- */
  function speakViaBrowser(text, onStart, done) {
    if (!window.speechSynthesis) { onStart && onStart(); setTimeout(() => done && done(), Math.min(6000, 60 * text.split(' ').length)); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = 1;
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => /Google UK English Female|Samantha|Microsoft Aria|en-GB/i.test(v.name + v.lang)) || voices.find(v => v.lang.startsWith('en')) || null;
    let t0 = performance.now(), boundaryKick = 0;
    u.onstart = () => { t0 = performance.now(); onStart && onStart(); };
    u.onboundary = () => { boundaryKick = 1; };
    u.onend = u.onerror = () => { ttsAmp = 0; done && done(); };
    ttsAmp = 0;
    // Simulated syllable envelope — browsers don't expose speechSynthesis audio.
    const tick = () => { if (!speechSynthesis.speaking) return; const s = (performance.now() - t0) / 1000;
      const env = Math.pow((Math.sin(s * 6.5) * .5 + .5) * .5 + (Math.sin(s * 2.3 + 1.2) * .5 + .5) * .3 + (Math.sin(s * 11.7) * .5 + .5) * .2, 1.4);
      ttsAmp = Math.min(1, env * .8 + boundaryKick * .6); boundaryKick *= .85; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    speechSynthesis.speak(u);
  }

  /* ---------------- public ---------------- */
  function stopLocal() {
    token++;
    if (streamAbort) { streamAbort.abort(); streamAbort = null; }
    sources.forEach(s => { s.onended = null; try { s.stop(); } catch (e) {} });
    sources = [];
    if (window.speechSynthesis) speechSynthesis.cancel();
    ttsAmp = 0;
  }

  // Full stop, including in-flight server synthesis. Not used when starting a
  // new utterance: /tts/stream already preempts older work server-side, and a
  // separate cancel request could race ahead and kill the new stream.
  function cancel() {
    const wasStreaming = !!streamAbort;
    stopLocal();
    if (wasStreaming) API.ttsCancel();
  }

  async function speak(text, { onStart, onEnd: done } = {}) {
    stopLocal();
    if (!ttsOn) { onStart && onStart(); done && done(); return; }
    if (engine === 'xtts') {
      try { await speakViaXTTS(text, onStart, done); return; }
      catch (e) {
        console.warn('XTTS unavailable, using browser voice:', e);
        toast('Neural voice unavailable — using browser voice');
        setEngine('browser', 'offline'); pollEngine();
      }
    }
    speakViaBrowser(text, onStart, done);
  }

  return { start, stop, speak, cancel, pollEngine,
    get listening() { return listening; }, get micAmp() { return micAmp(); }, get ttsAmp() { return ttsAmp; },
    get engine() { return engine; }, get engineNote() { return engineNote; },
    set onResult(f) { onResult = f; }, set onInterim(f) { onInterim = f; }, set onEnd(f) { onEnd = f; },
    set onEngine(f) { onEngine = f; },
    set tts(v) { ttsOn = v; if (!v) cancel(); }, get tts() { return ttsOn; } };
})();
