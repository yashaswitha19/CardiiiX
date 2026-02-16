from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
import os

router = APIRouter(prefix="/api/user", tags=["reports"])


# ADD THESE 3 LINES AT THE TOP (after your imports)
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Global MongoDB connection
client = AsyncIOMotorClient("mongodb://localhost:27017")  # Your MongoDB URL
db = client["cardiiix"]  # Your database name (change if different)

# REPLACE your get_user_reports function with this:
@app.get("/api/user/reports")
async def get_user_reports():
    try:
        # Get ALL reports (no user filter for now)
        reports_cursor = db.medical_reports.find().sort("timestamp", -1).limit(10)
        reports = await reports_cursor.to_list(None)
        
        # Format for frontend
        formatted_reports = []
        for report in reports:
            formatted_reports.append({
                "id": str(report.get("_id", "")),
                "type": report.get("type", "Medical Scan"),
                "timestamp": report.get("timestamp", ""),
                "status": report.get("status", "Completed"),
                "aiInterpretation": report.get("aiInterpretation", "AI analysis completed"),
                "confidence": float(report.get("confidence", 0)),
                "severity": report.get("severity", "None"),
                "risk": report.get("cholesterolRisk", "low_visual_risk")
            })
        
        return {"reports": formatted_reports}
    except Exception as e:
        print(f"Error: {e}")
        return {"reports": []}
