import io
import logging
import threading
import time
from collections import OrderedDict

import numpy as np
import soundfile as sf
import torch
from transformers import StoppingCriteria, StoppingCriteriaList

import config
from textprep import plan

log = logging.getLogger("tts.engine")

SAMPLE_RATE = 24000
MODEL_DIR = config.MODELS_DIR / "tts" / config.MODEL_NAME.replace("/", "--")
REQUIRED_FILES = ("model.pth", "config.json", "vocab.json", "speakers_xtts.pth")

# Plausible speaking rate bounds (chars/second) used to catch XTTS failure
# modes: runaway babbling (too long) or truncated output (too short).
TYPICAL_CPS = 14.0
MIN_CPS, MAX_CPS = 7.0, 30.0


class Cancelled(Exception):
    pass


class _CancelOnNewEpoch(StoppingCriteria):
    def __init__(self, engine, epoch):
        self.engine, self.epoch = engine, epoch

    def __call__(self, input_ids, scores, **kwargs):
        stop = self.engine.epoch != self.epoch
        return torch.full((input_ids.shape[0],), stop, dtype=torch.bool, device=input_ids.device)


def to_wav_bytes(wav):
    buf = io.BytesIO()
    sf.write(buf, wav, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def _trim_and_level(wav):
    frame = SAMPLE_RATE // 100
    n = len(wav) // frame
    if n < 3:
        return wav
    rms = np.sqrt(np.mean(wav[: n * frame].reshape(n, frame) ** 2, axis=1))
    voiced = np.nonzero(rms > max(rms.max() * 0.01, 1e-4))[0]
    if len(voiced):
        start = max(0, (voiced[0] - 3) * frame)
        end = min(len(wav), (voiced[-1] + 7) * frame)
        wav = wav[start:end]
    peak = float(np.abs(wav).max()) if len(wav) else 0.0
    if peak > 0:
        wav = wav * min(0.9 / peak, 3.0)
    fade_in, fade_out = SAMPLE_RATE // 200, SAMPLE_RATE // 50
    if len(wav) > fade_in + fade_out:
        wav[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
        wav[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)
    return wav.astype(np.float32)


class XTTSEngine:
    def __init__(self):
        self.status = "idle"  # idle | loading | ready | error
        self.error = None
        self.model = None
        self.speaker = config.SPEAKER
        self.speakers = []
        self.load_seconds = None
        self.epoch = 0
        self._latents = None
        self._gen_settings = {}
        self._infer_lock = threading.Lock()
        self._epoch_lock = threading.Lock()
        self._cache = OrderedDict()
        self._cache_lock = threading.Lock()
        self.stats = {"chunks": 0, "cache_hits": 0, "retries": 0, "audio_seconds": 0.0, "synth_seconds": 0.0}

    # ------------------------------------------------------------ lifecycle

    def load(self):
        self.status = "loading"
        t0 = time.perf_counter()
        try:
            missing = [f for f in REQUIRED_FILES if not (MODEL_DIR / f).is_file()]
            if missing:
                raise FileNotFoundError(
                    f"XTTS-v2 model files missing in {MODEL_DIR} ({', '.join(missing)}). "
                    "Run: tts\\venv\\Scripts\\python.exe tts\\download_model.py"
                )
            if config.THREADS > 0:
                torch.set_num_threads(config.THREADS)

            from TTS.tts.configs.xtts_config import XttsConfig
            from TTS.tts.models.xtts import Xtts

            cfg = XttsConfig()
            cfg.load_json(str(MODEL_DIR / "config.json"))
            model = Xtts.init_from_config(cfg)
            model.load_checkpoint(cfg, checkpoint_dir=str(MODEL_DIR), use_deepspeed=False)
            model.eval()

            self.speakers = sorted(model.speaker_manager.speakers.keys())
            if self.speaker not in model.speaker_manager.speakers:
                raise ValueError(f"Speaker '{self.speaker}' not found. Available: {', '.join(self.speakers)}")
            voice = model.speaker_manager.speakers[self.speaker]
            self._latents = (voice["gpt_cond_latent"], voice["speaker_embedding"])
            self._gen_settings = {
                "temperature": config.TEMPERATURE,
                "length_penalty": cfg.length_penalty,
                "repetition_penalty": cfg.repetition_penalty,
                "top_k": cfg.top_k,
                "top_p": cfg.top_p,
                "speed": config.SPEED,
            }
            self.model = model

            log.info("Model loaded in %.1fs (threads=%d); warming up…", time.perf_counter() - t0, torch.get_num_threads())
            w0 = time.perf_counter()
            wav = self._infer("Hello, and welcome.", self.epoch, config.SEED, config.TEMPERATURE)
            log.info("Warm-up: %.2fs audio in %.2fs", len(wav) / SAMPLE_RATE, time.perf_counter() - w0)

            self.load_seconds = round(time.perf_counter() - t0, 1)
            self.status = "ready"
            log.info("XTTS-v2 ready — speaker '%s', %.1fs total", self.speaker, self.load_seconds)
        except Exception as e:
            self.status, self.error = "error", str(e)
            log.exception("TTS engine failed to load")

    def info(self):
        s = self.stats
        rtf = round(s["synth_seconds"] / s["audio_seconds"], 2) if s["audio_seconds"] else None
        return {
            "status": self.status,
            "error": self.error,
            "model": "xtts_v2",
            "device": "cpu",
            "speaker": self.speaker,
            "language": config.LANGUAGE,
            "sample_rate": SAMPLE_RATE,
            "load_seconds": self.load_seconds,
            "real_time_factor": rtf,
            **s,
        }

    # ------------------------------------------------------------ cancellation

    def new_epoch(self):
        """Invalidate all in-flight and queued synthesis; returns the new epoch."""
        with self._epoch_lock:
            self.epoch += 1
            return self.epoch

    # ------------------------------------------------------------ synthesis

    def plan(self, text):
        return plan(text, config.FIRST_CHUNK_MAX, config.CHUNK_MAX, config.CHUNK_MIN)

    def _infer(self, text, epoch, seed, temperature):
        if self.epoch != epoch:
            raise Cancelled()
        with self._infer_lock:
            if self.epoch != epoch:
                raise Cancelled()
            torch.manual_seed(seed)
            gpt_cond_latent, speaker_embedding = self._latents
            out = self.model.inference(
                text,
                config.LANGUAGE,
                gpt_cond_latent,
                speaker_embedding,
                **{**self._gen_settings, "temperature": temperature},
                stopping_criteria=StoppingCriteriaList([_CancelOnNewEpoch(self, epoch)]),
            )
        if self.epoch != epoch:
            raise Cancelled()
        return np.asarray(out["wav"], dtype=np.float32)

    @staticmethod
    def _cps(text, wav):
        seconds = max(len(wav) / SAMPLE_RATE, 1e-3)
        return len(text) / seconds * config.SPEED ** -1

    def synth_chunk(self, text, epoch, pause_ms=0):
        key = (self.speaker, text, config.TEMPERATURE, config.SPEED, config.SEED)
        with self._cache_lock:
            wav = self._cache.get(key)
            if wav is not None:
                self._cache.move_to_end(key)
                self.stats["cache_hits"] += 1

        if wav is None:
            t0 = time.perf_counter()
            wav = self._infer(text, epoch, config.SEED, config.TEMPERATURE)
            cps = self._cps(text, wav)
            if not (MIN_CPS <= cps <= MAX_CPS):
                log.warning("Implausible duration (%.1f chars/s) for %r — retrying", cps, text)
                self.stats["retries"] += 1
                retry = self._infer(text, epoch, config.SEED + 1, min(config.TEMPERATURE, 0.5))
                if abs(self._cps(text, retry) - TYPICAL_CPS) < abs(cps - TYPICAL_CPS):
                    wav = retry
            elapsed = time.perf_counter() - t0
            wav = _trim_and_level(wav)
            self.stats["chunks"] += 1
            self.stats["synth_seconds"] += elapsed
            self.stats["audio_seconds"] += len(wav) / SAMPLE_RATE
            log.info("Synth %.2fs audio in %.2fs (RTF %.2f): %r",
                     len(wav) / SAMPLE_RATE, elapsed, elapsed / max(len(wav) / SAMPLE_RATE, 1e-3), text)
            with self._cache_lock:
                self._cache[key] = wav
                while len(self._cache) > config.CACHE_ENTRIES:
                    self._cache.popitem(last=False)

        if pause_ms:
            wav = np.concatenate([wav, np.zeros(SAMPLE_RATE * pause_ms // 1000, dtype=np.float32)])
        return wav
