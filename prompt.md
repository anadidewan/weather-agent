Prompt #1

scaffold a 3-service project fro me, no business logic yet, just skeletons

mcp-wrapper (node+ts+express) runs on 8080, just a health check for now, ESM(type:moduke) dev script "ts watch src.index.ts". It should have basic http service dependency such as express, axios, cors, dotenv and for logging.. and for dev include typescript and @types/express , @types/cors , @types/node

backend-agent built on python and fastAPI, runs on 8080, basic health check , requriemtns should be fastapi, uvicorn , langchain, langchain for gemini, pydantic and dot env. should have app/main.py and __init__, include short not on setup, and add logs too 

frontend ts+ vite scaffolding, react dev server at 300 

Each should have its own .env.example
wrapper : port, OPENWeather_API_KEY
agent: Port, Gemini_API_KEY, MCP_Wrapper_url 
fronted: vite_agent_backend_url

Create .ignore fro root level
create a xml file,, for you to understand progress of it

Make sure you have latest stable versions>
No business logic just health  endpoints and each service boot independently

I'll verify one youre done

