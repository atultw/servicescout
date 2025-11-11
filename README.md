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

## Custom UI
ServiceScout is best enjoyed through the custom NextJS dashboard.

* In `frontend`, run `npm run dev`
<img width="1506" height="762" alt="Screenshot 2025-11-10 at 7 55 44 PM" src="https://github.com/user-attachments/assets/5d746c74-8b9a-4c37-bdae-bd4fac64447e" />
