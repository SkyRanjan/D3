from services.decisionservice import DecisionService


decision_service = DecisionService()


test_messages = [
    "What services does UST provide?",
    "What can you tell me about my meeting today?",
    "What did we discuss earlier?",
    "What did we discuss during my last visit?",
    "Can you tell me more?",
    "Tell me something about UST."
]


for message in test_messages:

    print("\n" + "=" * 60)
    print("USER:", message)
    print("-" * 60)

    decision = decision_service.decide(message)

    print(decision)