#!/usr/bin/env python3
"""
Minimal test to find the exact import issue
"""

print("Testing step by step...")

try:
    print("1. Testing config import...")
    from config import settings
    print("   ✅ Config OK")
except Exception as e:
    print(f"   ❌ Config failed: {e}")
    exit(1)

try:
    print("2. Testing send_email import...")
    from utils import send_email
    print("   ✅ send_email OK")
except Exception as e:
    print(f"   ❌ send_email failed: {e}")
    import traceback
    traceback.print_exc()

try:
    print("3. Testing generate_branded_document import...")
    from utils import generate_branded_document
    print("   ✅ generate_branded_document OK")
except Exception as e:
    print(f"   ❌ generate_branded_document failed: {e}")
    import traceback
    traceback.print_exc()

print("4. Testing document generation...")
try:
    sample_text = "Q1: Test question?\nA1: Test answer."
    doc_path = generate_branded_document(sample_text)
    print(f"   ✅ Document created: {doc_path}")
except Exception as e:
    print(f"   ❌ Document generation failed: {e}")
    import traceback
    traceback.print_exc()

print("All tests completed!")
