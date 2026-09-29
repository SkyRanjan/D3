import io
import logging
import time
import wave
import threading
from dataclasses import dataclass
from pathlib import Path
 
import numpy as np
from piper import PiperVoice
 
log = logging.getLogger("tts.engine")
 
# ---------------------------------------------------------
# Piper configuration
# ---------------------------------------------------------
 
BASE_DIR = Path(__file__).resolve().parent
VOICE_DIR = BASE_DIR / "voices"
MODEL_PATH = VOICE_DIR / "en_US-lessac-medium.onnx"
 
# Will be updated from the actual Piper voice configuration
SAMPLE_RATE = 22050
 
 
class Cancelled(Exception):
    pass
 
 
@dataclass
class Chunk:
    text: str
    sentence_end: bool = False
 
 
class PiperEngine:
 
    def __init__(self):
        self.status = "idle"
        self.error = None
 
        self.voice = None
        self.speaker = "en_US-lessac-medium"
        self.speakers = ["en_US-lessac-medium"]
 
        self.epoch = 0
        self.epoch_lock = threading.Lock()
 
        self.stats = {
            "chunks": 0,
            "audio_seconds": 0.0,
            "synth_seconds": 0.0,
        }
 
    # -----------------------------------------------------
    # Model loading
    # -----------------------------------------------------
 
    def load(self):
        global SAMPLE_RATE
 
        self.status = "loading"
        self.error = None
 
        start = time.perf_counter()
 
        try:
            if not MODEL_PATH.exists():
                raise FileNotFoundError(
                    f"Piper voice model not found:\n{MODEL_PATH}"
                )
 
            config_path = Path(str(MODEL_PATH) + ".json")
 
            if not config_path.exists():
                raise FileNotFoundError(
                    f"Piper voice configuration not found:\n{config_path}"
                )
 
            log.info("Loading Piper voice: %s", MODEL_PATH)
 
            self.voice = PiperVoice.load(
                str(MODEL_PATH),
                use_cuda=False
            )
 
            SAMPLE_RATE = self.voice.config.sample_rate
 
            self.status = "ready"
 
            elapsed = time.perf_counter() - start
 
            log.info(
                "Piper TTS ready in %.2fs | sample_rate=%s",
                elapsed,
                SAMPLE_RATE,
            )
 
            # Warm-up
            self.synth_chunk(
                "Hello, and welcome.",
                self.epoch,
                0
            )
 
            log.info("Piper TTS warm-up complete")
 
        except Exception as exc:
            self.status = "error"
            self.error = str(exc)
 
            log.exception("Piper TTS failed to load")
 
    # -----------------------------------------------------
    # Health information
    # -----------------------------------------------------
 
    def info(self):
        return {
            "status": self.status,
            "error": self.error,
            "model": "piper",
            "voice": self.speaker,
            "device": "cpu",
            "sample_rate": SAMPLE_RATE,
            "voice_model": MODEL_PATH.name,
            "stats": self.stats,
        }
 
    # -----------------------------------------------------
    # Cancellation
    # -----------------------------------------------------
 
    def new_epoch(self):
        with self.epoch_lock:
            self.epoch += 1
            return self.epoch
 
    def _check_epoch(self, epoch):
        with self.epoch_lock:
            if epoch != self.epoch:
                raise Cancelled()
 
    # -----------------------------------------------------
    # Text planning
    # -----------------------------------------------------
 
    def plan(self, text):
        """
        Split text into manageable sentence/chunk units.
 
        The server expects each chunk to contain:
            chunk.text
            chunk.sentence_end
        """
 
        text = " ".join(text.strip().split())
 
        if not text:
            return []
 
        chunks = []
 
        # Simple sentence segmentation
        import re
 
        parts = re.split(r"(?<=[.!?])\s+", text)
 
        for part in parts:
            part = part.strip()
 
            if not part:
                continue
 
            chunks.append(
                Chunk(
                    text=part,
                    sentence_end=True
                )
            )
 
        # Fallback
        if not chunks:
            chunks.append(
                Chunk(
                    text=text,
                    sentence_end=True
                )
            )
 
        return chunks
 
    # -----------------------------------------------------
    # Synthesis
    # -----------------------------------------------------
 
    def synth_chunk(
        self,
        text,
        epoch,
        pause_ms=0
    ):
        self._check_epoch(epoch)
 
        if self.voice is None:
            raise RuntimeError("Piper TTS engine is not loaded")
 
        start = time.perf_counter()
 
        buffer = io.BytesIO()
 
        with wave.open(buffer, "wb") as wav_file:
            self.voice.synthesize_wav(
                text,
                wav_file
            )
 
        wav_bytes = buffer.getvalue()
 
        # Read generated WAV back into numpy
        with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
            frames = wav_file.readframes(wav_file.getnframes())
 
        audio = np.frombuffer(
            frames,
            dtype=np.int16
        ).astype(np.float32) / 32768.0
 
        # Add pause between chunks/sentences
        if pause_ms > 0:
            pause_samples = int(
                SAMPLE_RATE * pause_ms / 1000
            )
 
            audio = np.concatenate(
                [
                    audio,
                    np.zeros(
                        pause_samples,
                        dtype=np.float32
                    )
                ]
            )
 
        elapsed = time.perf_counter() - start
 
        self.stats["chunks"] += 1
        self.stats["synth_seconds"] += elapsed
        self.stats["audio_seconds"] += (
            len(audio) / SAMPLE_RATE
        )
 
        self._check_epoch(epoch)
 
        return audio
 
    # -----------------------------------------------------
    # WAV conversion
    # -----------------------------------------------------
 
    @staticmethod
    def to_wav_bytes(audio):
        buffer = io.BytesIO()
 
        audio = np.asarray(audio)
 
        audio = np.clip(
            audio,
            -1.0,
            1.0
        )
 
        pcm = (
            audio * 32767
        ).astype(np.int16)
 
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(
                pcm.tobytes()
            )
 
        return buffer.getvalue()
 
 
# Backwards-compatible name if anything else imports XTTS
XTTS_Engine = PiperEngine