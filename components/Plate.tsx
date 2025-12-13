import React, { useEffect, useLayoutEffect, useRef, useMemo } from 'react';
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
  // Goal: Simulate CSS "background-size: cover" + "background-position: center"
  
  useEffect(() => {
    if (topTexture) {
      // 1. Setup Texture Capabilities
      topTexture.colorSpace = THREE.SRGBColorSpace;
      topTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
      
      // 2. DISABLE REPEAT (Fixes Seams/Hard Edges)
      // We use ClampToEdge so pixels at the edge are extended if needed, 
      // preventing the "tiled" look of non-seamless images.
      topTexture.wrapS = THREE.ClampToEdgeWrapping;
      topTexture.wrapT = THREE.ClampToEdgeWrapping;

      // 3. CALCULATE COVER SCALE
      const img = topTexture.image as HTMLImageElement;
      
      let imgAspect = 1;
      if (img && img.width && img.height) {
        imgAspect = img.width / img.height;
      }

      const plateAspect = plateDims.width / plateDims.height;

      // Logic:
      // texture.repeat controls "How much of the texture fits in the UV square".
      // If repeat < 1, we are "Zooming In" (cropping).
      // If repeat > 1, we are "Zooming Out" (tiling - avoided here).
      
      // We want to calculate Scale Factors to ensure the image COVERS the mesh.
      
      if (plateAspect > imgAspect) {
        // CASE: Plate is WIDER than the Image (relative to their own ratios).
        // To cover the width, we must use 100% of the image width.
        // But doing so makes the image height LARGER than the plate height.
        // So we must "crop" the height (show only a portion of the V axis).
        
        const scaleFactor = imgAspect / plateAspect;
        topTexture.repeat.set(1, scaleFactor);
        
        // Center vertically: (1 - visible_portion) / 2
        topTexture.offset.set(0, (1 - scaleFactor) / 2);
        
      } else {
        // CASE: Plate is TALLER (or equal) than the Image.
        // To cover the height, we must use 100% of the image height.
        // But doing so makes the image width LARGER than the plate width.
        // So we must "crop" the width (show only a portion of the U axis).
        
        const scaleFactor = plateAspect / imgAspect;
        topTexture.repeat.set(scaleFactor, 1);
        
        // Center horizontally
        topTexture.offset.set((1 - scaleFactor) / 2, 0);
      }
      
      topTexture.needsUpdate = true;
    }
  }, [topTexture, plateDims, gl]);

  useEffect(() => {
    // Noise texture for Gold back
    if (noiseTexture) {
      noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
      noiseTexture.repeat.set(4, 4);
    }
  }, [noiseTexture]);

  // --- GEOMETRY GENERATION ---
  
  const thickness = 0.05; // ~4-5mm relative to size
  
  const geometry = useMemo(() => {
    const { width: geoWidth, height: geoDepth } = plateDims;
    const segmentsX = 64;
    const segmentsZ = 64;
    
    let baseGeo;

    if (shape === PlateShape.ROUND) {
      // Cylinder Top UVs are planar projections, so the Cover logic works nicely.
      baseGeo = new THREE.CylinderGeometry(BASE_SIZE/2, BASE_SIZE/2, thickness, 128, 4);
    } else {
      // Box Geometry UVs are 0..1 on each face.
      baseGeo = new THREE.BoxGeometry(geoWidth, thickness, geoDepth, segmentsX, 2, segmentsZ);
    }

    // --- DEFORMATION (SLUMPING) ---
    const positionAttribute = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    const liftFactor = shape === PlateShape.RECTANGULAR ? 0.02 : 0.08;

    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i);

      // SLUMP / CURVATURE
      const distSq = (vertex.x * vertex.x) + (vertex.z * vertex.z);
      vertex.y += distSq * liftFactor;

      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    baseGeo.computeVertexNormals();
    return baseGeo;
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
          <>
            <primitive object={goldBackMaterial} attach="material-0" /> 
            <primitive object={glassTopMaterial} attach="material-1" />  
            <primitive object={goldBackMaterial} attach="material-2" />  
          </>
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
            position={[0, -0.1, 0]} 
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