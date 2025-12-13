import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stage, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PlateShape } from './types';
import Plate from './components/Plate';
import Controls from './components/Controls';

const App: React.FC = () => {
  const [shape, setShape] = useState<PlateShape>(PlateShape.ROUND);
  const [textureUrl, setTextureUrl] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setTextureUrl(url);
    }
  };

  return (
    <div className="relative w-full h-full bg-neutral-100 flex">
      {/* Sidebar Controls */}
      <Controls 
        currentShape={shape} 
        onShapeChange={setShape} 
        onImageUpload={handleImageUpload} 
      />

      {/* 3D Scene Container */}
      <div className="flex-1 h-full relative bg-[#f0f0f0]">
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          // ADJUSTMENT: Reduced Y height from 8 to 4 (half) based on feedback.
          camera={{ position: [0, 4, 8], fov: 40 }}
          // CRITICAL FIX: NoToneMapping ensures colors are not desaturated/compressed by filmic algorithms.
          // This creates a "Pass-Through" pipeline for the texture colors.
          gl={{ 
            toneMapping: THREE.NoToneMapping, 
            outputColorSpace: THREE.SRGBColorSpace 
          }}
        >
          <Suspense fallback={null}>
            {/* 
               Intensity 1.0: Now that ToneMapping is off, we use neutral lighting 
               to avoid blowing out whites (overexposure).
            */}
            <Stage
              environment="city"
              intensity={1.0}
              adjustCamera={false}
              preset="soft"
              shadows="contact"
            >
              <Plate shape={shape} textureUrl={textureUrl} />
            </Stage>
            
            {/* 
              Background environment for reflections
            */}
            <Environment preset="lobby" background={false} blur={0.8} />
          </Suspense>
          
          <OrbitControls 
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI} 
            enablePan={false}
            minDistance={3}
            maxDistance={12}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default App;