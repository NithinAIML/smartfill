import os
import pandas as pd
import fitz
import docx
import faiss
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS

# Initialize
embedding = OpenAIEmbeddings(model="text-embedding-ada-002")
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
DIM = 1536  # dimension for ada-002

# Uploaded document paths
files = {
    "Quiet Period Policy": "Attachment B.pdf",
    "Non-Emergent RFP": "Request for Proposal.pdf",
    "Kaizen Bios": "Kaizen Health Bios.pdf",
    "Kaizen Pricing": "Kaizen Health Pricing.pdf",
    "Q&A Excel": "Attachment A.xlsx",
}

results = {}

# Loop through and process
for name, path in files.items():
    try:
        ext = os.path.splitext(path)[1].lower()

        # Text extraction
        if ext == ".pdf":
            with fitz.open(path) as doc:
                text = "\n".join([page.get_text("text") for page in doc])
                # Print PDF chunks
                chunks = splitter.split_text(text)
                print(f"\n=== Chunks from {name} ===")
                for i, chunk in enumerate(chunks, 1):
                    print(f"\nChunk {i}:")
                    print("-" * 50)
                    print(chunk)
                    print("-" * 50)
        elif ext == ".docx":
            doc = docx.Document(path)
            text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        elif ext == ".xlsx":
            df = pd.read_excel(path)
            if "Question" in df.columns and "Response" in df.columns:
                text = "\n".join(
                    [f"Q: {q}\nA: {a}" for q, a in zip(df["Question"], df["Response"])]
                )
            else:
                text = df.to_string(index=False)
            # Print Excel chunks
            chunks = splitter.split_text(text)
            print(f"\n=== Chunks from {name} ===")
            for i, chunk in enumerate(chunks, 1):
                print(f"\nChunk {i}:")
                print("-" * 50)
                print(chunk)
                print("-" * 50)
        else:
            text = ""

        # Chunking
        chunks = splitter.split_text(text)
        embeddings = embedding.embed_documents(chunks)

        # Create FAISS index
        from langchain.vectorstores import FAISS

        vectorstore = FAISS.from_texts(chunks, embedding)
        vectorstore.save_local("faiss_index")

        results[name] = {
            "text_extracted": len(text) > 50,
            "chunks_created": len(chunks),
            "embeddings_created": len(embeddings),
            "faiss_index_size": vectorstore.index.ntotal,
        }

    except Exception as e:
        results[name] = {"error": str(e)}

# Print results
print("\n==== RAG Document Processing Report ====\n")
for k, v in results.items():
    print(f"{k}:")
    for metric, val in v.items():
        print(f"  {metric}: {val}")
    print()
