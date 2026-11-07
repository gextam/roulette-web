@echo off
cd /d "%~dp0"
start "" "http://localhost:8771/"
python -m http.server 8771 --bind 127.0.0.1
