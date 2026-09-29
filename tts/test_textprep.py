import pytest

from textprep import HARD_MAX, normalize, plan


@pytest.mark.parametrize("raw, expected", [
    ("Welcome to UST.", "Welcome to you ess tee."),
    ("UST's AI and ML teams.", "you ess tee's ay eye and em el teams."),
    ("We build APIs and KPIs.", "We build ay pee eyes and kay pee eyes."),
    ("Our CTO joined NASA.", "Our see tee oh joined Nasa."),
    ("That's OK.", "That's okay."),
    ("We use SaaS and IoT platforms.", "We use sass and eye oh tee platforms."),
    ("Offices in the U.S. Our team is ready.", "Offices in the you ess. Our team is ready."),
    ("Results in Q3 were strong.", "Results in cue 3 were strong."),
])
def test_acronyms_and_lexicon(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize("raw, expected", [
    ("Meet at 10:30 AM.", "Meet at ten thirty ay em."),
    ("Meet at 3 p.m. Bring slides.", "Meet at three pee em. Bring slides."),
    ("It starts at 9:00.", "It starts at nine o'clock."),
    ("Call at 4:05 pm", "Call at four oh five pee em."),
    ("Founded in 1999.", "Founded in nineteen ninety-nine."),
    ("Growth since the 1990s.", "Growth since the nineteen nineties."),
    ("Plans for 2026-2028.", "Plans for twenty twenty-six to twenty twenty-eight."),
    ("Budget of ₹500.", "Budget of 500 rupees."),
    ("Support is 24/7.", "Support is twenty four seven."),
])
def test_times_years_symbols(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize("raw, expected", [
    ("Clouds, e.g. Azure, work.", "Clouds, for example Azure, work."),
    ("Dr. Rao will join.", "Doctor Rao will join."),
    ("Cloud, data, etc. Next topic.", "Cloud, data, et cetera. Next topic."),
    ("Email info@ust.com today.", "Email info at you ess tee dot com today."),
    ("Visit https://www.ust.com/en/services.", "Visit you ess tee dot com."),
])
def test_abbreviations_emails_urls(raw, expected):
    assert normalize(raw) == expected


def test_markdown_is_stripped():
    raw = "## Our Services\n\n- **Cloud** migration\n- *AI* solutions\n\nSee [our site](https://ust.com)."
    out = normalize(raw)
    assert "#" not in out and "*" not in out and "hash" not in out
    assert out == "Our Services. Cloud migration. ay eye solutions. See our site."


def test_parentheses_dashes_emoji():
    assert normalize("Our team (based in Kochi) — ready 🚀") == "Our team, based in Kochi, ready."


def test_empty_and_unspeakable():
    assert normalize("") == ""
    assert plan("🚀🚀") == []


def test_first_chunk_short_and_limits():
    text = ("Certainly. I can arrange a follow-up with your account team. "
            "Would early next week or later in the week suit you better? "
            "UST partners with enterprises across digital transformation, cloud and data engineering, "
            "AI solutions, and managed services, helping clients modernize legacy platforms, "
            "adopt cloud-native architectures, and build responsible AI programs at scale.")
    chunks = plan(text, first_max=110, max_len=220, min_len=25)
    assert len(chunks) >= 3
    assert len(chunks[0].text) <= 110
    assert chunks[0].text.startswith("Certainly. I can arrange")  # short opener merged, not alone
    assert all(len(c.text) <= HARD_MAX for c in chunks)
    assert all(c.text[-1] in ".!?" for c in chunks)


def test_long_sentence_split_at_clause():
    text = ("We help clients modernize legacy platforms, adopt cloud-native architectures, "
            "strengthen cybersecurity, automate operations with intelligent tooling, "
            "and build data platforms that support analytics and responsible AI at enterprise scale")
    chunks = plan(text, first_max=110, max_len=150, min_len=25)
    assert len(chunks) >= 2
    assert all(len(c.text) <= 150 for c in chunks)
    assert chunks[0].sentence_end is False and chunks[-1].sentence_end is True


def test_short_tail_merged():
    chunks = plan("I can walk you through each of these areas in depth right now. Sure?")
    assert len(chunks) == 1


def test_all_text_preserved_across_chunks():
    text = ("Here's a brief summary. We reviewed your engagement scope, discussed the cloud migration "
            "timeline, and agreed to revisit the analytics roadmap. Shall I send this recap to your team?")
    joined = " ".join(c.text for c in plan(text)).replace(".", "").replace(",", "").split()
    original = normalize(text).replace(".", "").replace(",", "").split()
    assert joined == original
