import os
import shutil
import tempfile
import zipfile
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import chromadb
from chromadb.config import Settings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
import glob
from pathlib import Path
import subprocess

from config import config

app = FastAPI(title="Codebase RAG API")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3055"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB (in-memory)
# Use Client with SQLite backend to avoid hnswlib compilation on Windows
chroma_client = chromadb.Client(
    Settings(
        anonymized_telemetry=False,
        allow_reset=True
    )
)

collection = chroma_client.create_collection(
    name="codebase"
)

# Request/Response models
class IngestRequest(BaseModel):
    directory_path: str

class IngestRepoRequest(BaseModel):
    repo_url: str

class IngestResponse(BaseModel):
    message: str
    files_processed: int
    chunks_created: int

class ChatRequest(BaseModel):
    query: str
    model: Optional[str] = "deepseek"

class ChatResponse(BaseModel):
    response: str
    sources: List[dict]

def get_language_splitter(file_extension: str) -> RecursiveCharacterTextSplitter:
    """Get appropriate text splitter based on file extension"""
    language_map = {
        ".py": "python",
        ".js": "js",
        ".ts": "ts",
        ".tsx": "ts",
        ".jsx": "js"
    }
    
    language = language_map.get(file_extension.lower(), "python")
    
    return RecursiveCharacterTextSplitter.from_language(
        language=language,
        chunk_size=1000,
        chunk_overlap=200
    )

def get_line_number(text: str, position: int) -> int:
    """Get line number from character position in text"""
    return text[:position].count('\n') + 1

def ingest_directory(directory_path: str):
    """Parse directory, split code, and store in ChromaDB"""
    if not os.path.exists(directory_path):
        raise HTTPException(status_code=400, detail="Directory path does not exist")
    
    # Find all .js, .ts, .py, .tsx, .jsx files
    extensions = ['**/*.js', '**/*.ts', '**/*.py', '**/*.tsx', '**/*.jsx']
    all_files = []
    
    for ext in extensions:
        pattern = os.path.join(directory_path, ext)
        all_files.extend(glob.glob(pattern, recursive=True))
    
    # Remove duplicates
    all_files = list(set(all_files))
    
    if not all_files:
        raise HTTPException(status_code=400, detail="No code files found in directory")
    
    all_chunks = []
    all_metadatas = []
    all_ids = []
    
    chunk_counter = 0
    
    for file_path in all_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip empty files
            if not content.strip():
                continue
            
            file_ext = Path(file_path).suffix
            splitter = get_language_splitter(file_ext)
            
            # Split the code
            chunks = splitter.split_text(content)
            
            # Create metadata for each chunk
            for i, chunk in enumerate(chunks):
                # Find the position of this chunk in the original file
                start_pos = content.find(chunk)
                start_line = get_line_number(content, start_pos) if start_pos >= 0 else 1
                
                # Make path relative to directory_path
                relative_path = os.path.relpath(file_path, directory_path)
                
                metadata = {
                    "filename": relative_path,
                    "start_line": start_line,
                    "code_snippet": chunk[:200],  # First 200 chars for preview
                    "file_type": file_ext[1:] if file_ext else "unknown"
                }
                
                all_chunks.append(chunk)
                all_metadatas.append(metadata)
                all_ids.append(f"{relative_path}_{chunk_counter}")
                chunk_counter += 1
                
        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}")
            continue
    
    # Store in ChromaDB
    global collection
    if all_chunks:
        # Clear existing collection if re-ingesting
        try:
            chroma_client.delete_collection(name="codebase")
            collection = chroma_client.create_collection(name="codebase")
        except:
            collection = chroma_client.create_collection(name="codebase")
        
        collection.add(
            documents=all_chunks,
            metadatas=all_metadatas,
            ids=all_ids
        )
    
    return len(all_files), len(all_chunks)

def get_llm_model(model_name: str):
    """Get LLM model based on selection"""
    if model_name.lower() == "deepseek":
        return ChatOpenAI(
            model="deepseek-chat",
            openai_api_key=config.DEEPSEEK_API_KEY,
            openai_api_base=config.DEEPSEEK_API_BASE,
            temperature=0.7
        )
    elif model_name.lower() == "chatgpt" or model_name.lower() == "gpt":
        return ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=config.OPENAI_API_KEY,
            temperature=0.7
        )
    else:
        raise ValueError(f"Unknown model: {model_name}")

