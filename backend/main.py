from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from ingestion import ingest_documents
from rfp_processor import extract_questions
from retriever import answer_questions_with_rag
from generator import generate_output_doc
from config import settings


app = FastAPI(title="RFP AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.post("/ingest")
async def ingest(files: list[UploadFile]):
    result = await ingest_documents(files)
    return JSONResponse(content={"status": "success", "indexed": result})

@app.post("/process-rfp")
async def process_rfp(file: UploadFile):
    questions = await extract_questions(file)
    return {"questions": questions}

@app.post("/answer-rfp")
async def answer_rfp(file: UploadFile):
    questions = await extract_questions(file)
    answers, clarifications_needed = await answer_questions_with_rag(questions)

    if clarifications_needed:
        return {"status": "incomplete", "clarifications_needed": clarifications_needed}

    output_file_path = await generate_output_doc(questions, answers)
    return {"status": "complete", "file_path": output_file_path}

from fastapi.responses import FileResponse

@app.get("/download")
def download_file(file: str):
    return FileResponse(path=file, filename=file.split("/")[-1], media_type='application/octet-stream')
