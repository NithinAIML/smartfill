# import os
# import fitz  # PyMuPDF
# import docx
# import pandas as pd
# from openai import OpenAI
# from tiktoken import encoding_for_model
# from backend.config import settings

# openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


# def read_file(file_path):
#     ext = os.path.splitext(file_path)[1].lower()
#     if ext == ".pdf":
#         return read_pdf(file_path)
#     elif ext == ".docx":
#         return read_docx(file_path)
#     elif ext in [".xlsx", ".xls", ".csv"]:
#         return read_table(file_path)
#     else:
#         return ""


# def read_pdf(file_path):
#     doc = fitz.open(file_path)
#     return "\n".join(page.get_text() for page in doc)


# def read_docx(file_path):
#     doc = docx.Document(file_path)
#     return "\n".join(p.text for p in doc.paragraphs)


# def read_table(file_path):
#     if file_path.endswith(".csv"):
#         df = pd.read_csv(file_path)
#     else:
#         df = pd.read_excel(file_path)
#     return df.to_string(index=False)


# def clean_text(text):
#     import re

#     text = text.replace("\xa0", " ").replace("\r", " ").strip()
#     text = re.sub(r"[\\s\\n]+", " ", text)
#     return text


# def chunk_text(text, chunk_size=settings.CHUNK_SIZE, overlap=settings.CHUNK_OVERLAP):
#     enc = encoding_for_model("gpt-4")
#     tokens = enc.encode(text)
#     chunks = []
#     start = 0

#     while start < len(tokens):
#         end = min(start + chunk_size, len(tokens))
#         chunk = enc.decode(tokens[start:end])
#         chunks.append(chunk)
#         start += chunk_size - overlap

#     return chunks


# def embed_texts(text_chunks):
#     embeddings = []
#     for chunk in text_chunks:
#         response = openai_client.embeddings.create(
#             model=settings.EMBEDDING_MODEL, input=chunk
#         )
#         vector = response.data[0].embedding
#         embeddings.append((chunk, vector))
#     return embeddings


# def send_email(
#     recipient_email: str, subject: str, body: str, attachment_path: str = None
# ):
#     """Send an email with optional attachment"""
#     import smtplib
#     from email.mime.text import MIMEText
#     from email.mime.multipart import MIMEMultipart
#     from email.mime.application import MIMEApplication
#     from backend.config import settings

#     try:
#         msg = MIMEMultipart()
#         msg["From"] = settings.SENDER_EMAIL
#         msg["To"] = recipient_email
#         msg["Subject"] = subject

#         # Add body
#         msg.attach(MIMEText(body, "plain"))

#         # Add attachment if provided
#         if attachment_path and os.path.exists(attachment_path):
#             with open(attachment_path, "rb") as f:
#                 attachment = MIMEApplication(f.read(), _subtype="docx")
#                 attachment.add_header(
#                     "Content-Disposition",
#                     "attachment",
#                     filename=os.path.basename(attachment_path),
#                 )
#                 msg.attach(attachment)

#         # Connect to SMTP server
#         server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
#         server.starttls()
#         server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

#         # Send email
#         server.send_message(msg)
#         server.quit()
#         return True, "Email sent successfully"

#     except Exception as e:
#         return False, f"Failed to send email: {str(e)}"

# backend/utils.py  — Drop-in replacement (no other file changes required)

import os
import io
import re
import base64
import mimetypes
from typing import Iterable, List, Tuple

import fitz  # PyMuPDF
import docx
import pandas as pd

from openai import OpenAI
from tiktoken import encoding_for_model, get_encoding

# Keep compatibility with both import styles used across your codebase
try:
    from backend.config import settings
except Exception:
    from config import settings

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

# ---------------------------
# File readers (coverage-focused)
# ---------------------------

def read_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        text = read_pdf(file_path)
        # Optional: multimodal OCR fallback for scanned PDFs
        use_vision = os.getenv("USE_OPENAI_VISION_OCR", "false").lower() in ("1", "true", "yes")
        if use_vision and len(text.strip()) < 40:
            ocr_text = ocr_pdf_with_openai(file_path, model=os.getenv("VISION_MODEL", "gpt-4o-mini"))
            if ocr_text.strip():
                text = ocr_text
        return text

    if ext == ".docx":
        return read_docx(file_path)

    if ext in (".xlsx", ".xls", ".csv"):
        return read_table(file_path)

    if ext in (".txt", ".text"):
        return read_txt(file_path)

    # Unknown types → empty string (preserves current behavior)
    return ""


