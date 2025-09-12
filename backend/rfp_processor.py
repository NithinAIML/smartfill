# rfp_processor.py  — Drop-in replacement
# ------------------------------------------------------------
# Upgrades:
# - Universal question extraction from XLSX/XLS, DOCX, PDF, CSV, TXT
# - Scans ALL Excel cells; no reliance on "Column B"
# - Heuristic scoring + optional LLM validator for high precision
# - Keeps the same public API (RFPProcessor + async extract_questions)
# - Preserves existing RAG and sufficiency logic & return shapes

import os
import io
import re
import json
import tempfile
from typing import List, Dict, Tuple, Iterable, Optional

import numpy as np
from openpyxl import load_workbook
import fitz  # PyMuPDF
import docx  # python-docx
import pandas as pd

from langchain_openai import OpenAIEmbeddings
from openai import OpenAI


# -----------------------------
# Utilities: segmentation & heuristics
# -----------------------------

def _split_into_sentences(text: str) -> List[str]:
    """Simple sentence/bullet segmentation that preserves '?', ':' and bullets."""
    if not text:
        return []
    # Normalize whitespace
    t = re.sub(r"\s+", " ", str(text)).strip()
    if not t:
        return []

    # Split on sentence boundaries and newlines
    parts = re.split(r'(?<=[\?\!\.])\s+|\n+', t)
    out: List[str] = []
    for p in parts:
        if not p:
            continue
        # Further split on common bullet separators
        sub = re.split(r'\s+[•\-–]\s+', p)
        for s in sub:
            s = s.strip()
            if s:
                out.append(s)
    return out


def _heuristic_question_score(s: str) -> float:
    """
    Heuristic score in [0,1] for whether a string looks like a question/prompt in an RFP.
    Emphasizes interrogatives and imperative RFP verbs; penalizes headings/fragments.
    """
    if not s:
        return 0.0
    text = re.sub(r"\s+", " ", s.strip())
    if not text:
        return 0.0

    # Discard very short items (unless they contain a '?')
    words = text.split()
    if len(words) < 4 and "?" not in text:
        return 0.05

    # Short ALL-CAPS headings without question mark are likely section titles
    if text.isupper() and len(words) <= 6 and "?" not in text:
        return 0.1

    score = 0.0

    # Strong signal: question mark anywhere
    if text.endswith("?") or "?" in text:
        score += 0.5

    # Interrogatives / auxiliaries / common RFP imperatives
    starters = (
        r"who|what|when|where|why|how|which|whom|whose|"
        r"do|does|did|is|are|was|were|can|could|should|would|will|may|"
        r"(please\s+)?(provide|describe|explain|confirm|list|attach|outline|specify|indicate)\b|"
        r"(detail|demonstrate|document|state)\b"
    )
    if re.match(rf"^\s*(\d+[\.\)]\s*)?({starters})", text, flags=re.IGNORECASE):
        score += 0.35

    # Cue phrases
    cues = [
        "please provide", "please describe", "please explain", "please confirm",
        "include the", "include your", "respond with", "address the following",
        "detail the", "outline the", "specify the", "indicate the"
    ]
    if any(p in text.lower() for p in cues):
        score += 0.2

    # Lines ending with ":" often introduce sub-prompts
    if text.endswith(":"):
        score += 0.1

    return float(min(score, 1.0))


def _dedupe_keep_order(items: Iterable[str]) -> List[str]:
    """Deduplicate normalized strings but preserve first-seen order."""
    seen = set()
    out: List[str] = []
    for s in items:
        key = re.sub(r"\s+", " ", s.lower()).strip().rstrip(":?")
        if key and key not in seen:
            seen.add(key)
            out.append(s.strip())
    return out


# -----------------------------
# Universal text extraction (by file type)
# -----------------------------

