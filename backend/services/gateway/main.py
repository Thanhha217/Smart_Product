from fastapi import FastAPI, HTTPException, Depends

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello World"}