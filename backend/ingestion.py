import os
import tempfile
from typing import List, Dict, Any
from faiss_store import ingest_documents as faiss_ingest

def ingest_documents(file_paths: List[str]) -> Dict[str, Any]:
    """
    Main ingestion function that uses FAISS for local vector storage.
    This replaces the Weaviate implementation for better local development.
    """
    print(f"🚀 Starting document ingestion with FAISS...")
    print(f"📁 Processing {len(file_paths)} files")
    
    try:
        # Use FAISS-based ingestion
        result = faiss_ingest(file_paths)
        
        print(f"✅ Ingestion completed successfully!")
        print(f"📊 Indexed {result.get('indexed_count', 0)} files")
        print(f"📝 Created {result.get('total_chunks', 0)} text chunks")
        
        return result
        
    except Exception as e:
        print(f"❌ Ingestion failed: {e}")
        return {
            'indexed_count': 0,
            'total_chunks': 0,
            'error': str(e)
        }
