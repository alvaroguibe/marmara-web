import React, { useEffect, useRef, useMemo } from 'react';
import { useTexture, Decal } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PlateShape, SIGNATURE_TEXTURE_URL, NOISE_TEXTURE_URL } from '../types';

interface PlateProps {
  shape: PlateShape;
  textureUrl: string | null;
}

const Plate: React.FC<PlateProps> = ({ shape, textureUrl }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const gl = useThree((state) => state.gl);
  
  const safeTextureUrl = textureUrl || "https://placehold.co/10x10/ffffff/ffffff";
  
  const [topTexture, signatureTexture, noiseTexture] = useTexture([
    safeTextureUrl,
    SIGNATURE_TEXTURE_URL,
    NOISE_TEXTURE_URL
  ]);

  // Base dimensions constant
  const BASE_SIZE = 3.5;

  // Calculate plate physical dimensions (World Units)
  const plateDims = useMemo(() => {
    if (shape === PlateShape.RECTANGULAR) {
      // Width (X) and Height/Depth (Z)
      return { width: BASE_SIZE * 1.6, height: BASE_SIZE * 0.9 };
    }
    // Round and Square
    return { width: BASE_SIZE, height: BASE_SIZE };
  }, [shape]);

  // --- TEXTURE MAPPING LOGIC: ASPECT FILL (COVER) ---
  useEffect(() => {
    if (topTexture) {
      topTexture.colorSpace = THREE.SRGBColorSpace;
      topTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
      topTexture.wrapS = THREE.ClampToEdgeWrapping;
      topTexture.wrapT = THREE.ClampToEdgeWrapping;
      
      topTexture.center.set(0.5, 0.5);

      const img = topTexture.image as HTMLImageElement;
      let imgAspect = 1;
      if (img && img.width && img.height) {
        imgAspect = img.width / img.height;
      }

      const plateAspect = plateDims.width / plateDims.height;
      
      if (plateAspect > imgAspect) {
        const scaleFactor = imgAspect / plateAspect;
        topTexture.repeat.set(1, scaleFactor);
        topTexture.offset.set(0, (1 - scaleFactor) / 2);
      } else {
        const scaleFactor = plateAspect / imgAspect;
        topTexture.repeat.set(scaleFactor, 1);
        topTexture.offset.set((1 - scaleFactor) / 2, 0);
      }
      
      topTexture.needsUpdate = true;
    }
  }, [topTexture, plateDims, gl]);

  useEffect(() => {
    if (noiseTexture) {
      noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
      noiseTexture.repeat.set(4, 4);
    }
  }, [noiseTexture]);

  // --- GEOMETRY GENERATION ---
  
  const thickness = 0.05; 
  
  const geometry = useMemo(() => {
    const { width, height } = plateDims;
    
    // 1. ROUND PLATE
    if (shape === PlateShape.ROUND) {
      const radius = BASE_SIZE / 2;
      const rimHeight = 0.15; 
      const radialSegments = 128; 
      
      // Defined at top of block for scope access in Section D
      const topSegments = 64;
      const rimSteps = 8;
      const bottomSegments = 48; // Increased segments for smoother bottom curve

      const points: THREE.Vector2[] = [];
      const uvRadii: number[] = []; 

      // Track accumulated length for accurate UV wrapping over the edge
      let accumulatedRimDist = 0;
      let lastPos = new THREE.Vector2(0, 0);

      // A. Top Surface Profile
      for (let i = 0; i <= topSegments; i++) {
        const t = i / topSegments;
        
        // Use epsilon to ensure stability for LatheGeometry generation
        // (Prevents vertex welding at the exact center, maintaining ring count)
        const x = Math.max(t * radius, 0.001); 

        // Continuous parabolic curve for the profile (no flat center)
        // y = (x / radius)^2 * rimHeight
        const y = Math.pow(t, 2) * rimHeight;
        
        const currentPos = new THREE.Vector2(x, y);
        points.push(currentPos);

        // For Top Surface: Planar Projection (UV Radius == Physical Radius)
        // This keeps the image undistorted on the face
        uvRadii.push(x);
        
        lastPos.copy(currentPos);
      }

      // B. Rim / Edge Transition (Wrap around)
      const topY = rimHeight;
      const bottomY = rimHeight - thickness;

      for (let i = 1; i <= rimSteps; i++) {
        const t = i / rimSteps;
        // Slight bulge for realistic glaze edge
        const bulge = Math.sin(t * Math.PI) * 0.0025; 
        const x = radius + bulge;
        const y = THREE.MathUtils.lerp(topY, bottomY, t);
        
        const currentPos = new THREE.Vector2(x, y);
        
        // Calculate actual Euclidean distance for smooth UV flow
        const segDist = currentPos.distanceTo(lastPos);
        accumulatedRimDist += segDist;

        points.push(currentPos);
        // Extend UV radius by the actual distance traveled down the side
        uvRadii.push(radius + accumulatedRimDist);
        
        lastPos.copy(currentPos);
      }

      // C. Bottom Surface 
      // Follows the same curve shape back to center
      for (let i = 0; i <= bottomSegments; i++) {
         const t = i / bottomSegments;
         // Linear interpolation from edge (radius) back to center (0.001)
         const x = THREE.MathUtils.lerp(radius, 0.001, t);
         
         // Calculate curve height at this X, then subtract thickness
         const curveY = Math.pow(x / radius, 2) * rimHeight;
         const y = curveY - thickness;
         
         const currentPos = new THREE.Vector2(x, y);
         points.push(currentPos);
         
         // Push UVs way out (> 1.0) so they clamp to the last pixel
         // This avoids the texture appearing reversed/distorted on bottom
         uvRadii.push(radius + accumulatedRimDist + (radius - x) + 0.1);
      }

      // D. Generate and Normalize
      const geo = new THREE.LatheGeometry(points, radialSegments); 
      const posAttribute = geo.attributes.position;
      const uvAttribute = geo.attributes.uv;
      uvAttribute.needsUpdate = true;
      
      // CRITICAL: Normalize UVs by the TOTAL unwrapped diameter (including rim)
      const maxUVRadius = radius + accumulatedRimDist;
      const diameterUV = maxUVRadius * 2;
      
      const totalProfilePoints = uvRadii.length;
      // Calculate the normalized V value where the top surface ends.
      // Used to switch from Planar to Polar mapping.
      const topSurfaceRatio = topSegments / (topSegments + rimSteps + bottomSegments);

      for (let i = 0; i < posAttribute.count; i++) {
        const x = posAttribute.getX(i);
        const z = posAttribute.getZ(i);
        
        // Get the original V coordinate from LatheGeometry (0 to 1 along profile)
        const originalV = uvAttribute.getY(i);
        
        // --- HYBRID MAPPING STRATEGY ---
        
        // 1. TOP SURFACE (Strict Cartesian Planar Mapping)
        // If we are on the top surface, we map X/Z directly to U/V.
        // This completely avoids Math.atan2 and singularities at the center.
        // We use a small buffer (+0.005) to ensure the exact edge loop is included.
        if (originalV <= topSurfaceRatio + 0.005) {
          const u = (x / diameterUV) + 0.5;
          const v = (z / diameterUV) + 0.5;
          uvAttribute.setXY(i, u, v);
        } 
        
        // 2. RIM & BOTTOM (Polar Arc-Length Mapping)
        // For the edge and bottom, we use the unwrapped accumulated radius to curve the texture.
        else {
          let ringIndex = Math.round(originalV * (totalProfilePoints - 1));
          ringIndex = Math.max(0, Math.min(ringIndex, totalProfilePoints - 1));

          const rUV = uvRadii[ringIndex];
          const angle = Math.atan2(z, x);

          const u = (rUV * Math.cos(angle)) / diameterUV + 0.5;
          const v = (rUV * Math.sin(angle)) / diameterUV + 0.5;
          
          uvAttribute.setXY(i, u, v);
        }
      }
      
      geo.computeVertexNormals();
      return geo;
    } 
    
    // 2. SQUARE / RECTANGULAR
    else {
      const segmentsX = 64;
      const segmentsZ = 64;
      const baseGeo = new THREE.BoxGeometry(width, thickness, height, segmentsX, 2, segmentsZ);

      const positionAttribute = baseGeo.attributes.position;
      const vertex = new THREE.Vector3();
      
      const minDim = Math.min(width, height);
      const flatRadius = (minDim / 2) * 0.60; 
      
      // Reduced lift height by another 50% for realistic look based on feedback
      // Was 0.04 : 0.075 -> Now 0.02 : 0.035
      const liftHeight = shape === PlateShape.RECTANGULAR ? 0.02 : 0.035;

      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        const dist = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);

        if (dist > flatRadius) {
          const normalizedDist = (dist - flatRadius) / ((minDim / 2) - flatRadius);
          const lift = (normalizedDist * normalizedDist) * liftHeight;
          vertex.y += lift;
        }
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }

      baseGeo.computeVertexNormals();
      return baseGeo;
    }
  }, [shape, plateDims]);


  // --- MATERIALS ---

  const goldBackMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C8A050'), 
    roughness: 0.6,
    metalness: 1.0,
    bumpMap: noiseTexture || null,
    bumpScale: 0.02,
    envMapIntensity: 0.8,
  });

  const glassTopMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff', 
    map: textureUrl ? topTexture : null,
    roughness: 0.5, 
    metalness: 0.0, 
    envMapIntensity: 0.25,
    toneMapped: false,
    transparent: false,
    side: THREE.DoubleSide
  });

  return (
    <group>
      <mesh 
        ref={meshRef} 
        geometry={geometry} 
        castShadow 
        receiveShadow
      >
        {shape === PlateShape.ROUND ? (
          <primitive object={glassTopMaterial} attach="material" />
        ) : (
          <>
            <primitive object={goldBackMaterial} attach="material-0" />
            <primitive object={goldBackMaterial} attach="material-1" />
            <primitive object={glassTopMaterial} attach="material-2" /> 
            <primitive object={goldBackMaterial} attach="material-3" />
            <primitive object={goldBackMaterial} attach="material-4" />
            <primitive object={goldBackMaterial} attach="material-5" />
          </>
        )}

        {signatureTexture && (
          <Decal
            position={[0, -0.15, 0]} 
            rotation={[-Math.PI / 2, 0, 0]} 
            scale={[1.5, 0.75, 0.15]} 
          >
            <meshBasicMaterial 
              map={signatureTexture} 
              transparent 
              opacity={0.9} 
              depthTest={true} 
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-4}
            />
          </Decal>
        )}
      </mesh>
    </group>
  );
};

export default Plate;