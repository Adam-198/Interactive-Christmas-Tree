import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { UploadedPhoto } from '../types';

interface PhotoWallProps {
  photos: UploadedPhoto[];
  isExploding: boolean;
  focusedId: string | null;
}

const PhotoWall: React.FC<PhotoWallProps> = ({ photos, isExploding, focusedId }) => {
  return (
    <group>
      {photos.map((photo) => (
        <PhotoMesh 
           key={photo.id} 
           photo={photo} 
           isExploding={isExploding} 
           isFocused={photo.id === focusedId}
        />
      ))}
    </group>
  );
};

const PhotoMesh: React.FC<{ photo: UploadedPhoto; isExploding: boolean; isFocused: boolean }> = ({ photo, isExploding, isFocused }) => {
  const meshRef = useRef<THREE.Group>(null);
  const currentExplosion = useRef(0);
  
  // Use Drei's useTexture for Suspense-ready loading
  const texture = useTexture(photo.url);
  
  useMemo(() => {
    texture.anisotropy = 16;
    texture.center.set(0.5, 0.5);
    texture.matrixAutoUpdate = true; 
  }, [texture]);

  // Pre-calculate the correct orientation quaternion for the "Tree Form"
  const baseQuaternion = useMemo(() => {
      const dummy = new THREE.Object3D();
      dummy.position.copy(photo.position);
      dummy.lookAt(photo.position.clone().add(photo.rotation));
      return dummy.quaternion;
  }, [photo]);

  useFrame((state, delta) => {
    // SYNC SPEED: Must match Experience.tsx exactly to avoid "Zoom/Overshoot" artifacts.
    // Focused: 4.0, Idle: 2.0
    const lerpSpeed = isFocused ? 4.0 : 2.0;
    const target = isExploding ? 1.0 : 0.0;
    currentExplosion.current = THREE.MathUtils.lerp(currentExplosion.current, target, delta * lerpSpeed);
    const explosion = currentExplosion.current;
    
    if (meshRef.current) {
        // 1. Calculate Structural Position
        const structuralPos = new THREE.Vector3().lerpVectors(photo.position, photo.scatterPosition, explosion);
        meshRef.current.position.copy(structuralPos);

        if (isFocused) {
             // FOCUS MODE: Look directly at the camera.
             // Using World Space lookAt for correct orientation
             meshRef.current.lookAt(state.camera.position);
             
        } else if (explosion > 0.01) {
             // EXPLODED BUT NOT FOCUSED: Free rotation/tumble
             meshRef.current.rotation.y += delta * 0.5;
             meshRef.current.rotation.z += delta * 0.2;
        } else {
             // TREE FORM: Lock to base orientation
             meshRef.current.quaternion.copy(baseQuaternion);
             const sway = Math.sin(state.clock.elapsedTime * 1.5 + parseFloat(photo.id)) * 0.05;
             meshRef.current.rotateZ(sway);
        }
    }
  });

  return (
    <group ref={meshRef}>
      {/* 1. The Photo Face */}
      <mesh position={[0, 0, 0.06]}>
         <circleGeometry args={[1.4, 32]} />
         {/* 
            Pure white, unlit material for maximum clarity and original colors.
         */}
         <meshBasicMaterial 
            map={texture} 
            color="#FFFFFF"
            toneMapped={false}
            side={THREE.DoubleSide}
         />
      </mesh>

      {/* 2. Gold Frame/Rim */}
      <mesh position={[0, 0, 0.05]}>
         <ringGeometry args={[1.35, 1.55, 32]} />
         <meshStandardMaterial 
            color="#FFD700" 
            metalness={1.0} 
            roughness={0.2} 
            emissive="#FFD700"
            emissiveIntensity={0.2}
         />
      </mesh>

      {/* 3. Backing Plate */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
         <cylinderGeometry args={[1.5, 1.5, 0.1, 32]} />
         <meshStandardMaterial color="#330000" roughness={0.8} />
      </mesh>

      {/* 4. Hanging Hook */}
      <mesh position={[0, 1.6, 0]}>
         <torusGeometry args={[0.2, 0.05, 16, 32]} />
         <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.2} />
      </mesh>
    </group>
  );
};

export default PhotoWall;