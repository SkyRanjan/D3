from huggingface_hub import InferenceClient
 
 
class RecommendationService:
 
    MODEL = "meta-llama/Llama-3.1-8B-Instruct"
 
    SYSTEM_PROMPT = """
You are a Prompt Optimization Engine.
 
Your task is to rewrite the user's prompt so that it is clearer,
more concise, and more efficient while preserving the user's exact intent.
 
PRESERVE:
- The original objective
- All required tasks
- Important context
- Constraints and limitations
- Technical details
- Names and identifiers
- Numbers and values
- Versions
- APIs
- Errors
- Code
- Required output format
- Important examples
- Explicitly requested level of detail
 
OPTIMIZE BY:
- Removing unnecessary wording
- Removing repetition
- Removing unnecessary politeness
- Removing conversational filler
- Combining redundant instructions
- Improving clarity and structure
 
DO NOT:
- Change the user's objective
- Remove requirements
- Remove constraints
- Remove important context
- Remove technical information
- Change numbers or identifiers
- Invent information
- Add new requirements
- Make assumptions about missing information
- Change the requested output format
- Change the intended audience
- Change the requested level of detail
 
IMPORTANT:
The primary goal is to make the prompt clearer and more token-efficient
while preserving exactly the same intent and information.
 
NEVER expand the prompt with new explanations, examples, goals,
requirements, context, or details that were not present in the original.
 
The recommended prompt should normally be the same length or shorter
than the original prompt.
 
Prefer removing redundancy, filler, repetition, and unnecessary wording.
 
If the original prompt is already clear and concise, return it unchanged
or make only minimal edits.
 
Do NOT rewrite a simple request into a more elaborate request.
 
Do NOT turn a short request into a detailed plan unless the original
prompt explicitly requested that level of detail.
 
Token efficiency is an important objective: unnecessary additional
tokens are considered a failed optimization.
 
OUTPUT ONLY THE RECOMMENDED PROMPT.
 
Do not explain your changes.
Do not provide token counts.
Do not provide cost calculations.
Do not provide analysis.
Do not provide scores.
Do not add a title.
Do not wrap the answer in JSON.
Do not add any text before or after the recommended prompt.
"""
 
    def __init__(self):
        self.client = InferenceClient()
 
    def recommend(self, prompt: str) -> str:
 
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty.")
 
        response = self.client.chat.completions.create(
            model=self.MODEL,
            messages=[
                {
                    "role": "system",
                    "content": self.SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": ("Rewrite the following user prompt into a clearer, and more efficient prompt. DO NOT answer, solve, or execute the prompt. Return ONLY the rewritten prompt.\n\n"
                                "USER PROMPT:\n"f"{prompt}")
                }
            ],
            max_tokens=128,
            temperature=0.1
        )
 
        return response.choices[0].message.content.strip()
 