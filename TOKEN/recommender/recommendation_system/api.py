from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
 
from recommendation_system.recommendation_service import RecommendationService
 
 
app = FastAPI(title="Prompt Recommendation API")
 
 
# Allow the React/Vite frontend to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
 
# Request format
class RecommendationRequest(BaseModel):
    prompt: str
 
 
# Create the recommendation service once
service = RecommendationService()
 
 
@app.get("/health")
def health():
    return {"status": "ok"}
 
 
@app.post("/recommend")
def recommend(request: RecommendationRequest):
    recommended_prompt = service.recommend(request.prompt)
 
    return {
        "recommended_prompt": recommended_prompt
    }
 