from google.adk.tools.tool_context import ToolContext
from google.cloud import firestore


def save_request_tool(
    new_summary: str, new_title: str, tool_context: ToolContext
) -> str:
    """Saves the user request to the context.

    Args:
        new_summary: The new summary of the user request.
        new_title: The new short (5 word max) title for the session.
        tool_context: The context of the tool, containing session and state information.
    """
    try:
        session_id = tool_context.session.id
        user_id = tool_context.session.user_id

        # Save the user request to the database
        db = firestore.Client()
        doc_ref = db.collection("sessions").document(session_id)
        doc_ref.update(
            {"request_summary": new_summary, "user_id": user_id, "title": new_title}
        )
        print(f"Saving user request: {new_summary}")    
    finally:
        return "User request saved."