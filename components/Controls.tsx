import React from 'react';
import { PlateShape } from '../types';

interface ControlsProps {
  currentShape: PlateShape;
  onShapeChange: (shape: PlateShape) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Controls: React.FC<ControlsProps> = ({ currentShape, onShapeChange, onImageUpload }) => {
  return (
    <div className="absolute top-0 left-0 h-full w-80 bg-white shadow-2xl z-10 flex flex-col border-r border-gray-100">
      
      {/* Header / Branding */}
      <div className="pt-10 pb-8 px-8 text-center bg-gray-50 border-b border-gray-100">
        <h1 className="text-3xl font-serif font-bold text-marmara-black tracking-tight mb-2">MARMARA</h1>
        <p className="text-[10px] font-sans font-bold text-marmara-gold tracking-[0.3em] uppercase">Ceramics</p>
      </div>

      <div className="p-8 flex-1 flex flex-col gap-8 overflow-y-auto">
        
        {/* Shape Selector */}
        <div className="flex flex-col gap-4">
          <label className="text-xs font-sans font-bold text-gray-400 uppercase tracking-widest">Select Shape</label>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => onShapeChange(PlateShape.ROUND)}
              className={`flex items-center gap-4 py-3 px-4 rounded-lg transition-all duration-300 border ${
                currentShape === PlateShape.ROUND
                  ? 'bg-marmara-black text-white border-marmara-gold shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex-shrink-0 ${currentShape === PlateShape.ROUND ? 'border-marmara-gold' : 'border-gray-300'}`}></div>
              <span className="text-sm font-medium font-serif">Round Plate</span>
            </button>

            <button
              onClick={() => onShapeChange(PlateShape.SQUARE)}
              className={`flex items-center gap-4 py-3 px-4 rounded-lg transition-all duration-300 border ${
                currentShape === PlateShape.SQUARE
                  ? 'bg-marmara-black text-white border-marmara-gold shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-md border-2 flex-shrink-0 ${currentShape === PlateShape.SQUARE ? 'border-marmara-gold' : 'border-gray-300'}`}></div>
              <span className="text-sm font-medium font-serif">Square Plate</span>
            </button>

            <button
              onClick={() => onShapeChange(PlateShape.RECTANGULAR)}
              className={`flex items-center gap-4 py-3 px-4 rounded-lg transition-all duration-300 border ${
                currentShape === PlateShape.RECTANGULAR
                  ? 'bg-marmara-black text-white border-marmara-gold shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-6 rounded-sm border-2 flex-shrink-0 ${currentShape === PlateShape.RECTANGULAR ? 'border-marmara-gold' : 'border-gray-300'}`}></div>
              <span className="text-sm font-medium font-serif">Rectangular Platter</span>
            </button>
          </div>
        </div>

        <div className="h-px bg-gray-100 w-full" />

        {/* Upload */}
        <div className="flex flex-col gap-4">
          <label className="text-xs font-sans font-bold text-gray-400 uppercase tracking-widest">Custom Design</label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
              id="texture-upload"
            />
            <label
              htmlFor="texture-upload"
              className="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-marmara-gold hover:bg-orange-50/10 transition-all group"
            >
              <div className="w-10 h-10 mb-3 text-gray-300 group-hover:text-marmara-gold transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-600 group-hover:text-marmara-gold">Upload Pattern</span>
              <span className="text-xs text-gray-400 mt-1">Supports JPG, PNG</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
          Rotate the model to view the 
          <br/>
          signature finish on the back.
        </p>
      </div>
    </div>
  );
};

export default Controls;