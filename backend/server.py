from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL'].strip('"')
db_name = os.environ['DB_NAME'].strip('"')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ============ MODELS ============

class College(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str

class UserProfile(BaseModel):
    name: str
    employeeId: Optional[str] = None
    dob: Optional[str] = None  # For students
    branch: Optional[str] = None
    year: Optional[int] = None
    section: Optional[str] = None
    attendancePercent: Optional[float] = 85.0

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collegeId: str
    email: Optional[EmailStr] = None
    rollNumber: Optional[str] = None
    password: str
    role: str  # "admin", "invigilator", "student"
    profile: UserProfile

class LoginRequest(BaseModel):
    collegeId: str
    email: Optional[str] = None
    rollNumber: Optional[str] = None
    password: str
    role: str

class TokenResponse(BaseModel):
    token: str
    user: Dict[str, Any]

class Block(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collegeId: str
    name: str

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    blockId: str
    roomNumber: str
    capacity: int
    benches: int = 20

class ExamSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collegeId: str
    title: str
    date: str
    startTime: str
    endTime: str
    subjects: List[str]
    years: List[int]
    branches: List[str]
    allocationType: str = "random"  # "random" or "jumbled"
    studentsPerBench: int = 1

class Allocation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examSessionId: str
    studentId: str
    roomId: str
    benchNumber: int
    seatPosition: Optional[str] = None  # "A", "B" or None
    attendance: str = "pending"  # "pending", "present", "absent"

class InvigilatorDuty(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examSessionId: str
    invigilatorId: str
    roomId: str
    status: str = "pending"  # "pending", "accepted", "declined"
    declineReason: Optional[str] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    message: str
    isRead: bool = False
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class IncidentReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examSessionId: str
    invigilatorId: str
    roomId: str
    studentId: Optional[str] = None
    description: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============ HELPER FUNCTIONS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# ============ AUTH ROUTES ============

class SignupRequest(BaseModel):
    collegeName: str
    email: EmailStr
    password: str
    name: str

@api_router.post("/auth/signup")
async def signup(request: SignupRequest):
    # Check if email already exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new college
    college_id = str(uuid.uuid4())
    college = {
        "id": college_id,
        "name": request.collegeName,
        "address": ""
    }
    
    # Check if college with same name exists
    existing_college = await db.colleges.find_one({"name": request.collegeName})
    if existing_college:
        college_id = existing_college["id"]
    else:
        await db.colleges.insert_one(college)
    
    # Create admin user
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(request.password)
    
    admin_user = {
        "id": user_id,
        "collegeId": college_id,
        "email": request.email,
        "password": hashed_password,
        "role": "admin",
        "profile": {
            "name": request.name,
            "employeeId": f"ADM{str(uuid.uuid4())[:6].upper()}"
        }
    }
    
    await db.users.insert_one(admin_user)
    
    return {
        "message": "Signup successful! Please login with your credentials.",
        "collegeId": college_id,
        "email": request.email
    }

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    # Find user based on role
    query = {"collegeId": request.collegeId, "role": request.role}
    
    if request.role == "student":
        if not request.rollNumber:
            raise HTTPException(status_code=400, detail="Roll number is required for students")
        query["rollNumber"] = request.rollNumber
    else:
        if not request.email:
            raise HTTPException(status_code=400, detail="Email is required for admin/invigilator")
        query["email"] = request.email
    
    user = await db.users.find_one(query, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create access token
    token = create_access_token({"user_id": user["id"], "role": user["role"]})
    
    # Remove password from response
    user_data = {k: v for k, v in user.items() if k != "password"}
    
    return TokenResponse(token=token, user=user_data)

@api_router.get("/auth/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password"}

# ============ COLLEGE ROUTES ============

@api_router.get("/colleges", response_model=List[College])
async def get_colleges():
    colleges = await db.colleges.find({}, {"_id": 0}).to_list(1000)
    return colleges

@api_router.post("/colleges", response_model=College)
async def create_college(college: College):
    doc = college.model_dump()
    await db.colleges.insert_one(doc)
    return college

# ============ BLOCK ROUTES ============

@api_router.get("/blocks/{college_id}", response_model=List[Block])
async def get_blocks(college_id: str, current_user: dict = Depends(get_current_user)):
    blocks = await db.blocks.find({"collegeId": college_id}, {"_id": 0}).to_list(1000)
    return blocks

@api_router.post("/blocks", response_model=Block)
async def create_block(block: Block, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create blocks")
    doc = block.model_dump()
    await db.blocks.insert_one(doc)
    return block

@api_router.delete("/blocks/{block_id}")
async def delete_block(block_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete blocks")
    await db.blocks.delete_one({"id": block_id})
    await db.rooms.delete_many({"blockId": block_id})
    return {"message": "Block deleted successfully"}

# ============ ROOM ROUTES ============

@api_router.get("/rooms/{block_id}", response_model=List[Room])
async def get_rooms(block_id: str, current_user: dict = Depends(get_current_user)):
    rooms = await db.rooms.find({"blockId": block_id}, {"_id": 0}).to_list(1000)
    return rooms

@api_router.post("/rooms", response_model=Room)
async def create_room(room: Room, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create rooms")
    doc = room.model_dump()
    await db.rooms.insert_one(doc)
    return room

@api_router.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, room: Room, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update rooms")
    doc = room.model_dump()
    await db.rooms.update_one({"id": room_id}, {"$set": doc})
    return room

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete rooms")
    await db.rooms.delete_one({"id": room_id})
    return {"message": "Room deleted successfully"}

# ============ STUDENT ROUTES ============

@api_router.get("/students/{college_id}", response_model=List[User])
async def get_students(college_id: str, year: Optional[int] = None, branch: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"collegeId": college_id, "role": "student"}
    if year:
        query["profile.year"] = year
    if branch:
        query["profile.branch"] = branch
    students = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    return students

@api_router.post("/students", response_model=User)
async def create_student(user: User, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create students")
    
    # Check if student already exists
    existing = await db.users.find_one({"collegeId": user.collegeId, "rollNumber": user.rollNumber})
    if existing:
        raise HTTPException(status_code=400, detail="Student with this roll number already exists")
    
    user.role = "student"
    user.password = hash_password(user.password)
    doc = user.model_dump()
    await db.users.insert_one(doc)
    return user

@api_router.post("/students/bulk")
async def create_students_bulk(students: List[User], current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create students")
    
    docs = []
    for student in students:
        student.role = "student"
        student.password = hash_password(student.password)
        docs.append(student.model_dump())
    
    if docs:
        await db.users.insert_many(docs)
    
    return {"message": f"{len(docs)} students created successfully"}

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete students")
    await db.users.delete_one({"id": student_id, "role": "student"})
    return {"message": "Student deleted successfully"}

# ============ STAFF ROUTES ============

@api_router.get("/staff/{college_id}")
async def get_staff(college_id: str, role: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view staff")
    
    staff = await db.users.find({"collegeId": college_id, "role": role}, {"_id": 0, "password": 0}).to_list(1000)
    return staff

@api_router.post("/staff", response_model=User)
async def create_staff(user: User, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create staff")
    
    # Check if staff already exists
    existing = await db.users.find_one({"collegeId": user.collegeId, "email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Staff with this email already exists")
    
    user.password = hash_password(user.password)
    doc = user.model_dump()
    await db.users.insert_one(doc)
    return user

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete staff")
    await db.users.delete_one({"id": staff_id})
    return {"message": "Staff deleted successfully"}

# ============ EXAM ROUTES ============

@api_router.get("/exams/{college_id}", response_model=List[ExamSession])
async def get_exams(college_id: str, current_user: dict = Depends(get_current_user)):
    exams = await db.examSessions.find({"collegeId": college_id}, {"_id": 0}).to_list(1000)
    return exams

@api_router.post("/exams", response_model=ExamSession)
async def create_exam(exam: ExamSession, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create exams")
    doc = exam.model_dump()
    await db.examSessions.insert_one(doc)
    return exam

@api_router.post("/exams/{exam_id}/allocate")
async def allocate_seats(exam_id: str, room_ids: List[str], current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can allocate seats")
    
    # Get exam details
    exam = await db.examSessions.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get students for the exam
    query = {
        "collegeId": exam["collegeId"],
        "role": "student",
        "profile.year": {"$in": exam["years"]},
        "profile.branch": {"$in": exam["branches"]}
    }
    students = await db.users.find(query, {"_id": 0}).to_list(10000)
    
    # Get selected rooms
    rooms = await db.rooms.find({"id": {"$in": room_ids}}, {"_id": 0}).to_list(1000)
    
    # Calculate total capacity
    total_capacity = sum(room["benches"] * exam["studentsPerBench"] for room in rooms)
    
    if len(students) > total_capacity:
        raise HTTPException(status_code=400, detail=f"Not enough capacity. Students: {len(students)}, Capacity: {total_capacity}")
    
    # Clear existing allocations for this exam
    await db.allocations.delete_many({"examSessionId": exam_id})
    
    # Allocate seats
    allocations = []
    
    if exam["allocationType"] == "jumbled":
        # Group students by branch and year
        groups = {}
        for student in students:
            key = f"{student['profile']['branch']}_{student['profile']['year']}"
            if key not in groups:
                groups[key] = []
            groups[key].append(student)
        
        # Interleave students from different groups
        interleaved = []
        max_len = max(len(g) for g in groups.values()) if groups else 0
        for i in range(max_len):
            for group in groups.values():
                if i < len(group):
                    interleaved.append(group[i])
        students = interleaved
    else:
        # Random allocation
        random.shuffle(students)
    
    # Assign seats
    student_idx = 0
    for room in rooms:
        for bench in range(1, room["benches"] + 1):
            for seat_pos in range(exam["studentsPerBench"]):
                if student_idx >= len(students):
                    break
                
                allocation = Allocation(
                    examSessionId=exam_id,
                    studentId=students[student_idx]["id"],
                    roomId=room["id"],
                    benchNumber=bench,
                    seatPosition="A" if exam["studentsPerBench"] == 2 and seat_pos == 0 else "B" if exam["studentsPerBench"] == 2 else None
                )
                allocations.append(allocation.model_dump())
                student_idx += 1
            
            if student_idx >= len(students):
                break
        
        if student_idx >= len(students):
            break
    
    # Save allocations
    if allocations:
        await db.allocations.insert_many(allocations)
    
    # Create notifications for students
    notifications = []
    for allocation in allocations:
        room = next(r for r in rooms if r["id"] == allocation["roomId"])
        block = await db.blocks.find_one({"id": room["blockId"]}, {"_id": 0})
        notification = Notification(
            userId=allocation["studentId"],
            message=f"Your seating for {exam['title']} is confirmed. Block: {block['name']}, Room: {room['roomNumber']}, Bench: {allocation['benchNumber']}"
        )
        notifications.append(notification.model_dump())
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    return {"message": f"Successfully allocated {len(allocations)} seats", "count": len(allocations)}

@api_router.get("/allocations/exam/{exam_id}")
async def get_exam_allocations(exam_id: str, current_user: dict = Depends(get_current_user)):
    allocations = await db.allocations.find({"examSessionId": exam_id}, {"_id": 0}).to_list(10000)
    
    # Enrich with student and room details
    enriched = []
    for alloc in allocations:
        student = await db.users.find_one({"id": alloc["studentId"]}, {"_id": 0, "password": 0})
        room = await db.rooms.find_one({"id": alloc["roomId"]}, {"_id": 0})
        block = await db.blocks.find_one({"id": room["blockId"]}, {"_id": 0}) if room else None
        
        enriched.append({
            **alloc,
            "student": student,
            "room": room,
            "block": block
        })
    
    return enriched

@api_router.get("/allocations/student/{student_id}")
async def get_student_allocations(student_id: str):
    allocations = await db.allocations.find({"studentId": student_id}, {"_id": 0}).to_list(1000)
    
    # Enrich with exam, room, and block details
    enriched = []
    for alloc in allocations:
        exam = await db.examSessions.find_one({"id": alloc["examSessionId"]}, {"_id": 0})
        room = await db.rooms.find_one({"id": alloc["roomId"]}, {"_id": 0})
        block = await db.blocks.find_one({"id": room["blockId"]}, {"_id": 0}) if room else None
        
        enriched.append({
            **alloc,
            "exam": exam,
            "room": room,
            "block": block
        })
    
    return enriched

# ============ INVIGILATOR DUTY ROUTES ============

@api_router.post("/duties", response_model=InvigilatorDuty)
async def create_duty(duty: InvigilatorDuty, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign duties")
    
    doc = duty.model_dump()
    await db.invigilatorDuties.insert_one(doc)
    
    # Create notification for invigilator
    exam = await db.examSessions.find_one({"id": duty.examSessionId}, {"_id": 0})
    room = await db.rooms.find_one({"id": duty.roomId}, {"_id": 0})
    
    notification = Notification(
        userId=duty.invigilatorId,
        message=f"You have been assigned to Room {room['roomNumber']} for {exam['title']} on {exam['date']}"
    )
    await db.notifications.insert_one(notification.model_dump())
    
    return duty

@api_router.get("/duties/invigilator/{invigilator_id}")
async def get_invigilator_duties(invigilator_id: str, current_user: dict = Depends(get_current_user)):
    duties = await db.invigilatorDuties.find({"invigilatorId": invigilator_id}, {"_id": 0}).to_list(1000)
    
    # Enrich with exam and room details
    enriched = []
    for duty in duties:
        exam = await db.examSessions.find_one({"id": duty["examSessionId"]}, {"_id": 0})
        room = await db.rooms.find_one({"id": duty["roomId"]}, {"_id": 0})
        block = await db.blocks.find_one({"id": room["blockId"]}, {"_id": 0}) if room else None
        
        enriched.append({
            **duty,
            "exam": exam,
            "room": room,
            "block": block
        })
    
    return enriched

@api_router.put("/duties/{duty_id}/status")
async def update_duty_status(duty_id: str, status: str, reason: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    update_data = {"status": status}
    if reason:
        update_data["declineReason"] = reason
    
    await db.invigilatorDuties.update_one({"id": duty_id}, {"$set": update_data})
    return {"message": "Duty status updated successfully"}

@api_router.get("/duties/room/{room_id}/exam/{exam_id}")
async def get_room_students(room_id: str, exam_id: str, current_user: dict = Depends(get_current_user)):
    allocations = await db.allocations.find({"roomId": room_id, "examSessionId": exam_id}, {"_id": 0}).to_list(1000)
    
    # Enrich with student details
    enriched = []
    for alloc in allocations:
        student = await db.users.find_one({"id": alloc["studentId"]}, {"_id": 0, "password": 0})
        enriched.append({
            **alloc,
            "student": student
        })
    
    return enriched

@api_router.put("/allocations/{allocation_id}/attendance")
async def mark_attendance(allocation_id: str, attendance: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "invigilator":
        raise HTTPException(status_code=403, detail="Only invigilators can mark attendance")
    
    await db.allocations.update_one({"id": allocation_id}, {"$set": {"attendance": attendance}})
    return {"message": "Attendance marked successfully"}

# ============ INCIDENT REPORTS ============

@api_router.post("/incidents", response_model=IncidentReport)
async def create_incident(incident: IncidentReport, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "invigilator":
        raise HTTPException(status_code=403, detail="Only invigilators can report incidents")
    
    doc = incident.model_dump()
    await db.incidents.insert_one(doc)
    return incident

@api_router.get("/incidents/exam/{exam_id}")
async def get_exam_incidents(exam_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view incidents")
    
    incidents = await db.incidents.find({"examSessionId": exam_id}, {"_id": 0}).to_list(1000)
    return incidents

# ============ NOTIFICATION ROUTES ============

@api_router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find({"userId": user_id}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id}, {"$set": {"isRead": True}})
    return {"message": "Notification marked as read"}

# ============ STATS ROUTES ============

@api_router.get("/stats/{college_id}")
async def get_stats(college_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view stats")
    
    total_students = await db.users.count_documents({"collegeId": college_id, "role": "student"})
    total_blocks = await db.blocks.count_documents({"collegeId": college_id})
    total_rooms = 0
    blocks = await db.blocks.find({"collegeId": college_id}, {"_id": 0}).to_list(1000)
    for block in blocks:
        room_count = await db.rooms.count_documents({"blockId": block["id"]})
        total_rooms += room_count
    
    total_exams = await db.examSessions.count_documents({"collegeId": college_id})
    total_staff = await db.users.count_documents({"collegeId": college_id, "role": {"$in": ["admin", "invigilator"]}})
    
    return {
        "totalStudents": total_students,
        "totalBlocks": total_blocks,
        "totalRooms": total_rooms,
        "totalExams": total_exams,
        "totalStaff": total_staff
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()