import streamlit as st
import os
import sys
import time
import tempfile
from docx import Document

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.rag_engine import RAGEngine
from backend.rfp_processor import RFPProcessor

st.set_page_config(page_title="SMARTFILL AI", layout="wide")

# Initialize session state
if 'rag' not in st.session_state:
    st.session_state.rag = RAGEngine(layout_aware=True)
if 'rfp_processor' not in st.session_state:
    st.session_state.rfp_processor = RFPProcessor()
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []
if 'indexed' not in st.session_state:
    st.session_state.indexed = False
if 'needs_context' not in st.session_state:
    st.session_state.needs_context = []
if 'answers' not in st.session_state:
    st.session_state.answers = {}
if 'current_question_idx' not in st.session_state:
    st.session_state.current_question_idx = 0
if 'questions_mode' not in st.session_state:
    st.session_state.questions_mode = None
if 'export_status' not in st.session_state:
    st.session_state.export_status = {
        'ready': False,
        'filename': None,
        'error': None
    }
if 'document_generated' not in st.session_state:
    st.session_state.document_generated = False

# Critical fix: Initialize proper email state variables
if 'email_form_visible' not in st.session_state:
    st.session_state.email_form_visible = False
if 'email_recipient' not in st.session_state:
    st.session_state.email_recipient = ""
if 'current_doc_filename' not in st.session_state:
    st.session_state.current_doc_filename = None
if 'email_success' not in st.session_state:
    st.session_state.email_success = False
if 'email_success_message' not in st.session_state:
    st.session_state.email_success_message = ""

# Define callbacks for email functionality
def show_email_form():
    st.session_state.email_form_visible = True
    st.session_state.email_success = False  # Reset success state when showing form

def hide_email_form():
    st.session_state.email_form_visible = False

def set_email_success(message):
    st.session_state.email_success = True
    st.session_state.email_success_message = message
    # Hide the form after 3 seconds
    time.sleep(3)
    st.session_state.email_form_visible = False

def send_email_now(recipient, filename):
    if recipient.strip():
        try:
            from backend.utils import send_email
            success, message = send_email(
                recipient_email=recipient,
                subject="SMARTFILL AI - RFP Responses",
                body="Attached are the SMARTFILL AI generated RFP responses.",
                attachment_path=filename
            )
            if success:
                success_msg = f"✅ Document successfully delivered to {recipient}!"
                set_email_success(success_msg)
            return success, message
        except Exception as e:
            return False, str(e)
    else:
        return False, "Please enter a valid email address"

rag = st.session_state.rag
rfp_processor = st.session_state.rfp_processor

# Define callback functions for mode selection
def set_all_mode():
    st.session_state.questions_mode = "all"
    st.session_state.current_question_idx = 0

def set_single_mode():
    st.session_state.questions_mode = "single"
    st.session_state.current_question_idx = 0

def clear_input_fields():
    # Clear any existing context input for the current question
    current_context_key = f"context_{st.session_state.current_question_idx}"
    if current_context_key in st.session_state:
        st.session_state[current_context_key] = ""
    
    # Clear any existing file upload for the current question    
    current_file_key = f"file_{st.session_state.current_question_idx}"
    if current_file_key in st.session_state:
        st.session_state[current_file_key] = None

