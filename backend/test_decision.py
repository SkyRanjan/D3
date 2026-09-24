import json
from typing import Literal

from openai import OpenAI
from huggingface_hub import get_token
from pydantic import BaseModel


class VisitorDecision(BaseModel):
    action: Literal[
        "ANSWER",
        "CLARIFY",
        "REFUSE",
        "ESCALATE"
    ]

    context_required: list[
        Literal[
            "UST_KNOWLEDGE",
            "VISITOR_PROFILE",
            "CURRENT_SESSION",
            "PREVIOUS_SESSION",
            "NONE"
        ]
    ]

    needs_clarification: bool
    needs_escalation: bool

    sensitivity: Literal[
        "NORMAL",
        "SENSITIVE"
    ]


client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=get_token()
)


system_prompt = """
You are the decision layer for an AI corporate representative.

Do NOT answer the visitor.

Analyze the visitor's request and decide what the application should do.

ALLOWED ACTIONS:

- ANSWER:
  The request can be answered using the available context.

- CLARIFY:
  The visitor's intent is genuinely ambiguous or insufficient.

- REFUSE:
  The visitor requests information that should not be provided.

- ESCALATE:
  The request requires a human UST representative.

ALLOWED CONTEXT:

- UST_KNOWLEDGE:
  General factual information about UST.

- VISITOR_PROFILE:
  Information specifically provided about this visitor, including:
  organization, role, meeting_with, purpose, and areas_of_interest.

- CURRENT_SESSION:
  Information discussed during the current conversation.

- PREVIOUS_SESSION:
  Information from an earlier visit or previous session.

- NONE:
  No additional context is required.


CONTEXT RULES:

1. UST_KNOWLEDGE

Use UST_KNOWLEDGE when the visitor asks about UST, its services,
capabilities, industries, technologies, or other general company
information.


2. VISITOR_PROFILE

Use VISITOR_PROFILE when the visitor asks about information specific
to their current visit or profile, such as:

- their organization
- their role
- their purpose of visiting
- who they are meeting
- their areas of interest
- their meeting today

If this information is already available in the visitor profile,
choose ANSWER.

Do NOT choose CLARIFY simply because visitor profile information and
another context source could both be useful.


3. CURRENT_SESSION

Use CURRENT_SESSION when the visitor explicitly refers to something
discussed during the current conversation.

Examples:

"What did we discuss just now?"
"What was I asking earlier?"
"Can you remind me what you said?"


4. PREVIOUS_SESSION

Use PREVIOUS_SESSION when the visitor explicitly refers to a previous
visit, previous meeting, or previous conversation.

Examples:

"What did we discuss during my last visit?"
"What did we talk about in our previous meeting?"
"What did we discuss last time?"


5. AMBIGUOUS REFERENCES

If a phrase such as "earlier", "before", or "previously" could
reasonably refer either to the current conversation or a previous
session, choose CLARIFY.

When doing this, include both:

CURRENT_SESSION
PREVIOUS_SESSION


6. CLARIFY

Use CLARIFY only when the visitor's actual intent cannot be determined
with reasonable confidence.

Examples:

"Can you tell me more?"
"I want to know more."

These require clarification because the subject is missing.

Do NOT use CLARIFY when the required information is already available
in the visitor profile or another clearly identifiable context.


7. REFUSE

Use REFUSE when the visitor explicitly requests confidential,
private, restricted, or unauthorized information.


8. ESCALATE

Use ESCALATE when the request requires a human representative,
authorization, action, or information unavailable to the AI.


SENSITIVITY RULES:

The sensitivity field MUST contain exactly one of:

NORMAL
SENSITIVE

Use NORMAL for ordinary questions about UST, the visitor, meetings,
services, conversations, or other non-confidential information.

Use SENSITIVE only when the visitor is requesting confidential,
private, restricted, or unauthorized information.

Never return values such as:

"none"
"low"
"medium"
"high"
"non-sensitive"

Only NORMAL or SENSITIVE are allowed.


IMPORTANT:

Do not generate the visitor's answer.

Return only the structured decision.
"""


test_messages = [
    "What services does UST provide?",
    "What can you tell me about my meeting today?",
    "What did we discuss earlier?",
    "What did we discuss during my last visit?",
    "Can you tell me more?",
    "Tell me something about UST.",
]


for message in test_messages:

    response = client.responses.parse(
        model="openai/gpt-oss-120b:groq",

        input=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": message
            }
        ],

        text_format=VisitorDecision
    )

    decision = response.output_parsed

    print("\n" + "=" * 60)
    print("USER:", message)
    print("-" * 60)
    print(
        json.dumps(
            decision.model_dump(),
            indent=4
        )
    )