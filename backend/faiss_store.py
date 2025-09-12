import os
import pickle
import numpy as np
from typing import List, Dict, Any
import faiss
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyMuPDFLoader, Docx2txtLoader
from langchain_openai import OpenAIEmbeddings
from config import settings

class FAISSVectorStore:
    def __init__(self, embedding_model="text-embedding-ada-002", storage_dir=None):
        self.embeddings = OpenAIEmbeddings(
            model=embedding_model,
            openai_api_key=settings.OPENAI_API_KEY
        )
        self.index = None
        self.documents = []
        self.metadata = []
        self.dimension = 1536  # OpenAI embedding dimension
        
        # Set storage directory
        self.storage_dir = storage_dir or "faiss_storage"
        os.makedirs(self.storage_dir, exist_ok=True)
        
        # For multi-client architecture, don't auto-load any index
        # Each client will have their own isolated storage
        print("📋 FAISS vector store initialized - ready for client-specific indices")
    
    def load_index_if_exists(self):
        """Load existing FAISS index only if it exists, don't create new one"""
        index_path = os.path.join(self.storage_dir, "index.faiss")
        docs_path = os.path.join(self.storage_dir, "documents.pkl")
        meta_path = os.path.join(self.storage_dir, "metadata.pkl")
        source_files_path = os.path.join(self.storage_dir, "source_files.pkl")
        
        if os.path.exists(index_path) and os.path.exists(docs_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(docs_path, 'rb') as f:
                    self.documents = pickle.load(f)
                with open(meta_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                
                # Load source files count if available
                source_files_count = 0
                if os.path.exists(source_files_path):
                    with open(source_files_path, 'rb') as f:
                        source_files = pickle.load(f)
                        source_files_count = len(source_files)
                else:
                    # Fallback: count unique source files from metadata
                    source_files = set()
                    for meta in self.metadata:
                        if 'source' in meta:
                            source_files.add(os.path.basename(meta['source']))
                    source_files_count = len(source_files)
                
                print(f"✅ Loaded existing FAISS index with {len(self.documents)} chunks from {source_files_count} source files")
            except Exception as e:
                print(f"⚠️ Error loading existing index: {e}")
                self._create_new_index()
        else:
            print("📋 No existing knowledge base found - ready for new training documents")

    def load_index(self):
        """Load existing FAISS index and metadata (with fallback to create new)"""
        index_path = os.path.join(self.storage_dir, "index.faiss")
        docs_path = os.path.join(self.storage_dir, "documents.pkl")
        meta_path = os.path.join(self.storage_dir, "metadata.pkl")
        
        if os.path.exists(index_path) and os.path.exists(docs_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(docs_path, 'rb') as f:
                    self.documents = pickle.load(f)
                with open(meta_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                print(f"✅ Loaded existing FAISS index with {len(self.documents)} documents")
            except Exception as e:
                print(f"⚠️ Error loading existing index: {e}")
                self._create_new_index()
        else:
            self._create_new_index()
    
    def _create_new_index(self):
        """Create a new FAISS index"""
        self.index = faiss.IndexFlatIP(self.dimension)  # Inner product (cosine similarity)
        self.documents = []
        self.metadata = []
        print("✅ Created new FAISS index")
    
    def save_index(self):
        """Save FAISS index and metadata to disk"""
        try:
            index_path = os.path.join(self.storage_dir, "index.faiss")
            docs_path = os.path.join(self.storage_dir, "documents.pkl")
            meta_path = os.path.join(self.storage_dir, "metadata.pkl")
            source_files_path = os.path.join(self.storage_dir, "source_files.pkl")
            
            faiss.write_index(self.index, index_path)
            with open(docs_path, 'wb') as f:
                pickle.dump(self.documents, f)
            with open(meta_path, 'wb') as f:
                pickle.dump(self.metadata, f)
            
            # Save source files metadata
            source_files = set()
            for meta in self.metadata:
                if 'source' in meta:
                    source_files.add(os.path.basename(meta['source']))
            
            with open(source_files_path, 'wb') as f:
                pickle.dump(list(source_files), f)
            
            print(f"✅ Saved FAISS index with {len(self.documents)} chunks from {len(source_files)} source files")
        except Exception as e:
            print(f"❌ Error saving index: {e}")
    
    def add_documents(self, texts: List[str], metadatas: List[Dict[str, Any]]):
        """Add documents to the vector store"""
        if not texts:
            return
        
        # Ensure we have an index - create one if it doesn't exist
        if self.index is None:
            print("🆕 Creating new FAISS index for first documents...")
            self._create_new_index()
        
        try:
            # Generate embeddings
            print(f"🔄 Generating embeddings for {len(texts)} text chunks...")
            embeddings = self.embeddings.embed_documents(texts)
            
            # Normalize embeddings for cosine similarity
            embeddings_array = np.array(embeddings).astype('float32')
            faiss.normalize_L2(embeddings_array)
            
            # Add to index
            self.index.add(embeddings_array)
            
            # Store documents and metadata
            self.documents.extend(texts)
            self.metadata.extend(metadatas)
            
            # Save to disk
            self.save_index()
            print(f"✅ Added {len(texts)} chunks to vector store")
            
        except Exception as e:
            if "quota" in str(e).lower() or "429" in str(e):
                print("⚠️ OpenAI API quota exceeded. Creating mock embeddings for testing...")
                # Create mock embeddings for testing
                mock_embeddings = np.random.rand(len(texts), self.dimension).astype('float32')
                faiss.normalize_L2(mock_embeddings)
                
                # Add to index
                self.index.add(mock_embeddings)
                
                # Store documents and metadata
                self.documents.extend(texts)
                self.metadata.extend(metadatas)
                
                # Save to disk
                self.save_index()
                print(f"✅ Added {len(texts)} chunks to vector store (using mock embeddings)")
            else:
                raise e
    
    def similarity_search(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """Search for similar documents with improved scoring"""
        if self.index.ntotal == 0:
            print("⚠️ FAISS index is empty")
            return []
        
        try:
            # Generate query embedding
            query_embedding = self.embeddings.embed_query(query)
            query_vector = np.array([query_embedding]).astype('float32')
            faiss.normalize_L2(query_vector)
            
        except Exception as e:
            if "quota" in str(e).lower() or "429" in str(e):
                print("⚠️ OpenAI API quota exceeded. Using mock query embedding...")
                # Create mock query embedding for testing
                query_vector = np.random.rand(1, self.dimension).astype('float32')
                faiss.normalize_L2(query_vector)
            else:
                raise e
        
        # Search with more results to have better options
        search_k = min(k * 2, self.index.ntotal)  # Search more, return best k
        scores, indices = self.index.search(query_vector, search_k)
        
        # Return results with better filtering
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx != -1 and score > 0.1:  # More permissive threshold
                results.append({
                    'page_content': self.documents[idx],
                    'metadata': self.metadata[idx],
                    'score': float(score)
                })
        
        # Sort by score and return top k
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:k]

# Global vector store instance (for backward compatibility only - not used in multi-client mode)
vector_store = None  # Don't create any global index

def reset_vector_store():
    """Reset the global vector store to empty state"""
    global vector_store
    vector_store = FAISSVectorStore()
    print("🔄 Reset vector store to empty state")

def ingest_documents(file_paths: List[str], storage_dir: str = None) -> Dict[str, Any]:
    """Ingest documents into FAISS vector store"""
    try:
        # Always use client-specific storage directory
        if storage_dir is None:
            # For backward compatibility, create a default storage
            vs = FAISSVectorStore(storage_dir="faiss_storage")
            vs.load_index_if_exists()
        else:
            # Create a new vector store instance for the specific client
            vs = FAISSVectorStore(storage_dir=storage_dir)
            vs.load_index_if_exists()
        
        all_texts = []
        all_metadata = []
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=250,  # Smaller chunks as requested
            chunk_overlap=25,  # Smaller overlap as requested
            length_function=len,
            separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""]  # Better splitting
        )
        
        processed_files = []
        
        for file_path in file_paths:
            try:
                print(f"🔄 Processing: {os.path.basename(file_path)}")
                
                # Determine file type and load
                _, ext = os.path.splitext(file_path.lower())
                
                if ext == '.pdf':
                    loader = PyMuPDFLoader(file_path)
                    documents = loader.load()
                elif ext in ['.docx', '.doc']:
                    loader = Docx2txtLoader(file_path)
                    documents = loader.load()
                elif ext in ['.xlsx', '.xls']:
                    # Handle Excel files using pandas
                    import pandas as pd
                    try:
                        # Read all sheets from Excel file
                        excel_file = pd.ExcelFile(file_path)
                        all_content = []
                        
                        for sheet_name in excel_file.sheet_names:
                            df = pd.read_excel(file_path, sheet_name=sheet_name)
                            # Convert DataFrame to text
                            sheet_content = f"Sheet: {sheet_name}\n"
                            sheet_content += df.to_string(index=False, na_rep='')
                            all_content.append(sheet_content)
                        
                        content = "\n\n".join(all_content)
                        documents = [type('Document', (), {'page_content': content, 'metadata': {'source': file_path}})()]
                        print(f"📊 Excel file contains {len(excel_file.sheet_names)} sheets")
                    except Exception as e:
                        print(f"❌ Error reading Excel file: {e}")
                        continue
                elif ext in ['.txt']:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    documents = [type('Document', (), {'page_content': content, 'metadata': {'source': file_path}})()]
                elif ext in ['.csv']:
                    # Handle CSV files
                    import pandas as pd
                    try:
                        df = pd.read_csv(file_path)
                        content = f"CSV File: {os.path.basename(file_path)}\n"
                        content += df.to_string(index=False, na_rep='')
                        documents = [type('Document', (), {'page_content': content, 'metadata': {'source': file_path}})()]
                        print(f"📊 CSV file contains {len(df)} rows")
                    except Exception as e:
                        print(f"❌ Error reading CSV file: {e}")
                        continue
                elif ext in ['.json']:
                    # Handle JSON files
                    import json
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        content = f"JSON File: {os.path.basename(file_path)}\n"
                        content += json.dumps(data, indent=2)
                        documents = [type('Document', (), {'page_content': content, 'metadata': {'source': file_path}})()]
                        print(f"📊 JSON file loaded successfully")
                    except Exception as e:
                        print(f"❌ Error reading JSON file: {e}")
                        continue
                elif ext in ['.xml']:
                    # Handle XML files
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        documents = [type('Document', (), {'page_content': content, 'metadata': {'source': file_path}})()]
                        print(f"📊 XML file loaded successfully")
                    except Exception as e:
                        print(f"❌ Error reading XML file: {e}")
                        continue
                
                else:
                    print(f"⚠️ Unsupported file type: {ext}")
                    continue
                
                # Split documents into chunks
                texts = text_splitter.split_documents(documents)
                
                # Debug: Print document extraction info
                print(f"📖 Extracted {len(documents)} pages, created {len(texts)} chunks")
                
                # Debug: Show sample content
                for i, doc in enumerate(documents[:2]):  # First 2 pages
                    content_preview = doc.page_content[:200].replace('\n', ' ')
                    print(f"   Page {i+1}: {content_preview}...")
                
                # Filter meaningful chunks and debug
                meaningful_chunks = []
                for i, doc in enumerate(texts):
                    content = doc.page_content.strip()
                    if len(content) >= 50:  # Only keep substantial chunks
                        meaningful_chunks.append(doc)
                        if i < 3:  # Show first 3 chunks
                            chunk_preview = content[:150].replace('\n', ' ')
                            print(f"   Chunk {i+1}: {chunk_preview}...")
                
                print(f"✅ Kept {len(meaningful_chunks)} meaningful chunks (filtered {len(texts) - len(meaningful_chunks)} short ones)")
                
                # Prepare texts and metadata
                for doc in meaningful_chunks:
                    all_texts.append(doc.page_content)
                    all_metadata.append({
                        'source': os.path.basename(file_path),
                        'file_path': file_path,
                        **doc.metadata
                    })
                
                processed_files.append(os.path.basename(file_path))
                print(f"✅ Processed: {os.path.basename(file_path)} ({len(meaningful_chunks)} chunks)")
                
            except Exception as e:
                print(f"❌ Error processing {file_path}: {e}")
                import traceback
                print(f"❌ Traceback: {traceback.format_exc()}")
                continue
        
        # Add all documents to vector store
        if all_texts:
            print(f"📊 Total chunks to index: {len(all_texts)}")
            print(f"📊 Average chunk length: {sum(len(t) for t in all_texts) / len(all_texts):.0f} characters")
            vs.add_documents(all_texts, all_metadata)
        else:
            print("⚠️ No meaningful content extracted from documents")
        
        return {
            'indexed_count': len(processed_files),
            'total_chunks': len(all_texts),
            'processed_files': processed_files
        }
        
    except Exception as e:
        print(f"❌ Ingestion failed: {e}")
        return {'indexed_count': 0, 'error': str(e)}

def get_vector_store():
    """Get the global vector store instance (for backward compatibility)"""
    global vector_store
    if vector_store is None:
        vector_store = FAISSVectorStore(storage_dir="faiss_storage")
        vector_store.load_index_if_exists()
    return vector_store
