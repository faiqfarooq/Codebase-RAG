import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")
    BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
    
    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.OPENAI_API_KEY:
            print("Warning: OPENAI_API_KEY not set")
        if not cls.DEEPSEEK_API_KEY:
            print("Warning: DEEPSEEK_API_KEY not set")

config = Config()
config.validate()