from services.llmservice import LLMService

llm = LLMService()

conversation_history = [
    {
        "role": "user",
        "content": "Hello"
    }
]

response = llm.generate(
    "Reply with exactly one word: HELLO",
    conversation_history
)

print("MODEL RESPONSE:", response)