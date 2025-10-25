import asyncio
import sys
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path('/app/backend')
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def setup_initial_data():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🚀 Setting up Pariksha Sarthi initial data...")
    
    # Create a sample college
    college_id = str(uuid.uuid4())
    college = {
        "id": college_id,
        "name": "Global Institute of Technology",
        "address": "Hyderabad, India"
    }
    
    # Check if college exists
    existing_college = await db.colleges.find_one({"name": college["name"]})
    if not existing_college:
        await db.colleges.insert_one(college)
        print(f"✅ Created college: {college['name']}")
    else:
        college_id = existing_college["id"]
        print(f"ℹ️  College already exists: {college['name']}")
    
    # Create admin user
    admin_password = "admin123"
    hashed_password = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    admin = {
        "id": str(uuid.uuid4()),
        "collegeId": college_id,
        "email": "admin@git.com",
        "password": hashed_password,
        "role": "admin",
        "profile": {
            "name": "Dr. Suresh Kumar",
            "employeeId": "ADM001"
        }
    }
    
    existing_admin = await db.users.find_one({"email": admin["email"]})
    if not existing_admin:
        await db.users.insert_one(admin)
        print(f"✅ Created admin: {admin['email']}")
        print(f"   Password: {admin_password}")
    else:
        print(f"ℹ️  Admin already exists: {admin['email']}")
    
    # Create sample invigilator
    invig_password = "invig123"
    hashed_invig_password = bcrypt.hashpw(invig_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    invigilator = {
        "id": str(uuid.uuid4()),
        "collegeId": college_id,
        "email": "invig1@git.com",
        "password": hashed_invig_password,
        "role": "invigilator",
        "profile": {
            "name": "Prof. Rajesh Sharma",
            "employeeId": "INV001"
        }
    }
    
    existing_invig = await db.users.find_one({"email": invigilator["email"]})
    if not existing_invig:
        await db.users.insert_one(invigilator)
        print(f"✅ Created invigilator: {invigilator['email']}")
        print(f"   Password: {invig_password}")
    else:
        print(f"ℹ️  Invigilator already exists: {invigilator['email']}")
    
    # Create sample student
    student_password = "student123"
    hashed_student_password = bcrypt.hashpw(student_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    student = {
        "id": str(uuid.uuid4()),
        "collegeId": college_id,
        "rollNumber": "22A91A0501",
        "password": hashed_student_password,
        "role": "student",
        "profile": {
            "name": "Rohan Sharma",
            "dob": "2004-05-10",
            "branch": "CSE",
            "year": 3,
            "section": "A",
            "attendancePercent": 85.0
        }
    }
    
    existing_student = await db.users.find_one({"rollNumber": student["rollNumber"]})
    if not existing_student:
        await db.users.insert_one(student)
        print(f"✅ Created student: {student['rollNumber']}")
        print(f"   Password: {student_password}")
    else:
        print(f"ℹ️  Student already exists: {student['rollNumber']}")
    
    # Create sample blocks
    blocks = [
        {"id": str(uuid.uuid4()), "collegeId": college_id, "name": "A Block (Main Building)"},
        {"id": str(uuid.uuid4()), "collegeId": college_id, "name": "B Block (Engineering)"}
    ]
    
    for block in blocks:
        existing_block = await db.blocks.find_one({"collegeId": college_id, "name": block["name"]})
        if not existing_block:
            await db.blocks.insert_one(block)
            print(f"✅ Created block: {block['name']}")
        else:
            blocks[blocks.index(block)] = existing_block
            print(f"ℹ️  Block already exists: {block['name']}")
    
    # Create sample rooms
    rooms = []
    for i, block in enumerate(blocks):
        for room_num in range(1, 4):
            room = {
                "id": str(uuid.uuid4()),
                "blockId": block["id"],
                "roomNumber": f"{chr(65+i)}-{100+room_num}",
                "capacity": 40,
                "benches": 20
            }
            existing_room = await db.rooms.find_one({"blockId": block["id"], "roomNumber": room["roomNumber"]})
            if not existing_room:
                await db.rooms.insert_one(room)
                rooms.append(room)
                print(f"✅ Created room: {room['roomNumber']}")
            else:
                print(f"ℹ️  Room already exists: {room['roomNumber']}")
    
    print("\n" + "="*50)
    print("🎉 Setup complete!")
    print("="*50)
    print("\n📋 Login Credentials:\n")
    print("Admin:")
    print(f"  College: {college['name']}")
    print(f"  Email: admin@git.com")
    print(f"  Password: admin123\n")
    print("Invigilator:")
    print(f"  College: {college['name']}")
    print(f"  Email: invig1@git.com")
    print(f"  Password: invig123\n")
    print("Student:")
    print(f"  College: {college['name']}")
    print(f"  Roll Number: 22A91A0501")
    print(f"  Password: student123\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_initial_data())
