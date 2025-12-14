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
      const flatRadius = radius * 0.65; 
      const rimHeight = 0.15; 
      const radialSegments = 128; 
      
      const points: THREE.Vector2[] = [];
      const uvRadii: number[] = []; 

      // Track accumulated length for accurate UV wrapping over the edge
      let accumulatedRimDist = 0;
      let lastPos = new THREE.Vector2(0, 0);

      // A. Top Surface Profile
      const topSegments = 64;
      for (let i = 0; i <= topSegments; i++) {
        const t = i / topSegments;
        
        // CRITICAL FIX: Use epsilon (0.00001) instead of 0 to prevent LatheGeometry 
        // from welding vertices at the center pole. This preserves the vertex count 
        // per ring needed for our custom UV index math.
        const x = Math.max(t * radius, 0.00001); 

        let y = 0;

        if (x > flatRadius) {
          const tCurve = (x - flatRadius) / (radius - flatRadius);
          y = (tCurve * tCurve) * rimHeight;
        }
        
        const currentPos = new THREE.Vector2(x, y);
        points.push(currentPos);

        // For Top Surface: Planar Projection (UV Radius == Physical Radius)
        // This keeps the image undistorted on the face
        uvRadii.push(x);
        
        lastPos.copy(currentPos);
      }

      // B. Rim / Edge Transition (Wrap around)
      const rimSteps = 8;
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
      // We push UVs further out so they clamp to the edge color (solid) 
      // instead of creating noise.
      const bottomSegments = 12;
      for (let i = 0; i <= bottomSegments; i++) {
         const t = i / bottomSegments;
         // Simple flat bottom or slight curve
         const x = THREE.MathUtils.lerp(radius, flatRadius, t);
         // Taper thickness slightly
         const y = bottomY - (t * 0.01); 
         
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
      // This scales the texture down slightly so it fits the Top + Rim
      const maxUVRadius = radius + accumulatedRimDist;
      const diameterUV = maxUVRadius * 2;

      for (let i = 0; i < posAttribute.count; i++) {
        const ringIndex = Math.floor(i / (radialSegments + 1));
        
        if (ringIndex < uvRadii.length) {
          const rUV = uvRadii[ringIndex];
          const x = posAttribute.getX(i);
          const z = posAttribute.getZ(i);
          
          const angle = Math.atan2(z, x);

          // Standard Circular Mapping normalized to new Diameter
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
      
      const liftHeight = shape === PlateShape.RECTANGULAR ? 0.08 : 0.15;

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