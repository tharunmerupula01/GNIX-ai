@echo off
rem Start FastAPI backend
start "Backend" "C:\\Users\\rohit\\OneDrive\\Desktop\\GNIX\\backend\\venv\\Scripts\\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

rem Start Next.js frontend
cd "C:\\Users\\rohit\\OneDrive\\Desktop\\GNIX\\frontend"
start "Frontend" npm run dev
