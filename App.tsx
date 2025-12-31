import React, { useState, useRef, useEffect } from 'react';
import Experience from './components/Experience';
import HandController from './components/HandController';
import { HandGestures, UploadedPhoto } from './types';
import { Maximize, Camera, Image as ImageIcon, Music, Volume2, VolumeX } from 'lucide-react';
import { TREE_HEIGHT, TREE_RADIUS } from './constants';
import { audioController } from './services/audioService';
import * as THREE from 'three';

const App: React.FC = () => {
  const [gestures, setGestures] = useState<HandGestures>({ isLeftOpen: false, isRightPinch: false, rightHandX: 0 });
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  // Use Kevin MacLeod's Jingle Bells (Public Domain) from Wikimedia - OGG format is widely supported
  const [musicUrl, setMusicUrl] = useState("https://upload.wikimedia.org/wikipedia/commons/e/e6/Kevin_MacLeod_-_Jingle_Bells.ogg");
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Toggle Music Playback
  const toggleMusic = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Initialize Audio Context for visualization (if needed later)
      try {
        // Only set up audio context if not already set up (handled internally in service)
        await audioController.setup(audioRef.current);
        audioController.resume();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch((error) => {
                    console.error("Audio playback failed:", error);
                    setIsPlaying(false);
                });
        }
      } catch (e) {
        console.error("Audio setup failed:", e);
        setIsPlaying(false);
      }
    }
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      console.warn("Audio source failed:", e.currentTarget.src);
      
      // Fallback strategy
      if (musicUrl.includes("wikimedia")) {
          // Try Google's hosted sound as fallback
          setMusicUrl("https://actions.google.com/sounds/v1/holidays/jingle_bells.ogg");
          // The key prop on the audio element will force a re-render with the new source
      } else {
           // If fallback also fails, stop trying and inform user via console/ui state
           setIsPlaying(false);
      }
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setMusicUrl(url);
      
      // Reset playing state momentarily to allow new source to load
      setIsPlaying(false);
      
      // Auto play new track after short delay
      setTimeout(() => {
          if (audioRef.current) {
             toggleMusic();
          }
      }, 500);
    }
  };

  const processPhotos = (sources: (File | string)[], isUrl = false) => {
      const newPhotos: UploadedPhoto[] = [];
      
      // Use Golden Angle (~2.4 radians) to guarantee even distribution around the cone
      const startTheta = Math.random() * Math.PI * 2;
      const goldenAngle = 2.39996; 

      sources.forEach((source, index) => {
        let url = "";
        if (typeof source === 'string') url = source;
        else url = URL.createObjectURL(source);
        
        // Random Height: Cover almost full tree height (leave small gap at very top/bottom)
        const y = (Math.random() - 0.5) * (TREE_HEIGHT - 6); 
        
        // Calculate radius at this Y. 
        const progress = (y + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
        const rSurface = (1 - progress) * TREE_RADIUS;
        
        // Radius adjustment: Sit cleanly on top of foliage
        const r = rSurface + 0.6; 
        
        // Distribute angle
        const theta = startTheta + (index * goldenAngle) + (Math.random() * 0.5);
        
        const pos = new THREE.Vector3(
           r * Math.cos(theta),
           y,
           r * Math.sin(theta)
        );
        
        // Rotation Vector (Normal) - Facing Outwards
        const rotationVec = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)); 

        // Calculate Scatter Position (Deterministic)
        const scatterDir = pos.clone().normalize();
        const scatterDist = 25 + Math.random() * 15; 
        const scatterPos = pos.clone().add(scatterDir.multiplyScalar(scatterDist));
        scatterPos.y += (Math.random() - 0.5) * 10;

        newPhotos.push({
          id: Math.random().toString(36),
          url,
          position: pos,
          rotation: rotationVec, 
          scatterPosition: scatterPos
        });
      });
      setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      processPhotos(files);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Background Audio */}
      {/* Added key to force re-render when URL changes, helping with source updates */}
      <audio 
        key={musicUrl}
        ref={audioRef} 
        src={musicUrl} 
        loop 
        crossOrigin="anonymous" 
        onError={handleAudioError}
      />

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Experience gestures={gestures} photos={photos} />
      </div>

      {/* Hand Controller (Hidden logic + Webcam view) */}
      <HandController onGestureUpdate={setGestures} showCamera={showCamera} />

      {/* UI Overlay - Glassmorphism */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6 z-10 pointer-events-none flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex flex-col gap-1 md:gap-2 pointer-events-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
            Interactive Christmas Tree
          </h1>
          <p className="text-amber-100/60 text-xs md:text-sm max-w-xs">
            Open left hand to Explode. Pinch right hand to Focus.
          </p>
        </div>

        <div className="flex gap-3 md:gap-4 pointer-events-auto self-end md:self-auto flex-wrap justify-end">
           {/* Music Controls */}
           <button 
             onClick={() => musicInputRef.current?.click()} 
             className="p-2 md:p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-amber-500/20 transition-all group relative"
             title="Upload Music"
           >
              <Music size={20} className="text-amber-200 group-hover:text-white" />
           </button>

           <button 
             onClick={toggleMusic} 
             className={`p-2 md:p-3 rounded-full backdrop-blur-md border transition-all ${isPlaying ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/10 border-white/20 text-amber-200 hover:bg-amber-500/20'}`}
             title={isPlaying ? "Mute Music" : "Play Music"}
           >
              {isPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
           </button>

           <div className="w-px h-8 md:h-10 bg-white/10 mx-1"></div>

           {/* Scene Controls */}
           <button onClick={() => setShowCamera(!showCamera)} className="p-2 md:p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-amber-500/20 transition-all">
              <Camera size={20} className="text-amber-200" />
           </button>
           
           <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-amber-500/20 transition-all">
              <ImageIcon size={20} className="text-amber-200" />
           </button>

           <button onClick={toggleFullScreen} className="p-2 md:p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-amber-500/20 transition-all">
              <Maximize size={20} className="text-amber-200" />
           </button>
        </div>
      </div>

      {/* Inputs */}
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handlePhotoUpload}
      />
      <input 
        type="file" 
        accept="audio/*" 
        className="hidden" 
        ref={musicInputRef}
        onChange={handleMusicUpload}
      />
    </div>
  );
};

export default App;