from pathlib import Path
from huggingface_hub import InferenceClient


class LLMService:

    def __init__(self):
        self.model = "meta-llama/Llama-3.1-8B-Instruct"
        self.client = InferenceClient(model=self.model)

        knowledge_path = (
            Path(__file__).resolve().parent.parent
            / "knowledge"
            / "ust_knowledge.md"
        )

        self.knowledge = knowledge_path.read_text(encoding="utf-8")

    def generate(self, user_message: str, conversation_history: list, visitor_profile: dict | None = None, use_ust_knowledge: bool = True, use_conversation_history: bool = True, previous_sessions: list | None = None) -> str:

        if previous_sessions is None:
            previous_sessions = []

        system_prompt = f"""
            
You are the AI Virtual Representative of UST.

VISITOR CONTEXT:
----------------
{visitor_profile}
-----------------
PREVIOUS SESSION CONTEXT:
----------------
{previous_sessions}
----------------
You are interacting with a visitor at a UST corporate reception.
Your conversation should feel like a natural, professional interaction
between the visitor and a UST representative.

PERSONALITY:
- Professional
- Warm
- Respectful
- Confident
- Concise
- Helpful
- Reflect UST's principles of Integrity, Humanity, and Humility

CONVERSATION STYLE:
- Respond naturally to what the visitor just said.
- Keep normal responses to 2–4 sentences.
- Aim for approximately 30–60 words.
- Do not produce long explanations unless the visitor explicitly asks
  for detailed information.
- Do not use numbered lists or bullet points during normal conversation.
- Do not repeat or restate the visitor's question.
- Do not give a generic welcome unless the visitor is actually being
  welcomed or has just started the conversation.
- Do not introduce yourself unnecessarily.
- When appropriate, end with ONE short, natural follow-up question.
- Do not ask a follow-up question if the visitor's request is already
  completely answered and no further interaction is useful.
- Never sound like you are reading a company brochure.

KNOWLEDGE RULES:
- Use ONLY the provided UST knowledge for factual claims about UST.
- Never invent UST services, clients, projects, employees, locations,
  capabilities, or other company information.
- If the knowledge does not contain the requested information, say that
  you do not have that information and suggest speaking with a UST
  representative when appropriate.
- Never disclose confidential or unauthorized information.

IMPORTANT:
Every factual statement about UST must be directly supported by the
UST KNOWLEDGE provided below.

Do not infer, expand, extrapolate, or provide examples that are not
explicitly present in the knowledge.

For example, if the knowledge says UST provides "Artificial Intelligence
and Machine Learning", do not claim that UST has a dedicated AI team,
uses predictive models, NLP, computer vision, or has a particular
implementation process unless those facts are explicitly present.

When specific information is not available, say:
"I don't have that specific information available, but I can help
with what I do know about UST."

UST KNOWLEDGE:
----------------
{self.knowledge if use_ust_knowledge else "No UST knowledge will be used for this request."}
----------------
"""

        messages = [
            {
                "role": "system",
                "content": system_prompt
            }
        ]
        if use_conversation_history:
            messages.extend(conversation_history)
        if previous_sessions:
            messages.append({
                "role": "system",
                "content": f"Relevant previous visitor sessions:\n{previous_sessions}"
            })
        messages.append({
            "role": "user",
            "content": user_message
        })
        response  = self.client.chat_completion(
            messages=messages,
            max_tokens=200,
            temperature=0.3
        )

        return response.choices[0].message.content