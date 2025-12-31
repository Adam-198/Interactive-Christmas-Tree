
export const vertexShader = `
  uniform float uTime;
  uniform float uExplosion;
  uniform float uSize;
  
  attribute vec3 aScatterPos;
  attribute vec3 color;
  attribute float aSize;
  attribute float aType; // 0: Tree, 1: Dust, 2: Ribbon
  attribute float aOffset; 
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vType;

  // Constants to match JS
  const float TREE_HEIGHT = 30.0;
  const float TREE_RADIUS = 12.0;

  void main() {
    vColor = color;
    vType = aType;
    
    vec3 currentPos = position;
    vec3 targetScatter = aScatterPos;
    
    // --- Ribbon Animation (Type 2) ---
    if (aType > 1.5) {
      float speed = 2.0;
      
      // Use aOffset to determine position along the spiral
      // Modulo TREE_HEIGHT to loop animations
      float yRaw = mod(aOffset + uTime * speed, TREE_HEIGHT);
      
      // Center Y vertically (-15 to 15)
      currentPos.y = yRaw - (TREE_HEIGHT / 2.0);
      
      // Normalized progress from bottom (0.0) to top (1.0)
      float progress = yRaw / TREE_HEIGHT;
      
      // Calculate Tree Cone Radius at this height
      float coneRadius = (1.0 - progress) * TREE_RADIUS;
      
      // Place Ribbon CLEARLY OUTSIDE the tree (Increased from +2.0 to +3.5)
      float ribbonRadius = coneRadius + 3.5; 
      
      // Spiral Angle: Increases with height + rotates with time
      float turns = 4.0; 
      float angle = (progress * turns * 6.28318) - (uTime * 1.0); 
      
      currentPos.x = cos(angle) * ribbonRadius;
      currentPos.z = sin(angle) * ribbonRadius;
    }

    // --- Foliage Breathing (Type 0) ---
    if (aType < 0.5) {
       // Slight expansion/contraction based on time only
       float breath = sin(uTime * 2.0 + aOffset) * 0.05;
       currentPos += normalize(currentPos) * breath;
    }

    // --- 1. Calculate Structural Position ---
    // Interpolate between Tree Form and Exploded Form
    vec3 structuralPos = mix(currentPos, targetScatter, uExplosion);

    // No Audio Reactivity anymore, just use structural position
    vec3 finalPos = structuralPos;

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // --- 3. Point Size Logic ---
    float dist = length(mvPosition.xyz);
    
    // Make dust smaller, foliage larger
    float typeScale = (aType < 0.5) ? 2.5 : 1.0;
    // Make Ribbon particles prominent and bold (Increased scale)
    if (aType > 1.5) typeScale = 3.0;
    
    gl_PointSize = aSize * uSize * typeScale * (300.0 / dist);
    
    vAlpha = 1.0;
    if (aType > 0.5 && aType < 1.5) {
        vAlpha = 0.6 + 0.4 * sin(uTime + aOffset);
    }
  }
`;

export const fragmentShader = `
  uniform sampler2D pointTexture;
  uniform float uOpacity; // Control global opacity for focus mode
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vType;

  void main() {
    vec2 xy = gl_PointCoord.xy - vec2(0.5);
    float ll = length(xy);
    if(ll > 0.5) discard;

    vec3 finalColor = vColor;
    float alpha = vAlpha;

    // --- Foliage Look (Type 0) - Fake 3D Sphere ---
    if (vType < 0.5) {
      // Calculate pseudo-normal from 2D coordinate
      vec2 uv = gl_PointCoord.xy * 2.0 - 1.0;
      float z = sqrt(1.0 - dot(uv, uv));
      vec3 normal = normalize(vec3(uv, z));
      
      // Simple lighting
      vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
      float diff = max(dot(normal, lightDir), 0.0);
      
      // Specular highlight
      vec3 viewDir = vec3(0.0, 0.0, 1.0); 
      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
      
      finalColor = vColor * (0.3 + 0.7 * diff) + vec3(0.8) * spec * 0.5;
      alpha = 1.0;
    } 
    // --- Dust/Ribbon Look (Type 1 & 2) ---
    else {
      float strength = 1.0 - (ll * 2.0);
      strength = pow(strength, 1.5);
      alpha *= strength;
      
      // Boost alpha/brightness for ribbon to make it clear
      if (vType > 1.5) {
          finalColor = vColor * 1.5; // Brighter
      }
    }

    gl_FragColor = vec4(finalColor, alpha * uOpacity);
  }
`;