# from config import settings
# from utils import embed_texts
# from weaviate import Client
# from openai import OpenAI

# client = Client(settings.WEAVIATE_URL)
# openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


# def answer_questions_with_rag(questions):
#     clarifications = []
#     answers = {}

#     for idx, question in enumerate(questions):
#         response = openai_client.embeddings.create(
#             model=settings.EMBEDDING_MODEL, input=question
#         )
#         q_vector = response.data[0].embedding

#         result = (
#             client.query.get("DocumentChunk", ["text", "source"])
#             .with_near_vector({"vector": q_vector})
#             .with_limit(3)
#             .do()
#         )

#         context_chunks = [
#             item["text"] for item in result["data"]["Get"]["DocumentChunk"]
#         ]
#         if not context_chunks:
#             clarifications.append({"question": question, "index": idx})
#             continue

#         context_str = "\n\n".join(context_chunks)
#         completion = openai_client.chat.completions.create(
#             model="gpt-4o",
#             messages=[
#                 {
#                     "role": "system",
#                     "content": "Answer RFP questions using the provided context.",
#                 },
#                 {
#                     "role": "user",
#                     "content": f"Question: {question}\n\nContext:\n{context_str}",
#                 },
#             ],
#             temperature=0.2,
#         )
#         answers[question] = completion.choices[0].message.content

#     return answers, clarifications

# retriever.py — Drop-in replacement (keeps the same API)
# Enhancements:
# - Hybrid retrieval: vector (nearVector) + BM25 (fallback-safe)
# - Multi-query expansion (3 reformulations per question)
# - LLM reranking of top candidates (keep best 3–5)
# - Structured prompts by detected intent (security/pricing/SLA/etc.)
# - Citations appended to the answer text (non-breaking)
# - Self-check: verifies grounding; if weak, routes to clarifications
# - Smarter gating: coverage + confidence thresholds
#
# Requirements: weaviate-client>=3.26, openai, config.settings as in your repo

from typing import List, Tuple, Dict, Optional
import os
import re
import json
from dataclasses import dataclass

from config import settings
from faiss_store import get_vector_store
from openai import OpenAI

# Use FAISS instead of Weaviate
vector_store = get_vector_store()
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

def answer_questions_with_rag(questions: List[str]) -> Tuple[Dict[str, str], List[Dict]]:
    """
    Answer questions using FAISS-based RAG system.
    Returns:
      answers: Dict[question] = answer_text
      clarifications: List[{"question": q, "index": idx}] for questions needing more context
    """
    print(f"🤖 Processing {len(questions)} questions with FAISS RAG...")
    
    clarifications: List[Dict] = []
    answers: Dict[str, str] = {}

    for idx, question in enumerate(questions):
        print(f"🔍 Processing question {idx + 1}: {question[:100]}...")
        
        try:
            # Search for relevant documents with more results
            search_results = vector_store.similarity_search(question, k=5)
            
            if not search_results:
                print(f"⚠️ No relevant context found for question {idx + 1}")
                clarifications.append({"question": question, "index": idx})
                continue
            
            # Prepare context from search results
            context_chunks = []
            for result in search_results:
                context_chunks.append(result['page_content'])
            
            context_str = "\n\n".join(context_chunks)
            
            # Much more lenient context check
            if len(context_str.strip()) < 50:  # Reduced from 100 to 50
                print(f"⚠️ Insufficient context for question {idx + 1}")
                clarifications.append({"question": question, "index": idx})
                continue
            
            # Generate answer using OpenAI
            print(f"🎯 Generating answer for question {idx + 1}...")
            completion = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert assistant that answers RFP questions based on provided context. Be specific, professional, and comprehensive. If the context doesn't contain enough information to answer confidently, say so."
                    },
                    {
                        "role": "user",
                        "content": f"Question: {question}\n\nContext:\n{context_str}\n\nPlease provide a detailed answer based on the context above."
                    }
                ],
                temperature=0.2,
                max_tokens=1000
            )
            
            answer = completion.choices[0].message.content.strip()
            
            # Basic quality check
            if len(answer) < 50 or "insufficient" in answer.lower() or "cannot answer" in answer.lower():
                print(f"⚠️ Generated answer seems insufficient for question {idx + 1}")
                clarifications.append({"question": question, "index": idx})
                continue
            
            answers[question] = answer
            print(f"✅ Successfully answered question {idx + 1}")
            
        except Exception as e:
            print(f"❌ Error processing question {idx + 1}: {e}")
            clarifications.append({"question": question, "index": idx})
            continue

    print(f"📊 RAG Results: {len(answers)} answered, {len(clarifications)} need clarification")
    return answers, clarifications

