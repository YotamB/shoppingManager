#!/bin/bash
# check_portal.sh — ensure portal is running, restart if not

PORT=3100
PORTAL_DIR="$(dirname "$0")"
LOG="$PORTAL_DIR/portal.log"

if curl -s --max-time 3 http://localhost:$PORT/ > /dev/null 2>&1; then
  echo "[$(date)] Portal OK on port $PORT" >> "$LOG"
  exit 0
fi

echo "[$(date)] Portal DOWN — restarting..." >> "$LOG"
pkill -f "node.*portal/server.js" 2>/dev/null
sleep 1
cd "$PORTAL_DIR" && nohup node server.js >> "$LOG" 2>&1 &
sleep 3

if curl -s --max-time 3 http://localhost:$PORT/ > /dev/null 2>&1; then
  echo "[$(date)] Portal restarted OK" >> "$LOG"
else
  echo "[$(date)] Portal FAILED to restart" >> "$LOG"
  exit 1
fi
