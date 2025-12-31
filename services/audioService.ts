export class AudioController {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  public isReady = false;
  
  // Smoothing variables
  private currentBeat = 0;
  private lastTime = 0;

  constructor() {
    // Lazy init
  }

  async setup(audioElement: HTMLAudioElement) {
    if (this.ctx) return;
    
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512; // Increased resolution
    this.analyser.smoothingTimeConstant = 0.8; // Hardware smoothing
    
    this.source = this.ctx.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.isReady = true;
  }

  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getBeat(): number {
    if (!this.isReady || !this.analyser || !this.dataArray) return 0;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Focus on sub-bass and bass (Index 0-10 roughly covers 0-400Hz @ 48kHz)
    let sum = 0;
    const bassBins = 8; 
    for(let i = 0; i < bassBins; i++) {
      sum += this.dataArray[i];
    }
    
    // Normalize 0-1
    const rawTarget = (sum / bassBins) / 255;
    
    // --- Software Smoothing (Fast Attack, Slow Decay) ---
    // This makes the animation feel "bouncy" rather than jittery
    if (rawTarget > this.currentBeat) {
        // Attack: React quickly to hit
        this.currentBeat += (rawTarget - this.currentBeat) * 0.3; 
    } else {
        // Decay: Fade out slowly
        this.currentBeat += (rawTarget - this.currentBeat) * 0.05;
    }
    
    return this.currentBeat;
  }
}

export const audioController = new AudioController();