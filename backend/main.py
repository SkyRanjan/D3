from fastapi import FastAPI
from pydantic import BaseModel
from services.llmservice import LLMService
from sessions.session_manager import SessionManager
from services.visitor_manager import VisitorManager
from services.cagservice import CAGService
from services.decisionservice import DecisionService
from services.responsevalidator import ResponseValidator

app = FastAPI()

llm = LLMService()
session_manager = SessionManager()
response_validator = ResponseValidator()
decision_service = DecisionService()
cag_service = CAGService()
visitor_manager = VisitorManager()

current_session_id = None


class SessionRequest(BaseModel):
    visitor_id: str

class VisitorProfile(BaseModel):
    visitor_id: str
    name: str
    organization: str
    role: str
    meeting_with: str
    purpose: str
    areas_of_interest: list[str]
    previous_context: str

class ChatRequest(BaseModel):
    message: str


@app.get("/")
def health():
    return {
        "status": "ok",
        "message": "UST AI Virtual Representative backend is running"
    }


@app.post("/session/start")
def start_session(request: SessionRequest):

    global current_session_id

    current_session_id = session_manager.create_session(
        request.visitor_id
    )

    return {
        "session_id": current_session_id,
        "visitor_id": request.visitor_id,
        "status": "started"
    }


@app.post("/chat")
def chat(request: ChatRequest):

    if current_session_id is None:
        return {
            "error": "No active session. Start a session first."
        }

    visitor_id = session_manager.get_session_visitor_id(current_session_id)

    visitor = visitor_manager.get_visitor(visitor_id)
    
    decision = decision_service.decide(request.message)
    
    print("DECISION IN MAIN:", decision)
    
    if decision["action"] == "CLARIFY":
        return {
            "response": "Could you please clarify what you'd like to know?",
            "session_id": current_session_id,
            "decision": decision
        }
    
    if decision["action"] == "REFUSE":
        return {
            "response": "I'm sorry, but I cannot provide that information.",
            "session_id": current_session_id,
            "decision": decision
        }
    
    if decision["action"] == "ESCALATE":
        return {
            "response": "I'll connect you with a UST representative who can assist you with that request.",
            "session_id": current_session_id,
            "decision": decision
        }
    
    previous_sessions = session_manager.search_previous_sessions(
        visitor_id,
        current_session_id,
        request.message
    )

    session_manager.add_message(
        current_session_id,
        "user",
        request.message
    )

    conversation = session_manager.get_conversation(
        current_session_id
    )

    conversation_history = []

    for message in conversation:
        conversation_history.append({
            "role": (
                "assistant"
                if message["role"] == "assistant"
                else "user"
            ),
            "content": message["message"]
        })
    
    context = cag_service.build_context(
        decision, visitor, conversation_history, previous_sessions
    )

    response = llm.generate(
        request.message,
        context["conversation_history"],
        context["visitor_profile"],
        context["use_ust_knowledge"],
        context["use_conversation_history"],
        context["previous_sessions"]
    )
    
    response = response_validator.validate(
        response,
        decision
    )

    session_manager.add_message(
        current_session_id,
        "assistant",
        response
    )

    return {
        "response": response,
        "session_id": current_session_id
    }


@app.post("/session/end")
def end_session():

    global current_session_id

    if current_session_id is None:
        return {
            "error": "No active session."
        }

    session_manager.end_session(current_session_id)

    ended_session = current_session_id
    current_session_id = None

    return {
        "session_id": ended_session,
        "status": "ended"
    }

@app.post("/visitor/create")
def create_visitor(profile: VisitorProfile):

    visitor_id = visitor_manager.create_visitor(
        profile.model_dump()
    )

    return {
        "visitor_id": visitor_id,
        "status": "created"
    }