# import streamlit as st
# import os
# import sys
# import time
# import tempfile
# from docx import Document

# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# from backend.rag_engine import RAGEngine
# from backend.rfp_processor import RFPProcessor

# st.set_page_config(page_title="SMARTFILL AI", layout="wide")

# # Add this at the top with other callback functions
# def show_email_form():
#     st.session_state.email_stage = "input"
#     st.session_state.recipient_email = ""  # Reset email input

# def hide_email_form():
#     st.session_state.email_stage = "hidden"

# # Add email handling function at the top level
# def handle_email_section(col, filename):
#     # Initialize state
#     if 'email_stage' not in st.session_state:
#         st.session_state.email_stage = "hidden"
#     if 'email_input' not in st.session_state:
#         st.session_state.email_input = ""

#     # Capture click explicitly and update session state
#     send_clicked = col.button("✉️ Send via Email", key="email_trigger_btn")

#     if send_clicked:
#         st.session_state.email_stage = "input"

#     # Show email form
#     if st.session_state.email_stage == "input":
#         col.markdown("#### ✉️ Email Export")
#         st.session_state.email_input = col.text_input(
#             "📧 Enter recipient's email",
#             value=st.session_state.email_input,
#             key="email_input_text"
#         )

#         send_col1, send_col2 = col.columns([1, 3])
#         with send_col1:
#             if send_col1.button("📨 Send Email Now"):
#                 if st.session_state.email_input.strip():
#                     try:
#                         from backend.utils import send_email
#                         success, message = send_email(
#                             recipient_email=st.session_state.email_input,
#                             subject="SMARTFILL AI - RFP Responses",
#                             body="Attached are the SMARTFILL AI generated RFP responses.",
#                             attachment_path=filename
#                         )
#                         if success:
#                             col.success("✅ Email sent successfully!")
#                             st.session_state.email_stage = "hidden"
#                             st.session_state.email_input = ""
#                         else:
#                             col.error(f"❌ Failed to send email: {message}")
#                     except Exception as e:
#                         col.error(f"❌ Error sending email: {str(e)}")
#                 else:
#                     col.warning("⚠️ Please enter a valid recipient email address")

#         with send_col2:
#             if send_col2.button("❌ Cancel"):
#                 st.session_state.email_stage = "hidden"
#                 st.session_state.email_input = ""

# # Initialize session state
# if 'rag' not in st.session_state:
#     st.session_state.rag = RAGEngine(layout_aware=True)
# if 'rfp_processor' not in st.session_state:
#     st.session_state.rfp_processor = RFPProcessor()
# if 'chat_history' not in st.session_state:
#     st.session_state.chat_history = []
# if 'indexed' not in st.session_state:
#     st.session_state.indexed = False
# if 'needs_context' not in st.session_state:
#     st.session_state.needs_context = []
# if 'answers' not in st.session_state:
#     st.session_state.answers = {}
# if 'current_question_idx' not in st.session_state:
#     st.session_state.current_question_idx = 0
# if 'questions_mode' not in st.session_state:
#     st.session_state.questions_mode = None
# if 'export_status' not in st.session_state:
#     st.session_state.export_status = {
#         'ready': False,
#         'filename': None,
#         'error': None
#     }
# if 'document_generated' not in st.session_state:
#     st.session_state.document_generated = False
# if 'email_stage' not in st.session_state:
#     st.session_state.email_stage = "hidden"
# if 'recipient_email' not in st.session_state:
#     st.session_state.recipient_email = ""

# rag = st.session_state.rag
# rfp_processor = st.session_state.rfp_processor

# # Define callback functions for mode selection
# def set_all_mode():
#     st.session_state.questions_mode = "all"
#     st.session_state.current_question_idx = 0

# def set_single_mode():
#     st.session_state.questions_mode = "single"
#     st.session_state.current_question_idx = 0

# def clear_input_fields():
#     # Clear any existing context input for the current question
#     current_context_key = f"context_{st.session_state.current_question_idx}"
#     if current_context_key in st.session_state:
#         st.session_state[current_context_key] = ""

#     # Clear any existing file upload for the current question
#     current_file_key = f"file_{st.session_state.current_question_idx}"
#     if current_file_key in st.session_state:
#         st.session_state[current_file_key] = None

# def show_export_button():
#     try:
#         # Debug state information
#         print("Debug - Export Status:", st.session_state.export_status)
#         st.write("Debug - Export Status:", st.session_state.export_status)

#         if st.session_state.export_status['ready'] and st.session_state.export_status['filename']:
#             try:
#                 # Verify file exists before creating the export UI
#                 if not os.path.exists(st.session_state.export_status['filename']):
#                     st.error(f"Export file not found: {st.session_state.export_status['filename']}")
#                     print(f"Debug - File not found: {st.session_state.export_status['filename']}")
#                     return