def generate_document(answers):
    """Generate a Word document with RFP responses"""
    try:
        # Create Word document
        doc = Document()
        doc.add_heading("SMARTFILL AI - RFP Responses", 0)
        doc.add_paragraph(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        doc.add_paragraph(f"Total Questions: {len(answers)}")
        doc.add_paragraph()

        # Add each Q&A to document
        for q, a in answers.items():
            doc.add_heading("Question", level=2)
            doc.add_paragraph(q)
            doc.add_heading("Response", level=2)
            doc.add_paragraph(a)
            doc.add_paragraph()

        # Save to file
        import uuid
        filename = f"RFP_Responses_{uuid.uuid4().hex[:8]}.docx"
        doc.save(filename)
        st.session_state.current_doc_filename = filename
        
        return filename, None
    except Exception as e:
        return None, str(e)

# Sidebar for document processing
with st.sidebar:
    st.title("📂 Upload Training Documents")
    
    training_files = st.file_uploader(
        "Upload your training documents",
        type=["pdf", "xlsx", "docx", "csv"],
        accept_multiple_files=True,
        help="Upload any PDF, Excel, Word, or CSV files for training"
    )
    
    if st.button("Process Documents"):
        if training_files:
            status = st.empty()
            progress_text = st.empty()
            progress_bar = st.progress(0)
            total_files = len(training_files)
            
            for i, file in enumerate(training_files):
                try:
                    progress_text.text(f"Processing: {file.name}")
                    
                    # Handle Excel files specially for Q&A pairs if they match the expected format
                    if file.name.endswith('.xlsx'):
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
                            tmp.write(file.read())
                            # Try to process as Q&A pairs first
                            try:
                                rfp_processor.load_training_qa_pairs(tmp.name)
                                st.info(f"✅ Processed Q&A pairs from {file.name}")
                            except Exception as e:
                                # If Q&A processing fails, process as regular document
                                chunks_added = rag.add_document(file)
                                st.info(f"✅ Processed {file.name} as regular document")
                            os.remove(tmp.name)
                    else:
                        # Process all other document types
                        chunks_added = rag.add_document(file)
                        progress_text.text(f"✅ Added {chunks_added} chunks from {file.name}")
                    
                except Exception as e:
                    progress_text.text(f"❌ Error processing {file.name}: {str(e)}")
                    time.sleep(2)
                
                progress_bar.progress((i + 1) / total_files)
                time.sleep(0.5)
            
            progress_bar.empty()
            progress_text.empty()
            status.success("✅ All documents processed successfully")
            st.session_state.indexed = True
        else:
            st.warning("Please upload at least one document to process")

# Display success message if email was sent successfully
if st.session_state.email_success:
    st.success(st.session_state.email_success_message)
    # Reset the success flag after displaying the message
    time.sleep(3)
    st.session_state.email_success = False
    st.rerun()

# Main UI
st.title("🤖 SMARTFILL AI - RFP Assistant")

if st.session_state.indexed:
    st.markdown("### 📑 Upload RFP Document")
    rfp_file = st.file_uploader("Please Upload Files here", type=["xlsx"], key="rfp", help="Upload your RFP Excel file here")

    if rfp_file and st.button("Process RFP"):
        with st.spinner("Processing RFP..."):
            # Reset state for new RFP
            st.session_state.questions_mode = None
            st.session_state.current_question_idx = 0
            st.session_state.answers = {}
            st.session_state.document_generated = False
            st.session_state.email_form_visible = False
            
            # Process RFP
            answers, needs_context = rfp_processor.process_rfp(rfp_file, rag.db)
            st.session_state.answers = answers
            st.session_state.needs_context = needs_context

            # If there are no questions needing context, show success message
            if not needs_context:
                st.success("✅ All questions have been processed automatically!")
                st.session_state.show_final_button = True
            else:
                st.warning(f"⚠️ {len(needs_context)} questions need additional context")
                st.info("Please select how you would like to provide context for the questions:")

    # Show Get Final Responses button if appropriate
    if 'show_final_button' in st.session_state and st.session_state.show_final_button:
        if st.button("Get Final Responses", key="get_final_responses_auto"):
            try:
                with st.spinner("Generating final document..."):
                    filename, error = generate_document(st.session_state.answers)
                    if error:
                        st.error(f"❌ Failed to generate document: {error}")
                    else:
                        st.success("✅ Completed final question and responses generation!")
                        
                        # Create two columns for export and email options
                        col1, col2 = st.columns(2)
                        
                        with col1:
                            with open(filename, "rb") as file:
                                file_data = file.read()
                                st.download_button(
                                    label="📥 Export Responses as DOCX",
                                    data=file_data,
                                    file_name=filename,
                                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                )
                        
                        # The email button with on_click callback
                        with col2:
                            st.button("✉️ Send via Email", key="email_button_1", on_click=show_email_form)
            except Exception as e:
                st.error(f"❌ Failed to generate export: {str(e)}")

    # Question display mode selection
    if st.session_state.needs_context:
        col1, col2 = st.columns(2)
        with col1:
            st.checkbox("Show all questions at once", key="show_all", 
                       on_change=set_all_mode,
                       value=(st.session_state.questions_mode == "all"))
        with col2:
            st.checkbox("Show questions one by one", key="show_one",
                       on_change=set_single_mode,
                       value=(st.session_state.questions_mode == "single"))
        
        # Handle mode selection conflicts
        if st.session_state.get("show_all") and st.session_state.get("show_one"):
            st.error("Please select only one display mode")
            st.session_state.questions_mode = None
        
        # Display questions based on selected mode
        if st.session_state.questions_mode:
            unanswered = [q for q in st.session_state.needs_context if q not in st.session_state.answers]
            
            if unanswered:
                if st.session_state.questions_mode == "all":
                    st.markdown("### Questions Needing Additional Context")
                    question_containers = {}  # Store containers for each question
                    
                    for question in unanswered:
                        question_containers[question] = st.container()
                        with question_containers[question]:
                            st.markdown(f"**Q:** {question}")
                            col1, col2, col3 = st.columns([2, 1, 1])
                            with col1:
                                context = st.text_area("Provide additional context:", key=f"context_{question}")
                            with col2:
                                context_file = st.file_uploader(
                                    "Or upload a file with context", 
                                    key=f"file_{question}",
                                    label_visibility="collapsed"
                                )
                            with col3:
                                # Add Update Context button for each question
                                if st.button("Update Context", key=f"update_{question}"):
                                    if context.strip() or context_file:
                                        if context_file:
                                            chunks_added = rag.add_document(context_file)
                                            docs = rag.db.similarity_search(question, k=3)
                                            context = "\n\n".join([doc.page_content for doc in docs])
                                        
                                        response = rfp_processor.openai_client.chat.completions.create(
                                            model="gpt-4",
                                            messages=[
                                                {"role": "system", "content": "Generate a precise answer based on the provided context."},
                                                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
                                            ]
                                        )
                                        st.session_state.answers[question] = response.choices[0].message.content
                                        st.success("Answer updated successfully!")
                                        
                                        # Show preview of the answer
                                        st.markdown("**Generated Answer:**")
                                        st.markdown(st.session_state.answers[question])
                
                elif st.session_state.questions_mode == "single":
                    if st.session_state.current_question_idx < len(unanswered):
                        question = unanswered[st.session_state.current_question_idx]
                        st.markdown("### Current Question")
                        st.markdown(f"**Q:** {question}")
                        
                        # Add question counter
                        st.markdown(f"Question {st.session_state.current_question_idx + 1} of {len(unanswered)}")
                        
                        # Generate unique keys for each question's input fields
                        context_key = f"context_{st.session_state.current_question_idx}"
                        file_key = f"file_{st.session_state.current_question_idx}"
                        
                        col1, col2, col3 = st.columns([2, 1, 1])
                        with col1:
                            context = st.text_area("Provide additional context:", key=context_key)
                        with col2:
                            context_file = st.file_uploader(
                                "Or upload a file with context",
                                key=file_key,
                                label_visibility="collapsed"
                            )
                        with col3:
                            # Add Update Context button
                            if st.button("Update Context"):
                                if context.strip() or context_file:
                                    if context_file:
                                        chunks_added = rag.add_document(context_file)
                                        docs = rag.db.similarity_search(question, k=3)
                                        context = "\n\n".join([doc.page_content for doc in docs])
                                    
                                    # Generate answer without context validation
                                    response = rfp_processor.openai_client.chat.completions.create(
                                        model="gpt-4",
                                        messages=[
                                            {"role": "system", "content": "Generate a precise answer based on the provided context."},
                                            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
                                        ]
                                    )
                                    st.session_state.answers[question] = response.choices[0].message.content
                                    st.success("Answer updated successfully!")
                                    
                                    # Show preview of the answer
                                    st.markdown("**Generated Answer:**")
                                    st.markdown(st.session_state.answers[question])
                        
                        # Add navigation buttons in a new row
                        nav_col1, nav_col2, nav_col3 = st.columns([1, 1, 1])
                        with nav_col1:
                            if st.session_state.current_question_idx > 0:
                                if st.button("⬅️ Previous Question"):
                                    clear_input_fields()  # Clear current input fields
                                    st.session_state.current_question_idx -= 1
                                    st.rerun()
                        with nav_col3:
                            if st.session_state.current_question_idx < len(unanswered) - 1:
                                if st.button("Next Question ➡️"):
                                    clear_input_fields()  # Clear current input fields
                                    st.session_state.current_question_idx += 1
                                    st.rerun()
                        
                        # Only show the current question's answer if it exists
                        if question in st.session_state.answers:
                            st.markdown("**Current Answer:**")
                            st.markdown(st.session_state.answers[question])
                    else:
                        st.success("✅ All questions have been processed!")
            else:
                st.success("✅ All questions have been processed!")
            
            # Show Get Final Responses button only when appropriate
            if not st.session_state.needs_context or not unanswered:
                st.markdown("---")
                if st.button("Get Final Responses", key="get_final_responses"):
                    try:
                        with st.spinner("Generating final document..."):
                            filename, error = generate_document(st.session_state.answers)
                            if error:
                                st.error(f"❌ Failed to generate document: {error}")
                            else:
                                st.success("✅ Completed final question and responses generation!")
                                
                                # Create two columns for export and email options
                                col1, col2 = st.columns(2)
                                
                                with col1:
                                    with open(filename, "rb") as file:
                                        file_data = file.read()
                                        st.download_button(
                                            label="📥 Export Responses as DOCX",
                                            data=file_data,
                                            file_name=filename,
                                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        )
                                
                                # The email button uses the on_click parameter for the callback
                                with col2:
                                    st.button("✉️ Send via Email", key="email_button_2", on_click=show_email_form)
                    except Exception as e:
                        st.error(f"❌ Failed to generate export: {str(e)}")

# EMAIL FORM SECTION - This is a completely separate section at the end
# Only show if the email form should be visible
if st.session_state.email_form_visible and st.session_state.current_doc_filename:
    # Create a container with a border to make it stand out
    email_container = st.container()
    
    with email_container:
        st.markdown("""
        <style>
        .email-section {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin: 10px 0;
            background-color: #f8f9fa;
        }
        .success-message {
            background-color: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            text-align: center;
            font-weight: bold;
            animation: fadeIn 0.5s;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        </style>
        <div class="email-section">
        <h3>✉️ Send Document via Email</h3>
        </div>
        """, unsafe_allow_html=True)
        
        # Email input field
        recipient_email = st.text_input("Enter recipient's email address:", key="email_recipient_input")
        
        # Create columns for send and cancel buttons
        button_col1, button_col2, button_col3 = st.columns([1, 1, 2])
        
        with button_col1:
            if st.button("📨 Send Email", key="send_email_btn"):
                if recipient_email:
                    with st.spinner("Sending email..."):
                        success, message = send_email_now(
                            recipient=recipient_email,
                            filename=st.session_state.current_doc_filename
                        )
                        
                        if success:
                            # Display a beautiful success message
                            st.markdown(f"""
                            <div class="success-message">
                                <div>✅ Document successfully delivered to {recipient_email}!</div>
                                <div style="font-size: 0.9em; margin-top: 5px;">The recipient will receive the document shortly.</div>
                            </div>
                            """, unsafe_allow_html=True)
                            
                            # Set the success state and schedule the form to hide
                            st.session_state.email_success = True
                            st.session_state.email_success_message = f"✅ Document successfully delivered to {recipient_email}!"
                            st.session_state.email_form_visible = False
                            st.rerun()
                        else:
                            st.error(f"❌ Failed to send email: {message}")
                else:
                    st.warning("⚠️ Please enter a recipient email address")
                    
        with button_col2:
            if st.button("❌ Cancel", key="cancel_email_btn"):
                st.session_state.email_form_visible = False
                st.rerun()