ANSWER_MODEL = os.getenv("ANSWER_MODEL", "gpt-4o")
VALIDATOR_MODEL = os.getenv("VALIDATOR_MODEL", "gpt-4o-mini")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "gpt-4o-mini")
EMBED_MODEL = settings.EMBEDDING_MODEL

TOP_K_VECTOR = int(os.getenv("TOP_K_VECTOR", "20"))
TOP_K_BM25 = int(os.getenv("TOP_K_BM25", "20"))
ALPHA = float(os.getenv("HYBRID_ALPHA", "0.55"))  # weight for vector score vs bm25
RERANK_KEEP = int(os.getenv("RERANK_KEEP", "5"))   # how many contexts to keep for answering
MULTI_QUERY = int(os.getenv("MULTI_QUERY", "3"))   # how many reformulations

MAX_SNIPPET_CHARS = int(os.getenv("MAX_SNIPPET_CHARS", "900"))  # truncate passage sent to LLM
SELF_CHECK_MIN_CONF = float(os.getenv("SELF_CHECK_MIN_CONF", "0.75"))
COVERAGE_MIN = float(os.getenv("COVERAGE_MIN", "0.70"))  # coverage threshold
BM25_AVAILABLE = True  # toggled off if server errors once


@dataclass
class Retrieved:
    id: str
    text: str
    source: str
    score_vec: Optional[float]  # normalized 0..1 (None if unavailable)
    score_bm25: Optional[float] # normalized 0..1 (None if unavailable)

    def hybrid_score(self) -> float:
        v = self.score_vec if self.score_vec is not None else None
        b = self.score_bm25 if self.score_bm25 is not None else None
        if v is None and b is None:
            return 0.0
        if v is None:
            return b
        if b is None:
            return v
        return ALPHA * v + (1 - ALPHA) * b


# ---------------------------
# Helpers
# ---------------------------

def _embed(text: str) -> List[float]:
    resp = openai_client.embeddings.create(model=EMBED_MODEL, input=text)
    return resp.data[0].embedding

def _multi_query(question: str) -> List[str]:
    """Generate reformulations; fallback to light heuristics if LLM fails."""
    try:
        prompt = (
            "Rephrase the question into {} alternative search queries that may retrieve different but relevant context. "
            "Keep them short, no punctuation beyond what’s necessary. Return a JSON array of strings."
        ).format(MULTI_QUERY)
        resp = openai_client.chat.completions.create(
            model=VALIDATOR_MODEL,
            temperature=0.2,
            messages=[{"role": "system", "content": "You generate alternative search queries."},
                      {"role": "user", "content": f"{prompt}\n\nOriginal: {question}"}],
        )
        txt = resp.choices[0].message.content.strip()
        arr = json.loads(re.search(r"\[.*\]", txt, flags=re.DOTALL).group(0) if "[" in txt else txt)
        variants = [str(s).strip() for s in arr if str(s).strip()]
        # Ensure uniqueness & include original
        uniq = []
        for q in [question] + variants:
            if q not in uniq:
                uniq.append(q)
        return uniq[: MULTI_QUERY + 1]
    except Exception:
        # simple fallbacks
        seeds = [question]
        if len(question.split()) > 6:
            seeds.append(" ".join(question.split()[:6]))
        seeds.append(re.sub(r"[^\w\s]", "", question))
        uniq = []
        for q in seeds:
            if q and q not in uniq:
                uniq.append(q)
        return uniq[: MULTI_QUERY + 1]