#                 file_size = os.path.getsize(st.session_state.export_status['filename'])
#                 print(f"Debug - File size: {file_size} bytes")

#                 # Create a container for the export button
#                 export_container = st.container()
#                 with export_container:
#                     st.markdown("""
#                         <style>
#                         .download-button {
#                             text-align: center;
#                             padding: 20px;
#                             background-color: #f0f2f6;
#                             border-radius: 10px;
#                             margin: 20px 0;
#                         }
#                         </style>
#                         <div class="download-button">
#                             <h3>Your document is ready for download!</h3>
#                         </div>
#                         """, unsafe_allow_html=True)

#                     try:
#                         # Show export button with the file
#                         with open(st.session_state.export_status['filename'], "rb") as file:
#                             file_data = file.read()
#                             if len(file_data) > 0:  # Verify file is not empty
#                                 st.download_button(
#                                     label="📥 Export Response Document",
#                                     data=file_data,
#                                     file_name=os.path.basename(st.session_state.export_status['filename']),
#                                     mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
#                                     key="download_button"
#                                 )
#                                 print("Debug - Download button created successfully")

#                                 # Add a status message to confirm document is saved
#                                 st.info(f"💾 Document saved as: {st.session_state.export_status['filename']}")
#                             else:
#                                 st.error("Generated document is empty")
#                                 print("Debug - Generated document is empty")
#                     except Exception as file_e:
#                         st.error(f"Error reading the file: {str(file_e)}")
#                         print(f"Debug - File reading error: {str(file_e)}")

#             except Exception as ui_e:
#                 st.error(f"Error creating export UI: {str(ui_e)}")
#                 print(f"Debug - UI creation error: {str(ui_e)}")

#     except Exception as e:
#         st.error(f"Error in export functionality: {str(e)}")
#         print(f"Debug - Export error: {str(e)}")
#         # Reset export status on error
#         st.session_state.export_status['ready'] = False
#         st.session_state.export_status['filename'] = None
#         st.session_state.export_status['error'] = str(e)

# # Sidebar for document processing
# with st.sidebar:
#     st.title("📂 Upload Training Documents")

#     pdf_files = st.file_uploader("Please Upload Files here", type=["pdf"], accept_multiple_files=True, key="pdf_upload", help="Upload your PDF files here")
#     excel_files = st.file_uploader("Please Upload Files here", type=["xlsx"], accept_multiple_files=True, key="excel_upload", help="Upload your Excel files here")
#     other_files = st.file_uploader("Please Upload Files here", type=["docx", "csv"], accept_multiple_files=True, key="other_upload", help="Upload your DOCX/CSV files here")

#     if st.button("Process Documents"):
#         all_files = []
#         if pdf_files:
#             all_files.extend(pdf_files)
#         if excel_files:
#             all_files.extend(excel_files)
#             # Process Q&A pairs with progress bar
#             progress_bar = st.progress(0)
#             for i, f in enumerate(excel_files):
#                 with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
#                     tmp.write(f.read())
#                     st.info(f"Processing Q&A pairs from {f.name}...")
#                     rfp_processor.load_training_qa_pairs(tmp.name)
#                     os.remove(tmp.name)
#                 progress_bar.progress((i + 1) / len(excel_files))
#             progress_bar.empty()
#         if other_files:
#             all_files.extend(other_files)

#         if all_files:
#             status = st.empty()
#             progress_text = st.empty()
#             progress_bar = st.progress(0)

#             for i, f in enumerate(all_files):
#                 progress_text.text(f"Processing: {f.name}")
#                 chunks_added = rag.add_document(f)
#                 progress_text.text(f"✅ Added {chunks_added} chunks from {f.name}")
#                 progress_bar.progress((i + 1) / len(all_files))
#                 time.sleep(0.5)

#             progress_bar.empty()
#             progress_text.empty()
#             status.success("✅ All documents processed successfully")
#             st.session_state.indexed = True
#         else:
#             st.warning("Please upload at least one document to process")

# # Main UI
# st.title("🤖 SMARTFILL AI - RFP Assistant")

# if st.session_state.indexed:
#     st.markdown("### 📑 Upload RFP Document")
#     rfp_file = st.file_uploader("Please Upload Files here", type=["xlsx"], key="rfp", help="Upload your RFP Excel file here")

#     if rfp_file and st.button("Process RFP"):
#         with st.spinner("Processing RFP..."):
#             # Reset state for new RFP
#             st.session_state.questions_mode = None
#             st.session_state.current_question_idx = 0
#             st.session_state.answers = {}
#             st.session_state.document_generated = False

#             # Process RFP
#             answers, needs_context = rfp_processor.process_rfp(rfp_file, rag.db)
#             st.session_state.answers = answers
#             st.session_state.needs_context = needs_context

