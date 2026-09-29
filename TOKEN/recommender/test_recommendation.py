from recommendation_system.recommendation_service import RecommendationService

service = RecommendationService()

prompt = """
Can you please help me write a Python program that reads CSV file
containing employee information and calculates the average salary.
Please also explain the code clearly and provide an example showing 
how th program can be executed.
"""

result = service.recommend(prompt)

print(result)
