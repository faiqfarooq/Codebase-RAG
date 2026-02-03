@echo off
echo Installing dependencies for Windows...
echo.

echo Installing base dependencies (without chromadb)...
pip install fastapi==0.115.0 uvicorn[standard]==0.32.0 python-dotenv==1.0.0 langchain==0.3.0 langchain-openai==0.2.0 langchain-community==0.3.0 langchain-core==0.3.0 tiktoken==0.9.0 pydantic==2.9.0

echo.
echo Attempting to install ChromaDB...
echo If this fails, you may need to install Microsoft Visual C++ Build Tools
echo Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
echo.

pip install chromadb==0.5.0 --no-cache-dir

echo.
echo Installation complete!
pause