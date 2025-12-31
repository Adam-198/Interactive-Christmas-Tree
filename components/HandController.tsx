import React, { useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { HandGestures } from '../types';

interface HandControllerProps {
  onGestureUpdate: (gestures: HandGestures) => void;
  showCamera: boolean;
}

const HandController: React.FC<HandControllerProps> = ({ onGestureUpdate, showCamera }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const initializationLoopRef = useRef<number | null>(null);

  useEffect(() => {
    // Function to initialize MediaPipe and Camera safely
    const attemptInitialization = () => {
      // 1. Check if external MediaPipe scripts are loaded
      if (!window.Hands || !window.Camera) return;

      // 2. Initialize Hands Model if not done yet
      if (!handsRef.current) {
        handsRef.current = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        handsRef.current.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        handsRef.current.onResults((results: any) => {
          let isLeftOpen = false;
          let isRightPinch = false;
          let rightHandX = 0;

          // Debug Drawing
          const canvasCtx = canvasRef.current?.getContext('2d');
          if (canvasCtx && canvasRef.current) {
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            if (results.multiHandLandmarks) {
              for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const classification = results.multiHandedness[i];
                
                // Visual Swap for mirror effect debugging
                const label = classification.label === 'Left' ? 'Right' : 'Left'; 
                
                if (window.drawConnectors) {
                    window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
                }
                if (window.drawLandmarks) {
                    window.drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
                }
                
                // Draw Label
                const wrist = landmarks[0];
                canvasCtx.fillStyle = label === 'Left' ? '#FFFF00' : '#00FFFF'; 
                canvasCtx.font = "16px Arial";
                canvasCtx.fillText(label, wrist.x * canvasRef.current.width, wrist.y * canvasRef.current.height);
              }
            }
            canvasCtx.restore();
          }

          // Gesture Logic Calculation
          if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
              const landmarks = results.multiHandLandmarks[i];
              const classification = results.multiHandedness[i];
              const rawLabel = classification.label; 
              
              // Logic Swap: MediaPipe 'Left' is usually User's Right in selfie mode.
              // We want 'Left' label to control Explosion (User's Left Hand).
              // So if Raw is 'Right', it corresponds to User's Left.
              const label = rawLabel === 'Left' ? 'Right' : 'Left';

              const wrist = landmarks[0];
              const thumbTip = landmarks[4];
              const indexTip = landmarks[8];
              const middleMCP = landmarks[9];

              const dist = (p1: any, p2: any) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
              
              const handScale = dist(wrist, middleMCP);
              if (handScale === 0) continue; 

              const actionDist = dist(thumbTip, indexTip);
              const ratio = actionDist / handScale;

              // Left Hand (User's Left): Explode
              if (label === 'Left') {
                if (ratio > 0.5) isLeftOpen = true; 
              }

              // Right Hand (User's Right): Pinch & Rotate
              if (label === 'Right') {
                // Increased threshold from 0.25 to 0.35 to make pinching easier to detect
                if (ratio < 0.35) isRightPinch = true;
                rightHandX = (middleMCP.x - 0.5) * 2; 
              }
            }
          }

          onGestureUpdate({
            isLeftOpen,
            isRightPinch,
            rightHandX
          });
        });
      }

      // 3. Initialize Camera Loop ONLY if Video is Ready
      if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4 && !cameraRef.current) {
         const video = webcamRef.current.video;
         cameraRef.current = new window.Camera(video, {
            onFrame: async () => {
               if (handsRef.current) await handsRef.current.send({ image: video });
            },
            width: 640,
            height: 480,
         });
         cameraRef.current.start();
         
         // Initialization complete, stop polling
         if (initializationLoopRef.current) {
             window.clearInterval(initializationLoopRef.current);
             initializationLoopRef.current = null;
         }
      }
    };

    // Start Polling for Initialization (checks every 500ms)
    initializationLoopRef.current = window.setInterval(attemptInitialization, 500);

    return () => {
       if (initializationLoopRef.current) window.clearInterval(initializationLoopRef.current);
       // We keep the camera running to allow hot-reloading without losing stream permissions easily
    };
  }, [onGestureUpdate]);

  return (
    <div className={`fixed bottom-5 right-5 w-48 h-36 border-2 border-amber-500/50 rounded-lg overflow-hidden z-50 transition-all duration-300 ${showCamera ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
       <div className="relative w-full h-full">
         <Webcam
           ref={webcamRef}
           audio={false}
           width={192}
           height={144}
           screenshotFormat="image/jpeg"
           videoConstraints={{
             facingMode: "user"
           }}
           className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
         />
         <canvas 
            ref={canvasRef}
            width={192}
            height={144}
            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
         />
       </div>
       <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-2">
         <span className="text-[10px] text-amber-200 uppercase tracking-widest">Gesture Cam</span>
       </div>
    </div>
  );
};

export default HandController;