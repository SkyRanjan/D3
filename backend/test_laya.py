import laya


print("Loading Laya...")

agent = laya.load(
    "convaiinnovations/laya-typed-decisions"
)

print("Laya loaded successfully.\n")


questions = {
    "context": {
        "type": "choice",
        "instructions": """
Which context is required to answer the visitor's request?
""",
        "criteria": {
            "UST_KNOWLEDGE":
                "General information about UST, including services, "
                "capabilities, industries, or technologies.",

            "VISITOR_PROFILE":
                "Information specifically about the visitor, "
                "their organization, role, meeting, purpose, or interests.",

            "CURRENT_SESSION":
                "Information discussed during the current conversation.",

            "PREVIOUS_SESSION":
                "Information discussed during a previous visit, "
                "previous meeting, or previous conversation.",

            "NONE":
                "No additional context is required."
        }
    },

    "action": {
        "type": "choice",
        "instructions": """
What should the AI representative do with the visitor's request?
""",
        "criteria": {
            "ANSWER":
                "The request can be answered using available context.",

            "CLARIFY":
                "The visitor's intent is ambiguous or insufficient.",

            "REFUSE":
                "The visitor requests confidential, private, "
                "restricted, or unauthorized information.",

            "ESCALATE":
                "The request requires a human UST representative."
        }
    }
}


test_messages = [
    "What services does UST provide?",
    "What can you tell me about my meeting today?",
    "What did we discuss earlier?",
    "What did we discuss during my last visit?",
    "Can you tell me more?",
    "Tell me something about UST."
]


for message in test_messages:

    print("\n" + "=" * 70)
    print("USER:", message)
    print("-" * 70)

    result = agent.predict(
        message,
        questions
    )

    context = result["answers"]["context"]
    action = result["answers"]["action"]

    print("CONTEXT:", context["choice"])
    print("CONTEXT CONFIDENCE:", context["confidence"])

    print("ACTION:", action["choice"])
    print("ACTION CONFIDENCE:", action["confidence"])

    print("\nCONTEXT PROBABILITIES:")
    for key, value in context["probabilities"].items():
        print(f"  {key}: {value}")

    print("\nACTION PROBABILITIES:")
    for key, value in action["probabilities"].items():
        print(f"  {key}: {value}")