def _norm_vector_score(additional: dict) -> Optional[float]:
    # prefer certainty if present (0..1). else distance -> convert to 1/(1+distance) or 1 - distance if fits [0,1]
    if not additional:
        return None
    if "certainty" in additional and isinstance(additional["certainty"], (int, float)):
        c = float(additional["certainty"])
        return max(0.0, min(1.0, c))
    if "distance" in additional and isinstance(additional["distance"], (int, float)):
        d = float(additional["distance"])
        if 0 <= d <= 1:
            return max(0.0, min(1.0, 1.0 - d))
        return 1.0 / (1.0 + max(1e-6, d))
    return None

def _norm_bm25_scores(items: List[dict]) -> Dict[int, float]:
    # Normalize BM25 scores in this batch to 0..1
    scores = []
    for it in items:
        add = it.get("_additional", {})
        s = add.get("score")
        if s is not None:
            try:
                scores.append(float(s))
            except Exception:
                pass
    if not scores:
        return {}
    mn, mx = min(scores), max(scores)
    rng = (mx - mn) or 1.0
    out = {}
    for idx, it in enumerate(items):
        s = it.get("_additional", {}).get("score")
        if s is not None:
            try:
                val = (float(s) - mn) / rng
                out[idx] = max(0.0, min(1.0, val))
            except Exception:
                continue
    return out

def _weaviate_vector_search(q_vec: List[float], limit: int) -> List[dict]:
    try:
        res = (
            client.query.get("DocumentChunk", ["text", "source"])
            .with_near_vector({"vector": q_vec})
            .with_additional(["id", "distance", "certainty"])
            .with_limit(limit)
            .do()
        )
        return res["data"]["Get"]["DocumentChunk"] if res and res.get("data") else []
    except Exception:
        return []

def _weaviate_bm25_search(query: str, limit: int) -> List[dict]:
    global BM25_AVAILABLE
    if not BM25_AVAILABLE:
        return []
    try:
        res = (
            client.query.get("DocumentChunk", ["text", "source"])
            .with_bm25(query=query)
            .with_additional(["id", "score"])
            .with_limit(limit)
            .do()
        )
        return res["data"]["Get"]["DocumentChunk"] if res and res.get("data") else []
    except Exception:
        # turn off BM25 attempts for this process if server lacks the module
        BM25_AVAILABLE = False
        return []

def _hybrid_retrieve(question: str) -> List[Retrieved]:
    variants = _multi_query(question)
    # vector for original only (cheap), optionally for others if you want
    q_vec = _embed(question)
    items: Dict[str, Retrieved] = {}

    # Vector search
    vec_hits = _weaviate_vector_search(q_vec, TOP_K_VECTOR)
    for it in vec_hits:
        add = it.get("_additional", {}) or {}
        _id = add.get("id") or f"vec:{hash(it.get('text',''))}"
        r = items.get(_id)
        text = (it.get("text") or "").strip()
        src = (it.get("source") or "unknown").strip()
        vscore = _norm_vector_score(add)
        if r:
            r.score_vec = max(r.score_vec or 0.0, vscore or 0.0)
        else:
            items[_id] = Retrieved(id=_id, text=text, source=src, score_vec=vscore, score_bm25=None)

    # BM25 for each variant (if available)
    for v in variants:
        bm_hits = _weaviate_bm25_search(v, TOP_K_BM25)
        norm_map = _norm_bm25_scores(bm_hits)
        for idx, it in enumerate(bm_hits):
            add = it.get("_additional", {}) or {}
            _id = add.get("id") or f"bm:{hash(it.get('text',''))}"
            text = (it.get("text") or "").strip()
            src = (it.get("source") or "unknown").strip()
            bscore = norm_map.get(idx, None)
            r = items.get(_id)
            if r:
                # keep the best bm25 score across variants
                r.score_bm25 = max(r.score_bm25 or 0.0, bscore or 0.0) if bscore is not None else r.score_bm25
                # also merge text/source if empty
                if not r.text and text:
                    r.text = text
                if r.source == "unknown" and src:
                    r.source = src
            else:
                items[_id] = Retrieved(id=_id, text=text, source=src, score_vec=None, score_bm25=bscore)

    # Rank by hybrid score
    ranked = sorted(items.values(), key=lambda r: r.hybrid_score(), reverse=True)
    # Filter empties
    ranked = [r for r in ranked if r.text]
    return ranked

