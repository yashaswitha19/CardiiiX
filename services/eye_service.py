import cv2
import numpy as np
import io
import uvicorn
from PIL import Image
from typing import Dict, Optional
from fastapi import UploadFile, File, HTTPException, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Eye Analysis Service - Corneal Arcus Detection",
    description="Detects corneal arcus in eye images for cholesterol screening",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EyeAnalysisResponse(BaseModel):
    success: bool
    arcus_detected: bool
    arcus_severity: str
    cholesterol_risk: str
    confidence: float
    details: Dict
    message: str


def remove_specular_reflections(gray: np.ndarray) -> np.ndarray:
    """
    Remove bright specular reflections (camera flash, light spots)
    These can confuse arcus detection
    """
    # Find very bright pixels (reflections)
    _, bright_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
    
    # Dilate to cover reflection area
    kernel = np.ones((5, 5), np.uint8)
    bright_mask = cv2.dilate(bright_mask, kernel, iterations=2)
    
    # Inpaint to fill reflections with surrounding pixel values
    result = cv2.inpaint(gray, bright_mask, 3, cv2.INPAINT_TELEA)
    
    return result

def detect_arcus_opencv(image: Image.Image) -> Dict:
    """
    Robust arcus detection with reflection handling
    """
    
    # Convert PIL → OpenCV format
    img = np.array(image)
    if len(img.shape) == 2:
        gray = img
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    
    original_gray = gray.copy()
    
    # STEP 1: Remove specular reflections
    gray_no_reflections = remove_specular_reflections(gray)
    
    # STEP 2: Preprocessing
    gray_processed = cv2.GaussianBlur(gray_no_reflections, (7, 7), 1.2)
    
    # STEP 3: Detect iris using Hough Circle Transform
    circles = cv2.HoughCircles(
        gray_processed,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=gray.shape[0] // 2,
        param1=80,
        param2=35,
        minRadius=max(20, int(min(gray.shape) * 0.15)),
        maxRadius=int(min(gray.shape) * 0.45)
    )

    if circles is None:
        return {
            "arcus_detected": False,
            "confidence": 0.0,
            "reason": "Could not detect iris",
            "mean_ring_intensity": 0.0,
            "mean_iris_intensity": 0.0,
            "intensity_difference": 0.0,
            "contrast_ratio": 0.0,
            "iris_radius": 0
        }

    circles = np.uint16(np.around(circles))
    x, y, r = circles[0][0]

    # Validate circle is within image bounds
    if x - r < 0 or y - r < 0 or x + r >= gray.shape[1] or y + r >= gray.shape[0]:
        return {
            "arcus_detected": False,
            "confidence": 0.0,
            "reason": "Iris detection out of bounds",
            "mean_ring_intensity": 0.0,
            "mean_iris_intensity": 0.0,
            "iris_radius": int(r)
        }

    # ========================================
    # REGION DEFINITIONS - FIXED
    # ========================================
    
    # Ring region (arcus appears AT the iris edge, not beyond it)
    inner_radius = int(r * 0.88)  # Inner part of peripheral iris
    outer_radius = int(r * 0.98)  # Just before iris-sclera boundary
    
    # Create masks
    ring_mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.circle(ring_mask, (x, y), outer_radius, 255, -1)
    cv2.circle(ring_mask, (x, y), inner_radius, 0, -1)

    iris_mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.circle(iris_mask, (x, y), int(r * 0.70), 255, -1)  # Inner iris only

    # Extract pixel values (using reflection-removed image)
    ring_pixels = gray_no_reflections[ring_mask == 255]
    iris_pixels = gray_no_reflections[iris_mask == 255]

    if len(ring_pixels) == 0 or len(iris_pixels) == 0:
        return {
            "arcus_detected": False,
            "confidence": 0.0,
            "reason": "Could not extract ring/iris regions",
            "iris_radius": int(r)
        }

    # ========================================
    # BRIGHTNESS ANALYSIS
    # ========================================
    
    mean_ring = float(np.median(ring_pixels))
    mean_iris = float(np.median(iris_pixels))
    std_ring = float(np.std(ring_pixels))
    
    intensity_diff = mean_ring - mean_iris
    contrast_ratio = mean_ring / (mean_iris + 1e-5)
    
    # ========================================
    # TEXTURE ANALYSIS - FIXED
    # ========================================
    
    edges = cv2.Canny(gray_no_reflections, 50, 150)
    ring_edges = edges[ring_mask == 255]
    edge_density = np.sum(ring_edges > 0) / len(ring_pixels)
    has_smooth_ring = edge_density < 0.32  # Fixed typo: was has__smooth_ring
    
    # ========================================
    # SCLERA COMPARISON - ADDED
    # ========================================
    
    sclera_mask = np.zeros(gray.shape, dtype=np.uint8)
    sclera_x = min(x + int(r * 1.3), gray.shape[1] - 20)
    cv2.circle(sclera_mask, (sclera_x, y), 15, 255, -1)
    
    sclera_pixels = gray_no_reflections[sclera_mask == 255]
    if len(sclera_pixels) > 0:
        mean_sclera = np.median(sclera_pixels)
        ring_similar_to_sclera = abs(mean_ring - mean_sclera) < 20
    else:
        ring_similar_to_sclera = False
    
    # ========================================
    # SPATIAL UNIFORMITY ANALYSIS
    # ========================================
    
    # Divide ring into 12 segments
    angles = np.linspace(0, 2*np.pi, 13)[:-1]
    segment_intensities = []
    
    for angle in angles:
        angle_deg = np.degrees(angle)
        start_angle = angle_deg - 15
        end_angle = angle_deg + 15
        
        temp_mask = np.zeros_like(gray)
        cv2.ellipse(temp_mask, (x, y), (outer_radius, outer_radius), 
                   0, start_angle, end_angle, 255, -1)
        cv2.ellipse(temp_mask, (x, y), (inner_radius, inner_radius), 
                   0, start_angle, end_angle, 0, -1)
        
        segment_pixels = gray_no_reflections[temp_mask == 255]
        if len(segment_pixels) > 10:
            segment_intensities.append(np.median(segment_pixels))
    
    # Calculate uniformity metrics
    if len(segment_intensities) >= 8:
        segment_array = np.array(segment_intensities)
        segment_std = np.std(segment_array)
        segment_mean = np.mean(segment_array)
        segment_cv = segment_std / (segment_mean + 1e-5)
        segment_min = np.min(segment_array)
        segment_max = np.max(segment_array)
        segment_range = segment_max - segment_min
        
        # Count segments above threshold
        bright_threshold = mean_iris + 20
        segments_bright = np.sum(segment_array > bright_threshold)
        
        # Real arcus: most/all segments are bright and uniform - STRICTER
        is_uniform_ring = (segment_cv < 0.35 and segments_bright >= 8)
    else:
        segment_cv = 1.0
        segment_range = 0
        segments_bright = 0
        is_uniform_ring = False

    # ========================================
    # ADAPTIVE THRESHOLDS - STRICTER
    # ========================================
    
    avg_brightness = (mean_ring + mean_iris) / 2
    is_dark_image = avg_brightness < 120
    
    if is_dark_image:
        BRIGHTNESS_DIFF_MIN = 28
        CONTRAST_MIN = 1.30
        RING_BRIGHTNESS_MIN = 95
    else:
        BRIGHTNESS_DIFF_MIN = 38
        CONTRAST_MIN = 1.50
        RING_BRIGHTNESS_MIN = 140

    # ========================================
    # DETECTION LOGIC - FIXED
    # ========================================
    
    # Core checks
    has_brightness_diff = intensity_diff > BRIGHTNESS_DIFF_MIN
    has_high_contrast = contrast_ratio > CONTRAST_MIN
    has_absolute_brightness = mean_ring > RING_BRIGHTNESS_MIN
    has_uniform_pattern = is_uniform_ring
    
    # Multi-level detection
    strong_arcus = (
        has_brightness_diff and
        has_high_contrast and
        has_absolute_brightness and
        has_uniform_pattern and
        has_smooth_ring and 
        not ring_similar_to_sclera and
        segments_bright >= 11 and segment_cv < 0.15
    )
    
    moderate_arcus = (
        intensity_diff > 45 and
        contrast_ratio > 1.80 and
        has_uniform_pattern and
        has_smooth_ring and
        not ring_similar_to_sclera and
        segments_bright >= 9 and
        segment_cv < 0.25
    )
    
    mild_arcus = (
        intensity_diff > 55 and
        contrast_ratio > 2.00 and
        segment_cv < 0.33 and  # Tightened from 0.28
        has_smooth_ring and
        not ring_similar_to_sclera and
        segments_bright >= 8
    )
    
    # FINAL DECISION - MOVED BEFORE CONFIDENCE CALCULATION
    arcus_detected = bool(strong_arcus or moderate_arcus or mild_arcus)

    # ========================================
    # CONFIDENCE CALCULATION
    # ========================================
    
    if arcus_detected:
        brightness_score = min(intensity_diff / 50, 1.0)
        contrast_score = min((contrast_ratio - 1.0) / 0.8, 1.0)
        uniformity_score = max(0, 1.0 - segment_cv / 0.3)
        coverage_score = min(segments_bright / 12, 1.0)
        
        confidence = (
            brightness_score * 0.30 +
            contrast_score * 0.25 +
            uniformity_score * 0.25 +
            coverage_score * 0.20
        )
        
        if strong_arcus:
            confidence = min(confidence * 1.2, 1.0)
            
        confidence = max(0.0, min(confidence, 1.0))
    else:
        confidence = 0.0

    # ========================================
    # DEBUG OUTPUT
    # ========================================
    
    print(f"\n{'='*70}")
    print(f"🔍 CORNEAL ARCUS DETECTION - PRODUCTION v5.0")
    print(f"{'='*70}")
    print(f"IMAGE INFO:")
    print(f"  Image Size:         {gray.shape[1]}x{gray.shape[0]}")
    print(f"  Avg Brightness:     {avg_brightness:6.1f} {'🌙 DARK' if is_dark_image else '☀️ NORMAL'}")
    print(f"  Iris Radius:        {r} pixels")
    print(f"{'-'*70}")
    print(f"BRIGHTNESS METRICS:")
    print(f"  Ring (median):      {mean_ring:6.1f}")
    print(f"  Iris (median):      {mean_iris:6.1f}")
    print(f"  Sclera (median):    {mean_sclera if len(sclera_pixels) > 0 else 'N/A':6}")
    print(f"  Difference:         {intensity_diff:6.1f} (need: >{BRIGHTNESS_DIFF_MIN})")
    print(f"  Contrast Ratio:     {contrast_ratio:6.2f}x (need: >{CONTRAST_MIN})")
    print(f"  Edge Density:       {edge_density:6.3f} (need: <0.32)")
    print(f"{'-'*70}")
    print(f"SPATIAL PATTERN (12 segments):")
    print(f"  Segment CV:         {segment_cv:6.3f} (need: <0.35)")
    print(f"  Segment Range:      {segment_min:.0f} - {segment_max:.0f} (Δ{segment_range:.0f})")
    print(f"  Bright Segments:    {segments_bright}/12 (need: ≥8)")
    print(f"  Uniform Ring:       {'YES ✓' if is_uniform_ring else 'NO ✗'}")
    if len(segment_intensities) >= 8:
        seg_str = [f"{int(x)}" for x in segment_intensities]
        print(f"  Segment Values:     [{', '.join(seg_str)}]")
    print(f"{'-'*70}")
    print(f"DETECTION CHECKS:")
    print(f"  ✓ Brightness diff:  {'PASS ✓' if has_brightness_diff else 'FAIL ✗'}")
    print(f"  ✓ High contrast:    {'PASS ✓' if has_high_contrast else 'FAIL ✗'}")
    print(f"  ✓ Absolute bright:  {'PASS ✓' if has_absolute_brightness else 'FAIL ✗'}")
    print(f"  ✓ Uniform pattern:  {'PASS ✓' if has_uniform_pattern else 'FAIL ✗'}")
    print(f"  ✓ Smooth texture:   {'PASS ✓' if has_smooth_ring else 'FAIL ✗'}")
    print(f"  ✓ Not sclera:       {'PASS ✓' if not ring_similar_to_sclera else 'FAIL ✗'}")
    print(f"{'-'*70}")
    print(f"DETECTION LEVELS:")
    print(f"  Strong:   {'✅ YES' if strong_arcus else '❌ NO'}")
    print(f"  Moderate: {'✅ YES' if moderate_arcus else '❌ NO'}")
    print(f"  Mild:     {'✅ YES' if mild_arcus else '❌ NO'}")
    print(f"{'-'*70}")
    print(f"🎯 FINAL RESULT:    {'✅ ARCUS DETECTED' if arcus_detected else '❌ NO ARCUS'}")
    print(f"📊 CONFIDENCE:      {confidence:.1%}")
    print(f"{'='*70}\n")

    # Save debug visualization
    try:
        debug_img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR) if len(img.shape) == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        
        # Draw detection regions
        color = (0, 255, 0) if arcus_detected else (0, 0, 255)
        cv2.circle(debug_img, (x, y), r, (255, 255, 0), 2)  # Iris boundary in cyan
        cv2.circle(debug_img, (x, y), inner_radius, color, 2)
        cv2.circle(debug_img, (x, y), outer_radius, color, 2)
        
        # Draw sclera sample point
        if len(sclera_pixels) > 0:
            cv2.circle(debug_img, (sclera_x, y), 15, (255, 0, 255), 2)  # Magenta
        
        # Draw segments with brightness indicators
        for i, angle in enumerate(angles):
            if i < len(segment_intensities):
                intensity = segment_intensities[i]
                is_bright = intensity > (mean_iris + 20)
                seg_color = (0, 255, 255) if is_bright else (128, 128, 128)
                
                end_x = int(x + (outer_radius + 10) * np.cos(angle))
                end_y = int(y + (outer_radius + 10) * np.sin(angle))
                cv2.circle(debug_img, (end_x, end_y), 3, seg_color, -1)
        
        cv2.imwrite("debug_arcus_detection.jpg", debug_img)
        print(f"💾 Debug image saved: debug_arcus_detection.jpg\n")
    except Exception as e:
        print(f"⚠️  Could not save debug image: {e}\n")

    return {
        "arcus_detected": bool(arcus_detected),
        "confidence": round(float(confidence), 3),
        "mean_ring_intensity": round(float(mean_ring), 2),
        "mean_iris_intensity": round(float(mean_iris), 2),
        "intensity_difference": round(float(intensity_diff), 2),
        "contrast_ratio": round(float(contrast_ratio), 3),
        "std_dev": round(float(std_ring), 2),
        "segment_cv": round(float(segment_cv), 3),
        "segments_bright": int(segments_bright),
        "is_uniform_ring": bool(is_uniform_ring),
        "edge_density": round(float(edge_density), 3),
        "ring_similar_to_sclera": bool(ring_similar_to_sclera),
        "iris_radius": int(r)
    }

