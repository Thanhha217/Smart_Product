from fastapi import FastAPI, HTTPException, Depends
from ranker import query_ranking_system

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello World"}

@app.get("/query")
def query(q: str, limit: int = 32):
    return query_ranking_system(q, limit)