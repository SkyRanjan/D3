"""English text preparation for XTTS-v2: normalization and chunking.

XTTS lowercases input and only expands numbers, currency, a few symbols and
titles itself, so anything else (markdown, acronyms, times, URLs) is made
speakable here before it reaches the model.
"""
import re
import unicodedata
from dataclasses import dataclass

import pysbd
from num2words import num2words

HARD_MAX = 240  # XTTS English char limit is 250

LETTER_NAMES = {
    "A": "ay", "B": "bee", "C": "see", "D": "dee", "E": "ee", "F": "eff", "G": "jee",
    "H": "aitch", "I": "eye", "J": "jay", "K": "kay", "L": "el", "M": "em", "N": "en",
    "O": "oh", "P": "pee", "Q": "cue", "R": "ar", "S": "ess", "T": "tee", "U": "you",
    "V": "vee", "W": "double you", "X": "ex", "Y": "why", "Z": "zee",
}

# All-caps words pronounced as words rather than spelled out.
SAY_AS_WORD = {"NASA", "NATO", "COVID", "UNESCO", "UNICEF", "SCADA", "RADAR", "LASER",
               "SWOT", "CAPEX", "OPEX", "GIF", "PIN", "SIM"}

# Case-sensitive exact-token pronunciations, applied before the acronym rule.
LEXICON = {
    "UST": "you ess tee",
    "OK": "okay",
    "IoT": "eye oh tee",
    "SaaS": "sass",
    "PaaS": "pass",
    "DevOps": "dev ops",
    "DevSecOps": "dev sec ops",
    "MLOps": "em el ops",
    "AIOps": "ay eye ops",
    "FinOps": "fin ops",
    "GenAI": "jen ay eye",
    "ChatGPT": "chat jee pee tee",
    "B2B": "bee to bee",
    "B2C": "bee to see",
    "24/7": "twenty four seven",
    "and/or": "and or",
}

SPOKEN_TLDS = {"com", "org", "net", "gov", "edu"}


def _sentence_end_after(m):
    rest = m.string[m.end():]
    return rest.strip() == "" or re.match(r"\s+[\"'(]?[A-Z]", rest) is not None


def _spell(letters):
    return " ".join(LETTER_NAMES[c] for c in letters.upper() if c in LETTER_NAMES)


def _speak_domain(domain):
    labels = []
    for label in domain.lower().split("."):
        if label.upper() in LEXICON:
            labels.append(LEXICON[label.upper()])
        elif len(label) <= 3 and label not in SPOKEN_TLDS:
            labels.append(_spell(label))
        else:
            labels.append(label)
    return " dot ".join(labels)


# ---------------------------------------------------------------- markdown

def _strip_markdown(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"(\*\*|__)(.+?)\1", r"\2", text)
    text = re.sub(r"(?<!\w)[*_](?!\s)(.+?)(?<!\s)[*_](?!\w)", r"\1", text)
    text = re.sub(r"^\s*([-*_]\s*){3,}$", "", text, flags=re.M)
    text = re.sub(r"^\s{0,3}#{1,6}\s*(.*?)\s*#*\s*$", r"\1", text, flags=re.M)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)
    text = re.sub(r"^\s*(?:[-*+•]|\d{1,3}[.)])\s+", "", text, flags=re.M)
    text = text.replace("|", ", ")

    lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.endswith(":"):
            line = line[:-1] + "."
        elif line[-1] not in ".!?;,":
            line += "."
        lines.append(line)
    return " ".join(lines)


# ---------------------------------------------------------------- rules

_ABBREV_MIDSENTENCE = [
    (r"e\.\s?g\.", "for example"),
    (r"i\.\s?e\.", "that is"),
    (r"Mr\.", "Mister"),
    (r"Mrs\.", "Missus"),
    (r"Ms\.", "Miz"),
    (r"Dr\.", "Doctor"),
    (r"Prof\.", "Professor"),
    (r"Jr\.", "Junior"),
    (r"Sr\.", "Senior"),
]
_ABBREV_MAY_END = [
    (r"etc\.", "et cetera"),
    (r"approx\.", "approximately"),
    (r"Inc\.", "Incorporated"),
    (r"Ltd\.", "Limited"),
    (r"Dept\.", "Department"),
    (r"vs\.?", "versus"),
]


def _expand_abbreviations(text):
    for pat, rep in _ABBREV_MIDSENTENCE:
        text = re.sub(rf"(?<!\w){pat}", rep, text, flags=re.I)
    for pat, rep in _ABBREV_MAY_END:
        text = re.sub(
            rf"(?<!\w){pat}(?!\w)",
            lambda m, rep=rep: rep + ("." if m.group(0).endswith(".") and _sentence_end_after(m) else ""),
            text,
            flags=re.I,
        )
    text = re.sub(r"\bNo\.\s*(?=\d)", "number ", text)
    text = re.sub(r"#(?=\d)", "number ", text)
    return text


