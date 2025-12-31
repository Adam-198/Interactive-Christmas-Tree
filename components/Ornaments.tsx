import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ornamentVertexShader, ornamentFragmentShader } from '../shaders/ornamentShader';
import { TREE_HEIGHT, TREE_RADIUS, ORNAMENT_COUNT_BOX, ORNAMENT_COUNT_SPHERE, COLORS } from '../constants';

interface OrnamentsProps {
  isExploding: boolean;
  isFocused: boolean;
}

const Ornaments: React.FC<OrnamentsProps> = ({ isExploding, isFocused }) => {
  const boxMeshRef = useRef<THREE.InstancedMesh>(null);
  const sphereMeshRef = useRef<THREE.InstancedMesh>(null);
  const boxMatRef = useRef<THREE.ShaderMaterial>(null);
  const sphereMatRef = useRef<THREE.ShaderMaterial>(null);
  
  const currentExplosion = useRef(0);
  const currentOpacity = useRef(1.0);

  // Memoize Uniforms
  const boxUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExplosion: { value: 0 },
    uOpacity: { value: 1.0 }
  }), []);

  const sphereUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExplosion: { value: 0 },
    uOpacity: { value: 1.0 }
  }), []);

  // Helper for random pos on cone
  const getConePos = (heightOffset: number = 0) => {
    const y = Math.random() * TREE_HEIGHT - (TREE_HEIGHT / 2);
    const progress = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
    // Boxes/Spheres sit on surface
    const r = (1 - progress) * TREE_RADIUS + heightOffset; 
    const theta = Math.random() * Math.PI * 2;
    return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
  };

  const { boxData, sphereData } = useMemo(() => {
    const generateData = (count: number, geometryType: 'box' | 'sphere') => {
      const colors = new Float32Array(count * 3);
      const scatterPos = new Float32Array(count * 3);
      const tempObj = new THREE.Object3D();
      const matrices: THREE.Matrix4[] = [];

      for (let i = 0; i < count; i++) {
        // Position
        const pos = getConePos(geometryType === 'box' ? 0.2 : 0.0); 
        
        // Random Rotation
        tempObj.position.copy(pos);
        tempObj.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        
        // Varied Scale
        const scale = geometryType === 'box' 
            ? (0.5 + Math.random() * 0.5) 
            : (0.3 + Math.random() * 0.4); 
        tempObj.scale.set(scale, scale, scale);
        
        tempObj.updateMatrix();
        matrices.push(tempObj.matrix.clone());

        // Color
        let c = COLORS.GOLD;
        if (geometryType === 'box') {
           const rand = Math.random();
           if(rand < 0.5) c = COLORS.RED;
           else if(rand < 0.8) c = COLORS.GOLD;
           else c = COLORS.BLUE;
        } else {
           const rand = Math.random();
           if(rand < 0.4) c = COLORS.GOLD;
           else if(rand < 0.7) c = COLORS.RED;
           else if(rand < 0.9) c = COLORS.WHITE;
           else c = COLORS.EMERALD;
        }
        colors[i*3] = c[0];
        colors[i*3+1] = c[1];
        colors[i*3+2] = c[2];

        // Scatter Position - Dramatic
        const distMult = geometryType === 'box' ? 30.0 : 45.0; // Increased scatter distance
        const scatterDir = pos.clone().normalize();
        const sc = scatterDir.multiplyScalar(30 + Math.random() * distMult);
        
        sc.y += (Math.random() - 0.5) * 40;

        scatterPos[i*3] = sc.x;
        scatterPos[i*3+1] = sc.y;
        scatterPos[i*3+2] = sc.z;
      }

      return { colors, scatterPos, matrices };
    };

    return {
      boxData: generateData(ORNAMENT_COUNT_BOX, 'box'),
      sphereData: generateData(ORNAMENT_COUNT_SPHERE, 'sphere')
    };
  }, []);

  useLayoutEffect(() => {
    if (boxMeshRef.current && boxData) {
      boxData.matrices.forEach((mat, i) => boxMeshRef.current!.setMatrixAt(i, mat));
      boxMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (sphereMeshRef.current && sphereData) {
      sphereData.matrices.forEach((mat, i) => sphereMeshRef.current!.setMatrixAt(i, mat));
      sphereMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [boxData, sphereData]);

  useFrame((state, delta) => {
    // Internal Animation Lerp
    const target = isExploding ? 1.0 : 0.0;
    currentExplosion.current = THREE.MathUtils.lerp(currentExplosion.current, target, delta * 3);

    // Opacity Logic
    const targetOpacity = isFocused ? 0.05 : 1.0; 
    currentOpacity.current = THREE.MathUtils.lerp(currentOpacity.current, targetOpacity, delta * 4);

    if (boxMatRef.current) {
      boxMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      boxMatRef.current.uniforms.uExplosion.value = currentExplosion.current;
      boxMatRef.current.uniforms.uOpacity.value = currentOpacity.current;
    }
    if (sphereMatRef.current) {
      sphereMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      sphereMatRef.current.uniforms.uExplosion.value = currentExplosion.current;
      sphereMatRef.current.uniforms.uOpacity.value = currentOpacity.current;
    }
  });

  return (
    <group>
      {/* Gift Boxes */}
      <instancedMesh ref={boxMeshRef} args={[undefined, undefined, ORNAMENT_COUNT_BOX]}>
        <boxGeometry args={[0.5, 0.5, 0.5]}>
           {/* Explicitly attach attributes to the geometry */}
           <instancedBufferAttribute attach="attributes-aColor" count={boxData.colors.length / 3} array={boxData.colors} itemSize={3} />
           <instancedBufferAttribute attach="attributes-aScatterPos" count={boxData.scatterPos.length / 3} array={boxData.scatterPos} itemSize={3} />
        </boxGeometry>
        <shaderMaterial
          ref={boxMatRef}
          vertexShader={ornamentVertexShader}
          fragmentShader={ornamentFragmentShader}
          uniforms={boxUniforms}
          transparent
        />
      </instancedMesh>

      {/* Sphere Ornaments */}
      <instancedMesh ref={sphereMeshRef} args={[undefined, undefined, ORNAMENT_COUNT_SPHERE]}>
        <sphereGeometry args={[0.3, 16, 16]}>
           {/* Explicitly attach attributes to the geometry */}
           <instancedBufferAttribute attach="attributes-aColor" count={sphereData.colors.length / 3} array={sphereData.colors} itemSize={3} />
           <instancedBufferAttribute attach="attributes-aScatterPos" count={sphereData.scatterPos.length / 3} array={sphereData.scatterPos} itemSize={3} />
        </sphereGeometry>
        <shaderMaterial
          ref={sphereMatRef}
          vertexShader={ornamentVertexShader}
          fragmentShader={ornamentFragmentShader}
          uniforms={sphereUniforms}
          transparent
        />
      </instancedMesh>
    </group>
  );
};

export default Ornaments;