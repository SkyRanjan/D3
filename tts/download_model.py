"""One-time download of the XTTS-v2 weights (~1.9 GB) into tts/models.

XTTS-v2 is licensed under the Coqui Public Model License (CPML, non-commercial);
running this script records acceptance of that license.

Downloads resume after connection resets (common behind the Zscaler proxy),
so just re-run the script if it is interrupted.
"""
import os
import time

# Plain HTTPS via requests honours REQUESTS_CA_BUNDLE (Zscaler root CA);
# the Xet transfer backend uses its own TLS stack.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from huggingface_hub import hf_hub_download  # noqa: E402

from engine import MODEL_DIR, REQUIRED_FILES  # noqa: E402

REPO_ID = "coqui/XTTS-v2"
MAX_ATTEMPTS = 30


def fetch(filename):
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return hf_hub_download(REPO_ID, filename, local_dir=MODEL_DIR)
        except Exception as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (401, 403):
                raise SystemExit(
                    f"\n{filename}: HTTP {status} — the download was refused (behind Zscaler this is a "
                    "UST Internet Usage Policy block on the Hugging Face CDN / .pth file type).\n"
                    "Request a business exception from IT, or obtain the files through an approved channel "
                    f"and place {', '.join(REQUIRED_FILES)} in:\n  {MODEL_DIR}"
                )
            print(f"  {filename}: attempt {attempt} failed ({type(e).__name__}); resuming in 3s…")
            time.sleep(3)
    raise SystemExit(f"Giving up on {filename} after {MAX_ATTEMPTS} attempts")


if __name__ == "__main__":
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    (MODEL_DIR / "tos_agreed.txt").write_text("I have read, understood and agreed to the Terms and Conditions.")
    for name in sorted(REQUIRED_FILES, key=lambda f: f == "model.pth"):
        print(f"Downloading {name}…")
        fetch(name)
    print(f"XTTS-v2 ready at {MODEL_DIR}")
