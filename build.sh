#!/usr/bin/env bash
# exit on error
set -o errexit

echo "===================================================="
echo "  Building Road Guardian AI for Render Deployment"
echo "===================================================="

# 1. Upgrade pip and install Python backend dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 2. Install Node dependencies and build React Frontend
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
