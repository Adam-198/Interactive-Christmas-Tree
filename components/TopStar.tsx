import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_HEIGHT } from '../constants';

const TopStar: React.FC<{ isExploding: boolean; isFocused: boolean }> = ({ isExploding, isFocused }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentExplosion = useRef(0);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const starShape = React.useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.2;
    const innerRadius = 0.5;
    const points = 5;
    
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const a = (i / (points * 2)) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);

  const extrudeSettings = {
    steps: 1,
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2
  };

  useFrame((state, delta) => {
    // Internal Animation Lerp
    const target = isExploding ? 1.0 : 0.0;
    currentExplosion.current = THREE.MathUtils.lerp(currentExplosion.current, target, delta * 2);
    const explosion = currentExplosion.current;

    if (meshRef.current) {
      // Rotation logic moved to parent group in Experience.tsx
      
      const targetY = (TREE_HEIGHT / 2) + 1.5;

      if (explosion > 0.01) {
          meshRef.current.position.y = targetY + (explosion * 10);
          meshRef.current.rotation.x = explosion * 0.5;
      } else {
          meshRef.current.position.y = targetY;
          meshRef.current.rotation.x = 0;
          meshRef.current.rotation.z = 0;
      }
    }
    
    // Fade out logic
    if (materialRef.current) {
       const targetOp = isFocused ? 0.05 : 1.0;
       materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOp, delta * 4);
       materialRef.current.transparent = true;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, (TREE_HEIGHT / 2) + 1.5, 0]}>
      <extrudeGeometry args={[starShape, extrudeSettings]} />
      <meshStandardMaterial 
        ref={materialRef}
        color={0xffd700} 
        emissive={0xffe600} 
        emissiveIntensity={3.0} 
        roughness={0.1}
        metalness={1.0}
        toneMapped={false} 
      />
    </mesh>
  );
};

export default TopStar;