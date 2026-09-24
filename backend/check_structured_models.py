import requests

url = "https://router.huggingface.co/v1/models"

response = requests.get(url)

response.raise_for_status()

data = response.json()

print("\nSTRUCTURED OUTPUT MODELS AVAILABLE:\n")

for model in data.get("data", []):

    for provider in model.get("providers", []):

        if provider.get("supports_structured_output") is True:
            print(
                f"MODEL: {model.get('id')}"
            )
            print(
                f"PROVIDER: {provider.get('provider')}"
            )
            print(
                f"CONTEXT: {provider.get('context_length')}"
            )
            print(
                f"LATENCY: {provider.get('first_token_latency_ms')} ms"
            )
            print("-" * 60)