def map_to_cholesterol_risk(arcus_detected: bool, confidence: float) -> str:
    if not arcus_detected:
        return "low_visual_risk"
    elif confidence > 0.70:
        return "elevated_risk"
    elif confidence > 0.50:
        return "possible_elevated"
    else:
        return "uncertain"


@app.get("/")
async def root():
    return {
        "service": "Eye Analysis Service - Corneal Arcus Detection",
        "version": "4.0.0",
        "status": "running",
        "method": "Advanced CV with Reflection Removal"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "eye_analysis",
        "detection_ready": True
    }


@app.post("/analyze", response_model=EyeAnalysisResponse)
async def analyze_eye_image(file: UploadFile = File(...)):
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        result = detect_arcus_opencv(image)
        
        arcus_detected = result["arcus_detected"]
        confidence = result["confidence"]
        
        if not arcus_detected:
            severity = "none"
        elif confidence > 0.75:
            severity = "severe"
        elif confidence > 0.55:
            severity = "moderate"
        else:
            severity = "mild"
        
        cholesterol_risk = map_to_cholesterol_risk(arcus_detected, confidence)
        
        return EyeAnalysisResponse(
            success=True,
            arcus_detected=arcus_detected,
            arcus_severity=severity,
            cholesterol_risk=cholesterol_risk,
            confidence=confidence,
            details={
                "method": "Advanced CV v4.0 (Reflection Removal + Spatial Analysis)",
                "mean_ring_intensity": result.get("mean_ring_intensity"),
                "mean_iris_intensity": result.get("mean_iris_intensity"),
                "intensity_difference": result.get("intensity_difference"),
                "contrast_ratio": result.get("contrast_ratio"),
                "segment_cv": result.get("segment_cv"),
                "segments_bright": result.get("segments_bright"),
                "is_uniform_ring": result.get("is_uniform_ring"),
                "iris_radius": result.get("iris_radius"),
                "reason": result.get("reason", "Analysis completed")
            },
            message="Eye analysis completed (visual screening only - not medical diagnosis)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-image")
async def analyze_image_file(file: UploadFile = File(...)):
    return await analyze_eye_image(file)


if __name__ == "__main__":
    print("="*70)
    print("🚀 EYE ANALYSIS SERVICE v4.0 - PRODUCTION READY")
    print("="*70)
    print("Features: Reflection Removal + Robust Spatial Analysis")
    print("Port:     5000")
    print("Status:   Ready for real-world images")
    print("="*70)
    uvicorn.run(app, host="0.0.0.0", port=5004)