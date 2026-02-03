# Windows Installation Guide

## Issue: ChromaDB requires Visual C++ Build Tools

When installing ChromaDB on Windows, you may encounter an error requiring Microsoft Visual C++ 14.0 or greater.

## Solution Options

### Option 1: Install Visual C++ Build Tools (Recommended)
1. Download and install [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. During installation, select "Desktop development with C++"
3. Then run: `pip install -r requirements.txt`

### Option 2: Install without hnswlib (Alternative)
If you don't want to install Visual C++ Build Tools, ChromaDB will use a fallback mode:
```bash
pip install chromadb==0.5.0 --no-cache-dir
```

### Option 3: Use Pre-built Wheels (If Available)
Try installing with pre-built wheels:
```bash
pip install chromadb==0.5.0 --only-binary :all:
```

## Quick Start

1. Install dependencies: `pip install -r requirements.txt`
2. Create `.env` file with your API keys
3. Run: `python main.py`

The backend will start on `http://localhost:8000`