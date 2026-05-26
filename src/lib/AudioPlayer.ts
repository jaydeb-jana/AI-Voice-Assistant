import { base64ToPcm16, pcm16ToFloat32 } from "./audio-utils";

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private masterGain: GainNode | null = null;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 24000 });
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.nextStartTime = this.audioContext.currentTime;
  }

  playChunk(base64Data: string) {
    if (!this.audioContext || !this.masterGain) return;
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const pcm16 = base64ToPcm16(base64Data);
    const float32 = pcm16ToFloat32(pcm16);
    
    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.masterGain);
    
    const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(startTime);
    
    this.nextStartTime = startTime + audioBuffer.duration;
    this.isPlaying = true;
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.nextStartTime = this.audioContext.currentTime;
      this.isPlaying = false;
    }
  }

  clearQueue() {
    if (this.audioContext) {
        this.nextStartTime = this.audioContext.currentTime;
    }
  }

  get context() {
    return this.audioContext;
  }

  get outputNode() {
    return this.masterGain;
  }
}
