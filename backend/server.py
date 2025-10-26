from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
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
import csv
import io

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
    status: str = "draft"  # "draft", "scheduled", "completed"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DraftExam(BaseModel):
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
    allocationType: str = "serial"
    studentsPerBench: int = 1
    selectedRooms: List[str] = []
    selectedInvigilators: Dict[str, str] = {}  # roomId -> invigilatorId
    studentAllocations: List[Dict] = []  # Detailed student allocations
    status: str = "draft"  # "draft", "finalized"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CalendarEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collegeId: str
    title: str
    date: str
    time: str
    branch: Optional[str] = None
    room: Optional[str] = None
    type: str = "exam"  # "exam", "event"
    status: str = "scheduled"  # "scheduled", "draft", "completed"
    examId: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BranchSubject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collegeId: str
    branch: str
    year: int
    subjects: List[str]

class ExamRoom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examSessionId: str
    roomId: str
    invigilatorId: Optional[str] = None
    capacity: int
    benches: int
    studentsPerBench: int

class ExamStudent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examSessionId: str
    studentId: str
    roomId: str
    benchNumber: int
    seatPosition: Optional[str] = None
    attendance: str = "pending"

class ExamInvigilator(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examSessionId: str
    invigilatorId: str
    roomId: str
    status: str = "pending"

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

class ExamAttendanceRestriction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    examId: str
    studentId: str
    attendancePercentage: float
    isAllowed: bool = False
    grantedBy: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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

# Student model for the dedicated students collection
class Student(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collegeId: str
    rollNumber: str
    name: str
    email: Optional[EmailStr] = None
    year: int
    branch: str
    section: Optional[str] = "A"
    attendancePercent: Optional[float] = 85.0
    dob: Optional[str] = None
    password: Optional[str] = None  # Only used for creation, never returned

@api_router.get("/students/{college_id}")
async def get_students(college_id: str, year: Optional[int] = None, branch: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"collegeId": college_id}
    if year:
        query["year"] = year
    if branch:
        query["branch"] = branch
    
    # First try the dedicated students collection
    students = await db.students.find(query, {"_id": 0, "password": 0}).to_list(1000)
    
    # If no students found and the collection might be empty, fall back to users collection
    if not students:
        legacy_query = {"collegeId": college_id, "role": "student"}
        if year:
            legacy_query["profile.year"] = year
        if branch:
            legacy_query["profile.branch"] = branch
        
        legacy_students = await db.users.find(legacy_query, {"_id": 0, "password": 0}).to_list(1000)
        
        # Transform legacy format to new format
        for student in legacy_students:
            profile = student.get("profile", {})
            students.append({
                "id": student.get("id"),
                "collegeId": student.get("collegeId"),
                "rollNumber": student.get("rollNumber"),
                "name": profile.get("name", ""),
                "email": student.get("email"),
                "year": profile.get("year", 1),
                "branch": profile.get("branch", "CSE"),
                "section": profile.get("section", "A"),
                "attendancePercent": profile.get("attendancePercent", 85.0),
                "dob": profile.get("dob", "")
            })
    
    return students

@api_router.post("/students")
async def create_student(student: Student, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create students")
    
    # Check if student already exists in students collection
    existing = await db.students.find_one({"collegeId": student.collegeId, "rollNumber": student.rollNumber})
    if existing:
        raise HTTPException(status_code=409, detail="Student with this roll number already exists")
    
    # Check if student exists in legacy users collection
    legacy_existing = await db.users.find_one({"collegeId": student.collegeId, "rollNumber": student.rollNumber, "role": "student"})
    if legacy_existing:
        raise HTTPException(status_code=409, detail="Student with this roll number already exists in legacy system")
    
    # Set password to roll number if not provided
    if not student.password:
        student.password = student.rollNumber
    
    # Hash the password
    hashed_password = hash_password(student.password)
    
    # Create student document
    student_doc = student.model_dump()
    student_doc["password"] = hashed_password
    
    # Insert into students collection
    await db.students.insert_one(student_doc)
    
    # Also create in users collection for authentication compatibility
    user_doc = {
        "id": student.id,
        "collegeId": student.collegeId,
        "email": student.email,
        "rollNumber": student.rollNumber,
        "password": hashed_password,
        "role": "student",
        "profile": {
            "name": student.name,
            "dob": student.dob,
            "branch": student.branch,
            "year": student.year,
            "section": student.section,
            "attendancePercent": student.attendancePercent
        }
    }
    await db.users.insert_one(user_doc)
    
    # Return student without password
    result = student_doc.copy()
    result.pop("password", None)
    return result

@api_router.post("/students/bulk")
async def create_students_bulk(students: List[Student], current_user: dict = Depends(get_current_user)):
    print(f"=== BULK IMPORT DEBUG ===")
    print(f"Number of students received: {len(students)}")
    print(f"Current user: {current_user}")
    print(f"User role: {current_user.get('role')}")
    print(f"User collegeId: {current_user.get('collegeId')}")
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create students")
    
    student_docs = []
    user_docs = []
    duplicates = []
    
    for student in students:
        # Check if student already exists in students collection
        existing = await db.students.find_one({"collegeId": student.collegeId, "rollNumber": student.rollNumber})
        if existing:
            duplicates.append(student.rollNumber)
            continue
        
        # Check if student exists in legacy users collection
        legacy_existing = await db.users.find_one({"collegeId": student.collegeId, "rollNumber": student.rollNumber, "role": "student"})
        if legacy_existing:
            duplicates.append(student.rollNumber)
            continue
        
        # Set password to roll number if not provided
        if not student.password:
            student.password = student.rollNumber
        
        # Hash the password
        hashed_password = hash_password(student.password)
        
        # Create student document
        student_doc = student.model_dump()
        student_doc["password"] = hashed_password
        student_docs.append(student_doc)
        
        # Also create user document for authentication compatibility
        user_doc = {
            "id": student.id,
            "collegeId": student.collegeId,
            "email": student.email,
            "rollNumber": student.rollNumber,
            "password": hashed_password,
            "role": "student",
            "profile": {
                "name": student.name,
                "dob": student.dob,
                "branch": student.branch,
                "year": student.year,
                "section": student.section,
                "attendancePercent": student.attendancePercent
            }
        }
        user_docs.append(user_doc)
    
    # Insert documents
    print(f"About to insert {len(student_docs)} students and {len(user_docs)} users")
    
    if student_docs:
        try:
            print("Inserting into students collection...")
            result_students = await db.students.insert_many(student_docs)
            print(f"✅ Inserted {len(result_students.inserted_ids)} students into students collection")
            
            print("Inserting into users collection...")
            result_users = await db.users.insert_many(user_docs)
            print(f"✅ Inserted {len(result_users.inserted_ids)} users into users collection")
            
            # Verify insertion
            for student_doc in student_docs:
                inserted_student = await db.students.find_one({"id": student_doc["id"]})
                if inserted_student:
                    print(f"✅ Verified student {student_doc['rollNumber']} in students collection")
                else:
                    print(f"❌ Student {student_doc['rollNumber']} NOT found in students collection")
                
                inserted_user = await db.users.find_one({"id": student_doc["id"]})
                if inserted_user:
                    print(f"✅ Verified user {student_doc['rollNumber']} in users collection")
                else:
                    print(f"❌ User {student_doc['rollNumber']} NOT found in users collection")
                    
        except Exception as e:
            print(f"❌ Error during insertion: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")
    
    result_message = f"{len(student_docs)} students created successfully"
    if duplicates:
        result_message += f", {len(duplicates)} duplicates skipped"
    
    print(f"=== BULK IMPORT COMPLETE: {result_message} ===")
    return {"message": result_message, "created": len(student_docs), "duplicates": duplicates}

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete students")
    
    # Delete from both collections
    await db.students.delete_one({"id": student_id})
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

@api_router.get("/exams/{exam_id}", response_model=ExamSession)
async def get_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    exam = await db.examSessions.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam

@api_router.post("/exams", response_model=ExamSession)
async def create_exam(exam: ExamSession, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create exams")
    doc = exam.model_dump()
    await db.examSessions.insert_one(doc)
    
    # Create calendar event for the exam
    calendar_event = CalendarEvent(
        collegeId=exam.collegeId,
        title=exam.title,
        date=exam.date,
        time=exam.startTime,
        type="exam",
        status=exam.status,
        examId=exam.id
    )
    await db.calendarEvents.insert_one(calendar_event.model_dump())
    
    return exam

@api_router.put("/exams/{exam_id}", response_model=ExamSession)
async def update_exam(exam_id: str, exam: ExamSession, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update exams")
    
    # Use atomic transaction for exam updates
    async with db.client.start_session() as session:
        async with session.start_transaction():
            exam.updatedAt = datetime.now(timezone.utc).isoformat()
            doc = exam.model_dump()
            await db.examSessions.update_one({"id": exam_id}, {"$set": doc}, session=session)
            
            # Update calendar event
            await db.calendarEvents.update_one(
                {"examId": exam_id},
                {"$set": {
                    "title": exam.title,
                    "date": exam.date,
                    "time": exam.startTime,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }},
                session=session
            )
    
    return exam

# ============ CALENDAR EVENTS ROUTES ============

@api_router.get("/calendar_events/{college_id}")
async def get_calendar_events(college_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view calendar events")
    
    events = await db.calendarEvents.find({"collegeId": college_id}, {"_id": 0}).to_list(1000)
    return events

@api_router.post("/calendar_events", response_model=CalendarEvent)
async def create_calendar_event(event: CalendarEvent, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create calendar events")
    
    doc = event.model_dump()
    await db.calendarEvents.insert_one(doc)
    return event

@api_router.put("/calendar_events/{event_id}", response_model=CalendarEvent)
async def update_calendar_event(event_id: str, event: CalendarEvent, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update calendar events")
    
    doc = event.model_dump()
    await db.calendarEvents.update_one({"id": event_id}, {"$set": doc})
    return event

@api_router.delete("/calendar_events/{event_id}")
async def delete_calendar_event(event_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete calendar events")
    
    await db.calendarEvents.delete_one({"id": event_id})
    return {"message": "Calendar event deleted successfully"}

@api_router.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete exams")
    
    # Delete related data
    await db.examSessions.delete_one({"id": exam_id})
    await db.allocations.delete_many({"examSessionId": exam_id})
    await db.invigilatorDuties.delete_many({"examSessionId": exam_id})
    await db.examRooms.delete_many({"examSessionId": exam_id})
    await db.examStudents.delete_many({"examSessionId": exam_id})
    await db.examInvigilators.delete_many({"examSessionId": exam_id})
    
    return {"message": "Exam deleted successfully"}

# ============ DRAFT EXAM ROUTES ============

@api_router.post("/draft_exam", response_model=DraftExam)
async def save_draft_exam(draft: DraftExam, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can save draft exams")
    
    draft.updatedAt = datetime.now(timezone.utc).isoformat()
    doc = draft.model_dump()
    await db.draftExams.insert_one(doc)
    
    # Create calendar event for draft
    calendar_event = CalendarEvent(
        collegeId=draft.collegeId,
        title=f"[DRAFT] {draft.title}",
        date=draft.date,
        time=draft.startTime,
        type="exam",
        status="draft",
        examId=draft.id
    )
    await db.calendarEvents.insert_one(calendar_event.model_dump())
    
    return draft

@api_router.get("/draft_exam/{college_id}", response_model=List[DraftExam])
async def get_draft_exams(college_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view draft exams")
    
    drafts = await db.draftExams.find({"collegeId": college_id}, {"_id": 0}).to_list(1000)
    return drafts

@api_router.get("/draft_exam/{draft_id}", response_model=DraftExam)
async def get_draft_exam(draft_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view draft exams")
    
    draft = await db.draftExams.find_one({"id": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft exam not found")
    return draft

@api_router.put("/draft_exam/{draft_id}", response_model=DraftExam)
async def update_draft_exam(draft_id: str, draft: DraftExam, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update draft exams")
    
    draft.updatedAt = datetime.now(timezone.utc).isoformat()
    doc = draft.model_dump()
    await db.draftExams.update_one({"id": draft_id}, {"$set": doc})
    
    # Update calendar event
    await db.calendarEvents.update_one(
        {"examId": draft_id},
        {"$set": {
            "title": f"[DRAFT] {draft.title}",
            "date": draft.date,
            "time": draft.startTime,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return draft

@api_router.delete("/draft_exam/{draft_id}")
async def delete_draft_exam(draft_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete draft exams")
    
    await db.draftExams.delete_one({"id": draft_id})
    await db.calendarEvents.delete_many({"examId": draft_id})
    return {"message": "Draft exam deleted successfully"}

@api_router.post("/draft_exam/{draft_id}/finalize")
async def finalize_draft_exam(draft_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can finalize draft exams")
    
    # Get draft exam
    draft = await db.draftExams.find_one({"id": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft exam not found")
    
    # Create finalized exam
    exam = ExamSession(
        collegeId=draft["collegeId"],
        title=draft["title"],
        date=draft["date"],
        startTime=draft["startTime"],
        endTime=draft["endTime"],
        subjects=draft["subjects"],
        years=draft["years"],
        branches=draft["branches"],
        allocationType=draft["allocationType"],
        studentsPerBench=draft["studentsPerBench"],
        status="scheduled"
    )
    
    # Save exam
    await db.examSessions.insert_one(exam.model_dump())
    
    # Create room allocations
    for room_id in draft["selectedRooms"]:
        room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
        if room:
            exam_room = ExamRoom(
                examSessionId=exam.id,
                roomId=room_id,
                invigilatorId=draft["selectedInvigilators"].get(room_id),
                capacity=room["benches"] * draft["studentsPerBench"],
                benches=room["benches"],
                studentsPerBench=draft["studentsPerBench"]
            )
            await db.examRooms.insert_one(exam_room.model_dump())
    
    # Create invigilator duties
    for room_id, invigilator_id in draft["selectedInvigilators"].items():
        if invigilator_id:
            duty = ExamInvigilator(
                examSessionId=exam.id,
                invigilatorId=invigilator_id,
                roomId=room_id
            )
            await db.examInvigilators.insert_one(duty.model_dump())
    
    # Create or update calendar event
    calendar_event = CalendarEvent(
        collegeId=exam.collegeId,
        title=exam.title,
        date=exam.date,
        time=exam.startTime,
        type="exam",
        status="scheduled",
        examId=exam.id
    )
    
    # Update or create calendar event
    existing_event = await db.calendarEvents.find_one({"examId": draft_id})
    if existing_event:
        await db.calendarEvents.update_one(
            {"examId": draft_id},
            {"$set": calendar_event.model_dump()}
        )
    else:
        await db.calendarEvents.insert_one(calendar_event.model_dump())
    
    # Delete draft
    await db.draftExams.delete_one({"id": draft_id})
    
    return {"message": "Draft exam finalized successfully", "examId": exam.id}

# ============ YEARS AND SUBJECTS ROUTES ============

@api_router.get("/years")
async def get_years():
    return [1, 2, 3, 4]

@api_router.get("/subjects")
async def get_subjects(year_id: Optional[int] = None, branch_id: Optional[str] = None, college_id: Optional[str] = None):
    if not college_id:
        # Return default subjects if no college_id provided
        default_subjects = {
            "CSE": ["Data Structures", "Algorithms", "Database Management", "Computer Networks", "Operating Systems"],
            "ECE": ["Digital Electronics", "Signals and Systems", "Communication Systems", "Microprocessors", "VLSI Design"],
            "EEE": ["Power Systems", "Control Systems", "Electrical Machines", "Power Electronics", "Renewable Energy"],
            "MECH": ["Thermodynamics", "Fluid Mechanics", "Machine Design", "Manufacturing Technology", "Heat Transfer"],
            "CIVIL": ["Structural Analysis", "Concrete Technology", "Geotechnical Engineering", "Transportation Engineering", "Environmental Engineering"]
        }
        
        if branch_id and branch_id in default_subjects:
            return default_subjects[branch_id]
        return []
    
    # Query from database
    query = {"collegeId": college_id}
    if year_id:
        query["year"] = year_id
    if branch_id:
        query["branch"] = branch_id
    
    branch_subjects = await db.branchSubjects.find(query, {"_id": 0}).to_list(1000)
    
    if branch_subjects:
        # Return subjects from database
        subjects = set()
        for bs in branch_subjects:
            subjects.update(bs.get("subjects", []))
        return list(subjects)
    
    # Fallback to default subjects
    default_subjects = {
        "CSE": ["Data Structures", "Algorithms", "Database Management", "Computer Networks", "Operating Systems"],
        "ECE": ["Digital Electronics", "Signals and Systems", "Communication Systems", "Microprocessors", "VLSI Design"],
        "EEE": ["Power Systems", "Control Systems", "Electrical Machines", "Power Electronics", "Renewable Energy"],
        "MECH": ["Thermodynamics", "Fluid Mechanics", "Machine Design", "Manufacturing Technology", "Heat Transfer"],
        "CIVIL": ["Structural Analysis", "Concrete Technology", "Geotechnical Engineering", "Transportation Engineering", "Environmental Engineering"]
    }
    
    if branch_id and branch_id in default_subjects:
        return default_subjects[branch_id]
    return []

@api_router.post("/branch_subjects", response_model=BranchSubject)
async def create_branch_subjects(branch_subject: BranchSubject, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create branch subjects")
    
    doc = branch_subject.model_dump()
    await db.branchSubjects.insert_one(doc)
    return branch_subject

# ============ ROOM ALLOCATION ROUTES ============

class AllocateRoomRequest(BaseModel):
    exam_id: str
    room_id: str
    invigilator_id: Optional[str] = None

@api_router.post("/allocate_room")
async def allocate_room(request: AllocateRoomRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can allocate rooms")
    
    # Get exam and room details
    exam = await db.examSessions.find_one({"id": request.exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    room = await db.rooms.find_one({"id": request.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if room is already allocated for this exam
    existing_allocation = await db.examRooms.find_one({
        "examSessionId": request.exam_id,
        "roomId": request.room_id
    })
    if existing_allocation:
        raise HTTPException(status_code=400, detail="Room already allocated for this exam")
    
    # Create exam room allocation
    exam_room = ExamRoom(
        examSessionId=request.exam_id,
        roomId=request.room_id,
        invigilatorId=request.invigilator_id,
        capacity=room["benches"] * exam["studentsPerBench"],
        benches=room["benches"],
        studentsPerBench=exam["studentsPerBench"]
    )
    
    await db.examRooms.insert_one(exam_room.model_dump())
    
    # Create invigilator duty if invigilator assigned
    if request.invigilator_id:
        duty = ExamInvigilator(
            examSessionId=request.exam_id,
            invigilatorId=request.invigilator_id,
            roomId=request.room_id
        )
        await db.examInvigilators.insert_one(duty.model_dump())
    
    return {"message": "Room allocated successfully", "capacity": exam_room.capacity}

@api_router.delete("/allocate_room/{exam_id}/{room_id}")
async def remove_room_allocation(exam_id: str, room_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can remove room allocations")
    
    # Remove exam room allocation
    await db.examRooms.delete_many({"examSessionId": exam_id, "roomId": room_id})
    
    # Remove invigilator duty
    await db.examInvigilators.delete_many({"examSessionId": exam_id, "roomId": room_id})
    
    # Remove student allocations for this room
    await db.allocations.delete_many({"examSessionId": exam_id, "roomId": room_id})
    
    return {"message": "Room allocation removed successfully"}

@api_router.get("/allocate_room/{exam_id}/capacity")
async def get_allocation_capacity(exam_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view allocation capacity")
    
    # Get exam details
    exam = await db.examSessions.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get total students for the exam
    query = {
        "collegeId": exam["collegeId"],
        "role": "student",
        "profile.year": {"$in": exam["years"]},
        "profile.branch": {"$in": exam["branches"]}
    }
    total_students = await db.users.count_documents(query)
    
    # Get allocated capacity
    exam_rooms = await db.examRooms.find({"examSessionId": exam_id}, {"_id": 0}).to_list(1000)
    allocated_capacity = sum(room["capacity"] for room in exam_rooms)
    
    return {
        "totalStudents": total_students,
        "allocatedCapacity": allocated_capacity,
        "remainingCapacity": allocated_capacity - total_students,
        "isComplete": allocated_capacity >= total_students
    }

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
    
    # Filter out students with attendance restrictions (unless permission granted)
    restricted_students = await db.examAttendanceRestrictions.find(
        {"examId": exam_id, "isAllowed": False},
        {"_id": 0}
    ).to_list(1000)
    
    restricted_student_ids = {rest["studentId"] for rest in restricted_students}
    students = [s for s in students if s["id"] not in restricted_student_ids]
    
    # Get selected rooms
    rooms = await db.rooms.find({"id": {"$in": room_ids}}, {"_id": 0}).to_list(1000)
    
    # Calculate total capacity
    total_capacity = sum(room["benches"] * exam["studentsPerBench"] for room in rooms)
    
    if len(students) > total_capacity:
        raise HTTPException(status_code=400, detail=f"Not enough capacity. Students: {len(students)}, Capacity: {total_capacity}")
    
    # Clear existing allocations for this exam
    await db.allocations.delete_many({"examSessionId": exam_id})
    await db.examStudents.delete_many({"examSessionId": exam_id})
    
    # Allocate seats
    allocations = []
    exam_students = []
    
    if exam["allocationType"] == "serial":
        # Sort students by roll number for serial allocation
        students.sort(key=lambda x: x.get('rollNumber', ''))
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
                
                exam_student = ExamStudent(
                    examSessionId=exam_id,
                    studentId=students[student_idx]["id"],
                    roomId=room["id"],
                    benchNumber=bench,
                    seatPosition="A" if exam["studentsPerBench"] == 2 and seat_pos == 0 else "B" if exam["studentsPerBench"] == 2 else None
                )
                exam_students.append(exam_student.model_dump())
                
                student_idx += 1
            
            if student_idx >= len(students):
                break
        
        if student_idx >= len(students):
            break
    
    # Save allocations
    if allocations:
        await db.allocations.insert_many(allocations)
        await db.examStudents.insert_many(exam_students)
    
    # Update exam status
    await db.examSessions.update_one({"id": exam_id}, {"$set": {"status": "scheduled"}})
    
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

# ============ DOWNLOAD ROUTES ============

@api_router.get("/exams/{exam_id}/download")
async def download_allocation_list(exam_id: str, format: str = "excel", current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can download allocation lists")
    
    # Get exam details
    exam = await db.examSessions.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get allocations with student and room details
    allocations = await db.allocations.find({"examSessionId": exam_id}, {"_id": 0}).to_list(10000)
    
    # Enrich with student, room, and block details
    enriched_allocations = []
    for alloc in allocations:
        student = await db.users.find_one({"id": alloc["studentId"]}, {"_id": 0, "password": 0})
        room = await db.rooms.find_one({"id": alloc["roomId"]}, {"_id": 0})
        block = await db.blocks.find_one({"id": room["blockId"]}, {"_id": 0}) if room else None
        
        # Get invigilator for this room
        invigilator_duty = await db.examInvigilators.find_one({"examSessionId": exam_id, "roomId": alloc["roomId"]}, {"_id": 0})
        invigilator = None
        if invigilator_duty:
            invigilator = await db.users.find_one({"id": invigilator_duty["invigilatorId"]}, {"_id": 0, "password": 0})
        
        enriched_allocations.append({
            "studentName": student["profile"]["name"] if student else "Unknown",
            "rollNumber": student["rollNumber"] if student else "Unknown",
            "branch": student["profile"]["branch"] if student else "Unknown",
            "year": student["profile"]["year"] if student else "Unknown",
            "roomNumber": room["roomNumber"] if room else "Unknown",
            "blockName": block["name"] if block else "Unknown",
            "benchNumber": alloc["benchNumber"],
            "seatPosition": alloc["seatPosition"] or "N/A",
            "invigilatorName": invigilator["profile"]["name"] if invigilator else "Not Assigned"
        })
    
    if format.lower() == "csv":
        # Generate CSV content
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "Student Name", "Roll Number", "Branch", "Year", 
            "Room Number", "Block", "Bench Number", "Seat Position", "Invigilator"
        ])
        
        # Write data
        for alloc in enriched_allocations:
            writer.writerow([
                alloc["studentName"], alloc["rollNumber"], alloc["branch"], alloc["year"],
                alloc["roomNumber"], alloc["blockName"], alloc["benchNumber"], 
                alloc["seatPosition"], alloc["invigilatorName"]
            ])
        
        content = output.getvalue()
        output.close()
        
        return {
            "content": content,
            "filename": f"{exam['title']}_allocation_list.csv",
            "content_type": "text/csv"
        }
    
    else:  # Excel format
        try:
            import pandas as pd
            
            df = pd.DataFrame(enriched_allocations)
            
            # Create Excel file in memory
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Allocation List', index=False)
            
            content = output.getvalue()
            output.close()
            
            return {
                "content": content,
                "filename": f"{exam['title']}_allocation_list.xlsx",
                "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            
        except ImportError:
            raise HTTPException(status_code=500, detail="Excel generation requires pandas and openpyxl. Please install: pip install pandas openpyxl")

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

# ============ ATTENDANCE RESTRICTION ROUTES ============

@api_router.post("/exams/{exam_id}/upload_attendance_csv")
async def upload_attendance_csv(
    exam_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can upload attendance CSV")
    
    # Verify exam exists
    exam = await db.examSessions.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not (file.filename.lower().endswith('.csv')):
        raise HTTPException(status_code=400, detail=f"Only CSV files are allowed. Received: {file.filename}")
    
    try:
        # Read and parse CSV
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="File is empty")
        
        logger.info(f"Reading CSV file: {file.filename}, Size: {len(contents)} bytes")
        
        # Try different encodings
        try:
            csv_content = io.StringIO(contents.decode('utf-8'))
        except UnicodeDecodeError:
            try:
                csv_content = io.StringIO(contents.decode('utf-8-sig'))
            except:
                csv_content = io.StringIO(contents.decode('latin-1'))
        
        reader = csv.DictReader(csv_content)
        
        # Expected columns
        expected_columns = ["Student Name", "Roll Number", "Branch", "Year", "Attendance %"]
        csv_columns = list(reader.fieldnames) if reader.fieldnames else []
        
        logger.info(f"CSV columns found: {csv_columns}")
        
        if not csv_columns:
            raise HTTPException(status_code=400, detail="CSV file appears to be empty or invalid")
        
        # Check for required columns with case-insensitive matching
        csv_columns_lower = [col.strip() for col in csv_columns]
        expected_lower = [col.lower() for col in expected_columns]
        
        missing_columns = []
        for exp_col in expected_columns:
            if exp_col not in csv_columns and exp_col.lower() not in [c.lower() for c in csv_columns_lower]:
                missing_columns.append(exp_col)
        
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"CSV must contain columns: {', '.join(expected_columns)}. Missing: {', '.join(missing_columns)}. Found columns: {', '.join(csv_columns)}"
            )
        
        restrictions_created = 0
        errors = []
        
        # Create a mapping for case-insensitive column access
        column_map = {}
        for col in csv_columns:
            for exp_col in expected_columns:
                if col.strip().lower() == exp_col.lower():
                    column_map[exp_col] = col
                    break
        
        logger.info(f"Column mapping: {column_map}")
        
        for row_idx, row in enumerate(reader, start=2):  # Start at 2 because row 1 is header
            try:
                # Use mapped column names or original
                roll_number = row.get(column_map.get("Roll Number", "Roll Number"), "").strip()
                attendance_str = row.get(column_map.get("Attendance %", "Attendance %"), "").strip()
                
                if not roll_number:
                    errors.append(f"Row {row_idx}: Roll Number is empty")
                    continue
                
                # Parse attendance percentage
                attendance_str = attendance_str.replace('%', '').strip()
                try:
                    attendance_percent = float(attendance_str)
                except ValueError:
                    errors.append(f"Row {row_idx}: Invalid attendance percentage: {attendance_str}")
                    continue
                
                # Find student
                student = await db.users.find_one({
                    "rollNumber": roll_number,
                    "collegeId": exam["collegeId"],
                    "role": "student"
                })
                
                if not student:
                    errors.append(f"Row {row_idx}: Student not found with roll number '{roll_number}'")
                    continue
                
                # Check if restriction already exists
                existing = await db.examAttendanceRestrictions.find_one({
                    "examId": exam_id,
                    "studentId": student["id"]
                })
                
                if existing:
                    # Update existing restriction
                    await db.examAttendanceRestrictions.update_one(
                        {"id": existing["id"]},
                        {"$set": {
                            "attendancePercentage": attendance_percent,
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    restrictions_created += 1
                else:
                    # Create new restriction
                    restriction = ExamAttendanceRestriction(
                        examId=exam_id,
                        studentId=student["id"],
                        attendancePercentage=attendance_percent,
                        isAllowed=False
                    )
                    await db.examAttendanceRestrictions.insert_one(restriction.model_dump())
                    restrictions_created += 1
                
            except Exception as e:
                errors.append(f"Row {row_idx}: Error - {str(e)}")
                logger.error(f"Error processing row {row_idx}: {str(e)}")
                continue
        
        if errors:
            logger.warning(f"CSV upload completed with {len(errors)} errors. Processed: {restrictions_created}")
        
        return {
            "message": f"Successfully processed {restrictions_created} restrictions" + 
                      (f" with {len(errors)} errors" if errors else ""),
            "total": restrictions_created,
            "errors": errors[:10]  # Return first 10 errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSV upload failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")

@api_router.get("/exams/{exam_id}/restricted_students")
async def get_restricted_students(exam_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view restricted students")
    
    # Get all restrictions for this exam
    restrictions = await db.examAttendanceRestrictions.find(
        {"examId": exam_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Enrich with student details
    enriched = []
    for restriction in restrictions:
        student = await db.users.find_one(
            {"id": restriction["studentId"]},
            {"_id": 0, "password": 0}
        )
        
        if student:
            enriched.append({
                **restriction,
                "studentName": student["profile"]["name"],
                "rollNumber": student["rollNumber"],
                "branch": student["profile"]["branch"],
                "year": student["profile"]["year"]
            })
    
    return enriched

@api_router.post("/exams/{exam_id}/grant_permission/{student_id}")
async def grant_permission(
    exam_id: str,
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can grant permission")
    
    # Update restriction
    result = await db.examAttendanceRestrictions.update_one(
        {
            "examId": exam_id,
            "studentId": student_id
        },
        {
            "$set": {
                "isAllowed": True,
                "grantedBy": current_user["id"],
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restriction not found")
    
    return {"message": "Permission granted successfully"}

@api_router.post("/exams/{exam_id}/grant_all_permissions")
async def grant_all_permissions(exam_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can grant permissions")
    
    # Update all restrictions for this exam
    result = await db.examAttendanceRestrictions.update_many(
        {
            "examId": exam_id,
            "isAllowed": False
        },
        {
            "$set": {
                "isAllowed": True,
                "grantedBy": current_user["id"],
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": f"Granted permissions to {result.modified_count} students",
        "count": result.modified_count
    }

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

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"] + os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',') if os.environ.get('CORS_ORIGINS') else ["http://localhost:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
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