_AMPM = r"(?:\s?([AaPp])(?:\.\s?[Mm]\.|\s?[Mm]\b))"
_TIME_RE = re.compile(rf"\b(\d{{1,2}}):(\d{{2}})\b{_AMPM}?")
_HOUR_AMPM_RE = re.compile(rf"\b(\d{{1,2}}){_AMPM}")


def _ampm(letter):
    return "ay em" if letter.lower() == "a" else "pee em"


def _time(m):
    h, mm, ap = int(m.group(1)), int(m.group(2)), m.group(3)
    if h > 24 or mm > 59:
        return m.group(0)
    words = num2words(h)
    if mm == 0:
        words += "" if ap else " o'clock"
    elif mm < 10:
        words += " oh " + num2words(mm)
    else:
        words += " " + num2words(mm)
    if ap:
        words += " " + _ampm(ap)
        if m.group(0).endswith(".") and _sentence_end_after(m):
            words += "."
    return words


def _hour_ampm(m):
    h = int(m.group(1))
    if h < 1 or h > 12:
        return m.group(0)
    out = f"{num2words(h)} {_ampm(m.group(2))}"
    if m.group(0).endswith(".") and _sentence_end_after(m):
        out += "."
    return out


_YEAR_CONTEXT = (r"in|since|by|from|until|till|through|during|of|year|early|late|mid|"
                 r"before|after|to|and|circa|the|for|fiscal|FY")
_YEAR_RE = re.compile(rf"\b({_YEAR_CONTEXT})(\s+)((?:19|20)\d{{2}})(s?)\b(?![.,]\d|\s*%)", re.I)


def _year(m):
    words = num2words(int(m.group(3)), to="year")
    if m.group(4):
        words = words[:-1] + "ies" if words.endswith("y") else words + "s"
    return f"{m.group(1)}{m.group(2)}{words}"


def _acronym(m):
    word, plural = m.group(1), m.group(2)
    if word in SAY_AS_WORD:
        return word.capitalize() + plural
    spelled = _spell(word)
    return spelled + ("s" if plural else "")


def _apply_lexicon(text):
    for key, spoken in LEXICON.items():
        text = re.sub(rf"(?<![\w/]){re.escape(key)}(?![\w/])", spoken, text)
    return text


def _speak_emails(text):
    def rep(m):
        user = m.group(1).replace(".", " dot ").replace("_", " underscore ").replace("-", " dash ")
        return f"{user} at {_speak_domain(m.group(2))}"
    return re.sub(r"\b([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)\b", rep, text)


_URL_RE = re.compile(
    r"\b(?:https?://)?(?:www\.)?((?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|in|uk|gov|edu|us))"
    r"(?:/[^\s]*[^\s.,;:!?)])?(?![\w.]*\w)",
    re.I,
)


def _speak_urls(text):
    return _URL_RE.sub(lambda m: _speak_domain(m.group(1)), text)


def _symbols(text):
    text = re.sub(r"₹\s?([\d,]+(?:\.\d+)?)", r"\1 rupees", text)
    text = re.sub(r"\bRs\.?\s?([\d,]+(?:\.\d+)?)", r"\1 rupees", text)
    text = re.sub(r"\bINR\s?([\d,]+(?:\.\d+)?)", r"\1 rupees", text)
    text = re.sub(r"~\s*(?=\d)", "about ", text)
    text = re.sub(r"(?<=\w)\s*\+\s*(?=[A-Za-z])", " plus ", text)
    text = text.replace("→", " to ").replace("×", " times ")
    text = re.sub(r"(?<![\d-])(\d{1,4})\s?[–-]\s?(\d{1,4})(?![\d-])", r"\1 to \2", text)
    text = re.sub(r"(?<=\w)/(?=\w)", " and ", text)
    return text


def _punctuation(text):
    text = text.replace("…", ", ").replace("...", ", ")
    text = re.sub(r"\s*[—]\s*", ", ", text)
    text = re.sub(r"\s+[–-]\s+", ", ", text)
    text = re.sub(r"[(\[{]\s*", ", ", text)
    text = re.sub(r"\s*[)\]}]", ", ", text)
    return text


def _keep_speakable(text):
    out = []
    for ch in text:
        if ch.isalpha() and ord(ch) < 0x250:
            out.append(ch)
        elif ch.isdigit() or ch in " .,!?;:'\"-$%&@£€°":
            out.append(ch)
        elif ch.isspace() or ch in "_\\*<>=^":
            out.append(" ")
    return "".join(out)


