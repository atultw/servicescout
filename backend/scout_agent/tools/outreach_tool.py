import os
import httpx
from typing import Optional
from google.adk.tools.tool_context import ToolContext
from google.cloud import firestore
from pydantic import BaseModel
import asyncio
import json
from google.genai import types

# Initialize Firestore client
db = firestore.Client()

class CallPlacedResult(BaseModel):
    message: str
    call_id: Optional[str] = None

async def initiate_outcall(phone_number: str, biz_name: str, biz_description: str, desired_outcome: str, user_context: str, tool_context: ToolContext) -> CallPlacedResult:
    """Initiates an outreach call to a business. DON'T CALL THIS TOOL MULTIPLE TIMES. ONLY ONCE. YOU MUST HAVE ANSWERS TO ALL ANTICIPATED QUESTIONS BEFORE CALLING THIS TOOL. 

    Args:
        phone_number: The phone number of the business to call.
        biz_name: The name of the business.
        biz_description: A description of the business.
        desired_outcome: The desired outcome of the call including any details we should collect from the business.
        user_context: A profile of the user and their needs. This should include answers to ALL anticipated questions from the business.
        tool_context: The context of the tool, containing session and state information.

    Returns:
        A confirmation message indicating that the call was initiated.
    """
    server_url = os.environ.get("PHONE_AGENT_SERVER_HOST")
    if not server_url:
        return "Error: PHONE_AGENT_SERVER_HOST environment variable is not set."

    try:
        with httpx.Client() as client:

            response = client.post(
                f"https://{server_url}/dialer/initiate_call",
                params={"initiator_user_id": tool_context.session.user_id, "phone_number": phone_number, "outcome": desired_outcome, "server_url": server_url, "biz_name": biz_name, "biz_description": biz_description, "lat": 0, "lng": 0, "session_id": tool_context.session.id, "user_context": user_context},
            )

            # get call ID from response
            response_data = response.json()
            call_id = response_data.get("call_id")
            tool_context.state["placed_call_id"] = call_id

            print(f"Initiated call to {biz_name} with call ID: {call_id}")

            return CallPlacedResult(message=f"Successfully called {biz_name}. We will have the result shortly.", call_id=call_id)

    except httpx.RequestError as e:
        print(e)
        return CallPlacedResult(message=f"An error occurred while trying to initiate the call: {e}", call_id=None)
    except Exception as e:
        print(e)
        return CallPlacedResult(message=f"An unexpected error occurred: {e}", call_id=None)
