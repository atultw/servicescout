import os
import asyncio
import base64
import json
import audioop
from typing import Optional
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from google.adk.agents import Agent, LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.cloud import firestore
import google.genai
from google.genai.types import EmbedContentConfig
from google.genai import types
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Connect
from google.cloud.firestore_v1.vector import Vector

load_dotenv()

# --- Firestore ---
db = firestore.Client()

def hang_up(outcome_summary: str, success: bool) -> str:
    """Tool to hang up the call.
    Args:
        outcome_summary: A summary of the call outcome.
        success: Whether the call achieved its objective.
    Returns:
        A confirmation message indicating that the call has ended.
    """

    return "Call ended, goodbye"

# --- ADK Agent ---
def create_outreach_agent(model: str) -> Agent:
    """Creates the Outreach Agent."""
    return Agent(
        model=model,
        name="outreach_agent",
        instruction="""You are the Outreach Agent. You are acting as the customer and speaking on the phone with a business to achieve the customer's objective.
          Once you achieve your objective or if it is clear that you cannot,
            politely end the conversation and call the hang_up tool. 
            The only tool you can use is hang_up, WHICH YOU SHOULD CALL EXACTLY ONCE AT THE END.
              If you don't know a detail like the customer's name or availability, DO NOT guess. Only give information you are provided with or 100 percent sure about.
              Just end the conversation and make a note in the outcome summary if you are unsure.""",
        description="Places outreach calls and saves the results in database.",
        tools=[hang_up],
    )

# gemini-2.5-flash-native-audio-preview-09-2025
# gemini-live-2.5-flash-preview-native-audio-09-2025
root_agent = create_outreach_agent(model="gemini-live-2.5-flash-preview-native-audio-09-2025")

# --- FastAPI App ---
app = FastAPI()

# --- ADK Streaming ---
APP_NAME = "outreach-agent"
session_service = InMemorySessionService()

