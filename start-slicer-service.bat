@echo off
chcp 65001 >nul
echo ===================================================================
echo   Voter Slip - Python Cloud Slicer Microservice (Local Runner)
echo ===================================================================
echo.
echo [1/2] Checking Python dependencies...
python -m pip install -r slicer-service/requirements.txt
echo.
echo [2/2] Starting Flask Microservice on http://localhost:5000...
echo.
python slicer-service/app.py
pause
