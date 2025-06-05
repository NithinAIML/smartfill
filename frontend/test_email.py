import streamlit as st

st.title("📧 Email Export Test")

# --- INIT STATE ---
if "email_stage" not in st.session_state:
    st.session_state.email_stage = "hidden"
if "email_input" not in st.session_state:
    st.session_state.email_input = ""

# --- SHOW MAIN BUTTON ---
if st.session_state.email_stage == "hidden":
    if st.button("✉️ Send via Email"):
        st.session_state.email_stage = "input"

# --- SHOW EMAIL INPUT & ACTIONS ---
if st.session_state.email_stage == "input":
    st.markdown("#### ✉️ Email Export Section")

    st.session_state.email_input = st.text_input(
        "📧 Enter recipient's email", value=st.session_state.email_input
    )

    col1, col2 = st.columns([1, 3])

    with col1:
        if st.button("📨 Send Email Now"):
            if st.session_state.email_input.strip():
                st.success(f"✅ Email sent to: {st.session_state.email_input}")
                st.session_state.email_stage = "hidden"
                st.session_state.email_input = ""
            else:
                st.warning("⚠️ Please enter a valid email")

    with col2:
        if st.button("❌ Cancel"):
            st.session_state.email_stage = "hidden"
            st.session_state.email_input = ""
