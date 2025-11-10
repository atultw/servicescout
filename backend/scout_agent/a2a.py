from google.adk.a2a.utils.agent_to_a2a import to_a2a
from scout_agent.agent import root_agent
import uvicorn
import os

a2a_app = to_a2a(root_agent)

if __name__ == "__main__":
    uvicorn.run("main:a2a_app", host="0.0.0.0", port=int(os.getenv("PORT", "8002")), reload=False)
