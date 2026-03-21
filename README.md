# Road-Guardian-AI--Intelligent-Road-Damage-Detection-System.

Intelligent Road Maintenance & Pothole Detection System
Road Guardian AI is an end-to-end computer vision solution designed to automate road hazard detection. Built for the India AI Impact Buildathon, it transforms standard mobile camera feeds into smart sensors that detect, locate, and log potholes in real-time.

📖 Table of Contents
Project Motivation

Core Features

System Architecture

Tech Stack

Installation & Setup

Data Logging Format

Future Enhancements

💡 Project Motivation
Manual road inspection is inefficient and reactive. Road Guardian AI empowers municipal authorities with:

Cost-effective monitoring using existing mobile hardware.

Precise data for prioritized road repairs based on severity.

Increased safety for two-wheelers and night-time commuters.

✨ Core Features
🎯 High-Precision Detection: Utilizes a fine-tuned YOLO model for identifying potholes in various lighting conditions.

📍 Geotagging: Syncs with GPS modules to record the exact Latitude and Longitude of every hazard.

📸 Visual Evidence: Automatically captures and stores frames of detected potholes for secondary verification.

📊 Automated Reporting: Generates structured CSV logs using Pandas for seamless data analysis.

🏗️ System Architecture
The workflow follows a 4-step real-time pipeline:

Inference: Live video stream is fed into the YOLO model via OpenCV.

Filtering: Detections are filtered based on a confidence threshold (e.g., > 0.5).

Data Retrieval: The system fetches current GPS Coordinates and Timestamp.

Storage: Information is appended to a local database using Pandas.
