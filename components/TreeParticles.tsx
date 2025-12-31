import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../shaders/particleShader';
import { TREE_HEIGHT, TREE_RADIUS, PARTICLE_COUNT_TREE, PARTICLE_COUNT_DUST, PARTICLE_COUNT_RIBBON, COLORS } from '../constants';

interface TreeParticlesProps {
  isExploding: boolean;
  isFocused: boolean;
}

const TreeParticles: React.FC<TreeParticlesProps> = ({ isExploding, isFocused }) => {
  const treeMeshRef = useRef<THREE.Points>(null);
  const effectsMeshRef = useRef<THREE.Points>(null);
  const treeMatRef = useRef<THREE.ShaderMaterial>(null);
  const effectsMatRef = useRef<THREE.ShaderMaterial>(null);
  
  const currentExplosion = useRef(0);
  const currentOpacity = useRef(1.0);

  // Memoize uniforms so object reference is stable and values persist across renders
  const treeUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExplosion: { value: 0 },
    uSize: { value: 1.0 },
    uOpacity: { value: 1.0 }
  }), []);

  const effectsUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExplosion: { value: 0 },
    uSize: { value: 1.0 },
    uOpacity: { value: 1.0 }
  }), []);

  const { treeAttributes, effectsAttributes } = useMemo(() => {
    // Helper to create attributes
    const createAttributes = (count: number) => ({
      positions: new Float32Array(count * 3),
      scatterPos: new Float32Array(count * 3),
      colors: new Float32Array(count * 3),
      sizes: new Float32Array(count),
      types: new Float32Array(count),
      offsets: new Float32Array(count),
    });

    const treeAttrs = createAttributes(PARTICLE_COUNT_TREE);
    const effectsAttrs = createAttributes(PARTICLE_COUNT_DUST + PARTICLE_COUNT_RIBBON);

    // 1. Foliage Layer (Dense Cone)
    for (let i = 0; i < PARTICLE_COUNT_TREE; i++) {
      const i3 = i * 3;
      
      const y = Math.random() * TREE_HEIGHT - (TREE_HEIGHT / 2);
      const progress = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
      const rBias = Math.pow(Math.random(), 0.3); // Push out
      const r = (1 - progress) * TREE_RADIUS * rBias;
      const theta = Math.random() * Math.PI * 2;

      treeAttrs.positions[i3] = r * Math.cos(theta);
      treeAttrs.positions[i3 + 1] = y;
      treeAttrs.positions[i3 + 2] = r * Math.sin(theta);

      // Scatter outward - Increased distance for dramatic effect
      const sr = 40 + Math.random() * 40; // Range 40-80
      const stheta = Math.random() * Math.PI * 2;
      const sphi = Math.acos(2 * Math.random() - 1);
      treeAttrs.scatterPos[i3] = sr * Math.sin(sphi) * Math.cos(stheta);
      treeAttrs.scatterPos[i3 + 1] = sr * Math.sin(sphi) * Math.sin(stheta);
      treeAttrs.scatterPos[i3 + 2] = sr * Math.cos(sphi);

      // Color Strategy
      const rand = Math.random();
      let c = COLORS.DEEP_GREEN;
      if (rand > 0.8) c = COLORS.EMERALD; 
      if (rand > 0.95) c = COLORS.LIME_GREEN; 
      
      treeAttrs.colors[i3] = c[0];
      treeAttrs.colors[i3 + 1] = c[1];
      treeAttrs.colors[i3 + 2] = c[2];

      treeAttrs.sizes[i] = Math.random() * 0.8 + 0.5; 
      treeAttrs.types[i] = 0.0;
      treeAttrs.offsets[i] = Math.random() * 10;
    }

    // 2 & 3. Effects (Dust + Ribbon)
    let idx = 0;
    
    // Dust
    for (let i = 0; i < PARTICLE_COUNT_DUST; i++) {
      const i3 = idx * 3;
      
      const r = Math.random() * 20 + 5;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * TREE_HEIGHT * 2;

      effectsAttrs.positions[i3] = r * Math.cos(theta);
      effectsAttrs.positions[i3 + 1] = y;
      effectsAttrs.positions[i3 + 2] = r * Math.sin(theta);

      // Dramatic scatter for dust
      const scatterScale = 4.0 + Math.random() * 2.0;
      effectsAttrs.scatterPos[i3] = effectsAttrs.positions[i3] * scatterScale;
      effectsAttrs.scatterPos[i3+1] = effectsAttrs.positions[i3+1] * scatterScale;
      effectsAttrs.scatterPos[i3+2] = effectsAttrs.positions[i3+2] * scatterScale;

      effectsAttrs.colors[i3] = 1.0;
      effectsAttrs.colors[i3 + 1] = 0.9;
      effectsAttrs.colors[i3 + 2] = 0.6;

      effectsAttrs.sizes[idx] = Math.random() * 0.2 + 0.05;
      effectsAttrs.types[idx] = 1.0;
      effectsAttrs.offsets[idx] = Math.random() * 10;
      
      idx++;
    }

    // Ribbon
    for (let i = 0; i < PARTICLE_COUNT_RIBBON; i++) {
      const i3 = idx * 3;
      
      effectsAttrs.positions[i3] = 0;
      effectsAttrs.positions[i3 + 1] = 0;
      effectsAttrs.positions[i3 + 2] = 0;

      const sr = 60; // Wide ring scatter
      const stheta = Math.random() * Math.PI * 2;
      effectsAttrs.scatterPos[i3] = sr * Math.cos(stheta);
      effectsAttrs.scatterPos[i3 + 1] = (Math.random() - 0.5) * 60;
      effectsAttrs.scatterPos[i3 + 2] = sr * Math.sin(stheta);

      effectsAttrs.colors[i3] = 1.0;
      effectsAttrs.colors[i3 + 1] = 0.8;
      effectsAttrs.colors[i3 + 2] = 0.2;

      effectsAttrs.sizes[idx] = Math.random() * 0.5 + 0.3;
      effectsAttrs.types[idx] = 2.0;
      effectsAttrs.offsets[idx] = (i / PARTICLE_COUNT_RIBBON) * TREE_HEIGHT;
      
      idx++;
    }

    return { treeAttributes: treeAttrs, effectsAttributes: effectsAttrs };
  }, []);

  useFrame((state, delta) => {
    const uTime = state.clock.elapsedTime;
    
    // Internal Animation State Logic
    const targetExplosion = isExploding ? 1.0 : 0.0;
    currentExplosion.current = THREE.MathUtils.lerp(currentExplosion.current, targetExplosion, delta * 3);

    // Opacity Logic (Fade out if focused)
    const targetOpacity = isFocused ? 0.05 : 1.0; // Fade to 5% opacity
    currentOpacity.current = THREE.MathUtils.lerp(currentOpacity.current, targetOpacity, delta * 4);

    // Update Tree Uniforms
    if (treeMatRef.current) {
      treeMatRef.current.uniforms.uTime.value = uTime;
      treeMatRef.current.uniforms.uExplosion.value = currentExplosion.current;
      treeMatRef.current.uniforms.uOpacity.value = currentOpacity.current;
    }

    // Update Effects Uniforms
    if (effectsMatRef.current) {
      effectsMatRef.current.uniforms.uTime.value = uTime;
      effectsMatRef.current.uniforms.uExplosion.value = currentExplosion.current;
      effectsMatRef.current.uniforms.uOpacity.value = currentOpacity.current;
    }
  });

  return (
    <group>
      {/* Foliage Layer - Render First (Order 1) */}
      <points ref={treeMeshRef} renderOrder={1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={treeAttributes.positions.length / 3} array={treeAttributes.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aScatterPos" count={treeAttributes.scatterPos.length / 3} array={treeAttributes.scatterPos} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={treeAttributes.colors.length / 3} array={treeAttributes.colors} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" count={treeAttributes.sizes.length} array={treeAttributes.sizes} itemSize={1} />
          <bufferAttribute attach="attributes-aType" count={treeAttributes.types.length} array={treeAttributes.types} itemSize={1} />
          <bufferAttribute attach="attributes-aOffset" count={treeAttributes.offsets.length} array={treeAttributes.offsets} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          ref={treeMatRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={treeUniforms}
          transparent
          depthWrite={false} 
          blending={THREE.NormalBlending}
        />
      </points>

      {/* Effects (Dust/Ribbon) - Render Second (Order 2) */}
      <points ref={effectsMeshRef} renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={effectsAttributes.positions.length / 3} array={effectsAttributes.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aScatterPos" count={effectsAttributes.scatterPos.length / 3} array={effectsAttributes.scatterPos} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={effectsAttributes.colors.length / 3} array={effectsAttributes.colors} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" count={effectsAttributes.sizes.length} array={effectsAttributes.sizes} itemSize={1} />
          <bufferAttribute attach="attributes-aType" count={effectsAttributes.types.length} array={effectsAttributes.types} itemSize={1} />
          <bufferAttribute attach="attributes-aOffset" count={effectsAttributes.offsets.length} array={effectsAttributes.offsets} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          ref={effectsMatRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={effectsUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};

export default TreeParticles;