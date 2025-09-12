#!/usr/bin/env python3
"""
Simple test script to debug email functionality
"""

import os
import sys
import traceback

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test if all required modules can be imported"""
    print("🧪 Testing imports...")
    
    try:
        from config import settings
        print("✅ Config imported successfully")
        print(f"   SMTP_SERVER: {settings.SMTP_SERVER}")
        print(f"   SMTP_PORT: {settings.SMTP_PORT}")
        print(f"   SMTP_USERNAME: {settings.SMTP_USERNAME}")
        print(f"   SENDER_EMAIL: {settings.SENDER_EMAIL}")
        print(f"   SMTP_PASSWORD: {'*' * len(settings.SMTP_PASSWORD) if settings.SMTP_PASSWORD else 'NOT SET'}")
    except Exception as e:
        print(f"❌ Config import failed: {e}")
        return False
    
    try:
        from utils import send_email, generate_branded_document
        print("✅ Utils functions imported successfully")
    except Exception as e:
        print(f"❌ Utils import failed: {e}")
        traceback.print_exc()
        return False
    
    return True

def test_document_generation():
    """Test document generation with sample data"""
    print("\n🧪 Testing document generation...")
    
    try:
        from utils import generate_branded_document
        
        # Sample Q&A data in the format sent by frontend
        sample_data = """Q1: What is SMARTFILL AI?
A1: SMARTFILL AI is an advanced RFP processing solution.

Q2: How does it work?
A2: It uses artificial intelligence to automatically fill RFP responses.

Q3: What are the benefits?
A3: Saves time, improves accuracy, and streamlines the RFP process."""
        
        print("📝 Sample data:")
        print(sample_data)
        print("\n🔧 Generating document...")
        
        doc_path = generate_branded_document(sample_data)
        
        if os.path.exists(doc_path):
            print(f"✅ Document generated successfully: {doc_path}")
            print(f"   File size: {os.path.getsize(doc_path)} bytes")
            return doc_path
        else:
            print(f"❌ Document not found at: {doc_path}")
            return None
            
    except Exception as e:
        print(f"❌ Document generation failed: {e}")
        traceback.print_exc()
        return None

def test_email_sending(doc_path=None):
    """Test email sending functionality"""
    print("\n🧪 Testing email sending...")
    
    try:
        from utils import send_email
        from config import settings
        
        # Check if email is configured
        if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD or not settings.SENDER_EMAIL:
            print("⚠️  Email not configured - testing will use mock mode")
            print("   To test real email, set these environment variables:")
            print("   - SMTP_USERNAME")
            print("   - SMTP_PASSWORD") 
            print("   - SENDER_EMAIL")
            return True
        
        # Test email sending
        test_email = "test@example.com"  # Change this to your email for testing
        subject = "SMARTFILL AI Test Email"
        body = """
        This is a test email from SMARTFILL AI.
        
        If you receive this, the email functionality is working correctly!
        
        Best regards,
        SMARTFILL AI Team
        """
        
        print(f"📧 Sending test email to: {test_email}")
        print(f"   Subject: {subject}")
        
        if doc_path:
            print(f"   Attachment: {doc_path}")
            success, message = send_email(test_email, subject, body.strip(), doc_path)
        else:
            print("   No attachment (document generation failed)")
            success, message = send_email(test_email, subject, body.strip())
        
        if success:
            print(f"✅ Email sent successfully: {message}")
        else:
            print(f"❌ Email failed: {message}")
            
        return success
        
    except Exception as e:
        print(f"❌ Email sending failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("🚀 SMARTFILL AI Email Functionality Test")
    print("=" * 50)
    
    # Test 1: Imports
    if not test_imports():
        print("\n❌ Import tests failed - cannot continue")
        return
    
    # Test 2: Document generation
    doc_path = test_document_generation()
    
    # Test 3: Email sending
    test_email_sending(doc_path)
    
    print("\n" + "=" * 50)
    print("🏁 Test completed!")
    
    # Cleanup
    if doc_path and os.path.exists(doc_path):
        try:
            os.remove(doc_path)
            print(f"🧹 Cleaned up test document: {doc_path}")
        except:
            pass

if __name__ == "__main__":
    main()
