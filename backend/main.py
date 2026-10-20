import json
import sys
import time
import uuid
from typing import Literal
from pathlib import Path
GROUNDED_THRESHOLD = 0.42
HYBRID_THRESHOLD = 0.32
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from llm_client import ask_llm
sys.path.insert(0, str(Path(__file__).parent.parent))

from retrieval.retrieve import retrieve

app = FastAPI(title =" rag-core backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],

    
)
EMBEDDINGS_PATH =Path(__file__).parent.parent /"embeddings.json"

with open(EMBEDDINGS_PATH, "r", encoding="utf-8") as f:
    EMBEDDINGS =json.load(f)
    # sessions
SESSIONS: dict[str, list[dict]] ={}

MAX_HISTORY_TURNS =3


class QueryRequest(BaseModel):
    question: str
    session_id: str | None = None

class Chunk(BaseModel):
    chunk_id: str
    text: str
    source_doc: str
    similarity_score: float

class Citation(BaseModel):
    chunk_id:str
    claim:str
class QueryResponse(BaseModel):
    answer: str
    retrieved_chunks: list[Chunk]
    answer_mode : Literal['grounded','hybrid','general']
    session_id: str
    citations :list[Citation]=[]


def build_prompt(question: str, chunks: list, history: list[dict], mode: str) -> str:
    context = "\n\n".join(
        f"[{c['chunk_id']}] (Source: {c['source_doc']})\n{c['text']}" for c in chunks
    )

    history_text = ""
    if history:
        recent = history[-MAX_HISTORY_TURNS:]
        history_text = "\n\n".join(
            f"Previous Q: {turn['question']}\nPrevious A: {turn['answer']}"
            for turn in recent
        )
        history_text = f"Conversation so far:\n{history_text}\n\n"

    instructions = get_mode_instructions(mode)

    if mode == "general":
        context_block = ""
        format_block = '{"answer": "..."}'
    else:
        context_block = (
            "Document pieces (use only the IDs shown here):\n"
            f"{context}\n\n"
        )
        format_block = (
            '{"answer": "...", "citations": '
            '[{"chunk_id": "<an ID from above>", "claim": "<the claim it supports>"}]}'
        )

    return f"""{instructions}

Use the conversation history only to understand what the current question is
referring to (for example "it", "that", "what about X").

{history_text}{context_block}Question: {question}

Reply with JSON only, in exactly this shape:
{format_block}"""

@app.get("/")
def health_check():
    return{"status": "ok", "message": "rage-core backend is running"}

@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="question cannot be empty")

    session_id = request.session_id or str(uuid.uuid4())

    history = SESSIONS.get(session_id, [])
    start = time.time()

    try:
        top_chunks = retrieve(question, EMBEDDINGS, top_k=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"retrieval failed: {e}")

    # The mode comes from OUR code (scores), never from the LLM.
    mode = decide_mode(top_chunks)
    prompt = build_prompt(question, top_chunks, history, mode)

    try:
        raw = ask_llm(prompt, max_tokens=1000, json_mode=True)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        parsed = json.loads(raw)
        answer = parsed["answer"]
        if not isinstance(answer, str) or not answer.strip():
            raise ValueError("empty answer")
    except (json.JSONDecodeError, TypeError, KeyError, ValueError) as e:
        print(f"[query] bad LLM output ({e}): {raw!r}")
        raise HTTPException(
            status_code=502,
            detail="The AI replied in an unexpected format. Please try again.",
        )

    # No citations in general mode. Otherwise drop any citation whose ID wasn't retrieved.
    citations = []
    if mode != "general":
        raw_citations = parsed.get("citations", [])
        if isinstance(raw_citations, list):
            citations = filter_citations(
                [
                    c for c in raw_citations
                    if isinstance(c, dict)
                    and isinstance(c.get("chunk_id"), str)
                    and isinstance(c.get("claim"), str)
                ],
                top_chunks,
            )

    SESSIONS.setdefault(session_id, []).append(
        {"question": question, "answer": answer}
    )
    elapsed = round(time.time() - start, 2)
    print(f"[query] '{question[:50]}...' -> {elapsed}s, mode={mode}, {len(top_chunks)} chunks, {len(citations)} citations")

    return QueryResponse(
        answer=answer,
        retrieved_chunks=top_chunks,
        session_id=session_id,
        answer_mode=mode,
        citations=citations,
    )
def decide_mode(chunks: list[dict]) -> str:
    if not chunks:
        return "general"
    best_score = max(c["similarity_score"] for c in chunks)
    if best_score >= GROUNDED_THRESHOLD:
        return "grounded"
    elif best_score >= HYBRID_THRESHOLD:
        return "hybrid"
    return "general"

def filter_citations(citations: list[dict], chunks: list[dict]) -> list[dict]:
    valid_ids = {c["chunk_id"] for c in chunks}
    return [c for c in citations if c.get("chunk_id") in valid_ids]

def get_mode_instructions(mode: str) -> str:
    if mode == "grounded":
        return (
            "Here are some document pieces, each with an ID. "
            "Answer the question using only these pieces. "
            "Put the piece ID next to every claim. "
            "If the pieces don't fully answer the question, say that clearly instead of guessing."
        )
    elif mode == "hybrid":
        return (
            "Here are some document pieces, each with an ID. "
            "They may only partly answer the question. "
            "Use them where they help, and put the piece ID next to every claim that comes from them. "
            "If you add anything that is not in the pieces, clearly mark it, "
            "for example: 'Beyond your documents, ...'. "
            "Never put a piece ID next to your own knowledge."
        )
    else:
        return (
            "The user's documents don't contain anything relevant to this question. "
            "Answer from your general knowledge. "
            "Start by saying clearly that this is not from their documents. "
            "Do not cite any piece IDs."
        )