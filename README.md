## ServiceScout
Author: Theo Weise

## Try it at [chatbookings.net](https://chatbookings.net)
### Important Note: Currently, all calls are redirected to your signed-in phone number for proof of concept. When you pick up the phone, speak as the business owner.

## Overview
ServiceScout places calls to businesses on your behalf. You can ask it to get you quotes, make appointments, and more. 

By default, ServiceScout will search Google Places API for candidate businesses and call them to gather more information:
<img width="1506" height="762" alt="Screenshot 2025-11-10 at 7 55 44 PM" src="https://github.com/user-attachments/assets/5d746c74-8b9a-4c37-bdae-bd4fac64447e" />

If you check the box "Only show results from database", ServiceScout will not place any outbound calls. It will check its internal knowledge base (from previous calls) via RAG to give you a response:
<img width="1296" height="963" alt="Screenshot from 2025-11-12 22-31-36" src="https://github.com/user-attachments/assets/d63328ea-18ef-42d0-a655-b8d7e41705b2" />

If you are using ServiceScout from https://chatbookings.net, there may be up to a 30s delay the first time you log in or initiate a call. This is because the Cloud Run services are spinning up. 

## Architecture
* backend
    * scout_agent
        * agent.py -> agent runnable with `adk web`
        * a2a.py -> a2a server
        * main.py -> http server for custom setup
    * phone_agent
        * main.py -> http server for custom setup
* frontend -> NextJS frontend to interact with ServiceScout

## ADK Support
* Run `adk web` from the `backend` directory for a playground 

## Run Locally
1. Rename `.env.example` to `.env` in both `backend/phone_agent` and `backend/scout_agent`
2. Fill in both .env files.
4. In Firebase, go to auth and get a `firebase.ts` file to put in frontend/src/app. 
5. Switch the commented lines at the top of `frontend/src/app/page.tsx` if needed. 
6. Create and activate a python virtualenv. You only need one.
7. Run `./setup.sh` and follow the instructions.
8. Run these commands in separate terminals:
```
cd backend/scout_agent && python3 main.py
cd backend/phone_agent && python3 main.py
cd backend/scout_agent && python3 a2a.py
cd frontend && npm run dev
```

The following services will run:
3000: NextJS Frontend
8000: scout_agent HTTP API
8001: phone_agent HTTP API
8002: A2A server

## Custom UI
ServiceScout is best enjoyed through the custom NextJS dashboard. You can try it at `http://localhost:3000` if you followed the above steps, or at `https://chatbookings.net`.
