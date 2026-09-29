import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent 
ZSCALER_CERT = BASE_DIR /"certs" / "zscaler-root-ca.cer"
os.environ["REQUESTS_CA_BUNDLE"]=str(ZSCALER_CERT)
os.environ["SSL_CERT_FILE"]=str(ZSCALER_CERT)

"""UST Representative — TTS service (Coqui XTTS-v2, CPU).

Endpoints (JSON in, same request pattern as the chat backend):
  GET  /tts/health   engine status: loading | ready | error
  GET  /tts/voices   built-in speakers
  POST /tts          {text} -> audio/wav (whole utterance)
  POST /tts/stream   {text} -> NDJSON: start, chunk (base64 WAV) ..., end
  POST /tts/cancel   stop any in-flight synthesis

Run:  tts\\venv\\Scripts\\python.exe tts\\server.py
"""
import base64
import json
import logging
import threading
import time
from contextlib import asynccontextmanager

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

import config
from engine import SAMPLE_RATE, Cancelled, PiperEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("tts.server")

engine = PiperEngine()


@asynccontextmanager
async def lifespan(app):
    threading.Thread(target=engine.load, name="xtts-load", daemon=True).start()
    yield


app = FastAPI(title="UST Representative TTS", lifespan=lifespan)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=config.MAX_INPUT_CHARS)


def _require_ready():
    if engine.status != "ready":
        detail = engine.error if engine.status == "error" else f"TTS engine is {engine.status}"
        raise HTTPException(status_code=503, detail=detail)


def _plan_or_422(text):
    chunks = engine.plan(text)
    if not chunks:
        raise HTTPException(status_code=422, detail="Nothing speakable in text")
    return chunks


def _pause_ms(chunks, i):
    if i == len(chunks) - 1:
        return 0
    return config.SENTENCE_PAUSE_MS if chunks[i].sentence_end else config.CLAUSE_PAUSE_MS


@app.get("/tts/health")
def health():
    return engine.info()


@app.get("/tts/voices")
def voices():
    return {"current": engine.speaker, "speakers": engine.speakers}


@app.post("/tts/cancel")
def cancel():
    engine.new_epoch()
    return {"status": "cancelled"}


@app.post("/tts")
def synthesize(req: TTSRequest):
    _require_ready()
    chunks = _plan_or_422(req.text)
    epoch = engine.new_epoch()
    try:
        wav = np.concatenate([engine.synth_chunk(c.text, epoch, _pause_ms(chunks, i)) for i, c in enumerate(chunks)])
    except Cancelled:
        raise HTTPException(status_code=409, detail="Cancelled by a newer request")
    return Response(PiperEngine.to_wav_bytes(wav), media_type="audio/wav")


@app.post("/tts/stream")
def synthesize_stream(req: TTSRequest):
    _require_ready()
    chunks = _plan_or_422(req.text)
    epoch = engine.new_epoch()

    def line(obj):
        return json.dumps(obj) + "\n"

    def generate():
        t0 = time.perf_counter()
        yield line({"type": "start", "chunks": len(chunks), "sample_rate": SAMPLE_RATE})
        try:
            for i, chunk in enumerate(chunks):
                wav = engine.synth_chunk(chunk.text, epoch, _pause_ms(chunks, i))
                yield line({
                    "type": "chunk",
                    "index": i,
                    "text": chunk.text,
                    "audio": base64.b64encode(PiperEngine.to_wav_bytes(wav)).decode("ascii"),
                })
            yield line({"type": "end", "seconds": round(time.perf_counter() - t0, 2)})
        except Cancelled:
            yield line({"type": "cancelled"})
        except Exception as e:
            log.exception("Streaming synthesis failed")
            yield line({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")
