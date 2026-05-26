import { floatTo16BitPCM, pcm16ToBase64 } from "./audio-utils";

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioData: (base64Data: string) => void;

  constructor(onAudioData: (base64Data: string) => void) {
    this.onAudioData = onAudioData;
  }

  async start() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext is not supported in this browser.");
      }
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!this.audioContext) {
        throw new Error("Failed to create AudioContext");
      }

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Using ScriptProcessorNode with smaller buffer for lower latency
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        if (this.audioContext?.state === 'suspended') return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(inputData);
        const base64 = pcm16ToBase64(pcm16);
        this.onAudioData(base64);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      return this.stream;
    } catch (err) {
      console.error("Audio recorder failed to start:", err);
      this.stop();
      throw err;
    }
  }

  getStream() {
    return this.stream;
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