#             # If there are no questions needing context, show success message
#             if not needs_context:
#                 st.success("✅ All questions have been processed automatically!")
#                 st.session_state.show_final_button = True
#             else:
#                 st.warning(f"⚠️ {len(needs_context)} questions need additional context")
#                 st.info("Please select how you would like to provide context for the questions:")

#     # Show Get Final Responses button if appropriate
#     if 'show_final_button' in st.session_state and st.session_state.show_final_button:
#         if st.button("Get Final Responses", key="get_final_responses_auto"):
#             try:
#                 with st.spinner("Generating final document..."):
#                     # Create Word document
#                     doc = Document()
#                     doc.add_heading("SMARTFILL AI - RFP Responses", 0)
#                     doc.add_paragraph(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
#                     doc.add_paragraph(f"Total Questions: {len(st.session_state.answers)}")
#                     doc.add_paragraph()

#                     # Add each Q&A to document
#                     for q, a in st.session_state.answers.items():
#                         doc.add_heading("Question", level=2)
#                         doc.add_paragraph(q)
#                         doc.add_heading("Response", level=2)
#                         doc.add_paragraph(a)
#                         doc.add_paragraph()

#                     # Save to file
#                     import uuid
#                     filename = f"RFP_Responses_{uuid.uuid4().hex[:8]}.docx"
#                     doc.save(filename)

#                 st.success("✅ Completed final question and responses generation!")

#                 # Create two columns for export and mail buttons
#                 col1, col2 = st.columns(2)

#                 with col1:
#                     with open(filename, "rb") as file:
#                         file_data = file.read()
#                         st.download_button(
#                             label="📥 Export Responses as DOCX",
#                             data=file_data,
#                             file_name=filename,
#                             mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
#                         )

#                 # After showing export button in col1
#                 with col2:
#                     # Initialize email state
#                     if 'email_stage' not in st.session_state:
#                         st.session_state.email_stage = "hidden"
#                     if 'email_input' not in st.session_state:
#                         st.session_state.email_input = ""

#                     # --- SHOW MAIN BUTTON ---
#                     if st.session_state.email_stage == "hidden":
#                         if st.button("✉️ Send via Email"):
#                             st.session_state.email_stage = "input"
#                             st.rerun()

#                     # --- SHOW EMAIL INPUT & ACTIONS ---
#                     if st.session_state.email_stage == "input":
#                         st.markdown("#### ✉️ Email Export Section")

#                         st.session_state.email_input = st.text_input("📧 Enter recipient's email", value=st.session_state.email_input)

#                         send_col1, send_col2 = st.columns([1, 3])

#                         with send_col1:
#                             if st.button("📨 Send Email Now"):
#                                 if st.session_state.email_input.strip():
#                                     try:
#                                         from backend.utils import send_email
#                                         success, message = send_email(
#                                             recipient_email=st.session_state.email_input,
#                                             subject="SMARTFILL AI - RFP Responses",
#                                             body="Attached are the SMARTFILL AI generated RFP responses.",
#                                             attachment_path=filename
#                                         )
#                                         if success:
#                                             st.success("✅ Email sent successfully!")
#                                             st.session_state.email_stage = "hidden"
#                                             st.session_state.email_input = ""
#                                             st.rerun()
#                                         else:
#                                             st.error(f"❌ Failed to send email: {message}")
#                                     except Exception as e:
#                                         st.error(f"❌ Error sending email: {str(e)}")
#                                 else:
#                                     st.warning("⚠️ Please enter a valid email address")

#                         with send_col2:
#                             if st.button("❌ Cancel"):
#                                 st.session_state.email_stage = "hidden"
#                                 st.session_state.email_input = ""
#                                 st.rerun()

#             except Exception as e:
#                 st.error(f"❌ Failed to generate export: {str(e)}")
#                 st.write("Debug - Exception details:", e)

#     # Question display mode selection
#     if st.session_state.needs_context:
#         col1, col2 = st.columns(2)
#         with col1:
#             st.checkbox("Show all questions at once", key="show_all",
#                        on_change=set_all_mode,
#                        value=(st.session_state.questions_mode == "all"))
#         with col2:
#             st.checkbox("Show questions one by one", key="show_one",
#                        on_change=set_single_mode,
#                        value=(st.session_state.questions_mode == "single"))

#         # Handle mode selection conflicts
#         if st.session_state.get("show_all") and st.session_state.get("show_one"):
#             st.error("Please select only one display mode")
#             st.session_state.questions_mode = None

#         # Display questions based on selected mode
#         if st.session_state.questions_mode:
#             unanswered = [q for q in st.session_state.needs_context if q not in st.session_state.answers]

#             if unanswered:
#                 if st.session_state.questions_mode == "all":
#                     st.markdown("### Questions Needing Additional Context")
#                     question_containers = {}  # Store containers for each question

