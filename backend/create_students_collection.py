from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
from dotenv import load_dotenv
from pathlib import Path
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def create_students_collection():
    # MongoDB connection
    mongo_url = os.environ['MONGO_URL'].strip('"')
    db_name = os.environ['DB_NAME'].strip('"')
    
    print(f"Connecting to MongoDB: {mongo_url}")
    print(f"Database name: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Check if students collection already exists
    collections = await db.list_collection_names()
    if 'students' in collections:
        print("Students collection already exists. Dropping it to recreate...")
        await db.students.drop()
    
    # Create students collection with indexes
    await db.create_collection("students")
    
    # Create indexes for efficient querying
    await db.students.create_index("collegeId")
    await db.students.create_index("year")
    await db.students.create_index("branch")
    await db.students.create_index("rollNumber", unique=True)
    
    print("Students collection created with indexes")
    
    # Migrate existing students from users collection
    users = await db.users.find({"role": "student"}).to_list(1000)
    if users:
        print(f"Found {len(users)} students to migrate")
        
        for user in users:
            # Create student document with year and branch at the top level
            student_doc = {
                "id": user.get("id", str(uuid.uuid4())),
                "collegeId": user.get("collegeId"),
                "rollNumber": user.get("rollNumber"),
                "name": user.get("profile", {}).get("name", ""),
                "email": user.get("email", ""),
                "year": user.get("profile", {}).get("year", 1),
                "branch": user.get("profile", {}).get("branch", "CSE"),
                "section": user.get("profile", {}).get("section", "A"),
                "attendancePercent": user.get("profile", {}).get("attendancePercent", 85),
                "dob": user.get("profile", {}).get("dob", ""),
                "password": user.get("password", "")  # Keep password for authentication
            }
            
            try:
                await db.students.insert_one(student_doc)
                print(f"Migrated student: {student_doc['rollNumber']}")
            except Exception as e:
                print(f"Error migrating student {student_doc['rollNumber']}: {str(e)}")
        
        print("Migration completed")
    else:
        print("No students found to migrate")

if __name__ == "__main__":
    asyncio.run(create_students_collection())