def read_pdf(file_path: str) -> str:
    """Extracts text blocks in reading order. (Digital PDFs only; use OCR fallback for scans.)"""
    parts: List[str] = []
    with fitz.open(file_path) as doc:
        for pno in range(len(doc)):
            page = doc[pno]
            blocks = page.get_text("blocks")
            if blocks:
                for b in blocks:
                    if len(b) >= 5 and b[4]:
                        parts.append(b[4].strip())
            else:
                # Fallback: whole page text
                raw = page.get_text()
                if raw:
                    parts.append(raw.strip())
    return "\n".join(t for t in parts if t)


def ocr_pdf_with_openai(file_path: str, model: str = "gpt-4o-mini") -> str:
    """
    Multimodal OCR fallback using OpenAI vision. Opt-in via USE_OPENAI_VISION_OCR=true.
    Extracts readable text from each page image; returns concatenated text.
    """
    texts: List[str] = []
    try:
        with fitz.open(file_path) as doc:
            for pno in range(len(doc)):
                page = doc[pno]
                # Render page to PNG bytes
                pix = page.get_pixmap(dpi=180, alpha=False)
                png_bytes = pix.tobytes("png")
                b64 = base64.b64encode(png_bytes).decode("ascii")

                messages = [
                    {"role": "system",
                     "content": "Extract all visible readable text exactly as written. No summaries, no paraphrasing."},
                    {"role": "user",
                     "content": [
                         {"type": "text", "text": "Extract all readable text from this page. Return text only."},
                         {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
                     ]}
                ]
                resp = openai_client.chat.completions.create(
                    model=model, temperature=0.0, messages=messages
                )
                page_text = (resp.choices[0].message.content or "").strip()
                if page_text:
                    texts.append(page_text)
    except Exception:
        # If OCR fails, just return empty to keep ingestion robust
        return ""
    return "\n\n".join(texts)


def read_docx(file_path: str) -> str:
    """Extract paragraphs AND tables—RFPs often hide prompts in tables."""
    d = docx.Document(file_path)
    parts: List[str] = []

    # Paragraphs
    for p in d.paragraphs:
        if p.text and p.text.strip():
            parts.append(p.text.strip())

    # Tables
    for table in d.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))

    return "\n".join(parts)


def read_table(file_path: str) -> str:
    """
    Read CSV or Excel. For Excel, read ALL sheets, concatenate, and export to CSV-like text.
    """
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
        return df.to_csv(index=False)

    # Excel: read all sheets
    sheets = pd.read_excel(file_path, sheet_name=None, dtype=str)
    frames: List[pd.DataFrame] = []
    for sheet_name, df in sheets.items():
        if df is None or df.empty:
            continue
        df = df.fillna("")
        # Keep sheet provenance in text
        df.insert(0, "__sheet__", str(sheet_name))
        frames.append(df)

    if not frames:
        return ""

    big = pd.concat(frames, ignore_index=True)
    # CSV text is compact and chunk-friendly
    return big.to_csv(index=False)


def read_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


# ---------------------------
# Text cleanup / chunking / embeddings
# ---------------------------

def clean_text(text: str) -> str:
    # Fixes original regex bug: collapse *any* whitespace
    t = (text or "").replace("\xa0", " ").replace("\r", " ").strip()
    return re.sub(r"\s+", " ", t).strip()


def _tokenizer_name() -> str:
    # Match tokenizer to embedding model; fallback safe
    model = getattr(settings, "EMBEDDING_MODEL", "") or "cl100k_base"
    try:
        return encoding_for_model(model).name
    except Exception:
        return "cl100k_base"


def chunk_text(text: str, chunk_size: int = settings.CHUNK_SIZE, overlap: int = settings.CHUNK_OVERLAP) -> List[str]:
    """
    Token-aware chunking using the tokenizer matched to your embedding model.
    Preserves existing signature and behavior.
    """
    enc = get_encoding(_tokenizer_name())
    tokens = enc.encode(text or "")
    chunks: List[str] = []
    if not tokens:
        return chunks

    step = max(1, chunk_size - overlap)
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunks.append(enc.decode(tokens[start:end]))
        start += step
    return chunks


def embed_texts(text_chunks: Iterable[str]) -> List[Tuple[str, List[float]]]:
    """
    Batch embeddings for speed/cost. Keeps the (chunk, vector) return format you use.
    """
    texts = [clean_text(t) for t in text_chunks if t and clean_text(t)]
    if not texts:
        return []

    model = settings.EMBEDDING_MODEL
    out: List[Tuple[str, List[float]]] = []

    # Reasonable batch size to avoid oversized payloads
    batch_size = int(os.getenv("EMBED_BATCH_SIZE", "128"))
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        resp = openai_client.embeddings.create(model=model, input=batch)
        for t, d in zip(batch, resp.data):
            out.append((t, d.embedding))
    return out


# ---------------------------
# Email (unchanged API)
# ---------------------------