def _extract_excel_cells(file_path: str) -> List[Tuple[str, Dict]]:
    """
    Extract all *string* cell contents from all sheets.
    Returns list of (text, provenance).
    """
    wb = load_workbook(file_path, data_only=True)
    items: List[Tuple[str, Dict]] = []
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        # Quick skip: instruction-like sheets by peeking first rows (still universal)
        first_cells_text = " ".join(
            [str(cell.value or "").lower()
             for row in ws.iter_rows(max_row=3)
             for cell in row if cell.value]
        )
        # We *do not* skip decorated sheets; only skip clear instruction/legalese pages
        if "instruction" in first_cells_text and "question" not in first_cells_text:
            # If it's clearly instructions-only, skip
            continue

        for row in ws.iter_rows():
            for cell in row:
                val = cell.value
                if val is None:
                    continue
                # Keep strings only; dates/numbers become strings only if they contain letters
                if isinstance(val, str):
                    text = val.strip()
                else:
                    # Allow non-strings if they look like text (e.g., rich text coerced)
                    text = str(val)
                    # Mostly-numeric/empty -> skip
                    if not re.search(r"[A-Za-z]", text):
                        continue
                prov = {"sheet": sheet, "cell": cell.coordinate}
                items.append((text, prov))
    return items


def _extract_docx_blocks(file_path: str) -> List[Tuple[str, Dict]]:
    """
    Extract paragraphs and table rows from DOCX.
    Returns list of (text, provenance).
    """
    d = docx.Document(file_path)
    items: List[Tuple[str, Dict]] = []
    # Paragraphs
    for i, p in enumerate(d.paragraphs):
        txt = (p.text or "").strip()
        if txt:
            items.append((txt, {"block": f"para_{i+1}"}))
    # Tables
    for ti, table in enumerate(d.tables):
        for ri, row in enumerate(table.rows):
            cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
            if cells:
                items.append((" ".join(cells), {"block": f"table{ti+1}_row{ri+1}"}))
    return items


def _extract_pdf_blocks(file_path: str) -> List[Tuple[str, Dict]]:
    """
    Extract textual blocks from PDF using PyMuPDF in reading order.
    Returns list of (text, provenance{page, block_index}).
    """
    items: List[Tuple[str, Dict]] = []
    with fitz.open(file_path) as doc:
        for pno in range(len(doc)):
            page = doc[pno]
            # 'blocks' preserves a reasonable reading order (x0,y0,..., text)
            blocks = page.get_text("blocks")
            for bi, b in enumerate(blocks):
                if len(b) >= 6:
                    txt = (b[4] or "").strip()
                else:
                    # Fallback: whole-page text if blocks are odd
                    txt = (page.get_text() or "").strip()
                if txt:
                    items.append((txt, {"page": pno + 1, "block": bi + 1}))
    return items


def _extract_csv_text(file_path: str) -> List[Tuple[str, Dict]]:
    """
    Read CSV via pandas and return text rows as concatenated strings.
    """
    df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
    items: List[Tuple[str, Dict]] = []
    for i, row in df.iterrows():
        # join non-empty cells
        cells = [str(v).strip() for v in row.tolist() if str(v).strip()]
        if cells:
            items.append((" ".join(cells), {"row": i + 1}))
    return items


def _extract_txt_lines(file_path: str) -> List[Tuple[str, Dict]]:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [ln.strip() for ln in f.readlines()]
    items: List[Tuple[str, Dict]] = []
    for i, ln in enumerate(lines):
        if ln:
            items.append((ln, {"line": i + 1}))
    return items


# -----------------------------
# LLM validation (optional, for extra precision)
# -----------------------------

def _chunked(iterable: List[str], n: int) -> Iterable[List[str]]:
    for i in range(0, len(iterable), n):
        yield iterable[i:i + n]


