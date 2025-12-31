import { Vector3 } from 'three';

export interface ParticleState {
  explosion: number; // 0 to 1
  beat: number; // 0 to 1 (audio reactivity)
  rotationSpeed: number;
}

export interface HandGestures {
  isLeftOpen: boolean; // Explode
  isRightPinch: boolean; // Focus
  rightHandX: number; // -1 to 1 for rotation
}

export interface UploadedPhoto {
  id: string;
  url: string;
  position: Vector3;
  rotation: Vector3;
  scatterPosition: Vector3;
}

// MediaPipe global types (augmenting window)
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}