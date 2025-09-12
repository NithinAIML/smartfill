from typing import List, Tuple, Dict
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
            # Search for relevant documents
            search_results = vector_store.similarity_search(question, k=3)
            
            if not search_results:
                print(f"⚠️ No relevant context found for question {idx + 1}")
                clarifications.append({"question": question, "index": idx})
                continue
            
            # Prepare context from search results
            context_chunks = []
            sources = []
            for result in search_results:
                context_chunks.append(result['page_content'])
                sources.append(result['metadata'].get('source', 'Unknown'))
            
            context_str = "\n\n".join(context_chunks)
            
            # Check if context is sufficient (simple heuristic)
            if len(context_str.strip()) < 100:
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
            
            # Add sources to the answer
            unique_sources = list(set(sources))
            if unique_sources:
                answer += f"\n\nSources: {', '.join(unique_sources)}"
            
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
