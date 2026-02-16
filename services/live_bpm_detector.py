#!/usr/bin/env python3
"""
Live Heart Rate (BPM) Detection from Webcam
30-second measurement using POS algorithm (no pre-trained models needed)
"""

import cv2
import numpy as np
from scipy import signal
from scipy.fft import fft
import time
from collections import deque

class LiveBPMDetector:
    def __init__(self, duration=30, fps=30):
        self.duration = duration
        self.fps = fps
        self.frames_needed = duration * fps
        self.rgb_values = deque(maxlen=self.frames_needed)
        
        # Load Haar Cascade for face detection
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
    def extract_forehead_roi(self, frame, face):
        """Extract forehead region (best for heart rate detection)"""
        x, y, w, h = face
        
        # Forehead region: upper-center part of detected face
        roi_y = y + int(h * 0.2)
        roi_h = int(h * 0.15)
        roi_x = x + int(w * 0.3)
        roi_w = int(w * 0.4)
        
        roi = frame[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w]
        return roi, (roi_x, roi_y, roi_w, roi_h)
    
    def calculate_bpm(self, rgb_signals):
        """
        Calculate BPM using POS (Plane-Orthogonal-to-Skin) algorithm
        Paper: Wang et al., "Algorithmic Principles of Remote PPG" (2017)
        """
        if len(rgb_signals) < self.fps * 10:  # Need minimum 10 seconds
            return None, "Insufficient Data"
        
        # Convert to numpy array and normalize
        rgb_array = np.array(rgb_signals)
        rgb_mean = np.mean(rgb_array, axis=0)
        rgb_std = np.std(rgb_array, axis=0) + 1e-10
        rgb_normalized = (rgb_array - rgb_mean) / rgb_std
        
        # POS algorithm
        # Project RGB onto orthogonal plane to skin tone
        R = rgb_normalized[:, 0]
        G = rgb_normalized[:, 1]
        B = rgb_normalized[:, 2]
        
        X = R - G
        Y = R + G - 2 * B
        
        # Calculate pulse signal
        alpha = np.std(X) / (np.std(Y) + 1e-10)
        pulse_signal = X - alpha * Y
        
        # Bandpass filter (0.7-3.5 Hz = 42-210 BPM range)
        sos = signal.butter(4, [0.7, 3.5], btype='band', fs=self.fps, output='sos')
        pulse_filtered = signal.sosfilt(sos, pulse_signal)
        
        # Remove linear trend
        pulse_filtered = signal.detrend(pulse_filtered)
        
        # FFT to find dominant frequency
        n = len(pulse_filtered)
        fft_data = np.abs(fft(pulse_filtered))[:n//2]
        freqs = np.fft.fftfreq(n, 1.0/self.fps)[:n//2]
        
        # Focus on heart rate range (0.7-3.5 Hz)
        valid_idx = (freqs >= 0.7) & (freqs <= 3.5)
        freqs = freqs[valid_idx]
        fft_data = fft_data[valid_idx]
        
        if len(fft_data) == 0:
            return None, "No Valid Data"
        
        # Find peak frequency
        peak_idx = np.argmax(fft_data)
        peak_freq = freqs[peak_idx]
        
        # Check if peak is significant
        peak_power = fft_data[peak_idx]
        mean_power = np.mean(fft_data)
        
        if peak_power < 1.5 * mean_power:  # Weak signal
            return None, "Weak Signal"
        
        # Convert to BPM
        bpm = peak_freq * 60.0
        
        # Calculate signal quality
        snr = peak_power / mean_power  # Signal-to-noise ratio
    
        quality = "Poor"
        if snr > 3.0:
            quality = "Excellent"
        elif snr > 2.0:
            quality = "Good"
        elif snr > 1.5:
            quality = "Fair"
    
        return bpm, quality

    def is_valid_measurement(self, bpm, previous_bpm=None):
        """Check if BPM reading is reasonable"""
        # Range check
        if bpm < 40 or bpm > 200:
            return False
        
        # If we have previous reading, check for sudden jumps
        if previous_bpm is not None:
            change = abs(bpm - previous_bpm)
            if change > 20:  # More than 20 BPM difference
                return False
        
        return True
    
    def run(self):
        """Main loop for live BPM detection"""
        cap = cv2.VideoCapture(0,cv2.CAP_AVFOUNDATION)
        
        if not cap.isOpened():
            print("❌ ERROR: Cannot access webcam!")
            print("Make sure no other application is using the camera.")
            return None
        
        # Set camera properties
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 60)  # Use higher FPS for better accuracy
        print("\n" + "="*60)
        print("       LIVE HEART RATE MONITOR (30 seconds)")
        print("="*60)
        print("\n📋 INSTRUCTIONS:")
        print("  ✓ Sit still and face the camera")
        print("  ✓ Make sure your face is well-lit (avoid backlighting)")
        print("  ✓ Don't talk or move during measurement")
        print("  ✓ The green box shows the detection area (forehead)")
        print("\n⏱️  Starting in 3 seconds...")
        print("="*60 + "\n")
        
        # Countdown
        for i in range(3, 0, -1):
            print(f"  {i}...")
            time.sleep(1)
        
        print("\n🎥 RECORDING... Keep still!\n")
        
        start_time = time.time()
        frame_count = 0
        last_bpm = None
        last_quality = "Calculating..."
        face_detected_frames = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                print("⚠️  Warning: Frame read failed")
                break
            
            # Convert to RGB for processing
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=5,
                minSize=(120, 120)
            )
            
            elapsed = time.time() - start_time
            remaining = max(0, self.duration - elapsed)
            
            # Process if face detected
            if len(faces) > 0:
                # Use largest face
                face = max(faces, key=lambda f: f[2] * f[3])
                x, y, w, h = face
                
                # Draw face rectangle (blue)
                cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                
                # Extract forehead ROI
                roi, (rx, ry, rw, rh) = self.extract_forehead_roi(frame_rgb, face)
                
                # Draw ROI rectangle (green)
                cv2.rectangle(frame, (rx, ry), (rx+rw, ry+rh), (0, 255, 0), 2)
                cv2.putText(frame, "FOREHEAD", (rx, ry-5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # Calculate average RGB from ROI
                if roi.size > 0:
                    avg_rgb = np.mean(roi.reshape(-1, 3), axis=0)
                    self.rgb_values.append(avg_rgb)
                    frame_count += 1
                    face_detected_frames += 1
                
                # Calculate BPM if enough data
                if len(self.rgb_values) >= self.fps * 10:
                    bpm, quality = self.calculate_bpm(list(self.rgb_values))
                    if bpm is not None and 40 <= bpm <= 200:  # Sanity check
                        last_bpm = bpm
                        last_quality = quality
            
            # Display information overlay
            progress_pct = min(100, (elapsed / self.duration) * 100)
            
            # Top bar
            cv2.rectangle(frame, (0, 0), (640, 160), (0, 0, 0), -1)
            cv2.rectangle(frame, (0, 0), (640, 160), (255, 255, 255), 2)
            
            # Progress
            cv2.putText(frame, f"Progress: {progress_pct:.0f}%", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Progress bar
            bar_width = int((progress_pct / 100) * 400)
            cv2.rectangle(frame, (10, 40), (410, 60), (100, 100, 100), 2)
            cv2.rectangle(frame, (10, 40), (10 + bar_width, 60), (0, 255, 0), -1)
            
            # Time remaining
            cv2.putText(frame, f"Time: {remaining:.1f}s", (420, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Frames collected
            cv2.putText(frame, f"Frames: {frame_count}", (420, 55),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Current BPM
            if last_bpm is not None:
                bpm_color = (0, 255, 0) if 50 <= last_bpm <= 100 else (0, 165, 255)
                cv2.putText(frame, f"Heart Rate: {last_bpm:.0f} BPM", (10, 100),
                           cv2.FONT_HERSHEY_SIMPLEX, 1.2, bpm_color, 3)
            else:
                cv2.putText(frame, "Calculating...", (10, 100),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
            
            # Quality indicator
            quality_color = (0, 255, 0) if last_quality == "Excellent" else \
                           (0, 255, 255) if last_quality == "Good" else \
                           (0, 165, 255) if last_quality == "Fair" else (0, 0, 255)
            cv2.putText(frame, f"Quality: {last_quality}", (10, 130),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, quality_color, 2)
            
            # Status
            if len(faces) > 0:
                cv2.putText(frame, "✓ Face Detected", (10, 155),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            else:
                cv2.putText(frame, "✗ No Face - Please center your face", (10, 155),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            
            # Bottom instructions
            cv2.putText(frame, "Press 'Q' to quit early", (10, 470),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            cv2.imshow('Heart Rate Monitor', frame)
            
            # Check if measurement complete
            if elapsed >= self.duration:
                print("\n✅ Measurement complete!")
                break
            
            # Allow early exit
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == ord('Q'):
                print("\n⚠️  Measurement cancelled by user")
                break
        
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        
        # Final calculation
        print("\n" + "="*60)
        print("                    FINAL RESULTS")
        print("="*60)
        
        if len(self.rgb_values) >= self.fps * 10:
            final_bpm, final_quality = self.calculate_bpm(list(self.rgb_values))
            
            if final_bpm is not None and 40 <= final_bpm <= 200:
                print(f"\n  ❤️  HEART RATE: {final_bpm:.1f} BPM")
                print(f"  📊 Signal Quality: {final_quality}\n")
                print(f"  📊 Data Quality:")
                print(f"      • Total frames: {frame_count}")
                print(f"      • Face detected: {face_detected_frames} frames")
                print(f"      • Duration: {elapsed:.1f} seconds")
                
                # Health reference
                print(f"\n  📋 Reference Ranges (resting):")
                print(f"      • Athletes: 40-60 BPM")
                print(f"      • Normal: 60-100 BPM")
                print(f"      • Above normal: 100+ BPM")
                
                if 60 <= final_bpm <= 100:
                    print(f"\n  ✓ Your heart rate is in the normal range")
                elif final_bpm < 60:
                    print(f"\n  ℹ️  Lower than normal (may be normal for athletes)")
                else:
                    print(f"\n  ⚠️  Higher than normal resting rate")
                
                print(f"\n  ⚕️  Note: This is for informational purposes only.")
                print(f"      Consult a doctor for medical advice.")
                
                return final_bpm
            else:
                print(f"\n  ❌ Could not calculate reliable BPM")
                print(f"     Please try again with better lighting and less movement")
                return None
        else:
            print(f"\n  ❌ Insufficient data collected")
            print(f"     Got {len(self.rgb_values)} frames, need at least {self.fps * 10}")
            print(f"     Make sure your face is visible to the camera")
            return None
        
        print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    print("\n🫀 Live Heart Rate Monitor")
    print("Single measurement mode\n")
    
    bpm_readings = []
    
    # Single measurement
    print(f"\n--- Measurement 1/1 ---")
    detector = LiveBPMDetector(duration=30, fps=30)
    bpm = detector.run()
    
    if bpm is not None and 40 <= bpm <= 200:
        bpm_readings.append(bpm)
        
        print("\n" + "="*60)
        print("                 FINAL RESULT")
        print("="*60)
        print(f"\n  ❤️  Heart Rate: {bpm:.1f} BPM")
        
        # Health reference
        print(f"\n  📋 Reference Ranges (resting):")
        print(f"      • Athletes: 40-60 BPM")
        print(f"      • Normal: 60-100 BPM")
        print(f"      • Above normal: 100+ BPM")
        
        if 60 <= bpm <= 100:
            print(f"\n  ✓ Your heart rate is in the normal range")
        elif bpm < 60:
            print(f"\n  ℹ️  Lower than normal (may be normal for athletes)")
        else:
            print(f"\n  ⚠️  Higher than normal resting rate")
        
        print("\n" + "="*60 + "\n")
    else:
        print("\n❌ Could not get valid BPM reading")
        print("Please try again with better lighting and less movement\n")