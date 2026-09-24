class JEVService:

    def decide(
        self,
        user_message: str,
        visitor_profile: dict | None = None,
        conversation_history: list | None = None
    ) -> dict:

        message = user_message.lower().strip()

        if not message:
            return {
                "action": "CLARIFY",
                "reason": "Empty user message"
            }

        # --------------------------------
        # 1. Greeting / simple interaction
        # --------------------------------

        greetings = [
            "hello",
            "hi",
            "hey",
            "good morning",
            "good afternoon",
            "good evening"
        ]

        if message in greetings:
            return {
                "action": "ANSWER",
                "reason": "Simple greeting"
            }

        # --------------------------------
        # 2. Previous-session questions
        # --------------------------------

        previous_session_phrases = [
            "last time",
            "last visit",
            "previous visit",
            "previous meeting",
            "previous discussion",
            "previous conversation",
            "what did we discuss before",
            "what did we discuss previously",
            "what did we discuss last time",
            "what did we talk about before",
            "what did we talk about last time",
            "our last conversation",
            "our previous conversation"
        ]

        if any(
            phrase in message
            for phrase in previous_session_phrases
        ):
            return {
                "action": "ANSWER",
                "reason": "Previous-session context requested"
            }

        # --------------------------------
        # 3. Current conversation questions
        # --------------------------------

        conversation_phrases = [
            "just discussed",
            "just talked",
            "earlier",
            "what did we discuss",
            "what were we discussing",
            "what was i asking",
            "what did i ask"
        ]

        if any(
            phrase in message
            for phrase in conversation_phrases
        ):
            return {
                "action": "ANSWER",
                "reason": "Current conversation context requested"
            }

        # --------------------------------
        # 4. Visitor-specific questions
        # --------------------------------

        visitor_phrases = [
            "my interests",
            "my organization",
            "my company",
            "my role",
            "my meeting",
            "my visit",
            "why am i here",
            "what am i here for"
        ]

        if any(
            phrase in message
            for phrase in visitor_phrases
        ):
            return {
                "action": "ANSWER",
                "reason": "Visitor context requested"
            }

        # --------------------------------
        # 5. UST/company questions
        # --------------------------------

        ust_keywords = [
            "ust",
            "service",
            "services",
            "company",
            "capability",
            "capabilities",
            "industry",
            "industries",
            "technology",
            "technologies",
            "artificial intelligence",
            "machine learning",
            "cloud",
            "cybersecurity",
            "automation",
            "digital transformation"
        ]

        if any(
            keyword in message
            for keyword in ust_keywords
        ):
            return {
                "action": "ANSWER",
                "reason": "UST information requested"
            }

        # --------------------------------
        # 6. Ambiguous / unclear request
        # --------------------------------

        if len(message.split()) <= 2:
            return {
                "action": "CLARIFY",
                "reason": "Insufficient context"
            }

        # --------------------------------
        # 7. Default
        # --------------------------------

        return {
            "action": "ANSWER",
            "reason": "General conversational request"
        }