#                     for question in unanswered:
#                         question_containers[question] = st.container()
#                         with question_containers[question]:
#                             st.markdown(f"**Q:** {question}")
#                             col1, col2, col3 = st.columns([2, 1, 1])
#                             with col1:
#                                 context = st.text_area("Provide additional context:", key=f"context_{question}")
#                             with col2:
#                                 context_file = st.file_uploader(
#                                     "Or upload a file with context",
#                                     key=f"file_{question}",
#                                     label_visibility="collapsed"
#                                 )
#                             with col3:
#                                 # Add Update Context button for each question
#                                 if st.button("Update Context", key=f"update_{question}"):
#                                     if context.strip() or context_file:
#                                         if context_file:
#                                             chunks_added = rag.add_document(context_file)
#                                             docs = rag.db.similarity_search(question, k=3)
#                                             context = "\n\n".join([doc.page_content for doc in docs])

#                                         response = rfp_processor.openai_client.chat.completions.create(
#                                             model="gpt-4",
#                                             messages=[
#                                                 {"role": "system", "content": "Generate a precise answer based on the provided context."},
#                                                 {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
#                                             ]
#                                         )
#                                         st.session_state.answers[question] = response.choices[0].message.content
#                                         st.success("Answer updated successfully!")

#                                         # Show preview of the answer
#                                         st.markdown("**Generated Answer:**")
#                                         st.markdown(st.session_state.answers[question])

#                 elif st.session_state.questions_mode == "single":
#                     if st.session_state.current_question_idx < len(unanswered):
#                         question = unanswered[st.session_state.current_question_idx]
#                         st.markdown("### Current Question")
#                         st.markdown(f"**Q:** {question}")

#                         # Add question counter
#                         st.markdown(f"Question {st.session_state.current_question_idx + 1} of {len(unanswered)}")

#                         # Generate unique keys for each question's input fields
#                         context_key = f"context_{st.session_state.current_question_idx}"
#                         file_key = f"file_{st.session_state.current_question_idx}"

#                         col1, col2, col3 = st.columns([2, 1, 1])
#                         with col1:
#                             context = st.text_area("Provide additional context:", key=context_key)
#                         with col2:
#                             context_file = st.file_uploader(
#                                 "Or upload a file with context",
#                                 key=file_key,
#                                 label_visibility="collapsed"
#                             )
#                         with col3:
#                             # Add Update Context button
#                             if st.button("Update Context"):
#                                 if context.strip() or context_file:
#                                     if context_file:
#                                         chunks_added = rag.add_document(context_file)
#                                         docs = rag.db.similarity_search(question, k=3)
#                                         context = "\n\n".join([doc.page_content for doc in docs])

#                                     # Generate answer without context validation
#                                     response = rfp_processor.openai_client.chat.completions.create(
#                                         model="gpt-4",
#                                         messages=[
#                                             {"role": "system", "content": "Generate a precise answer based on the provided context."},
#                                             {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
#                                         ]
#                                     )
#                                     st.session_state.answers[question] = response.choices[0].message.content
#                                     st.success("Answer updated successfully!")

#                                     # Show preview of the answer
#                                     st.markdown("**Generated Answer:**")
#                                     st.markdown(st.session_state.answers[question])

#                         # Add navigation buttons in a new row
#                         nav_col1, nav_col2, nav_col3 = st.columns([1, 1, 1])
#                         with nav_col1:
#                             if st.session_state.current_question_idx > 0:
#                                 if st.button("⬅️ Previous Question"):
#                                     clear_input_fields()  # Clear current input fields
#                                     st.session_state.current_question_idx -= 1
#                                     st.rerun()
#                         with nav_col3:
#                             if st.session_state.current_question_idx < len(unanswered) - 1:
#                                 if st.button("Next Question ➡️"):
#                                     clear_input_fields()  # Clear current input fields
#                                     st.session_state.current_question_idx += 1
#                                     st.rerun()

#                         # Only show the current question's answer if it exists
#                         if question in st.session_state.answers:
#                             st.markdown("**Current Answer:**")
#                             st.markdown(st.session_state.answers[question])
#                     else:
#                         st.success("✅ All questions have been processed!")
#             else:
#                 st.success("✅ All questions have been processed!")

#             # Show Get Final Responses button only when appropriate
#             if not st.session_state.needs_context or not unanswered:
#                 st.markdown("---")
#                 if st.button("Get Final Responses", key="get_final_responses"):
#                     try:
#                         with st.spinner("Generating final document..."):
#                             # Create Word document
#                             doc = Document()
#                             doc.add_heading("SMARTFILL AI - RFP Responses", 0)
#                             doc.add_paragraph(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
#                             doc.add_paragraph(f"Total Questions: {len(st.session_state.answers)}")
#                             doc.add_paragraph()