def _tidy(text):
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text)
    text = re.sub(r"([,;:])(?:\s*[,;:])+", r"\1", text)
    text = re.sub(r"[,;:]\s*([.!?])", r"\1", text)
    text = re.sub(r"([.!?])(?:\s*[.!?,;:])+", r"\1", text)
    text = re.sub(r"([a-z])([.!?])([A-Z])", r"\1\2 \3", text)
    text = re.sub(r"^[\s,.;:!?]+", "", text).strip()
    if text and text[-1] in ",;:-":
        text = text[:-1].rstrip()
    if text and text[-1] not in ".!?":
        text += "."
    return text


def normalize(text):
    text = unicodedata.normalize("NFKC", text or "")
    text = (text.replace("‘", "'").replace("’", "'")
                .replace("“", '"').replace("”", '"'))
    text = _strip_markdown(text)
    text = _speak_emails(text)
    text = _speak_urls(text)
    text = re.sub(r"(?<!\w)((?:[A-Z]\.){2,})",
                  lambda m: _spell(m.group(1)) + ("." if _sentence_end_after(m) else ""), text)
    text = _expand_abbreviations(text)
    text = _TIME_RE.sub(_time, text)
    text = _HOUR_AMPM_RE.sub(_hour_ampm, text)
    text = _apply_lexicon(text)
    text = _symbols(text)
    text = _YEAR_RE.sub(_year, text)
    text = re.sub(r"\b([A-Z])(\d{1,2})\b", lambda m: f"{LETTER_NAMES[m.group(1)]} {m.group(2)}", text)
    text = re.sub(r"\b([A-Z]{2,6})(s?)\b", _acronym, text)
    text = _punctuation(text)
    text = _keep_speakable(text)
    return _tidy(text)


# ---------------------------------------------------------------- chunking

@dataclass(frozen=True)
class Chunk:
    text: str
    sentence_end: bool


_segmenter = pysbd.Segmenter(language="en", clean=False)
_CLAUSE_RE = re.compile(r"[,;:]\s+|\s+[-–—]\s+")


def _best_cut(s, limit, min_len):
    cuts = [m.end() for m in _CLAUSE_RE.finditer(s)
            if min_len <= m.end() <= limit and len(s) - m.end() >= min_len]
    if cuts:
        return max(cuts)
    space = s.rfind(" ", 0, limit + 1)
    return space if space >= min_len else limit


def _split(text, first_limit, limit, min_len):
    parts, rest, lim = [], text.strip(), first_limit
    while len(rest) > lim:
        cut = _best_cut(rest, lim, min_len)
        parts.append(rest[:cut].strip())
        rest = rest[cut:].strip()
        lim = limit
    if rest:
        parts.append(rest)
    return parts


def _finalize(text):
    text = text.strip()
    if text[-1] in ",;:-–—":
        text = text[:-1].rstrip()
    if text[-1] not in ".!?":
        text += "."
    return text


def plan(text, first_max=110, max_len=220, min_len=25):
    """Normalize text and split it into synthesis chunks.

    The first chunk is kept short for fast time-to-first-audio; later chunks
    merge sentences up to max_len to reduce per-call overhead, and very short
    fragments are merged because XTTS is prone to artifacts on them.
    """
    norm = normalize(text)
    if not norm:
        return []
    max_len = min(max_len, HARD_MAX)
    first_max = min(first_max, max_len)

    pieces = []
    for i, sentence in enumerate(s.strip() for s in _segmenter.segment(norm)):
        if not sentence:
            continue
        parts = _split(sentence, first_max if not pieces else max_len, max_len, min_len)
        pieces.extend((p, j == len(parts) - 1) for j, p in enumerate(parts))

    chunks, cur = [], None
    for piece, end in pieces:
        if cur is None:
            cur = [piece, end]
            continue
        limit = first_max if not chunks else max_len
        joined = f"{cur[0]} {piece}"
        if (len(joined) <= limit or len(cur[0]) < min_len) and len(joined) <= HARD_MAX:
            cur = [joined, end]
        else:
            chunks.append(Chunk(_finalize(cur[0]), cur[1]))
            cur = [piece, end]
    if cur:
        if chunks and len(cur[0]) < min_len and len(chunks[-1].text) + 1 + len(cur[0]) <= HARD_MAX:
            chunks[-1] = Chunk(_finalize(f"{chunks[-1].text} {cur[0]}"), cur[1])
        else:
            chunks.append(Chunk(_finalize(cur[0]), cur[1]))
    return chunks