def _validate_with_llm(openai_client: OpenAI, candidates: List[str], model: str = "gpt-4o") -> List[Tuple[bool, float]]:
    """
    Ask an LLM to classify each candidate as question/instruction/other and give a confidence in [0,1].
    Returns a list of (keep, confidence) aligned with candidates.
    If the LLM fails, gracefully keep heuristic decisions.
    """
    results: List[Tuple[bool, float]] = [(True, 0.6) for _ in candidates]  # default keep
    if not candidates:
        return results

    try:
        import math
        # Batch to control token size
        for batch_ids in _chunked(list(range(len(candidates))), 24):
            batch = [candidates[i] for i in batch_ids]
            # Compose a compact JSON prompt
            payload = {"items": [{"id": i, "text": t} for i, t in zip(batch_ids, batch)]}
            system = (
                "You are a strict classifier for RFP prompts. "
                "For each item, classify label ∈ {question, instruction, heading, other} "
                "and give confidence ∈ [0,1]. "
                "Return ONLY a JSON array like: "
                "[{\"id\": <int>, \"label\": \"question|instruction|heading|other\", \"confidence\": <float>}, ...]"
            )
            user = json.dumps(payload, ensure_ascii=False)

            resp = openai_client.chat.completions.create(
                model=model,
                temperature=0.0,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            text = (resp.choices[0].message.content or "").strip()
            # Attempt to parse JSON array from response
            m = re.search(r"\[.*\]", text, flags=re.DOTALL)
            parsed = json.loads(m.group(0)) if m else json.loads(text)

            for item in parsed:
                _id = int(item.get("id"))
                label = str(item.get("label", "")).lower()
                conf = float(item.get("confidence", 0.0))
                keep = label in ("question", "instruction")
                # Write into results slot
                results[_id] = (keep, max(0.0, min(1.0, conf)))
    except Exception:
        # If anything goes wrong, just return the default heuristic keep
        return results

    return results


# -----------------------------
# Universal question extraction (public helper)
# -----------------------------

def _extract_questions_from_any(file_bytes: bytes, filename: str, openai_client: Optional[OpenAI]) -> List[str]:
    """
    Core pipeline:
      1) Extract raw text blocks with provenance by file type
      2) Segment into sentences/bullets
      3) Heuristic scoring
      4) Optional LLM validation to boost precision
      5) Deduplicate + return
    """
    # 1) Dump to a temp file with proper suffix to let parsers work
    name = filename or "upload"
    _, ext = os.path.splitext(name)
    ext = ext.lower() or ".bin"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    blocks: List[Tuple[str, Dict]] = []
    try:
        if ext in (".xlsx", ".xls"):
            blocks = _extract_excel_cells(tmp_path)
        elif ext == ".docx":
            blocks = _extract_docx_blocks(tmp_path)
        elif ext == ".pdf":
            blocks = _extract_pdf_blocks(tmp_path)
        elif ext == ".csv":
            blocks = _extract_csv_text(tmp_path)
        elif ext in (".txt", ".text"):
            blocks = _extract_txt_lines(tmp_path)
        else:
            # Unknown types: try best-effort PDF read (if actually a PDF) or fallback to empty
            if ext == ".pdf":
                blocks = _extract_pdf_blocks(tmp_path)
            else:
                blocks = []
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    # 2) Segment to candidate lines
    candidates: List[str] = []
    for text, _prov in blocks:
        for sent in _split_into_sentences(text):
            candidates.append(sent)

    if not candidates:
        return []

    # 3) Heuristic scoring & preliminary filter
    scored = [(s, _heuristic_question_score(s)) for s in candidates]
    # Keep reasonable candidates (lower threshold to catch imperative prompts)
    prelim = [s for (s, sc) in scored if sc >= 0.35]

    if not prelim:
        return []

    # 4) Optional LLM validation for high precision (only if client is provided)
    if openai_client is not None:
        keep_flags = _validate_with_llm(openai_client, prelim, model="gpt-4o")
        refined = [s for s, (keep, conf) in zip(prelim, keep_flags) if keep and conf >= 0.85]
        final_list = refined if refined else prelim  # fall back to prelim if classifier is unsure
    else:
        final_list = prelim

    # 5) Deduplicate and return
    return _dedupe_keep_order(final_list)


# -----------------------------
# Main class (keeps original API)
# -----------------------------

class RFPProcessor:
    def __init__(self):
        # NOTE: You can swap to text-embedding-3-* or OSS in config—interface stays same
        self.embedding = OpenAIEmbeddings(model="text-embedding-ada-002")
        self.openai_client = OpenAI()  # re-used for sufficiency checks and LLM validation
        self.training_qa_pairs: Dict[str, str] = {}
        self.training_embeddings: Dict[str, List[float]] = {}

    # ---- Backwards-compatible Excel-only extractor (still available if needed) ----
    def extract_questions_from_excel(self, file_path: str) -> List[str]:
        """
        Legacy extractor for Excel (kept for compatibility) — scans Column B non-bold.
        Prefer using universal extractor via process_rfp.
        """
        from datetime import datetime

        def is_date(text: str) -> bool:
            pats = [
                r"\d{4}-\d{2}-\d{2}",
                r"\d{2}/\d{2}/\d{4}",
                r"[A-Za-z]+ \d{1,2},? \d{4}",
                r"\d{1,2} [A-Za-z]+ \d{4}",
            ]
            s = str(text)
            if any(re.search(p, s) for p in pats):
                return True
            try:
                s0 = s.split(" ", 1)[0] if " " in s else s
                datetime.strptime(s0, "%Y-%m-%d")
                return True
            except Exception:
                return False

        wb = load_workbook(file_path)
        qs: List[str] = []
        for sheet in wb.sheetnames:
            ws = wb[sheet]
            first_cells_text = " ".join(
                [str(c.value or "").lower()
                 for row in ws.iter_rows(max_row=3)
                 for c in row if c.value]
            )
            if "instruction" in first_cells_text or "français" in first_cells_text:
                continue
            for row in ws.iter_rows(min_row=1):
                q_cell = row[1] if len(row) > 1 else None  # column B
                if q_cell and q_cell.value and not bool(getattr(q_cell.font, "bold", False)):
                    question = str(q_cell.value).strip()
                    if not is_date(question) and len(question.split()) > 3:
                        qs.append(question)
        return qs

    # ---- Training Q/A handling (unchanged) ----
    def load_training_qa_pairs(self, excel_path: str):
        wb = load_workbook(excel_path)
        new_qs: List[str] = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            first_cells_text = " ".join(
                [str(c.value or "").lower()
                 for row in ws.iter_rows(max_row=3)
                 for c in row if c.value]
            )
            if "instruction" in first_cells_text or "français" in first_cells_text:
                continue

            for row in ws.iter_rows(min_row=1):
                q_cell = row[1] if len(row) > 1 else None
                r_cell = row[2] if len(row) > 2 else None
                if q_cell and q_cell.value and not bool(getattr(q_cell.font, "bold", False)) and r_cell and r_cell.value:
                    q = str(q_cell.value).strip()
                    if q not in self.training_qa_pairs:
                        self.training_qa_pairs[q] = str(r_cell.value).strip()
                        new_qs.append(q)

        if new_qs:
            embeddings = self.embedding.embed_documents(new_qs)
            for q, emb in zip(new_qs, embeddings):
                self.training_embeddings[q] = emb

    def calculate_similarity(self, q1: str, q2: str) -> float:
        try:
            e1 = self.embedding.embed_query(q1)
            e2 = self.embedding.embed_query(q2)
            return float(np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2)))
        except Exception:
            return 0.0

    def find_similar_questions(self, question: str, threshold: float = 0.85) -> List[Tuple[str, float]]:
        if not self.training_embeddings:
            return []
        q_emb = self.embedding.embed_query(question)
        sims: List[Tuple[str, float]] = []
        for tq, te in self.training_embeddings.items():
            s = float(np.dot(q_emb, te) / (np.linalg.norm(q_emb) * np.linalg.norm(te)))
            if s >= threshold:
                sims.append((tq, s))
        return sorted(sims, key=lambda x: x[1], reverse=True)

    def evaluate_context_sufficiency(self, question: str, context: str) -> bool:
        if not context:
            return False

        prompt = (
            f"Given this context: '{context}'\n\n"
            f"Can you provide a complete and accurate answer to this question: '{question}'?\n\n"
            "Rate the context sufficiency on a scale of 0-100 where:\n"
            "0-84: Insufficient context\n85-100: Sufficient context\n\n"
            "Reply with just the number."
        )
        resp = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert at evaluating context sufficiency for answering questions."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=10,
        )
        txt = (resp.choices[0].message.content or "").strip()
        m = re.search(r"\b(\d{1,3})\b", txt)
        try:
            score = int(m.group(1)) if m else -1
        except Exception:
            score = -1
        return 85 <= score <= 100

    # ---- Main pipeline (unchanged signature) ----
    def process_rfp(self, file, vectorstore) -> Tuple[Dict[str, str], List[str]]:
        """
        Process uploaded RFP file (any of: xlsx/xls/docx/pdf/csv/txt) and return:
          - answers: Dict[question, answer]
          - needs_context: List[question]
        Vectorstore must support .similarity_search(question, k=3).
        """
        # Read bytes from the uploaded file-like object (Streamlit / FastAPI compatible)
        data: Optional[bytes] = None
        filename = getattr(file, "name", None) or getattr(file, "filename", "upload")

        if hasattr(file, "getvalue"):
            data = file.getvalue()
        elif hasattr(file, "read"):
            # Some uploaders provide .read(); rewind if needed
            try:
                data = file.read()
            except Exception:
                # Try underlying .file
                data = getattr(getattr(file, "file", None), "read", lambda: b"")()
        elif isinstance(file, (bytes, bytearray)):
            data = bytes(file)
        else:
            raise TypeError("Unsupported file object for process_rfp")

        data = data or b""
        # 1) Universal question extraction (heuristics + LLM validator)
        questions: List[str] = _extract_questions_from_any(data, filename, self.openai_client)

        # If for some reason universal extraction yields nothing AND the file is Excel, fall back to legacy
        if not questions:
            _, ext = os.path.splitext(filename or "")
            if ext.lower() in (".xlsx", ".xls"):
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    tmp.write(data)
                    path = tmp.name
                try:
                    questions = self.extract_questions_from_excel(path)
                finally:
                    try:
                        os.remove(path)
                    except Exception:
                        pass

        answers: Dict[str, str] = {}
        needs_context: List[str] = []

        # 2) Process questions in small batches (kept the same as your original)
        batch_size = 5
        for i in range(0, len(questions), batch_size):
            batch = questions[i: i + batch_size]
            for question in batch:
                # (a) Try training bank first
                sims = self.find_similar_questions(question)
                if sims:
                    best_q = sims[0][0]
                    answers[question] = self.training_qa_pairs[best_q]
                    continue

                # (b) RAG retrieval
                try:
                    docs = vectorstore.similarity_search(question, k=3) if vectorstore else []
                except Exception:
                    docs = []
                context = "\n\n".join([getattr(d, "page_content", "") for d in docs]) if docs else ""

                # (c) Sufficiency gate
                if not self.evaluate_context_sufficiency(question, context):
                    needs_context.append(question)
                    continue

                # (d) Generate answer using provided context
                resp = self.openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "Generate a precise answer based on the provided context."},
                        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
                    ],
                    temperature=0.2,
                )
                answers[question] = (resp.choices[0].message.content or "").strip()

        return answers, needs_context


# -----------------------------
# Async helper for FastAPI (kept for main.py compatibility)
# -----------------------------

_processor = RFPProcessor()

async def extract_questions(file) -> List[str]:
    """
    Accepts FastAPI UploadFile or any similar object and returns a list of questions.
    Keeps the same name/signature used in main.py.
    """
    import asyncio

    filename = getattr(file, "filename", None) or getattr(file, "name", "upload")
    data: bytes

    if hasattr(file, "read") and asyncio.iscoroutinefunction(file.read):
        data = await file.read()
    else:
        # sync fallbacks
        if hasattr(file, "file") and hasattr(file.file, "read"):
            data = file.file.read()
        elif hasattr(file, "getvalue"):
            data = file.getvalue()
        elif hasattr(file, "read"):
            data = file.read()
        else:
            raise TypeError("Unsupported file type for extract_questions")

    return _extract_questions_from_any(data or b"", filename, _processor.openai_client)
