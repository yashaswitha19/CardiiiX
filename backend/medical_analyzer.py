import sys
import io
from transformers import pipeline
from fastapi import APIRouter, Depends, HTTPException
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

app = FastAPI(
    title="Medical Analysis Service",
    version="4.0.0"
)

def analyze_medical_text(text):
    try:
        print("Loading medical AI model...", file=sys.stderr)
        
        summarizer = pipeline(
            "summarization",
            model="Falconsai/medical_summarization",
            device=-1
        )
        
        print("Generating comprehensive medical analysis...", file=sys.stderr)
        
        # Generate main summary
        summary_result = summarizer(
            text,
            max_length=500,
            min_length=150,
            do_sample=False
        )
        
        main_summary = summary_result[0]['summary_text']
        
        print("Analysis complete!", file=sys.stderr)
        
        # Extract key information from text
        patient_info = ""
        diagnosis_info = ""
        treatment_info = ""
        
        # Simple keyword extraction
        lines = text.split('\n')
        for line in lines:
            lower_line = line.lower()
            if 'patient name' in lower_line or 'name:' in lower_line:
                patient_info += line.strip() + "\n"
            elif 'date of birth' in lower_line or 'hospital id' in lower_line:
                patient_info += line.strip() + "\n"
            elif 'diagnosis' in lower_line:
                diagnosis_info += line.strip() + "\n"
            elif 'treatment' in lower_line or 'medication' in lower_line:
                treatment_info += line.strip() + "\n"
        
        # Format structured output
        analysis = f"""Medical Report Summary
======================

OVERVIEW:
{main_summary}

"""
        
        if patient_info:
            analysis += f"""PATIENT INFORMATION:
{patient_info.strip()}

"""
        
        if diagnosis_info:
            analysis += f"""DIAGNOSIS:
{diagnosis_info.strip()}

"""
        
        if treatment_info:
            analysis += f"""TREATMENT PLAN:
{treatment_info.strip()}

"""
        
        analysis += """---
MEDICAL DISCLAIMER: This is an AI-generated analysis for informational purposes only. Always consult qualified healthcare professionals for medical advice, diagnosis, or treatment."""
        
        return analysis.strip()
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error: {error_msg}", file=sys.stderr)
        return f"Analysis Error: {error_msg}"

if __name__ == "__main__":
    input_text = sys.stdin.read().strip()
    
    if not input_text:
        print("Error: No input", file=sys.stderr)
        sys.exit(1)
    
    result = analyze_medical_text(input_text)
    print(result)
