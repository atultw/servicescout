from fastapi import Depends, FastAPI, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
import os
import asyncio
import warnings
import logging
from typing import Annotated, Optional, AsyncGenerator
import datetime
import base64
import json

import firebase_admin
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError

# ADK Core Imports
from google.adk.agents import LiveRequestQueue
from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig
from google.adk.sessions import InMemorySessionService
from google.adk.events import Event
# ADK Model & Type Imports
from google.genai import types
from google.cloud import firestore

# Agent imports
from agent import root_agent
from tools.outreach_tool import CallPlacedResult

# --- Configure Logging and Warnings ---
warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.ERROR)

from dotenv import load_dotenv
load_dotenv()

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    # cred = credentials.Certificate(service_account_file)
    firebase_admin.initialize_app()

# --- Firestore Client ---
db = firestore.Client()

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000"), "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ADK Agent Setup ---
runner: Optional[Runner] = None
session_service = None 
APP_NAME = "ServiceScout"

@app.on_event("startup")
async def startup_event():
    """Initializes the agent runner and session service on app startup."""
    global runner, session_service
    if not root_agent:
        print("\n❌ Root agent is not defined. Cannot initialize for FastAPI.")
        return
    session_service = InMemorySessionService()

    # session_service =  VertexAiSessionService(
    #     os.environ.get("GOOGLE_CLOUD_PROJECT"),
    #     os.environ.get("GOOGLE_CLOUD_LOCATION"),
    #     os.environ.get("VERTEX_AGENT_ENGINE_ID")
    # )
    
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service
    )
    print("✅ Agent Runner and Vertex AI Session Service initialized for FastAPI.")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except (FirebaseError, ValueError) as e:
        print(f"Error decoding token: {e}")
        raise credentials_exception