#                             # Add each Q&A to document
#                             for q, a in st.session_state.answers.items():
#                                 doc.add_heading("Question", level=2)
#                                 doc.add_paragraph(q)
#                                 doc.add_heading("Response", level=2)
#                                 doc.add_paragraph(a)
#                                 doc.add_paragraph()

#                             # Save to file
#                             import uuid
#                             filename = f"RFP_Responses_{uuid.uuid4().hex[:8]}.docx"
#                             doc.save(filename)

#                         st.success("✅ Completed final question and responses generation!")

#                         # Create two columns for export and mail buttons
#                         col1, col2 = st.columns(2)

#                         with col1:
#                             with open(filename, "rb") as file:
#                                 file_data = file.read()
#                                 st.download_button(
#                                     label="📥 Export Responses as DOCX",
#                                     data=file_data,
#                                     file_name=filename,
#                                     mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
#                                 )

#                         # After showing export button in col1
#                         with col2:
#                             # Initialize email state
#                             if 'email_stage' not in st.session_state:
#                                 st.session_state.email_stage = "hidden"
#                             if 'email_input' not in st.session_state:
#                                 st.session_state.email_input = ""

#                             # --- SHOW MAIN BUTTON ---
#                             if st.session_state.email_stage == "hidden":
#                                 if st.button("✉️ Send via Email"):
#                                     st.session_state.email_stage = "input"
#                                     st.rerun()

#                             # --- SHOW EMAIL INPUT & ACTIONS ---
#                             if st.session_state.email_stage == "input":
#                                 st.markdown("#### ✉️ Email Export Section")

#                                 st.session_state.email_input = st.text_input("📧 Enter recipient's email", value=st.session_state.email_input)

#                                 send_col1, send_col2 = st.columns([1, 3])

#                                 with send_col1:
#                                     if st.button("📨 Send Email Now"):
#                                         if st.session_state.email_input.strip():
#                                             try:
#                                                 from backend.utils import send_email
#                                                 success, message = send_email(
#                                                     recipient_email=st.session_state.email_input,
#                                                     subject="SMARTFILL AI - RFP Responses",
#                                                     body="Attached are the SMARTFILL AI generated RFP responses.",
#                                                     attachment_path=filename
#                                                 )
#                                                 if success:
#                                                     st.success("✅ Email sent successfully!")
#                                                     st.session_state.email_stage = "hidden"
#                                                     st.session_state.email_input = ""
#                                                     st.rerun()
#                                                 else:
#                                                     st.error(f"❌ Failed to send email: {message}")
#                                             except Exception as e:
#                                                 st.error(f"❌ Error sending email: {str(e)}")
#                                         else:
#                                             st.warning("⚠️ Please enter a valid email address")

#                                 with send_col2:
#                                     if st.button("❌ Cancel"):
#                                         st.session_state.email_stage = "hidden"
#                                         st.session_state.email_input = ""
#                                         st.rerun()

#                     except Exception as e:
#                         st.error(f"❌ Failed to generate export: {str(e)}")
#                         st.write("Debug - Exception details:", e)

# import streamlit as st
# import os
# import sys
# import time
# import tempfile
# from docx import Document

# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# from backend.rag_engine import RAGEngine
# from backend.rfp_processor import RFPProcessor

# st.set_page_config(page_title="SMARTFILL AI", layout="wide")

# # Initialize session state
# if 'rag' not in st.session_state:
#     st.session_state.rag = RAGEngine(layout_aware=True)
# if 'rfp_processor' not in st.session_state:
#     st.session_state.rfp_processor = RFPProcessor()
# if 'chat_history' not in st.session_state:
#     st.session_state.chat_history = []
# if 'indexed' not in st.session_state:
#     st.session_state.indexed = False
# if 'needs_context' not in st.session_state:
#     st.session_state.needs_context = []
# if 'answers' not in st.session_state:
#     st.session_state.answers = {}
# if 'current_question_idx' not in st.session_state:
#     st.session_state.current_question_idx = 0
# if 'questions_mode' not in st.session_state:
#     st.session_state.questions_mode = None
# if 'export_status' not in st.session_state:
#     st.session_state.export_status = {
#         'ready': False,
#         'filename': None,
#         'error': None
#     }
# if 'document_generated' not in st.session_state:
#     st.session_state.document_generated = False

# # Critical fix: Initialize proper email state variables
# if 'email_form_visible' not in st.session_state:
#     st.session_state.email_form_visible = False
# if 'email_recipient' not in st.session_state:
#     st.session_state.email_recipient = ""
# if 'current_doc_filename' not in st.session_state:
#     st.session_state.current_doc_filename = None

# # Define callbacks for email functionality
# def show_email_form():
#     st.session_state.email_form_visible = True

