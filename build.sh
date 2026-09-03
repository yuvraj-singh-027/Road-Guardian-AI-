#!/usr/bin/env bash
# exit on error
set -o errexit

echo "===================================================="
echo "  Building Road Guardian AI for Render Deployment"
echo "===================================================="

# 1. Upgrade pip and install Python backend dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 2. Ensure Node.js and npm are available in Render build environment
if ! command -v npm &> /dev/null; then
  echo "Node.js / npm not found in build environment."
  echo "Downloading portable Node.js 18.17.0 for Linux..."
  mkdir -p /tmp/node
  curl -fsSL https://nodejs.org/dist/v18.17.0/node-v18.17.0-linux-x64.tar.xz | tar -xJ -C /tmp/node --strip-components=1
  export PATH=/tmp/node/bin:$PATH
fi

echo "Using Node version: $(node -v)"
echo "Using npm version: $(npm -v)"

# 3. Install Node dependencies and build React Frontend
if [ -d "frontend" ]; then
  cd frontend
  echo "Installing frontend dependencies..."
  npm install
  echo "Building production frontend bundle..."
  npm run build
  cd ..
fi

echo "===================================================="
echo "  Build Completed Successfully!"
echo "===================================================="
