import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def _env(name, default, cast=str):
    value = os.environ.get(name)
    return default if value in (None, "") else cast(value)


HOST = _env("TTS_HOST", "127.0.0.1")
PORT = _env("TTS_PORT", 8001, int)

MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
MODELS_DIR = Path(_env("TTS_MODELS_DIR", str(ROOT / "models")))

SPEAKER = _env("TTS_SPEAKER", "Ana Florence")
LANGUAGE = _env("TTS_LANGUAGE", "en")

# Lower than XTTS's 0.75 default: fewer mispronunciations and artifacts, slightly flatter prosody.
TEMPERATURE = _env("TTS_TEMPERATURE", 0.65, float)
SPEED = _env("TTS_SPEED", 1.0, float)
SEED = _env("TTS_SEED", 1234, int)

# 0 = let torch decide (physical cores).
THREADS = _env("TTS_THREADS", 0, int)

# Chunking (characters). XTTS's English hard limit is 250; the first chunk is
# kept short so the first audio arrives quickly on CPU.
FIRST_CHUNK_MAX = _env("TTS_FIRST_CHUNK_MAX", 110, int)
CHUNK_MAX = _env("TTS_CHUNK_MAX", 220, int)
CHUNK_MIN = _env("TTS_CHUNK_MIN", 25, int)
MAX_INPUT_CHARS = _env("TTS_MAX_INPUT_CHARS", 4000, int)

CACHE_ENTRIES = _env("TTS_CACHE_ENTRIES", 256, int)

SENTENCE_PAUSE_MS = 220
CLAUSE_PAUSE_MS = 90
