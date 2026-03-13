#!/usr/bin/env bash
# GRID Kiosk-Startscript (Linux/Ubuntu)


set -euo pipefail

### >>> EDIT HERE <<<
URL="http://grid-kiosk.local"
ALLOW_INSECURE=0                
UNCLUTTER=1                     
DISPLAY_NUMBER="${DISPLAY:-:0}" 

# find Browser
BROWSER=""
for c in google-chrome-stable google-chrome chromium chromium-browser microsoft-edge; do
  if command -v "$c" >/dev/null 2>&1; then BROWSER="$c"; break; fi
done
if [[ -z "$BROWSER" ]]; then
  echo "no supported Browser found (chrome/chromium/edge). please install."
  exit 1
fi

# X-Environment init
export DISPLAY="$DISPLAY_NUMBER"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Screensaver/Power-Management off
if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

# hide mouse (optional)
if [[ "$UNCLUTTER" -eq 1 ]]; then
  if command -v unclutter >/dev/null 2>&1; then
    pkill unclutter 2>/dev/null || true
    unclutter -idle 0.5 -root &
  else
    echo "tip: 'unclutter' not installed (sudo apt install unclutter)."
  fi
fi

# Basis-Flags
FLAGS=(
  --kiosk
  --start-fullscreen
  --incognito
  --no-first-run
  --disable-session-crashed-bubble
  --disable-infobars
  --disable-features=TranslateUI,ChromeWhatsNewUI,PasswordManagerOnboarding
  --autoplay-policy=no-user-gesture-required
  --overscroll-history-navigation=0
)

# unsafe stuff (only in safe network)
if [[ "$ALLOW_INSECURE" -eq 1 ]]; then
  FLAGS+=( --allow-running-insecure-content --ignore-certificate-errors --allow-insecure-localhost )
fi

# close old instance (optional)
pkill -f "$BROWSER.*--kiosk" 2>/dev/null || true
sleep 1

# Keep-Alive-Loop
while true; do
  echo "Starte $BROWSER ${FLAGS[*]} $URL"
  "$BROWSER" "${FLAGS[@]}" "$URL"
  # browser fallback
  sleep 2
done
