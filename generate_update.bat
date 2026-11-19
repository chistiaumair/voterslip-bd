@echo off
setlocal EnableDelayedExpansion
title Voter Slip App Update Generator
color 0A
cd /d "%~dp0"

echo ===================================================
echo     Voter Slip Generator - Update Package Generator
echo ===================================================
echo.

set "OUTPUT_DIR=%~dp0App_Update_Package"

if exist "%OUTPUT_DIR%" (
    echo Cleaning old update package folder...
    rd /s /q "%OUTPUT_DIR%"
)

mkdir "%OUTPUT_DIR%"

echo [1/3] Compiling Python Slicer Binary...
python -m PyInstaller --noconfirm --onedir --console --name "pdf_slice" --distpath "bin" --workpath "build_temp" --exclude-module torch --exclude-module tensorflow --exclude-module scipy --exclude-module matplotlib --exclude-module pandas votcenter/pdf_slice.py

if exist build_temp (
    rd /s /q build_temp
)

echo.
echo [2/3] Packing Electron ASAR Package (including all latest JS, CSS, HTML)...
if exist "%~dp0build_asar_temp" rd /s /q "%~dp0build_asar_temp"
mkdir "%~dp0build_asar_temp"

copy /Y "%~dp0index.html" "%~dp0build_asar_temp\" >nul
copy /Y "%~dp0main.js" "%~dp0build_asar_temp\" >nul
copy /Y "%~dp0preload.js" "%~dp0build_asar_temp\" >nul
copy /Y "%~dp0package.json" "%~dp0build_asar_temp\" >nul
copy /Y "%~dp0icon.png" "%~dp0build_asar_temp\" >nul
if exist "%~dp0NotoSansBengali-Regular.ttf" copy /Y "%~dp0NotoSansBengali-Regular.ttf" "%~dp0build_asar_temp\" >nul
if exist "%~dp0key_generator.html" copy /Y "%~dp0key_generator.html" "%~dp0build_asar_temp\" >nul

if exist "%~dp0css" xcopy /E /I /Y /Q "%~dp0css" "%~dp0build_asar_temp\css" >nul
if exist "%~dp0js" xcopy /E /I /Y /Q "%~dp0js" "%~dp0build_asar_temp\js" >nul

if exist "%~dp0node_modules\@electron\asar\bin\asar.js" (
    node "%~dp0node_modules\@electron\asar\bin\asar.js" pack "%~dp0build_asar_temp" "%OUTPUT_DIR%\app.asar"
) else (
    call npx.cmd @electron/asar pack "%~dp0build_asar_temp" "%OUTPUT_DIR%\app.asar"
)

timeout /t 1 /nobreak >nul 2>&1
if exist "%~dp0build_asar_temp" rd /s /q "%~dp0build_asar_temp" >nul 2>&1

if not exist "%OUTPUT_DIR%\app.asar" (
    echo [ERROR] Failed to create app.asar!
    pause
    exit /b 1
)

echo [OK] app.asar created successfully.

echo.
echo [3/3] Packaging Python Binaries into %OUTPUT_DIR%...
if exist "%~dp0bin" (
    xcopy /E /I /Y /Q "%~dp0bin" "%OUTPUT_DIR%\bin" >nul
)

echo Adding Auto-Updater Script to %OUTPUT_DIR%...
if exist "%~dp0Update.bat" (
    copy /Y "%~dp0Update.bat" "%OUTPUT_DIR%\Update.bat" >nul
)

echo.
echo ===================================================
echo    SUCCESS: App Update Package Created!
echo ===================================================
echo Output Folder: %OUTPUT_DIR%
echo.
if exist "%OUTPUT_DIR%\app.asar" echo  [OK] app.asar
if exist "%OUTPUT_DIR%\Update.bat" echo  [OK] Update.bat
if exist "%OUTPUT_DIR%\bin" echo  [OK] bin (Python engines)
echo.
echo Just ZIP the "App_Update_Package" folder and send it to your User.
echo The user will unzip it and double-click "Update.bat".
echo.
pause
