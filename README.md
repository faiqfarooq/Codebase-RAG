# Codebase RAG

Ingest your code (local folder, ZIP upload, or GitHub repo), then ask questions in natural language. The app chunks code, stores it in a vector store, and answers using an LLM (DeepSeek or OpenAI).

## What is this project?

**Codebase RAG (Retrieval-Augmented Generation)** lets you point at a codebase—via a local directory path, an uploaded ZIP, or a GitHub repository URL—and then ask questions about it. The backend splits code into chunks, stores them in ChromaDB, retrieves relevant snippets for each question, and generates answers using either DeepSeek or ChatGPT.

**Tech stack:** FastAPI backend ([backend/main.py](backend/main.py)), Next.js frontend ([rag_code/](rag_code/)), ChromaDB (in-memory), LangChain, and OpenAI-compatible APIs.

## Prerequisites

- **Python 3.x** – for the backend
- **Node.js** (LTS) – for the frontend
- **Git** – required only if you use "ingest from repo" (GitHub URL)
- **Windows only:** **Microsoft C++ Build Tools** – recommended before installing backend requirements (needed for ChromaDB). Install from [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and choose the **"Desktop development with C++"** workload.

## API keys and environment variables

Create `backend/.env` with the variables below. At least one of `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` is needed for chat. Embeddings use ChromaDB's default (no extra key).

### Backend (`backend/.env`)

| Variable             | Required              | Purpose                                                                 |
| -------------------- | --------------------- | ----------------------------------------------------------------------- |
| `OPENAI_API_KEY`     | For "ChatGPT" model   | Used when the user selects ChatGPT in chat                              |
| `DEEPSEEK_API_KEY`   | For "DeepSeek" model  | Used when the user selects DeepSeek (default)                            |
| `DEEPSEEK_API_BASE`  | Optional              | Default `https://api.deepseek.com/v1`                                    |
| `BACKEND_PORT`       | Optional              | Default `8000`                                                           |

### Frontend (`rag_code/.env.local`)

| Variable               | Required | Purpose                                                |
| ---------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`  | Optional | Backend API base URL; default `http://localhost:8000` |

## Run the backend locally

All commands below are from the **`backend/`** directory.

1. Create and activate a virtual environment:
   - **Windows:** `python -m venv venv` then `venv\Scripts\activate`
   - **macOS/Linux:** `python3 -m venv venv` then `source venv/bin/activate`
2. **(Windows)** Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and select the **"Desktop development with C++"** workload, then install dependencies: `pip install -r requirements.txt`  
   **(macOS/Linux)** Install dependencies: `pip install -r requirements.txt`
3. Create a `.env` file in `backend/` with the variables listed above (see [backend/config.py](backend/config.py)).
4. Start the server: `python main.py`  
   Or: `uvicorn main:app --host 0.0.0.0 --port 8000`  
   The API runs at **http://localhost:8000** by default (or the port set by `BACKEND_PORT`).

**Windows:** If ChromaDB fails to install, you may need Visual C++ Build Tools. See [backend/README_WINDOWS.md](backend/README_WINDOWS.md) or [backend/INSTALL_INSTRUCTIONS.md](backend/INSTALL_INSTRUCTIONS.md) if those files exist.

## Run the frontend locally

All commands below are from the **`rag_code/`** directory.

1. Install dependencies: `npm install`
2. (Optional) If your backend is not at `http://localhost:8000`, create `rag_code/.env.local` and set `NEXT_PUBLIC_API_URL` to your backend URL.
3. Start the dev server: `npm run dev`  
   The app is available at **http://localhost:3055**. The backend CORS is configured to allow this origin.

## Quick start

1. Start the **backend** (from `backend/`): `python main.py`
2. Start the **frontend** (from `rag_code/`): `npm run dev`
3. Open **http://localhost:3055** in your browser.
4. Ingest a codebase (local path, ZIP upload, or GitHub repo URL), then ask questions in the chat.

## vedio link
https://www.loom.com/share/d86ecf1f7e704783bf41950b823cc79b
