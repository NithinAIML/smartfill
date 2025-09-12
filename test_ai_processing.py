#!/usr/bin/env python3
"""
Test script to diagnose AI processing issues    # 4. Check OpenAI Configuration...
    print("\n4. Checking OpenAI Configuration...")
    
    try:
        from backend.config import settings
        api_key = settings.OPENAI_API_KEY
        if api_key and api_key.startswith('sk-'):
            print(f"   ✅ OpenAI API key configured (starts with: {api_key[:10]}...)")
        else:
            print(f"   ⚠️  OpenAI API key: {api_key}")
    except Exception as e:
        print(f"   ❌ Error checking API key: {e}")mport os
import sys
import time
from backend.retriever_simple import answer_questions_with_rag
from backend.faiss_store import get_vector_store

def test_ai_processing():
    """Test the AI processing functionality"""
    
    print("🔍 Testing AI Processing Functionality")
    print("=" * 50)
    
    # 1. Check FAISS store
    print("\n1. Checking FAISS Store...")
    try:
        if os.path.exists('faiss_storage/index.faiss'):
            size = os.path.getsize('faiss_storage/index.faiss')
            print(f"   ✅ FAISS index exists ({size:,} bytes)")
            
            store = get_vector_store()
            print(f"   ✅ FAISS store loaded successfully")
        else:
            print("   ❌ FAISS index not found")
            return
    except Exception as e:
        print(f"   ❌ Error loading FAISS store: {e}")
        return
    
    # 2. Test with sample questions
    print("\n2. Testing with Sample Questions...")
    test_questions = [
        "What is the project timeline?",
        "What is your company's experience?",
        "What is the budget for this project?",
        "Who are the key team members?",
        "What is your technical approach?"
    ]
    
    print(f"   📝 Testing with {len(test_questions)} sample questions")
    
    # Time the processing
    start_time = time.time()
    
    try:
        answers, clarifications = answer_questions_with_rag(test_questions)
        end_time = time.time()
        
        processing_time = end_time - start_time
        print(f"   ⏱️  Processing time: {processing_time:.2f} seconds")
        print(f"   ✅ Generated {len(answers)} answers")
        print(f"   ⚠️  {len(clarifications)} questions need context")
        
        # Show sample results
        print("\n3. Sample Results...")
        for i, (question, answer) in enumerate(list(answers.items())[:2]):
            print(f"   Q{i+1}: {question}")
            print(f"   A{i+1}: {answer[:150]}..." if len(answer) > 150 else f"   A{i+1}: {answer}")
            print()
        
        if clarifications:
            print("   Questions needing context:")
            for i, item in enumerate(clarifications[:3]):
                print(f"   • {item['question']}")
        
    except Exception as e:
        print(f"   ❌ Error during processing: {e}")
        import traceback
        print(f"   📋 Traceback: {traceback.format_exc()}")
    
    # 4. Check OpenAI API
    print("\n4. Checking OpenAI Configuration...")
    from backend.config import get_openai_api_key
    
    api_key = get_openai_api_key()
    if api_key and api_key.startswith('sk-'):
        print(f"   ✅ OpenAI API key configured (starts with: {api_key[:10]}...)")
    else:
        print(f"   ⚠️  OpenAI API key: {api_key}")
    
    print("\n" + "=" * 50)
    print("🏁 AI Processing Test Complete")

if __name__ == "__main__":
    test_ai_processing()