@app.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest):
    """Ingest codebase directory into ChromaDB"""
    try:
        files_processed, chunks_created = ingest_directory(request.directory_path)
        
        return IngestResponse(
            message="Codebase ingested successfully",
            files_processed=files_processed,
            chunks_created=chunks_created
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ingesting codebase: {str(e)}")

@app.post("/ingest/upload", response_model=IngestResponse)
async def ingest_upload(file: UploadFile = File(...)):
    """Ingest codebase from uploaded ZIP file"""
    temp_dir = None
    try:
        # Validate file type
        if not file.filename.endswith('.zip'):
            raise HTTPException(status_code=400, detail="Only ZIP files are supported")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, file.filename)
        
        # Save uploaded file
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract ZIP file
        extract_path = os.path.join(temp_dir, "extracted")
        os.makedirs(extract_path, exist_ok=True)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        
        # Ingest the extracted directory
        files_processed, chunks_created = ingest_directory(extract_path)
        
        return IngestResponse(
            message="Codebase uploaded and ingested successfully",
            files_processed=files_processed,
            chunks_created=chunks_created
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing uploaded file: {str(e)}")
    finally:
        # Clean up temporary directory
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/ingest/repo", response_model=IngestResponse)
async def ingest_repo(request: IngestRepoRequest):
    """Ingest codebase from GitHub repository"""
    temp_dir = None
    try:
        repo_url = request.repo_url.strip()
        
        # Validate GitHub URL
        if not (repo_url.startswith('http://') or repo_url.startswith('https://')):
            # Assume it's a GitHub repo in format owner/repo
            if '/' in repo_url and not repo_url.startswith('git@'):
                repo_url = f"https://github.com/{repo_url}.git"
            else:
                raise HTTPException(status_code=400, detail="Invalid repository URL format")
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        clone_path = os.path.join(temp_dir, "repo")
        
        # Clone repository
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, clone_path],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to clone repository: {e.stderr or 'Unknown error'}"
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="Git is not installed. Please install Git to use this feature."
            )
        
        # Ingest the cloned directory
        files_processed, chunks_created = ingest_directory(clone_path)
        
        return IngestResponse(
            message="Repository cloned and ingested successfully",
            files_processed=files_processed,
            chunks_created=chunks_created
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing repository: {str(e)}")
    finally:
        # Clean up temporary directory
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the codebase using RAG"""
    try:
        # Search ChromaDB for relevant code snippets
        results = collection.query(
            query_texts=[request.query],
            n_results=5  # Top 5 relevant chunks
        )
        
        if not results['documents'] or not results['documents'][0]:
            return ChatResponse(
                response="No relevant code found in the codebase. Please try a different query or ingest some code first.",
                sources=[]
            )
        
        # Format context with citations
        context_parts = []
        sources = []
        
        for i, (doc, metadata_list) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
            filename = metadata_list.get('filename', 'unknown')
            start_line = metadata_list.get('start_line', 0)
            file_type = metadata_list.get('file_type', 'unknown')
            
            context_parts.append(f"[{filename}:{start_line}]\n{doc}")
            sources.append({
                "filename": filename,
                "start_line": start_line,
                "file_type": file_type,
                "preview": doc[:200]
            })
        
        context = "\n\n---\n\n".join(context_parts)
        
        # Create prompt
        system_prompt = """You are a helpful code assistant that explains code and helps debug issues.
When explaining code or answering questions, always cite the file and line number using the format: filename.ext:line_number
When explaining why something isn't working, be specific and reference the exact locations in the code.

Always format file references as: filename.ext:line_number (e.g., Button.tsx:42)"""

        user_prompt = f"""Context from codebase:

{context}

---

Question: {request.query}

Please answer the question based on the code context above. When mentioning files or code locations, use the format filename.ext:line_number."""
        
        # Get LLM model
        llm = get_llm_model(request.model)
        
        # Generate response
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = llm.invoke(messages)
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        return ChatResponse(
            response=response_text,
            sources=sources
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.BACKEND_PORT)