def send_email(
    recipient_email: str, subject: str, body: str, attachment_path: str = None
):
    """Send an email with optional attachment (same signature used by app.py)."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.application import MIMEApplication

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SENDER_EMAIL
        msg["To"] = recipient_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        if attachment_path and os.path.exists(attachment_path):
            ctype, _ = mimetypes.guess_type(attachment_path)
            subtype = (ctype.split("/", 1)[1] if ctype else "octet-stream")
            with open(attachment_path, "rb") as f:
                part = MIMEApplication(f.read(), _subtype=subtype)
            part.add_header("Content-Disposition", "attachment",
                            filename=os.path.basename(attachment_path))
            msg.attach(part)

        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True, "Email sent successfully"
    except Exception as e:
        return False, f"Failed to send email: {str(e)}"

def generate_branded_document(questions_answers_data: str) -> str:
    """Generate a Word document with SMARTFILL AI branding"""
    try:
        from docx import Document
        from docx.shared import Inches, Pt
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.style import WD_STYLE_TYPE
        import json
        import tempfile
        import os
        import re
        
        # Parse the questions and answers - handle both JSON and text formats
        qa_pairs = []
        try:
            # Try to parse as JSON first
            qa_data = json.loads(questions_answers_data)
            if isinstance(qa_data, dict) and 'answers' in qa_data:
                answers_dict = qa_data['answers']
            elif isinstance(qa_data, dict):
                answers_dict = qa_data
            else:
                answers_dict = {}
            
            # Convert to list of tuples
            for question, answer in answers_dict.items():
                qa_pairs.append((question, answer))
                
        except (json.JSONDecodeError, TypeError):
            # Parse as plain text format: "Q1: question\nA1: answer\n\n"
            lines = questions_answers_data.strip().split('\n')
            current_question = None
            current_answer = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                if line.startswith('Q') and ':' in line:
                    # Save previous Q&A pair
                    if current_question and current_answer:
                        qa_pairs.append((current_question, current_answer))
                    # Extract new question
                    current_question = line.split(':', 1)[1].strip()
                    current_answer = None
                elif line.startswith('A') and ':' in line and current_question:
                    # Extract answer
                    current_answer = line.split(':', 1)[1].strip()
            
            # Save last Q&A pair
            if current_question and current_answer:
                qa_pairs.append((current_question, current_answer))
        
        # Create document
        doc = Document()
        
        # Add SMARTFILL AI heading
        heading = doc.add_heading('SMARTFILL AI', 0)
        heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add caption
        caption = doc.add_paragraph('AI based RFP smart filling solution')
        caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption_format = caption.runs[0].font
        caption_format.size = Pt(14)
        caption_format.italic = True
        
        # Add separator
        doc.add_paragraph('=' * 60).alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add generation timestamp
        from datetime import datetime
        timestamp = doc.add_paragraph(f'Generated on: {datetime.now().strftime("%B %d, %Y at %I:%M %p")}')
        timestamp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        timestamp.runs[0].font.size = Pt(10)
        
        doc.add_paragraph()  # Empty line
        
        # Add questions and answers
        if qa_pairs:
            for i, (question, answer) in enumerate(qa_pairs, 1):
                # Question
                q_paragraph = doc.add_paragraph()
                q_run = q_paragraph.add_run(f"Question {i}: {question}")
                q_run.font.bold = True
                q_run.font.size = Pt(12)
                
                # Answer
                a_paragraph = doc.add_paragraph()
                a_run = a_paragraph.add_run(f"Answer: {answer}")
                a_run.font.size = Pt(11)
                
                # Add space between Q&A pairs
                doc.add_paragraph()
        else:
            doc.add_paragraph("No questions and answers data available.")
        
        # Footer
        doc.add_page_break()
        footer_para = doc.add_paragraph()
        footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        footer_run = footer_para.add_run("Generated by SMARTFILL AI\nAI based RFP smart filling solution")
        footer_run.font.size = Pt(10)
        footer_run.font.italic = True
        
        # Save to temporary file
        temp_dir = tempfile.gettempdir()
        doc_filename = f"SMARTFILL_AI_Results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        doc_path = os.path.join(temp_dir, doc_filename)
        doc.save(doc_path)
        
        return doc_path
        
    except Exception as e:
        print(f"❌ Error generating document: {e}")
        # Fallback: create a simple text file
        import tempfile
        import os
        from datetime import datetime
        
        temp_dir = tempfile.gettempdir()
        txt_filename = f"SMARTFILL_AI_Results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        txt_path = os.path.join(temp_dir, txt_filename)
        
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write("SMARTFILL AI\n")
            f.write("AI based RFP smart filling solution\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}\n\n")
            f.write("Results:\n")
            f.write(questions_answers_json)
        
        return txt_path
