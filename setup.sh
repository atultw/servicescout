cd frontend
npm i
cd ../backend
# activate virtualenv 
pip3 install -r scout_agent/requirements.txt
ngrok http 8001
echo "NOTE THE PUBLIC HOSTNAME without scheme (e.g. abc123.ngrok-free.app) -> put this in both your dotenv files as PHONE_AGENT_SERVER_HOST."