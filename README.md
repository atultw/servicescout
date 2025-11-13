## ServiceScout
Author: Theo Weise

Try it at chatbookings.net

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

* In `frontend`, run `npm run dev`
<img width="1506" height="762" alt="Screenshot 2025-11-10 at 7 55 44 PM" src="https://github.com/user-attachments/assets/5d746c74-8b9a-4c37-bdae-bd4fac64447e" />