# def hide_email_form():
#     st.session_state.email_form_visible = False

# def send_email_now(recipient, filename):
#     if recipient.strip():
#         try:
#             from backend.utils import send_email
#             success, message = send_email(
#                 recipient_email=recipient,
#                 subject="SMARTFILL AI - RFP Responses",
#                 body="Attached are the SMARTFILL AI generated RFP responses.",
#                 attachment_path=filename
#             )
#             return success, message
#         except Exception as e:
#             return False, str(e)
#     else:
#         return False, "Please enter a valid email address"

# rag = st.session_state.rag
# rfp_processor = st.session_state.rfp_processor

# # Define callback functions for mode selection
# def set_all_mode():
#     st.session_state.questions_mode = "all"
#     st.session_state.current_question_idx = 0

# def set_single_mode():
#     st.session_state.questions_mode = "single"
#     st.session_state.current_question_idx = 0

# def clear_input_fields():
#     # Clear any existing context input for the current question
#     current_context_key = f"context_{st.session_state.current_question_idx}"
#     if current_context_key in st.session_state:
#         st.session_state[current_context_key] = ""

#     # Clear any existing file upload for the current question
#     current_file_key = f"file_{st.session_state.current_question_idx}"
#     if current_file_key in st.session_state:
#         st.session_state[current_file_key] = None

# def generate_document(answers):
#     """Generate a Word document with RFP responses"""
#     try:
#         # Create Word document
#         doc = Document()
#         doc.add_heading("SMARTFILL AI - RFP Responses", 0)
#         doc.add_paragraph(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
#         doc.add_paragraph(f"Total Questions: {len(answers)}")
#         doc.add_paragraph()

#         # Add each Q&A to document
#         for q, a in answers.items():
#             doc.add_heading("Question", level=2)
#             doc.add_paragraph(q)
#             doc.add_heading("Response", level=2)
#             doc.add_paragraph(a)
#             doc.add_paragraph()

#         # Save to file
#         import uuid
#         filename = f"RFP_Responses_{uuid.uuid4().hex[:8]}.docx"
#         doc.save(filename)
#         st.session_state.current_doc_filename = filename

#         return filename, None
#     except Exception as e:
#         return None, str(e)

# # Sidebar for document processing
# with st.sidebar:
#     st.title("📂 Upload Training Documents")

#     pdf_files = st.file_uploader("Please Upload Files here", type=["pdf"], accept_multiple_files=True, key="pdf_upload", help="Upload your PDF files here")
#     excel_files = st.file_uploader("Please Upload Files here", type=["xlsx"], accept_multiple_files=True, key="excel_upload", help="Upload your Excel files here")
#     other_files = st.file_uploader("Please Upload Files here", type=["docx", "csv"], accept_multiple_files=True, key="other_upload", help="Upload your DOCX/CSV files here")

#     if st.button("Process Documents"):
#         all_files = []
#         if pdf_files:
#             all_files.extend(pdf_files)
#         if excel_files:
#             all_files.extend(excel_files)
#             # Process Q&A pairs with progress bar
#             progress_bar = st.progress(0)
#             for i, f in enumerate(excel_files):
#                 with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
#                     tmp.write(f.read())
#                     st.info(f"Processing Q&A pairs from {f.name}...")
#                     rfp_processor.load_training_qa_pairs(tmp.name)
#                     os.remove(tmp.name)
#                 progress_bar.progress((i + 1) / len(excel_files))
#             progress_bar.empty()
#         if other_files:
#             all_files.extend(other_files)

#         if all_files:
#             status = st.empty()
#             progress_text = st.empty()
#             progress_bar = st.progress(0)

#             for i, f in enumerate(all_files):
#                 progress_text.text(f"Processing: {f.name}")
#                 chunks_added = rag.add_document(f)
#                 progress_text.text(f"✅ Added {chunks_added} chunks from {f.name}")
#                 progress_bar.progress((i + 1) / len(all_files))
#                 time.sleep(0.5)

#             progress_bar.empty()
#             progress_text.empty()
#             status.success("✅ All documents processed successfully")
#             st.session_state.indexed = True
#         else:
#             st.warning("Please upload at least one document to process")

# # Main UI
# st.title("🤖 SMARTFILL AI - RFP Assistant")

# if st.session_state.indexed:
#     st.markdown("### 📑 Upload RFP Document")
#     rfp_file = st.file_uploader("Please Upload Files here", type=["xlsx"], key="rfp", help="Upload your RFP Excel file here")

#     if rfp_file and st.button("Process RFP"):
#         with st.spinner("Processing RFP..."):
#             # Reset state for new RFP
#             st.session_state.questions_mode = None
#             st.session_state.current_question_idx = 0
#             st.session_state.answers = {}
#             st.session_state.document_generated = False
#             st.session_state.email_form_visible = False

