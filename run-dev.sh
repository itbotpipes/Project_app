#!/bin/bash
# Start the app in development mode.
# Node is installed locally at ~/.local/node (no system changes were made),
# so we add it to PATH for this command only.
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")"
echo "Starting Northern Star Operations on http://localhost:3000 ..."
exec node node_modules/next/dist/bin/next dev --port 3000
