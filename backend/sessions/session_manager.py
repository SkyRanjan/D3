import json
from pathlib import Path
from datetime import datetime


class SessionManager:

    def __init__(self):
        self.sessions_dir = (
            Path(__file__).resolve().parent.parent / "sessions"
        )

        self.sessions_dir.mkdir(exist_ok=True)

    def create_session(self, visitor_id: str) -> str:

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        session_id = f"{visitor_id}_{timestamp}"

        session_file = self.sessions_dir / f"{session_id}.json"

        session_data = {
            "visitor_id": visitor_id,
            "session_id": session_id,
            "started_at": datetime.now().isoformat(),
            "ended_at": None,
            "conversation": []
        }

        with open(session_file, "w", encoding="utf-8") as file:
            json.dump(
                session_data,
                file,
                indent=4,
                ensure_ascii=False
            )

        return session_id

    def add_message(
        self,
        session_id: str,
        role: str,
        message: str
    ):

        session_file = self.sessions_dir / f"{session_id}.json"

        if not session_file.exists():
            raise FileNotFoundError(
                f"Session {session_id} does not exist."
            )

        with open(session_file, "r", encoding="utf-8") as file:
            session_data = json.load(file)

        session_data["conversation"].append({
            "role": role,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })

        with open(session_file, "w", encoding="utf-8") as file:
            json.dump(
                session_data,
                file,
                indent=4,
                ensure_ascii=False
            )

    def get_conversation(self, session_id: str):

        session_file = self.sessions_dir / f"{session_id}.json"

        if not session_file.exists():
            raise FileNotFoundError(
                f"Session {session_id} does not exist."
            )

        with open(session_file, "r", encoding="utf-8") as file:
            session_data = json.load(file)

        return session_data["conversation"]

    def end_session(self, session_id: str):

        session_file = self.sessions_dir / f"{session_id}.json"

        if not session_file.exists():
            raise FileNotFoundError(
                f"Session {session_id} does not exist."
            )

        with open(session_file, "r", encoding="utf-8") as file:
            session_data = json.load(file)

        session_data["ended_at"] = datetime.now().isoformat()

        with open(session_file, "w", encoding="utf-8") as file:
            json.dump(
                session_data,
                file,
                indent=4,
                ensure_ascii=False
            )
    def get_session_visitor_id(self, session_id: str) -> str:
        session_file = self.sessions_dir / f"{session_id}.json"
        if not session_file.exists():
            raise FileNotFoundError(
                f"Session {session_id} does not exist."
            )
        with open(session_file, "r", encoding="utf-8") as file:
            session_data = json.load(file)

        return session_data["visitor_id"]

    def get_previous_sessions(
        self,
        visitor_id: str,
        current_session_id: str,
        limit: int = 3
    ):

        session_files = []

        for session_file in self.sessions_dir.glob(
            f"{visitor_id}_*.json"
        ):

            if session_file.stem == current_session_id:
                continue

            session_files.append(session_file)

        session_files.sort(
            key=lambda file: file.stat().st_mtime,
            reverse=True
        )

        previous_sessions = []
        for session_file in session_files[:limit]:

            with open(session_file, "r", encoding="utf-8") as file:
                session_data = json.load(file)

            previous_sessions.append(session_data)

        return previous_sessions
    
    def search_previous_sessions(
    self,
    visitor_id: str,
    current_session_id: str,
    query: str,
    limit: int = 3
):
        query_lower = query.lower()
        
        previous_session_phrases = [
            "last time",
            "last visit",
            "previous discussion",
            "previous conversation",
            "previous meeting",
            "what did we discuss before",
            "what did we discuss previously",
            "what did we discuss last time",
            "what did we talk about before",
            "what did we talk about last time",
            "our last conversation",
            "our previous conversation"
        ]
        
        is_previous_session_query = any(
            phrase in query_lower
            for phrase in previous_session_phrases
        )
        
        matched_sessions = []
        
        for session_file in self.sessions_dir.glob(
            f"{visitor_id}_*.json"
        ):
        
            if session_file.stem == current_session_id:
                continue
        
            with open(session_file, "r", encoding="utf-8") as file:
                session_data = json.load(file)
        
            conversation = session_data.get("conversation", [])
        
            if not conversation:
                continue
        
            # If the user explicitly asks about a previous session,
            # prioritize the most recent previous session.
            if is_previous_session_query:
        
                matched_sessions.append(
                    (
                        session_file.stat().st_mtime,
                        session_data
                    )
                )
        
            else:
        
                conversation_text = " ".join(
                    message["message"]
                    for message in conversation
                ).lower()
        
                query_words = set(query_lower.split())
        
                score = sum(
                    1
                    for word in query_words
                    if len(word) > 2 and word in conversation_text
                )
        
                if score > 0:
                    matched_sessions.append(
                        (score, session_data)
                    )
        
        matched_sessions.sort(
            key=lambda item: item[0],
            reverse=True
        )
        
        return [
            session_data
            for score, session_data in matched_sessions[:limit]
        ]