#             # Process RFP
#             answers, needs_context = rfp_processor.process_rfp(rfp_file, rag.db)
#             st.session_state.answers = answers
#             st.session_state.needs_context = needs_context

#             # If there are no questions needing context, show success message
#             if not needs_context:
#                 st.success("✅ All questions have been processed automatically!")
#                 st.session_state.show_final_button = True
#             else:
#                 st.warning(f"⚠️ {len(needs_context)} questions need additional context")
#                 st.info("Please select how you would like to provide context for the questions:")

#     # Show Get Final Responses button if appropriate
#     if 'show_final_button' in st.session_state and st.session_state.show_final_button:
#         if st.button("Get Final Responses", key="get_final_responses_auto"):
#             try:
#                 with st.spinner("Generating final document..."):
#                     filename, error = generate_document(st.session_state.answers)
#                     if error:
#                         st.error(f"❌ Failed to generate document: {error}")
#                     else:
#                         st.success("✅ Completed final question and responses generation!")

#                         # Create two columns for export and email options
#                         col1, col2 = st.columns(2)

#                         with col1:
#                             with open(filename, "rb") as file:
#                                 file_data = file.read()
#                                 st.download_button(
#                                     label="📥 Export Responses as DOCX",
#                                     data=file_data,
#                                     file_name=filename,
#                                     mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
#                                 )

#                         # The email button with on_click callback
#                         with col2:
#                             st.button("✉️ Send via Email", key="email_button_1", on_click=show_email_form)
#             except Exception as e:
#                 st.error(f"❌ Failed to generate export: {str(e)}")

#     # Question display mode selection
#     if st.session_state.needs_context:
#         col1, col2 = st.columns(2)
#         with col1:
#             st.checkbox("Show all questions at once", key="show_all",
#                        on_change=set_all_mode,
#                        value=(st.session_state.questions_mode == "all"))
#         with col2:
#             st.checkbox("Show questions one by one", key="show_one",
#                        on_change=set_single_mode,
#                        value=(st.session_state.questions_mode == "single"))

#         # Handle mode selection conflicts
#         if st.session_state.get("show_all") and st.session_state.get("show_one"):
#             st.error("Please select only one display mode")
#             st.session_state.questions_mode = None

#         # Display questions based on selected mode
#         if st.session_state.questions_mode:
#             unanswered = [q for q in st.session_state.needs_context if q not in st.session_state.answers]

#             if unanswered:
#                 if st.session_state.questions_mode == "all":
#                     st.markdown("### Questions Needing Additional Context")
#                     question_containers = {}  # Store containers for each question

#                     for question in unanswered:
#                         question_containers[question] = st.container()
#                         with question_containers[question]:
#                             st.markdown(f"**Q:** {question}")
#                             col1, col2, col3 = st.columns([2, 1, 1])
#                             with col1:
#                                 context = st.text_area("Provide additional context:", key=f"context_{question}")
#                             with col2:
#                                 context_file = st.file_uploader(
#                                     "Or upload a file with context",
#                                     key=f"file_{question}",
#                                     label_visibility="collapsed"
#                                 )
#                             with col3:
#                                 # Add Update Context button for each question
#                                 if st.button("Update Context", key=f"update_{question}"):
#                                     if context.strip() or context_file:
#                                         if context_file:
#                                             chunks_added = rag.add_document(context_file)
#                                             docs = rag.db.similarity_search(question, k=3)
#                                             context = "\n\n".join([doc.page_content for doc in docs])

#                                         response = rfp_processor.openai_client.chat.completions.create(
#                                             model="gpt-4",
#                                             messages=[
#                                                 {"role": "system", "content": "Generate a precise answer based on the provided context."},
#                                                 {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
#                                             ]
#                                         )
#                                         st.session_state.answers[question] = response.choices[0].message.content
#                                         st.success("Answer updated successfully!")

#                                         # Show preview of the answer
#                                         st.markdown("**Generated Answer:**")
#                                         st.markdown(st.session_state.answers[question])

#                 elif st.session_state.questions_mode == "single":
#                     if st.session_state.current_question_idx < len(unanswered):
#                         question = unanswered[st.session_state.current_question_idx]
#                         st.markdown("### Current Question")
#                         st.markdown(f"**Q:** {question}")

#                         # Add question counter
#                         st.markdown(f"Question {st.session_state.current_question_idx + 1} of {len(unanswered)}")

#                         # Generate unique keys for each question's input fields
#                         context_key = f"context_{st.session_state.current_question_idx}"
#                         file_key = f"file_{st.session_state.current_question_idx}"

