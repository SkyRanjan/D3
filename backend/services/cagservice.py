class CAGService:

    def build_context(
        self,
        decision: dict,
        visitor_profile: dict,
        conversation_history: list,
        previous_sessions: list
    ) -> dict:

        context_required = decision.get(
            "context_required",
            []
        )

        return {
            "visitor_profile": (
                visitor_profile
                if "VISITOR_PROFILE" in context_required
                else None
            ),

            "use_ust_knowledge": (
                "UST_KNOWLEDGE" in context_required
            ),

            "use_conversation_history": (
                "CURRENT_SESSION" in context_required
            ),

            "use_previous_sessions": (
                "PREVIOUS_SESSION" in context_required
            ),

            "conversation_history": (
                conversation_history
                if "CURRENT_SESSION" in context_required
                else []
            ),

            "previous_sessions": (
                previous_sessions
                if "PREVIOUS_SESSION" in context_required
                else []
            ),
        }