async def start_agent_session(user_id, is_audio=False):
    """Starts an agent session"""
    runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service,
    )
    session = await runner.session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
    )
    
    modality = "AUDIO" if is_audio else "TEXT"
    run_config = RunConfig(response_modalities=[modality],    
                            output_audio_transcription=types.AudioTranscriptionConfig(),
    input_audio_transcription=types.AudioTranscriptionConfig())

    live_request_queue = LiveRequestQueue()
    live_events = runner.run_live(
        session=session,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue

async def agent_to_client_messaging(websocket: WebSocket, live_events, stream_sid_queue: asyncio.Queue, resample_state, call_id: str, call_sid: str):
    """Agent to client communication"""
    stream_sid = await stream_sid_queue.get()
    transcript_parts = []

    try:
        async for event in live_events:
            if event.input_transcription:
                transcript_parts.append({"role": "user", "timestamp": event.timestamp, "text": event.input_transcription})
            if event.output_transcription:
                transcript_parts.append({"role": "agent", "timestamp": event.timestamp, "text": event.output_transcription})

            if event.turn_complete or event.interrupted:
                message = {
                    "event": "turn_complete" if event.turn_complete else "interrupted",
                }
                await websocket.send_text(json.dumps(message))
                print(f"Event: {message['event']}")
                continue

            part: types.Part = (
                event.content and event.content.parts and event.content.parts[0]
            )

            if not part:
                continue

            if part.function_call and part.function_call.name == "hang_up":
                print("Agent called hang_up tool, ending call.")
                message = {
                    "event": "hang_up",
                }
                # sleep for 3 seconds
                await asyncio.sleep(3)
                twilio_client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
                twilio_client.calls(call_sid).update(status="completed")

                if part.function_call.args:
                    try:
                        args = part.function_call.args
                        outcome_summary = args.get("outcome_summary", "No Summary Provided")
                        success = args.get("success", False)
                        # update Firestore with outcome summary
                        doc_ref = db.collection("provider_conversations").document(call_id)
                        doc_ref.update({
                            "outcome_summary": outcome_summary,
                            "success": success
                        })
                        print(f"Call outcome summary: {outcome_summary}, success: {success}")
                    except json.JSONDecodeError:
                        print("Error decoding hang_up function arguments.")
                break

            is_audio = part.inline_data and part.inline_data.mime_type.startswith("audio/")
            if is_audio:
                audio_data = part.inline_data and part.inline_data.data
                if audio_data:
                    # The audio from Gemini is 16-bit linear PCM at 24kHz.
                    # Twilio needs 8-bit mu-law at 8kHz.
                    # We need to resample from 24kHz to 8kHz, then convert to mu-law.
                    try:
                        # Resample from 24kHz to 8kHz
                        resampled_data, resample_state.to_twilio = audioop.ratecv(audio_data, 2, 1, 24000, 8000, resample_state.to_twilio)
                        
                        # Convert 16-bit linear PCM to 8-bit mu-law
                        mulaw_audio = audioop.lin2ulaw(resampled_data, 2)
                        
                        media_message = {
                            "event": "media",
                            "streamSid": stream_sid, 
                            "media": {
                                "payload": base64.b64encode(mulaw_audio).decode("ascii")
                            }
                        }
                        await websocket.send_text(json.dumps(media_message))
                    except audioop.error as e:
                        print(f"Audio conversion error: {e}. Audio data might not be 16-bit linear PCM.")

                    continue

    except Exception as e:
        print(f"Error in agent_to_client_messaging: {e}")
    finally:
        print("TRANSCRIPT", transcript_parts)
        # merge contiguous transcript parts with the same role
        merged_transcript_parts = []
        transcript_parts_sorted = sorted(transcript_parts, key=lambda x: x["timestamp"])
        for part in transcript_parts_sorted:
            if (
                merged_transcript_parts
                and merged_transcript_parts[-1]["role"] == part["role"]
            ):
                merged_transcript_parts[-1]["text"].text += " " + part["text"].text
            else:
                merged_transcript_parts.append(part)

        return merged_transcript_parts


async def client_to_agent_messaging(websocket: WebSocket, live_request_queue: LiveRequestQueue, stream_sid_queue: asyncio.Queue, resample_state, call_id: str, user_context: str):
    """Client to agent communication"""
    stream_sid = None
    while True:
        message_json = await websocket.receive_text()
        message = json.loads(message_json)

        if message["event"] == "start":
            stream_sid = message["streamSid"]
            await stream_sid_queue.put(stream_sid)
            print(f"Twilio stream started: {stream_sid} for call_id: {call_id}")

            if call_id:
                # Retrieve call details from Firestore
                doc_ref = db.collection("provider_conversations").document(call_id)
                doc = doc_ref.get()
                if doc.exists:
                    call_data = doc.to_dict()
                    outcome = call_data.get("outcome")
                    phone_number = call_data.get("phone_number")
                    
                    # Greet and initiate the conversation
                    initial_text = f"""You are a customer.
                    This is the information about the customer: {user_context}. 
                    Adopt their persona. 
                    You are speaking to a business on the phone and acting as the customer to achieve a goal.
                      Your goal is to: {outcome}. Start the conversation now with a greeting, and remember that if you don't know something, DO NOT GUESS. Make a note in the outcome summary and end the call. Be sure to ask any auxiliary questions that the user might want to know."""
                    print(f"Sending initial prompt to agent: {initial_text}")
                    content = types.Content(role="user", parts=[types.Part.from_text(text=initial_text)])
                    live_request_queue.send_content(content=content)
                else:
                    print(f"Could not find call data in Firestore for call_id: {call_id}")


        if message["event"] == "media":
            payload = message["media"]["payload"]
            decoded_data = base64.b64decode(payload)
            
            # Twilio sends 8-bit mu-law audio. We need to convert it to 16-bit linear PCM for Gemini.
            pcm_data = audioop.ulaw2lin(decoded_data, 2)
            
            # Gemini requires 16kHz audio. Twilio sends 8kHz. We need to resample.
            resampled_data, resample_state.from_twilio = audioop.ratecv(pcm_data, 2, 1, 8000, 16000, resample_state.from_twilio)
            
            live_request_queue.send_realtime(types.Blob(data=resampled_data, mime_type="audio/l16;rate=16000"))

        if message["event"] == "stop":
            print(f"Twilio stream stopped: {stream_sid}")
            live_request_queue.send_content(content=types.Content(role="user", parts=[types.Part.from_text(text="Business hung up, please call the hang_up tool.")]))
            return

@app.websocket("/dialer/ws/{call_id}")
async def websocket_endpoint(websocket: WebSocket, call_id: str):
    """Client websocket endpoint for Twilio"""
    await websocket.accept()
    print(f"Twilio client connected for call: {call_id}")

    doc_ref = db.collection("provider_conversations").document(call_id)
    doc = doc_ref.get()
    if doc.exists:
        call_data = doc.to_dict()
        call_sid = call_data.get("twilio_sid")
        biz_description = call_data.get("biz_description")
        user_context = call_data.get("user_context", "")
    else:
        print(f"Could not find call data in Firestore for call_id: {call_id}, returning")
        return

    print(f"Starting agent session for call_sid: {call_sid}")

    live_events, live_request_queue = await start_agent_session(call_id, is_audio=True)
    
    stream_sid_queue = asyncio.Queue()

    # Use a state management object for resampling
    class ResampleState:
        def __init__(self):
            self.from_twilio = None
            self.to_twilio = None

    resample_state = ResampleState()    

    agent_to_client_task = asyncio.create_task(
        agent_to_client_messaging(websocket, live_events, stream_sid_queue, resample_state, call_id, call_sid)
    )
    client_to_agent_task = asyncio.create_task(
        client_to_agent_messaging(websocket, live_request_queue, stream_sid_queue, resample_state, call_id, user_context)
    )

    tasks = [agent_to_client_task, client_to_agent_task]
    await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)

    # --- Save Transcript ---
    # The agent_to_client_task will return the transcript parts when it's done.
    # We need to cancel the task to get the return value if it hasn't finished.
    try:
        transcript_parts = await agent_to_client_task
        processed_transcript = [{"role": part["role"], "text": part["text"].text} for part in transcript_parts]
        print(f"Processed Transcript: {processed_transcript}")

        # Create embedding
        transcript_text = " ".join([f"{t['role']}: {t['text']} \n" for t in processed_transcript])
        embedding = None
        if transcript_text:
            try:
                client = google.genai.Client()
                response = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=[
                        biz_description + "\n" + transcript_text
                    ],
                    config=EmbedContentConfig(
                        task_type="RETRIEVAL_DOCUMENT",  # Optional
                        output_dimensionality=2048,  # Optional
                        # title="Driver's License",  # Optional
                    ),
                )   
                embedding = response.embeddings[0].values
            except Exception as e:
                print(f"Error creating embedding: {e}")

        try:
            doc_ref = db.collection("provider_conversations").document(call_id)
            update_data = {"transcript": processed_transcript}
            if embedding:
                update_data["transcript_embedding"] = Vector(embedding)
            doc_ref.update(update_data)
            print(f"Saved transcript and embedding for call {call_id} to Firestore.")
        except Exception as e:
            print(f"Error saving transcript for call {call_id}: {e}")
    except asyncio.CancelledError:
        print("Agent to client task was cancelled, transcript not saved.")


    live_request_queue.close()
    print(f"Twilio client disconnected: {call_id}")
    return