#                         col1, col2, col3 = st.columns([2, 1, 1])
#                         with col1:
#                             context = st.text_area("Provide additional context:", key=context_key)
#                         with col2:
#                             context_file = st.file_uploader(
#                                 "Or upload a file with context",
#                                 key=file_key,
#                                 label_visibility="collapsed"
#                             )
#                         with col3:
#                             # Add Update Context button
#                             if st.button("Update Context"):
#                                 if context.strip() or context_file:
#                                     if context_file:
#                                         chunks_added = rag.add_document(context_file)
#                                         docs = rag.db.similarity_search(question, k=3)
#                                         context = "\n\n".join([doc.page_content for doc in docs])

#                                     # Generate answer without context validation
#                                     response = rfp_processor.openai_client.chat.completions.create(
#                                         model="gpt-4",
#                                         messages=[
#                                             {"role": "system", "content": "Generate a precise answer based on the provided context."},
#                                             {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
#                                         ]
#                                     )
#                                     st.session_state.answers[question] = response.choices[0].message.content
#                                     st.success("Answer updated successfully!")

#                                     # Show preview of the answer
#                                     st.markdown("**Generated Answer:**")
#                                     st.markdown(st.session_state.answers[question])

#                         # Add navigation buttons in a new row
#                         nav_col1, nav_col2, nav_col3 = st.columns([1, 1, 1])
#                         with nav_col1:
#                             if st.session_state.current_question_idx > 0:
#                                 if st.button("⬅️ Previous Question"):
#                                     clear_input_fields()  # Clear current input fields
#                                     st.session_state.current_question_idx -= 1
#                                     st.rerun()
#                         with nav_col3:
#                             if st.session_state.current_question_idx < len(unanswered) - 1:
#                                 if st.button("Next Question ➡️"):
#                                     clear_input_fields()  # Clear current input fields
#                                     st.session_state.current_question_idx += 1
#                                     st.rerun()

#                         # Only show the current question's answer if it exists
#                         if question in st.session_state.answers:
#                             st.markdown("**Current Answer:**")
#                             st.markdown(st.session_state.answers[question])
#                     else:
#                         st.success("✅ All questions have been processed!")
#             else:
#                 st.success("✅ All questions have been processed!")

#             # Show Get Final Responses button only when appropriate
#             if not st.session_state.needs_context or not unanswered:
#                 st.markdown("---")
#                 if st.button("Get Final Responses", key="get_final_responses"):
#                     try:
#                         with st.spinner("Generating final document..."):
#                             filename, error = generate_document(st.session_state.answers)
#                             if error:
#                                 st.error(f"❌ Failed to generate document: {error}")
#                             else:
#                                 st.success("✅ Completed final question and responses generation!")

#                                 # Create two columns for export and email options
#                                 col1, col2 = st.columns(2)

#                                 with col1:
#                                     with open(filename, "rb") as file:
#                                         file_data = file.read()
#                                         st.download_button(
#                                             label="📥 Export Responses as DOCX",
#                                             data=file_data,
#                                             file_name=filename,
#                                             mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
#                                         )

#                                 # The email button uses the on_click parameter for the callback
#                                 with col2:
#                                     st.button("✉️ Send via Email", key="email_button_2", on_click=show_email_form)
#                     except Exception as e:
#                         st.error(f"❌ Failed to generate export: {str(e)}")

# # EMAIL FORM SECTION - This is a completely separate section at the end
# # Only show if the email form should be visible
# if st.session_state.email_form_visible and st.session_state.current_doc_filename:
#     # Create a container with a border to make it stand out
#     email_container = st.container()

#     with email_container:
#         st.markdown("""
#         <style>
#         .email-section {
#             border: 1px solid #ddd;
#             border-radius: 5px;
#             padding: 15px;
#             margin: 10px 0;
#             background-color: #f8f9fa;
#         }
#         </style>
#         <div class="email-section">
#         <h3>✉️ Send Document via Email</h3>
#         </div>
#         """, unsafe_allow_html=True)

#         # Email input field
#         recipient_email = st.text_input("Enter recipient's email address:", key="email_recipient_input")

#         # Create columns for send and cancel buttons
#         button_col1, button_col2, button_col3 = st.columns([1, 1, 2])

#         with button_col1:
#             if st.button("📨 Send Email", key="send_email_btn"):
#                 if recipient_email:
#                     with st.spinner("Sending email..."):
#                         success, message = send_email_now(
#                             recipient=recipient_email,
#                             filename=st.session_state.current_doc_filename
#                         )

#                         if success:
#                             st.success("✅ Email sent successfully!")
#                             # Hide the form after successful sending
#                             st.session_state.email_form_visible = False
#                             st.rerun()
#                         else:
#                             st.error(f"❌ Failed to send email: {message}")
#                 else:
#                     st.warning("⚠️ Please enter a recipient email address")

#         with button_col2:
#             if st.button("❌ Cancel", key="cancel_email_btn"):
#                 st.session_state.email_form_visible = False
#                 st.rerun()
