## ServiceScout
Author: Theo Weise

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
2. Fill in your twilio credentials in both .env files
3. Fill in GOOGLE_MAPS_API_KEY in both .env files
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

<img width="1506" height="762" alt="Screenshot 2025-11-10 at 7 55 44 PM" src="https://github.com/user-attachments/assets/5d746c74-8b9a-4c37-bdae-bd4fac64447e" />
