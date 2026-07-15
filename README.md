###CARDIXX

🫀 AI-Based Early Heart Risk Screening and Smart Lipid Monitoring System
📌 Overview

Cardiovascular diseases (CVDs) are the leading cause of death worldwide, often due to late diagnosis and lack of continuous health monitoring. Many individuals avoid regular health checkups because traditional tests are invasive, expensive, and time-consuming. As a result, critical conditions such as high cholesterol, hypertension, and early arterial damage remain undetected until severe complications occur.

This project presents an AI-driven, non-invasive early heart risk screening system that combines computer vision, IoT sensors, machine learning, and automated medical report analysis to identify cardiovascular risks at an early stage and support preventive healthcare.

❗ Problem Statement

Existing healthcare systems rely heavily on invasive tests, manual data entry, and hospital-based diagnosis. There is no easily accessible, intelligent system that continuously screens heart disease risk using non-invasive physiological signals, IoT sensors, and automated medical report analysis.

Due to this limitation, many individuals remain unaware of conditions such as high cholesterol, abnormal heart rate, low oxygen saturation, and hypertension until serious complications occur, leading to heart attacks and strokes.

💡 Proposed Solution

The proposed system is an AI-Based Early Heart Risk Screening and Smart Lipid Monitoring Platform that integrates camera-based analysis, IoT health sensors, and AI models to provide continuous cardiovascular risk assessment.

🔍 System Workflow

Non-Invasive Screening

Face video analysis

Eye image analysis

IoT-Based Vital Monitoring

MAX301002 sensor is used to measure:

Heart Rate (BPM)

Blood Oxygen Saturation (SpO₂)

Health Profile Input

Age, weight, diabetes status

Lifestyle habits

Family medical history

AI Risk Analysis

Machine learning models estimate BP trends

Initial heart risk score generation

Smart Lipid Monitoring

Upload lipid profile reports (image/PDF)

OCR & NLP extract LDL, HDL, total cholesterol, triglycerides

Risk Classification & Alerts

Low / Moderate / High risk classification

Alerts, reminders, and medical recommendations

Doctor Dashboard

Patient history, trends, reports, and AI scores

🚀 Features

Non-invasive heart risk screening

Real-time BPM & SpO₂ monitoring using MAX301002 IoT sensor

AI-based BP trend estimation

Automated cholesterol report analysis (OCR + NLP)

Continuous health data tracking

Smart alerts and test reminders

Doctor support dashboard

🛠️ Technology Stack
Software

Programming Language: Python

Backend: FastAPI / Django

Frontend: HTML, CSS, JavaScript / Streamlit

Computer Vision: OpenCV, MediaPipe

Machine Learning: Scikit-learn / TensorFlow

OCR & NLP: Tesseract OCR, NLP libraries

Database: SQLite / PostgreSQL

Hardware (IoT)

MAX301002 Pulse Oximeter & Heart Rate Sensor

Measures BPM (Heart Rate)

Measures SpO₂ (Blood Oxygen Saturation)

Microcontroller: Arduino / ESP32

📂 Project Structure
.
├── App.tsx
├── README.md
├── backend
├── components
├── index.html
├── index.tsx
├── metadata.json
├── package-lock.json
├── package.json
├── playground-1.mongodb.js
├── services
├── tsconfig.json
├── types.ts
└── vite.config.ts


▶️ Usage

Connect the MAX301002 sensor to the microcontroller

Capture BPM and SpO₂ readings

Perform camera-based screening (face, eye)

Enter basic health details

Upload lipid profile report (if required)

View heart risk score, trends, and alerts

📊 Advantages

Non-Invasive & IoT-Based Monitoring

No needles or manual BP machines required

Early Detection of Heart Risk

Real-Time Vital Signs Monitoring

Accurate BPM & SpO₂ using MAX301002

Automatic Cholesterol Extraction

Continuous Health Tracking

Smart Alerts & Medical Recommendations

Reduced Hospital Dependency

Doctor Support System

Cost-Effective Preventive Care

Scalable & Future-Ready Platform

🔮 Future Enhancements

Integration with smartwatches and fitness bands

Cloud-based deployment

Advanced deep learning risk prediction

Mobile app support

Telemedicine integration

⚠️ Disclaimer

This system is intended for early screening and preventive monitoring only. It does not replace professional medical diagnosis. High-risk users should consult certified medical professionals immediately.
