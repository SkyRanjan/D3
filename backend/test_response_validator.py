from services.responsevalidator import ResponseValidator


validator = ResponseValidator()


tests = [
    {
        "name": "Normal response",
        "response": "UST provides digital transformation and cloud services.",
        "decision": {
            "action": "ANSWER"
        }
    },
    {
        "name": "Empty response",
        "response": "",
        "decision": {
            "action": "ANSWER"
        }
    },
    {
        "name": "Sensitive response",
        "response": "The employee password is ABC123.",
        "decision": {
            "action": "ANSWER"
        }
    },
    {
        "name": "Refuse decision",
        "response": "Here is the confidential information.",
        "decision": {
            "action": "REFUSE"
        }
    },
    {
        "name": "Escalate decision",
        "response": "Sure, I will schedule the meeting.",
        "decision": {
            "action": "ESCALATE"
        }
    }
]


for test in tests:

    result = validator.validate(
        test["response"],
        test["decision"]
    )

    print("\n" + test["name"])
    print("Input:", test["response"])
    print("Output:", result)