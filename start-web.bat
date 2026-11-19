@echo off
chcp 65001 > nul
cls
echo ===================================================================
echo     ভোটার স্লিপ জেনারেটর (Voter Slip Web App) - লোকাল সার্ভার
echo ===================================================================
echo.

:: পূর্বে চালু থাকা কোনো পুরোনো প্রসেস পোর্ট ৩০০০ আটকে রাখলে তা ক্লিয়ার করা
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":3000\>"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo ব্রাউজারে ওয়েব অ্যাপ চালু হচ্ছে (http://localhost:3000)...
echo.
start http://localhost:3000
node web_server.js
pause
