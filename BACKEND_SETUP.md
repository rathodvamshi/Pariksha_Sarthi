# Backend Setup Instructions

## Quick Fix for College Dropdown Issue

The college dropdown issue is likely due to one of these problems:

1. **Backend server not running**
2. **Missing environment configuration**
3. **No data in MongoDB Atlas**
4. **CORS configuration issues**

## Step-by-Step Fix

### 1. Create Environment File

Create a file `backend/.env` with the following content:

```env
# MongoDB Atlas Configuration
MONGO_URL="your_mongodb_atlas_connection_string"
DB_NAME="pariksha_sarthi"

# JWT Configuration
JWT_SECRET_KEY="your-super-secret-jwt-key-change-in-production"

# CORS Configuration
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

**Important**: Replace `your_mongodb_atlas_connection_string` with your actual MongoDB Atlas connection string.

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Setup Initial Data

```bash
python scripts/setup_initial_data.py
```

This will create:
- A sample college: "Global Institute of Technology"
- Admin user: admin@git.com / admin123
- Invigilator user: invig1@git.com / invig123
- Student user: 22A91A0501 / student123

### 4. Start Backend Server

```bash
python start_backend.py
```

Or manually:
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Test the API

```bash
python test_colleges_api.py
```

### 6. Start Frontend

```bash
cd frontend
npm start
# or
yarn start
```

## Troubleshooting

### If colleges still don't load:

1. **Check browser console** for error messages
2. **Verify backend is running** at http://localhost:8000
3. **Test API directly** at http://localhost:8000/api/colleges
4. **Check MongoDB Atlas connection** in your .env file
5. **Verify CORS settings** allow localhost:3000

### Common Issues:

- **Connection refused**: Backend server not running
- **CORS error**: Check CORS_ORIGINS in .env
- **Empty response**: No colleges in database (run setup script)
- **Authentication error**: Check MongoDB Atlas connection string

## API Endpoints

- **Colleges**: GET http://localhost:8000/api/colleges
- **Login**: POST http://localhost:8000/api/auth/login
- **Signup**: POST http://localhost:8000/api/auth/signup
- **API Docs**: http://localhost:8000/docs

## Default Login Credentials

After running the setup script:

**Admin:**
- College: Global Institute of Technology
- Email: admin@git.com
- Password: admin123

**Invigilator:**
- College: Global Institute of Technology
- Email: invig1@git.com
- Password: invig123

**Student:**
- College: Global Institute of Technology
- Roll Number: 22A91A0501
- Password: student123
