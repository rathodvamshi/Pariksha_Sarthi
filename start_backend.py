#!/usr/bin/env python3
"""
Script to start the backend server and ensure initial data is set up
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def check_requirements():
    """Check if required packages are installed"""
    try:
        import fastapi
        import motor
        import bcrypt
        import jwt
        import python_dotenv
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing package: {e}")
        print("Please install requirements: pip install -r backend/requirements.txt")
        return False

def check_env_file():
    """Check if .env file exists in backend directory"""
    env_path = Path("backend/.env")
    if not env_path.exists():
        print("❌ .env file not found in backend directory")
        print("Please create backend/.env with the following variables:")
        print("MONGO_URL=your_mongodb_atlas_connection_string")
        print("DB_NAME=your_database_name")
        print("JWT_SECRET_KEY=your_secret_key")
        print("CORS_ORIGINS=http://localhost:3000")
        return False
    print("✅ .env file found")
    return True

def setup_initial_data():
    """Run the setup script to create initial data"""
    try:
        print("🔄 Setting up initial data...")
        result = subprocess.run([
            sys.executable, "scripts/setup_initial_data.py"
        ], capture_output=True, text=True, cwd=".")
        
        if result.returncode == 0:
            print("✅ Initial data setup completed")
            print(result.stdout)
            return True
        else:
            print("❌ Failed to setup initial data")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Error setting up initial data: {e}")
        return False

def start_server():
    """Start the FastAPI server"""
    try:
        print("🚀 Starting backend server...")
        print("Server will be available at: http://localhost:8000")
        print("API documentation at: http://localhost:8000/docs")
        print("Press Ctrl+C to stop the server")
        print("-" * 50)
        
        # Start the server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "backend.server:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")

def main():
    print("🎓 Pariksha Sarthi Backend Setup")
    print("=" * 40)
    
    # Check requirements
    if not check_requirements():
        return
    
    # Check environment file
    if not check_env_file():
        return
    
    # Setup initial data
    if not setup_initial_data():
        print("⚠️  Continuing without initial data setup...")
    
    # Start server
    start_server()

if __name__ == "__main__":
    main()
