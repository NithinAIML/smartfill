# SMARTFILL AI - RFP Assistant

An intelligent RFP (Request for Proposal) processing system that uses RAG (Retrieval Augmented Generation) to automate response generation.

## Features

- 📑 Automatic RFP question extraction and processing
- 🔍 Smart context retrieval using FAISS for semantic search
- 🤖 AI-powered response generation using GPT-4
- 📊 Support for multiple document formats (PDF, Excel, Word)
- 📧 Email export functionality
- 📥 Document export in DOCX format

## Tech Stack

- Python 3.10+
- Streamlit for frontend
- FastAPI for backend
- LangChain for RAG implementation
- OpenAI GPT-4 for response generation
- FAISS for vector search
- Weaviate for document storage
- Docker for containerization

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/smartfill-ai.git
cd smartfill-ai
```

2. Create and configure environment variables in `.env`:
```
OPENAI_API_KEY=your_openai_api_key
WEAVIATE_URL=http://localhost:8080
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_specific_password
SENDER_EMAIL=your_email@gmail.com
```

3. Install dependencies:
```bash
pip install -r backend/requirements.txt
```

4. Start the services:
```bash
docker-compose up -d
```

5. Run the Streamlit app:
```bash
cd frontend
streamlit run app.py
```

## Usage

1. Upload training documents using the sidebar
2. Process the RFP document
3. Review and provide additional context if needed
4. Generate final responses
5. Export or email the responses

## Project Structure

- `frontend/` - Streamlit web interface
- `backend/` - FastAPI backend services
- `docker-compose.yml` - Container orchestration

## License

MIT License

## Contributors

- [Your Name]

## Acknowledgments

- OpenAI for GPT-4
- Facebook Research for FAISS
- Streamlit team