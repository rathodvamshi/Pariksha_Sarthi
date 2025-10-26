from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_db():
    # MongoDB connection
    mongo_url = os.environ['MONGO_URL'].strip('"')
    db_name = os.environ['DB_NAME'].strip('"')
    
    print(f"Connecting to MongoDB: {mongo_url}")
    print(f"Database name: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # List collections
    collections = await db.list_collection_names()
    print(f"Collections: {collections}")
    
    # Check if users collection exists
    if 'users' in collections:
        users = await db.users.find({}).to_list(100)
        print(f"Users count: {len(users)}")
        
        # Check for students
        students = await db.users.find({"role": "student"}).to_list(100)
        print(f"Students count: {len(students)}")
        
        if students:
            print("\nSample students:")
            for student in students[:3]:
                print(f"ID: {student.get('id')}")
                print(f"Roll Number: {student.get('rollNumber')}")
                print(f"Name: {student.get('profile', {}).get('name')}")
                print(f"Branch: {student.get('profile', {}).get('branch')}")
                print(f"Year: {student.get('profile', {}).get('year')}")
                print("---")
        else:
            print("\nNo students found in the database.")
    else:
        print("Users collection does not exist.")

if __name__ == "__main__":
    asyncio.run(check_db())