async def start_voice_agent_session(user_id: str, session_id: str, is_audio=True) -> tuple[AsyncGenerator[Event, None], LiveRequestQueue]:
    """Starts a voice agent session with the business booking agent"""
    if runner is None or session_service is None:
        raise HTTPException(status_code=500, detail="Agent not initialized.")
    
    # Get existing session or create if needed
    try:
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id
        )
        if not session:
            raise Exception("Session not found")

    except:
        print(f"Session {session_id} not found for user {user_id}, creating new session.")
        # If session doesn't exist, create it
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state={}
        )
    
    modality = "AUDIO" if is_audio else "TEXT"
    run_config = RunConfig(
        response_modalities=[modality],    
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig()
    )

    live_request_queue = LiveRequestQueue()
    live_events = runner.run_live(
        user_id=user_id,
        session_id=session_id,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue

async def agent_to_client_messaging(websocket: WebSocket, live_request_queue: LiveRequestQueue, live_events: AsyncGenerator[Event, None], session_id: str, user_id: str):
    """Agent to client communication for voice chat"""
    conversation_ended = False

    try:
        async for event in live_events:
            for r in event.get_function_responses():
                placed_call_id = None
                if isinstance(r.response.get('result'), CallPlacedResult):
                    placed_call_id = r.response.get('result').call_id
                if placed_call_id:
                    # IN BACKGROUND, POLL FIRESTORE TO CHECK FOR CALL OUTCOME UPDATES
                    async def poll_call_outcome():
                        while True:
                            await asyncio.sleep(5)  # Poll every 5 seconds
                            call_ref = db.collection("provider_conversations").document(placed_call_id)
                            call_doc = call_ref.get()
                            if call_doc.exists:
                                call_data = call_doc.to_dict()
                                outcome_summary = call_data.get("outcome_summary", "")
                                success = call_data.get("success", "")
                                call_data_processed = {
                                    "call_id": placed_call_id,
                                    "biz_name": call_data.get("biz_name", ""),
                                    "phone_number": call_data.get("phone_number", ""),
                                    "outcome_summary": outcome_summary,
                                    "success": success,
                                    "transcript": call_data.get("transcript", "")
                                }
                                if outcome_summary is not None and success is not None and len(outcome_summary) > 0:
                                    # Send update to live request queue
                                    print(f"Call outcome received for call ID {placed_call_id}: {outcome_summary}, success: {success}")
                                    live_request_queue.send_content(content=types.Content(
                                        role="user",
                                        parts=[types.Part.from_text(
                                            text=f"Call completed. Data: {json.dumps(call_data_processed)}. Tell the user about the outcome. If You absolutely need more information from the user, you may ask. Keep user engagement to a minimum and think autonomously. Act autonomously using tools to continue achieving the user's goal, placing further calls liberally. Always use the tools available such as initiate_outcall. "
                                        )]
                                    ))
                                    break
                    asyncio.create_task(poll_call_outcome())

            if event.input_transcription:
                # Send transcription to client
                message = {
                    "type": "transcription",
                    "role": "user",
                    "text": event.input_transcription.text
                }
                await websocket.send_text(json.dumps(message))

            if event.output_transcription:
                # Send transcription to client
                message = {
                    "type": "transcription",
                    "role": "agent", 
                    "text": event.output_transcription.text
                }
                await websocket.send_text(json.dumps(message))

            if event.turn_complete or event.interrupted:
                message = {
                    "type": "turn_complete" if event.turn_complete else "interrupted",
                }
                await websocket.send_text(json.dumps(message))
                print(f"Event: {message['type']}")
                
                # If interrupted, signal the client to stop current audio playbook
                if event.interrupted:
                    stop_message = {
                        "type": "stop_audio"
                    }
                    await websocket.send_text(json.dumps(stop_message))
                
                # Update session state with candidates after turn completion
                if event.turn_complete:
                    try:
                        session = await session_service.get_session(
                            app_name=APP_NAME,
                            user_id=user_id,
                            session_id=session_id
                        )

                        # placed_call_id = session.state.get("placed_call_id")
                        

                        candidates = session.state.get("formatted_businesses", {})

                        if candidates:
                            # Convert pydantic object to dict if necessary
                            if hasattr(candidates, 'model_dump'):
                                candidates_dict = candidates.model_dump()
                            elif hasattr(candidates, 'dict'):
                                candidates_dict = candidates.dict()
                            else:
                                candidates_dict = candidates
                            
                            candidates_message = {
                                "type": "candidates",
                                "candidates": candidates_dict
                            }
                            await websocket.send_text(json.dumps(candidates_message))
                    except Exception as e:
                        print(f"Error fetching candidates: {e}")
                
                continue

            part: types.Part = (
                event.content and event.content.parts and event.content.parts[0]
            )

            if not part:
                continue

            is_audio = part.inline_data and part.inline_data.mime_type.startswith("audio/")
            if is_audio:
                audio_data = part.inline_data and part.inline_data.data
                if audio_data:
                    # The audio from Gemini is 16-bit linear PCM at 24kHz.
                    try:
                        media_message = {
                            "type": "audio",
                            "data": base64.b64encode(audio_data).decode("ascii"),
                            "sampleRate": 24000,
                            "channels": 1,
                            "bitsPerSample": 16
                        }
                        await websocket.send_text(json.dumps(media_message))
                    except Exception as e:
                        print(f"Audio encoding error: {e}")
                    continue

    except Exception as e:
        print(f"Error in agent_to_client_messaging: {e}")
    finally:
        return conversation_ended

async def client_to_agent_messaging(websocket: WebSocket, live_request_queue: LiveRequestQueue, session_id: str):
    """Client to agent communication for voice chat"""
    try:
        while True:
            message_json = await websocket.receive_text()
            message = json.loads(message_json)

            if message["type"] == "start":
                print(f"Starting voice conversation for session: {session_id}")
                live_request_queue.send_content(content=types.Content(role="user", parts=[types.Part.from_text(text="You are the user's personal concierge assistant. You have just been called by the user and should begin with the greeting asking the user what you can do for them today. ")]))

            elif message["type"] == "audio":
                # Receive audio data from client
                audio_data_b64 = message["data"]
                decoded_data = base64.b64decode(audio_data_b64)
                
                # Frontend sends 16-bit PCM data at 16kHz
                # Gemini expects 16-bit linear PCM at 16kHz
                live_request_queue.send_realtime(types.Blob(data=decoded_data, mime_type="audio/l16;rate=16000"))

            elif message["type"] == "text":
                # Receive text message from client
                text_content = message["text"]
                content = types.Content(role="user", parts=[types.Part.from_text(text=text_content)])
                live_request_queue.send_content(content=content)

            elif message["type"] == "end":
                print(f"Client ended voice conversation for session: {session_id}")
                live_request_queue.send_content(content=types.Content(role="user", parts=[types.Part.from_text(text="Thank you for using ServiceScout! Have a great day.")]))
                return

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session: {session_id}")
        return
    except Exception as e:
        print(f"Error in client_to_agent_messaging: {e}")
        return

class ChatRequest(BaseModel):
    message: str
    session_id: str

class SessionResponse(BaseModel):
    session_id: str
    title: str
    description: Optional[str] = None

class CallResponse(BaseModel):
    call_id: str
    biz_name: str
    phone_number: str
    outcome_summary: Optional[str] = None
    success: Optional[bool] = None

class CallDetailsResponse(CallResponse):
    transcript: Optional[list] = None

class CallsListResponse(BaseModel):
    calls: list[CallResponse]

class SessionsListResponse(BaseModel):
    sessions: list[SessionResponse]

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Creates a new chat session.
    """
    if session_service is None:
        raise HTTPException(status_code=500, detail="Session service not initialized.")

    user_id = current_user["phone_number"]
    
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        state={}
    )
    session_id = session.id

    db.collection("sessions").document(session_id).set({
        "user_id": user_id,
        "createdAt": datetime.datetime.utcnow(),
        "title": "New Session"
    })
    

    return {"session_id": session_id, "title": "New Session"}

@app.get("/api/sessions", response_model=SessionsListResponse)
async def get_sessions(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Retrieves all sessions for the current user.
    """
    user_id = current_user["phone_number"]
    sessions_ref = db.collection("sessions").where("user_id", "==", user_id).order_by("createdAt", direction=firestore.Query.DESCENDING).get()

    sessions = []
    for doc in sessions_ref:
        session_data = doc.to_dict()
        sessions.append(SessionResponse(
            session_id=doc.id, 
            title=session_data.get("title", f"Request"),
            description=session_data.get("request_summary")
        ))

    return {"sessions": sessions}

@app.get("/api/sessions/{session_id}/calls", response_model=CallsListResponse)
async def get_calls_for_session(session_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Retrieves all calls for a specific session.
    """
    # First, verify the user has access to the session
    session_ref = db.collection("sessions").document(session_id)
    session_doc = session_ref.get()
    if not session_doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session_doc.to_dict()
    if session_data.get("user_id") != current_user["phone_number"]:
        raise HTTPException(status_code=403, detail="User not authorized to access this session")

    # Fetch calls
    calls_ref = db.collection("provider_conversations").where("session_id", "==", session_id).order_by("timestamp").get()

    calls = []
    for doc in calls_ref:
        call_data = doc.to_dict()
        calls.append(CallResponse(
            call_id=doc.id,
            biz_name=call_data.get("biz_name"),
            phone_number=call_data.get("phone_number"),
            outcome_summary=call_data.get("outcome_summary"),
            success=call_data.get("success")
        ))
    
    return {"calls": calls}

@app.get("/api/calls/{call_id}", response_model=CallDetailsResponse)
async def get_call_details(call_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Retrieves the details for a specific call, including the transcript.
    """
    call_ref = db.collection("provider_conversations").document(call_id)
    call_doc = call_ref.get()
    if not call_doc.exists:
        raise HTTPException(status_code=404, detail="Call not found")
    
    call_data = call_doc.to_dict()
    
    # Verify user has access to the session this call belongs to
    session_id = call_data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=403, detail="Call not associated with a session")

    session_ref = db.collection("sessions").document(session_id)
    session_doc = session_ref.get()
    if not session_doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session_doc.to_dict()
    if session_data.get("user_id") != current_user["phone_number"]:
        raise HTTPException(status_code=403, detail="User not authorized to access this call")

    return CallDetailsResponse(
        call_id=call_doc.id,
        biz_name=call_data.get("biz_name"),
        phone_number=call_data.get("phone_number"),
        outcome_summary=call_data.get("outcome_summary"),
        success=call_data.get("success"),
        transcript=call_data.get("transcript")
    )

@app.websocket("/api/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for voice chat with authentication"""
    await websocket.accept()
    print(f"Voice client connected with session: {session_id}")

    try:
        # Wait for authentication message
        auth_message_json = await websocket.receive_text()
        auth_message = json.loads(auth_message_json)
        
        if auth_message.get("type") != "auth":
            await websocket.close(code=4001, reason="Authentication required")
            return
            
        token = auth_message.get("token")
        if not token:
            await websocket.close(code=4001, reason="Token required")
            return

        # Verify Firebase token
        try:
            decoded_token = auth.verify_id_token(token)
            user_id = decoded_token["phone_number"]
        except Exception as e:
            print(f"Authentication failed: {e}")
            await websocket.close(code=4001, reason="Invalid token")
            return

        # Verify session belongs to user
        try:
            session_ref = db.collection("sessions").document(session_id)
            session_doc = session_ref.get()
            if not session_doc.exists:
                await websocket.close(code=4004, reason="Session not found")
                return
            
            session_data = session_doc.to_dict()
            if session_data.get("user_id") != user_id:
                await websocket.close(code=4003, reason="Unauthorized")
                return
        except Exception as e:
            print(f"Session verification failed: {e}")
            await websocket.close(code=4004, reason="Session verification failed")
            return

        # Send authentication success
        await websocket.send_text(json.dumps({"type": "auth_success"}))

        # Start voice agent session
        live_events, live_request_queue = await start_voice_agent_session(user_id, session_id, is_audio=True)


        agent_to_client_task = asyncio.create_task(
            agent_to_client_messaging(websocket, live_request_queue, live_events, session_id, user_id)
        )
        client_to_agent_task = asyncio.create_task(
            client_to_agent_messaging(websocket, live_request_queue, session_id)
        )

        tasks = [agent_to_client_task, client_to_agent_task]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

        # Cancel remaining tasks
        for task in pending:
            task.cancel()

        # Get result from completed agent task
        try:
            conversation_ended = await agent_to_client_task
            print(f"Voice session completed for session {session_id}, conversation_ended: {conversation_ended}")
        except asyncio.CancelledError:
            print("Agent to client task was cancelled")

        live_request_queue.close()
        print(f"Voice session ended: {session_id}")

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        print(f"Error in websocket_endpoint: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