def _truncate(t: str, n: int) -> str:
    return t if len(t) <= n else t[: n - 3] + "..."

def _rerank(question: str, passages: List[Retrieved], keep: int) -> List[Retrieved]:
    """Use an LLM to score relevance; keep the best 'keep' contexts."""
    if not passages:
        return []
    # Prepare compact JSON for scoring
    batch = passages[:20]  # cap rerank candidates
    payload = {
        "question": question,
        "passages": [{"id": i, "text": _truncate(p.text, MAX_SNIPPET_CHARS)} for i, p in enumerate(batch)]
    }
    system = (
        "Score each passage for how well it can answer the question. "
        "Return JSON: [{\"id\": <int>, \"score\": 0..100}]. No commentary."
    )
    try:
        resp = openai_client.chat.completions.create(
            model=RERANKER_MODEL,
            temperature=0.0,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]
        )
        txt = resp.choices[0].message.content.strip()
        arr = json.loads(re.search(r"\[.*\]", txt, flags=re.DOTALL).group(0) if "[" in txt else txt)
        score_map = {}
        for item in arr:
            try:
                idx = int(item["id"])
                sc = float(item["score"])
                score_map[idx] = sc
            except Exception:
                continue
        scored = [(score_map.get(i, 0.0), p) for i, p in enumerate(batch)]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored[:keep]]
    except Exception:
        # fallback: keep top by hybrid score
        return passages[:keep]

def _classify_intent(question: str) -> str:
    """Rough intent classification to pick a template."""
    q = question.lower()
    if any(k in q for k in ["price", "cost", "rate", "fee", "commercial", "quote"]):
        return "pricing"
    if any(k in q for k in ["sla", "uptime", "availability", "response time", "mttr"]):
        return "sla"
    if any(k in q for k in ["security", "iso", "soc", "gdpr", "hipaa", "encryption", "compliance"]):
        return "security"
    if any(k in q for k in ["implementation", "deploy", "timeline", "project plan", "milestone"]):
        return "implementation"
    if any(k in q for k in ["support", "helpdesk", "ticket", "response", "escalation"]):
        return "support"
    return "general"

def _build_template(intent: str) -> str:
    """Small, structured answer frames. Kept concise to avoid changing UX."""
    if intent == "pricing":
        return ("Answer the question using only the provided context.\n"
                "If exact numbers/tiers are absent, say 'Insufficient context'.\n"
                "Structure:\n- Pricing model\n- Key inclusions/exclusions\n- Assumptions\n- If missing, say so")
    if intent == "security":
        return ("Answer using only the provided context. Structure:\n"
                "- Certifications & audits\n- Data protection (encryption, keys)\n- Access controls\n- Incident response\n- Compliance scope\n"
                "If details are missing, state 'Insufficient context'.")
    if intent == "sla":
        return ("Answer using the context. Structure:\n- Availability target\n- Response & resolution times\n- Credits/penalties\n- Monitoring & reporting\n"
                "If any item is not specified in context, say so.")
    if intent == "implementation":
        return ("Answer using the context. Structure:\n- Phases & timeline\n- Roles & responsibilities\n- Dependencies\n- Risks & mitigations\n"
                "Note any missing details as 'Insufficient context'.")
    if intent == "support":
        return ("Answer using the context. Structure:\n- Support channels & hours\n- SLAs\n- Escalation path\n- Included scope\n"
                "Call out missing items as 'Insufficient context'.")
    return ("Answer using only the provided context. If the context does not contain the information, "
            "respond with 'Insufficient context' and do not speculate.")

