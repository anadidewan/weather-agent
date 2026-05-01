# backend-agent

## Setup (quick)

1. Create a virtual environment.
2. Install dependencies: `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and fill values.
4. Run: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --reload`
