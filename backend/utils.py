import os
import fitz  # PyMuPDF
import docx
import pandas as pd
from openai import OpenAI
from tiktoken import encoding_for_model
from backend.config import settings

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def read_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return read_pdf(file_path)
    elif ext == ".docx":
        return read_docx(file_path)
    elif ext in [".xlsx", ".xls", ".csv"]:
        return read_table(file_path)
    else:
        return ""


def read_pdf(file_path):
    doc = fitz.open(file_path)
    return "\n".join(page.get_text() for page in doc)


def read_docx(file_path):
    doc = docx.Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs)


def read_table(file_path):
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    return df.to_string(index=False)


def clean_text(text):
    import re

    text = text.replace("\xa0", " ").replace("\r", " ").strip()
    text = re.sub(r"[\\s\\n]+", " ", text)
    return text


def chunk_text(text, chunk_size=settings.CHUNK_SIZE, overlap=settings.CHUNK_OVERLAP):
    enc = encoding_for_model("gpt-4")
    tokens = enc.encode(text)
    chunks = []
    start = 0

    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk = enc.decode(tokens[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


def embed_texts(text_chunks):
    embeddings = []
    for chunk in text_chunks:
        response = openai_client.embeddings.create(
            model=settings.EMBEDDING_MODEL, input=chunk
        )
        vector = response.data[0].embedding
        embeddings.append((chunk, vector))
    return embeddings


def send_email(
    recipient_email: str, subject: str, body: str, attachment_path: str = None
):
    """Send an email with optional attachment"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.application import MIMEApplication
    from backend.config import settings

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SENDER_EMAIL
        msg["To"] = recipient_email
        msg["Subject"] = subject

        # Add body
        msg.attach(MIMEText(body, "plain"))

        # Add attachment if provided
        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, "rb") as f:
                attachment = MIMEApplication(f.read(), _subtype="docx")
                attachment.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=os.path.basename(attachment_path),
                )
                msg.attach(attachment)

        # Connect to SMTP server
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

        # Send email
        server.send_message(msg)
        server.quit()
        return True, "Email sent successfully"

    except Exception as e:
        return False, f"Failed to send email: {str(e)}"
