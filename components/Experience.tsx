import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import TreeParticles from './TreeParticles';
import Ornaments from './Ornaments';
import TopStar from './TopStar';
import PhotoWall from './PhotoWall';
import { HandGestures, UploadedPhoto } from '../types';

interface ExperienceProps {
  gestures: HandGestures;
  photos: UploadedPhoto[];
}

const SceneContent: React.FC<ExperienceProps> = ({ gestures, photos }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Smooth state transitions for Camera only
  const explosionRef = useRef(0);
  
  // Track specific photo we are focusing on
  const [activePhoto, setActivePhoto] = useState<UploadedPhoto | null>(null);
  
  // Scale camera back further for the bigger tree (z: 60)
  const originalCamPos = useRef(new THREE.Vector3(0, 0, 60));

  // --- STICKY FOCUS LOGIC ---
  const rawIsFocused = gestures.isRightPinch && photos.length > 0;
  
  const [isStickyFocused, setIsStickyFocused] = useState(false);
  const focusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (rawIsFocused) {
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      setIsStickyFocused(true);
    } else {
      // Release focus after delay to prevent jitter
      if (!focusTimeoutRef.current && isStickyFocused) {
        focusTimeoutRef.current = window.setTimeout(() => {
          setIsStickyFocused(false);
          focusTimeoutRef.current = null;
        }, 800);
      }
    }
  }, [rawIsFocused, isStickyFocused]);

  useEffect(() => {
    // Select a photo IMMEDIATELY when entering focus mode
    if (isStickyFocused && !activePhoto && photos.length > 0) {
       // Pick random or cycle? Random for now.
       const rnd = Math.floor(Math.random() * photos.length);
       setActivePhoto(photos[rnd]);
    } else if (!isStickyFocused) {
       // Clear active photo when we lose focus (and timeout passes)
       setActivePhoto(null);
    }
  }, [isStickyFocused, photos, activePhoto]);

  useFrame((state, delta) => {
    // 1. Logic: If Focused, force Explosion.
    const shouldExplode = gestures.isLeftOpen || isStickyFocused;
    const targetExplosion = shouldExplode ? 1.0 : 0.0;
    
    // Lerp Speed: 
    // Focused = 4.0 (Fast snap)
    // Idle = 2.0 (Gentle return)
    const lerpSpeed = isStickyFocused ? 4.0 : 2.0;
    explosionRef.current = THREE.MathUtils.lerp(explosionRef.current, targetExplosion, delta * lerpSpeed);
    
    // 2. Rotate the entire tree group
    // Stop rotation when exploding/interacting.
    if (groupRef.current && !shouldExplode) {
       groupRef.current.rotation.y += delta * 0.6;
    }

    // Camera Logic State Machine
    if (isStickyFocused && activePhoto) {
      // --- STATE 1: FOCUS MODE (Close-up Portrait) ---
      
      // A. Calculate the CURRENT position of the photo
      const currentPhotoPos = new THREE.Vector3().lerpVectors(
         activePhoto.position, 
         activePhoto.scatterPosition, 
         explosionRef.current
      );
      
      // Apply Group Rotation to match world space
      if (groupRef.current) {
          currentPhotoPos.applyEuler(groupRef.current.rotation);
      }

      // B. Determine target camera position
      const directionFromCenter = currentPhotoPos.clone().normalize(); 
      if (directionFromCenter.lengthSq() < 0.1) directionFromCenter.set(0, 0, 1);

      // Adjust distance based on screen width (Mobile needs more distance to fit the photo)
      const isMobile = state.size.width < 768;
      const focusDistance = isMobile ? 12.0 : 6.0;

      const targetCamPos = currentPhotoPos.clone().add(directionFromCenter.multiplyScalar(focusDistance));
      
      // C. Move Camera smoothly
      // CRITICAL FIX: Increased lerp speed from 5 to 12.
      // This ensures the camera tracks the moving photo tightly.
      // If camera lags behind the outward moving photo, the photo gets too close (looks huge).
      state.camera.position.lerp(targetCamPos, delta * 12);
      
      // D. Force Camera to look at the photo's center
      const dummyCam = new THREE.Object3D();
      dummyCam.position.copy(state.camera.position);
      dummyCam.lookAt(currentPhotoPos); 
      state.camera.quaternion.slerp(dummyCam.quaternion, delta * 12); 

      // E. Sync OrbitControls
      if(controlsRef.current) {
         controlsRef.current.target.lerp(currentPhotoPos, delta * 12);
      }
      
    } else if (gestures.isLeftOpen) {
       // --- STATE 2: EXPLODED OVERVIEW (Manual Rotate) ---
       if(controlsRef.current) {
         controlsRef.current.target.lerp(new THREE.Vector3(0, 3, 0), delta * 2);
       }
       
       const currentDist = state.camera.position.length();
       const targetDist = 60;
       
       const dir = state.camera.position.clone().normalize();
       const rotSpeed = gestures.rightHandX * delta * 2;
       dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotSpeed);
       
       const newDist = THREE.MathUtils.lerp(currentDist, targetDist, delta * 2);
       
       state.camera.position.copy(dir.multiplyScalar(newDist));
       state.camera.lookAt(0, 3, 0);

    } else {
       // --- STATE 3: CLOSED TREE (IDLE) ---
       state.camera.position.lerp(originalCamPos.current, delta * 1.5);
       
       if(controlsRef.current) {
         controlsRef.current.target.lerp(new THREE.Vector3(0, 3, 0), delta * 2);
       }
    }
    
    if(controlsRef.current) controlsRef.current.update();
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[20, 20, 20]} intensity={1} color="#FFD700" />
      <pointLight position={[-20, 10, 20]} intensity={0.6} color="#AADDFF" />
      
      <group ref={groupRef} position={[0, 0, 0]}>
        <TreeParticles isExploding={gestures.isLeftOpen || isStickyFocused} isFocused={isStickyFocused} />
        <Ornaments isExploding={gestures.isLeftOpen || isStickyFocused} isFocused={isStickyFocused} />
        <TopStar isExploding={gestures.isLeftOpen || isStickyFocused} isFocused={isStickyFocused} />
        <Suspense fallback={null}>
            <PhotoWall photos={photos} isExploding={gestures.isLeftOpen || isStickyFocused} focusedId={activePhoto?.id || null} />
        </Suspense>
      </group>

      <OrbitControls 
        ref={controlsRef} 
        enablePan={false} 
        autoRotate={false} 
        enabled={!isStickyFocused}
        target={[0, 3, 0]} 
      />

      <EffectComposer disableNormalPass>
        <Bloom 
           luminanceThreshold={0.2} 
           mipmapBlur 
           intensity={1.0} 
           radius={0.5}
        />
      </EffectComposer>
    </>
  );
};

const Experience: React.FC<ExperienceProps> = (props) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 60], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}
      className="w-full h-full"
    >
      <SceneContent {...props} />
    </Canvas>
  );
};

export default Experience;