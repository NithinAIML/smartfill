#!/usr/bin/env python3
"""Quick test for AI processing"""

import os
import time
from backend.retriever_simple import answer_questions_with_rag

def quick_test():
    print("🔍 Quick AI Processing Test")
    print("=" * 40)
    
    # Test with 2 simple questions
    test_questions = [
        "What is the project timeline?",
        "What is your company's experience?"
    ]
    
    print(f"📝 Testing with {len(test_questions)} questions...")
    
    start_time = time.time()
    try:
        answers, clarifications = answer_questions_with_rag(test_questions)
        end_time = time.time()
        
        print(f"⏱️  Processing time: {end_time - start_time:.2f} seconds")
        print(f"✅ Generated {len(answers)} answers")
        print(f"⚠️  {len(clarifications)} questions need context")
        
        if answers:
            print("\n📋 Sample Answer:")
            for q, a in list(answers.items())[:1]:
                print(f"Q: {q}")
                print(f"A: {a[:200]}...")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    quick_test()
