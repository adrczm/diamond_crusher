#!/bin/bash
# Double-click to open Diamond Crusher in Safari. Keep this window open while you use the app; close it to stop.
cd "$(dirname "$0")" || exit 1
PORT=47820
URL="http://localhost:$PORT/"

if curl -s -o /dev/null "$URL"; then
  open -a Safari "$URL"
  exit 0
fi

/usr/bin/perl ./app-server.pl "$PORT" ./app &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null "$URL" && break
  sleep 0.3
done
open -a Safari "$URL"
echo
echo "Keep this window open while you use Diamond Crusher. Close it to stop."
wait $SERVER
