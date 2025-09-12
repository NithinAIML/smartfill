# retriever.py — Simple FAISS-based RAG implementation
from typing import List, Tuple, Dict
import os
from config import settings
from openai import OpenAI

# Initialize OpenAI client only
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Don't load any global vector store - use client-specific ones instead
print("📋 FAISS Retriever module loaded - ready for client-specific retrieval")

def answer_questions_with_rag(questions: List[str], storage_dir: str = None) -> Tuple[Dict[str, str], List[Dict]]:
    """
    Answer questions using FAISS-based RAG system.
    Args:
        questions: List of questions to answer
        storage_dir: Optional path to client-specific FAISS storage directory
    Returns:
      answers: Dict[question] = answer_text
      clarifications: List[{"question": q, "index": idx}] for questions needing more context
    """
    print(f"🤖 Processing {len(questions)} questions with FAISS RAG...")
    
    # Always use client-specific vector store
    if storage_dir:
        print(f"🔍 Using client-specific index from: {storage_dir}")
        from faiss_store import FAISSVectorStore
        client_vector_store = FAISSVectorStore(storage_dir=storage_dir)
        client_vector_store.load_index_if_exists()
        search_vector_store = client_vector_store
    else:
        print(f"🔍 Using default storage directory")
        from faiss_store import get_vector_store
        search_vector_store = get_vector_store()
    
    clarifications: List[Dict] = []
    answers: Dict[str, str] = {}

    for idx, question in enumerate(questions):
        print(f"🔍 Processing question {idx + 1}: {question[:100]}...")
        
        try:
            # Search for relevant documents with more results and debug
            search_results = search_vector_store.similarity_search(question, k=15)
            
            print(f"🔍 Found {len(search_results)} search results for question {idx + 1}")
            
            if not search_results:
                print(f"⚠️ No relevant context found for question {idx + 1}")
                clarifications.append({"question": question, "index": idx})
                continue
            
            # Debug: Show search results quality
            for i, result in enumerate(search_results[:3]):
                score = result.get('score', 0)
                content_preview = result['page_content'][:100].replace('\n', ' ')
                print(f"   Result {i+1} (score: {score:.3f}): {content_preview}...")
            
            # Prepare context from search results
            context_chunks = []
            for result in search_results:
                context_chunks.append(result['page_content'])
            
            context_str = "\n\n".join(context_chunks)
            
            # Very permissive context check
            if len(context_str.strip()) < 10:  # Extremely permissive
                print(f"⚠️ Insufficient context for question {idx + 1}")
                clarifications.append({"question": question, "index": idx})
                continue
            
            print(f"📝 Context length for question {idx + 1}: {len(context_str)} characters")
            
            # Generate answer using OpenAI
            print(f"🎯 Generating answer for question {idx + 1}...")
            completion = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert assistant that answers RFP questions based on provided context. Be specific, professional, and comprehensive. Use the context to provide detailed answers even if partial information is available."
                    },
                    {
                        "role": "user",
                        "content": f"Question: {question}\n\nContext:\n{context_str}\n\nPlease provide a detailed answer based on the context above. If the context provides partial information, use it to give the best possible answer."
                    }
                ],
                temperature=0.2,
                max_tokens=1000
            )
            
            answer = completion.choices[0].message.content.strip()
            
            # Very lenient quality check - accept almost any answer
            if len(answer) < 10:  # Very permissive
                print(f"⚠️ Generated answer too short for question {idx + 1}")
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
