# Installation Instructions for Windows

## Problem
ChromaDB's dependency `chroma-hnswlib` requires compilation from source on Windows, which needs **Microsoft Visual C++ 14.0 or greater**.

## Solutions

### Option 1: Install Visual C++ Build Tools (Recommended - ~5 minutes)

1. Download [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Run the installer
3. Select "Desktop development with C++" workload
4. Click Install
5. After installation completes, restart your terminal/PowerShell
6. Run: `pip install -r requirements.txt`

### Option 2: Use WSL (Windows Subsystem for Linux)

If you have WSL installed:
```bash
wsl
cd /mnt/d/"Rag implemention"/backend
pip install -r requirements.txt
```

### Option 3: Use Alternative Vector Database (Code Changes Required)

We can modify the code to use FAISS-CPU which has pre-built wheels for Windows. This would require code changes but doesn't need Visual C++ Build Tools.

---

## Quick Test

After installing Visual C++ Build Tools and running `pip install -r requirements.txt`, test the installation:

```bash
python -c "import chromadb; print('ChromaDB installed successfully!')"
```

If this works, you're ready to run the backend!