# --- Twilio Integration ---
@app.post("/dialer/initiate_call")
async def initiate_call(initiator_user_id: str, phone_number: str, outcome: str, biz_name: str, biz_description: Optional[str] = None, lat: Optional[float] = None, lng: Optional[float] = None, session_id: Optional[str] = None, user_context: str = ""):
    """Initiates a call to the given phone number."""
    server_url = os.environ.get("PHONE_AGENT_SERVER_HOST")
    if not server_url:
        raise ValueError("PHONE_AGENT_SERVER_HOST environment variable not set.")

    client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
    
    call_id = str(uuid.uuid4())

    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=f"wss://{server_url}/dialer/ws/{call_id}") 
    response.append(connect)
    response.pause(length=30) # Keep the call alive for a bit

    call = client.calls.create(
        # to=phone_number,
        to=initiator_user_id,
        from_="+18577995236",
        twiml=str(response)
    )

    # Store initial call info in Firestore
    doc_ref = db.collection("provider_conversations").document(call_id)
    doc_ref.set({
        "initiator_user_id": initiator_user_id,
        "session_id": session_id,
        "outcome": outcome,
        "twilio_sid": call.sid,
        "phone_number": phone_number,
        "biz_name": biz_name,
        "biz_description": biz_description,
        "lat": lat,
        "lng": lng,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "transcript": [],
        "user_context": user_context,
    })

    return {"status": "call_initiated", "sid": call.sid, "call_id": call_id}

# --- Main Application Setup ---
if __name__ == "__main__":
    import uvicorn
    print("✅ Phone Agent FastAPI server starting...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8001")))