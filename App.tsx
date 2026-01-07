import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stage, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PlateShape } from './types';
import Plate from './components/Plate';
import Controls from './components/Controls';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      spotLight: any;
    }
  }
}

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
          camera={{ position: [0, 5, 8], fov: 35 }}
          gl={{ 
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace 
          }}
        >
          <Suspense fallback={null}>
            <Stage
              environment="city"
              intensity={0.6} 
              adjustCamera={false}
              preset="soft"
              shadows={{ type: 'contact', opacity: 0.5, blur: 3 }}
            >
              <Plate shape={shape} textureUrl={textureUrl} />
            </Stage>
            
            <Environment preset="lobby" background={false} blur={0.6} />
            
            {/* Additional Light for the Gold Shine */}
            <ambientLight intensity={0.3} />
            <spotLight 
              position={[10, 10, 5]} 
              angle={0.15} 
              penumbra={1} 
              intensity={1} 
              castShadow 
            />
          </Suspense>
          
          <OrbitControls 
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI} 
            enablePan={false}
            minDistance={4}
            maxDistance={15}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default App;