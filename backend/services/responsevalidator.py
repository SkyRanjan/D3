class ResponseValidator:

    def validate(
        self,
        response: str,
        decision: dict
    ) -> str:

        # 1. Empty or invalid response
        if not response or not response.strip():
            return (
                "I'm sorry, I don't have enough information "
                "to answer that."
            )

        # 2. Basic confidentiality protection
        sensitive_terms = [
            "password",
            "passwords",
            "credential",
            "credentials",
            "private key",
            "api key",
            "secret key",
            "confidential salary",
            "employee salary",
        ]

        response_lower = response.lower()

        for term in sensitive_terms:
            if term in response_lower:
                return (
                    "I'm sorry, but I cannot provide "
                    "confidential or restricted information."
                )

        # 3. Basic escalation consistency
        if decision.get("action") == "REFUSE":
            return (
                "I'm sorry, but I cannot provide "
                "that information."
            )

        if decision.get("action") == "ESCALATE":
            return (
                "I'll connect you with a UST representative "
                "who can assist you with that request."
            )

        # Normal response
        return response.strip()