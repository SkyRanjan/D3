/* Speech — recognition (input) + synthesis (output).
   Output path: backend TTS engine when available (API.synthesize), otherwise
   the browser's speechSynthesis as an interim fallback. */
const Speech = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, micAmp = () => 0, analyser = null, buf = null, onResult = null, onInterim = null, onEnd = null;
  let ttsAmp = 0, ttsOn = true, audioEl = null;

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
    // Simulated syllable envelope — browsers don't expose TTS audio for analysis.
    const tick = () => { if (!speechSynthesis.speaking) return; const s = (performance.now() - t0) / 1000;
      const env = Math.pow((Math.sin(s * 6.5) * .5 + .5) * .5 + (Math.sin(s * 2.3 + 1.2) * .5 + .5) * .3 + (Math.sin(s * 11.7) * .5 + .5) * .2, 1.4);
      ttsAmp = Math.min(1, env * .8 + boundaryKick * .6); boundaryKick *= .85; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    speechSynthesis.speak(u);
  }

  function speakViaAudio(url, onStart, done) {
    audioEl = new Audio(url);
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaElementSource(audioEl);
    const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an); an.connect(ac.destination);
    const abuf = new Uint8Array(512);
    const tick = () => { if (!audioEl || audioEl.paused) return;
      an.getByteTimeDomainData(abuf); let s = 0; for (let i = 0; i < 512; i++) { const v = (abuf[i] - 128) / 128; s += v * v; }
      ttsAmp = Math.min(1, Math.sqrt(s / 512) * 6); requestAnimationFrame(tick); };
    audioEl.onplay = () => { onStart && onStart(); tick(); };
    audioEl.onended = audioEl.onerror = () => { ttsAmp = 0; URL.revokeObjectURL(url); audioEl = null; done && done(); };
    audioEl.play();
  }

  async function speak(text, { onStart, onEnd: done } = {}) {
    if (!ttsOn) { onStart && onStart(); done && done(); return; }
    cancel();
    try {
      const url = await API.synthesize(text); // null while TTS engine is under development
      if (url) { speakViaAudio(url, onStart, done); return; }
    } catch (e) { /* TTS backend unavailable — fall back to browser voice */ }
    speakViaBrowser(text, onStart, done);
  }

  function cancel() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (audioEl) { audioEl.pause(); audioEl = null; }
    ttsAmp = 0;
  }

  return { start, stop, speak, cancel,
    get listening() { return listening; }, get micAmp() { return micAmp(); }, get ttsAmp() { return ttsAmp; },
    set onResult(f) { onResult = f; }, set onInterim(f) { onInterim = f; }, set onEnd(f) { onEnd = f; },
    set tts(v) { ttsOn = v; if (!v) cancel(); }, get tts() { return ttsOn; } };
})();
