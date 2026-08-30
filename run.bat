@echo off
echo ====================================================
echo   Starting Road Guardian AI Frontend and Backend
echo ====================================================
start cmd /k "echo Starting Backend Service... & python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"
start cmd /k "echo Starting Frontend Dev Server... & cd frontend & npm run dev"
echo Both servers started!
echo   - Backend API: http://localhost:8000
echo   - Frontend: http://localhost:3000
echo ====================================================
pause
