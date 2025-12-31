
export const ornamentVertexShader = `
  attribute vec3 aScatterPos;
  attribute vec3 aColor;
  
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  uniform float uExplosion;
  
  void main() {
    vColor = aColor;
    
    // 1. Get original instance center from matrix
    vec3 instanceCenter = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    vec3 targetCenter = aScatterPos;
    
    // 2. Mix Center based on explosion
    vec3 structuralCenter = mix(instanceCenter, targetCenter, uExplosion);
    
    // No Audio Reactivity (Vibration removed)
    vec3 finalCenter = structuralCenter;
    
    // 5. Apply local transform (No beat scaling)
    mat3 instanceRot = mat3(instanceMatrix);
    vec3 localPos = instanceRot * position;
    
    // 6. Final World Position
    vec3 finalPos = finalCenter + localPos;
    
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * instanceRot * normal;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ornamentFragmentShader = `
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uOpacity; // New uniform for focus mode
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Simple Lighting Setup
    vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Specular (Metallic feel)
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    
    // Rim Light (Velvet/Glow look)
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = pow(rim, 3.0);
    
    vec3 baseColor = vColor;
    
    // Combine lighting: Ambient + Diffuse + Specular + Rim
    vec3 finalColor = baseColor * (0.2 + 0.6 * diff) 
                    + vec3(1.0, 0.9, 0.8) * spec * 0.6 
                    + baseColor * rim * 0.5;
    
    gl_FragColor = vec4(finalColor, 1.0 * uOpacity);
  }
`;