def _compose_context(passages: List[Retrieved]) -> Tuple[str, List[str]]:
    texts = []
    cites = []
    for i, p in enumerate(passages, start=1):
        texts.append(f"[{i}] {p.text}")
        cites.append(f"[{i}] {p.source}")
    return "\n\n".join(texts), cites

def _self_check(question: str, answer: str, cites: List[str]) -> Tuple[bool, float]:
    """Ask an LLM to verify grounding & sufficiency; return (ok, confidence)."""
    try:
        prompt = {
            "question": question,
            "answer": answer,
            "sources": cites
        }
        system = ("Judge if the answer is fully grounded in the sources and sufficiently addresses the question. "
                  "Return JSON: {\"grounded\": true|false, \"coverage\": 0..1, \"confidence\": 0..1}")
        resp = openai_client.chat.completions.create(
            model=VALIDATOR_MODEL,
            temperature=0.0,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}]
        )
        txt = resp.choices[0].message.content.strip()
        obj = json.loads(re.search(r"\{.*\}", txt, flags=re.DOTALL).group(0) if "{" in txt else txt)
        grounded = bool(obj.get("grounded", False))
        coverage = float(obj.get("coverage", 0.0))
        conf = float(obj.get("confidence", 0.0))
        ok = grounded and coverage >= COVERAGE_MIN and conf >= SELF_CHECK_MIN_CONF
        return ok, min(1.0, max(0.0, conf))
    except Exception:
        # If validator fails, don't block; allow through with low confidence
        return True, 0.5

# ---------------------------
# Public API (unchanged)
# ---------------------------

def answer_questions_with_rag(questions: List[str]) -> Tuple[Dict[str, str], List[Dict]]:
    """
    Returns:
      answers: Dict[question] = answer_text (with inline 'Sources:' appended)
      clarifications: List[{"question": q, "index": idx}]
    Keeps the original signature/shape.
    """
    clarifications: List[Dict] = []
    answers: Dict[str, str] = {}

    for idx, question in enumerate(questions):
        # 1) Retrieve hybrid candidates
        retrieved = _hybrid_retrieve(question)

        if not retrieved:
            clarifications.append({"question": question, "index": idx})
            continue

        # 2) Rerank and keep top contexts
        contexts = _rerank(question, retrieved, RERANK_KEEP)
        if not contexts:
            clarifications.append({"question": question, "index": idx})
            continue

        # 3) Compose context + citations
        context_text, citations = _compose_context(contexts)

        # 4) Structured prompt by intent
        intent = _classify_intent(question)
        guidance = _build_template(intent)

        # 5) Generate answer
        try:
            completion = openai_client.chat.completions.create(
                model=ANSWER_MODEL,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": guidance},
                    {"role": "user",
                     "content": f"Question:\n{question}\n\nContext passages (numbered):\n{context_text}\n\n"
                                f"Write the answer grounded ONLY in these passages. Cite by [n] where applicable."}
                ],
            )
            raw_answer = (completion.choices[0].message.content or "").strip()
        except Exception as e:
            raw_answer = ""

        if not raw_answer:
            clarifications.append({"question": question, "index": idx})
            continue

        # 6) Self-check & gating
        ok, conf = _self_check(question, raw_answer, citations)
        if not ok:
            # Not confidently grounded; ask for clarification rather than risking hallucination
            clarifications.append({"question": question, "index": idx})
            continue

        # 7) Append citations (non-breaking)
        src_block = "\n\nSources:\n" + "\n".join(f"- {c}" for c in citations)
        answers[question] = raw_answer + src_block

    return answers, clarifications
