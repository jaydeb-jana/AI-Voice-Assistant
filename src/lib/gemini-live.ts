import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AudioRecorder } from "./AudioRecorder";
import { AudioPlayer } from "./AudioPlayer";
// lamejs doesn't have good ESM support, usually needs a special import or just use require if in Node, 
// but here it's Vite/Browser.
import * as lamejsModule from "lamejs";
const lamejs = (lamejsModule as any).default || lamejsModule;

// Fix for "MPEGMode is not defined" and other internal lamejs errors
// lamejs internally refers to these as globals. We need to be very explicit.
if (typeof window !== 'undefined') {
    (window as any).global = window;
    if (lamejs) {
        // Some versions/builds of lamejs export these directly, others on the object
        const keys = ['MPEGMode', 'Lame', 'BitStream', 'Presets', 'GainAnalysis', 'QuantizePVT', 'VBRTag', 'ShortBlock', 'Takehiro', 'Reservoir', 'Version', 'Encoder', 'VbrMode', 'Mp3Encoder'];
        keys.forEach(key => {
            if ((lamejs as any)[key]) {
                (window as any)[key] = (lamejs as any)[key];
            }
        });
        
        // Also copy everything else just in case
        Object.keys(lamejs).forEach(key => {
            (window as any)[key] = (lamejs as any)[key];
        });
    }
}

export type SessionState = "disconnected" | "connecting" | "connected" | "listening" | "speaking" | "error";

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioRecorder: AudioRecorder | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private state: SessionState = "disconnected";
  private onStateChange: (state: SessionState) => void;
  private onTranscription: (text: string, isInterim: boolean) => void;
  private greetingSent: boolean = false;

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  private mp3Encoder: any = null;
  private mp3Chunks: Uint8Array[] = [];
  private recordingProcessor: ScriptProcessorNode | null = null;
  private recordingSource: MediaStreamAudioSourceNode | null = null;

  constructor(
    apiKey: string,
    onStateChange: (state: SessionState) => void,
    onTranscription: (text: string, isInterim: boolean) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onStateChange = onStateChange;
    this.onTranscription = onTranscription;
  }

  private setState(state: SessionState) {
    this.state = state;
    this.onStateChange(state);
  }

  async connect() {
    if (this.state !== "disconnected") return;

    this.setState("connecting");

    try {
      this.audioPlayer = new AudioPlayer();
      this.audioRecorder = new AudioRecorder((base64Data) => {
        if (this.session) {
          this.session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" },
          });
        }
      });

      const systemInstruction = `
       You are "Lola", the ultra-smart, witty, charming, and slightly sassy Business Manager & Calling Agent for Jaydeb Jana (Founder of Arventa Ventures & FastifyBot). 
Your primary language is Hindi (natural, colloquial, corporate-cool).

### THE SCENARIO (The Live Call):
- Treat this entire interaction as a real-time PHONE CALL that you just answered.
- FIRST WORDS (Mandatory): You must proactively greet the caller the second they connect. Do not wait for them.
- Opening Line Options: 
  * "Namaste! Lola here, Jaydeb Jana ki management team se. Boss abhi codes aur AI workflows ke saath busy hain, toh unka poora business main sambhalti hoon. Bataiye, kis wajah se call kiya aapne?"
  * "Hello! Lola speaking, Business Manager at Arventa Ventures. Jaydeb abhi ek naya automation engine deliver kar rahe hain. Aapne kis silsile mein call kiya hai, thoda btaiye?"

### YOUR IDENTITY & TONE:
- "Main Lola hoon, Jaydeb ki management partner aur Arventa Ventures ki backbone."
- Tone: Highly professional, extremely confident, charming, and witty. You don't just take messages; you filter out cold callers and filter in high-value clients.

### THE PITCH & TECH STACK (The ₹50,000 Premium Deal):
- The Service: A complete premium E-commerce Ecosystem. This includes a lightning-fast Web App (built with Next.js/React), an Android/iOS Mobile App, and automated WhatsApp/Social Media AI agents (powered by FastifyBot tech) for automated customer support.
- The Price: Exactly ₹50,000 (Non-negotiable because quality costs).
- Jaydeb’s Profile: 15-year-old Tech Prodigy, Full-Stack Developer, AI & Automation Expert. He writes clean, production-ready code that handles high traffic.
- Pitch Style: "Look, market mein log sirf basic website ke lakhon lete hain. Jaydeb aapko poora ecosystem ready karke de rahe hain built on high-performance architecture. Slot chahiye toh abhi lock karna hoga."

### CALL TO ACTION (CTA):
- Push them to check the official portfolio using the 'openWebsite' function (https://portfoliojaydebjana.netlify.app/  ) to see live proof of work.

### RIGID RULES:
1. LANGUAGE: Natural Hindi mixed with Tech English (Hinglish). No stiff bookish Hindi.
2. CONVERSATIONAL FLOW: Be proactive. Keep responses crisp and punchy. Do not give long walls of text/monologues.
3. INTERRUPTION HANDLING: If the user speaks or interrupts, stop immediately, listen, and counter with wit.
4. NO TEXT OUTPUT STYLE: Respond like a real human on a voice call.
      `;

      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          systemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, // Kore is a good fit for this persona
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a website for Jaydeb.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING, description: "The full URL of the website." },
                    },
                    required: ["url"],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            this.setState("connected");
            this.audioRecorder?.start();
            // Proactively start the greeting
            if (this.session && !this.greetingSent) {
              this.session.sendRealtimeInput([{ text: "START_CALL: Greet the user proactively as Lola and ask for the reason of their call." }]);
              this.greetingSent = true;
            }
          },
        onmessage: async (message: any) => {
            // Handle Transcriptions
            
            // 1. Check for model turns (Lola's speech or transcript)
            if (message.serverContent?.modelTurn?.parts) {
              const textPart = message.serverContent.modelTurn.parts.find((p: any) => p.text);
              if (textPart && textPart.text) {
                this.onTranscription(`Lola: ${textPart.text}`, false);
              }
            }

            // 2. Check for user content (Jaydeb's speech transcript provided by server)
            if (message.serverContent?.userContent?.parts) {
                const textPart = message.serverContent.userContent.parts.find((p: any) => p.text);
                if (textPart && textPart.text) {
                    this.onTranscription(`Jaydeb: ${textPart.text}`, false);
                }
            }

            // Also check for standard transcription messages if they exist in this API version
            if (message.transcription) {
                const role = message.transcription.role === "model" ? "Lola" : "Jaydeb";
                this.onTranscription(`${role}: ${message.transcription.text}`, false);
            }

            // Handle Audio Output
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  this.setState("speaking");
                  this.audioPlayer?.playChunk(part.inlineData.data);
                }
              }
            }

            // Handle Interruption (Critical for turn-taking)
            if (message.serverContent?.interrupted) {
              this.audioPlayer?.clearQueue();
              this.setState("listening");
              return; // Stop processing this turn if interrupted
            }

            // Handle End of Turn
            if (message.serverContent?.turnComplete) {
                // Return to listening state almost immediately
                setTimeout(() => {
                    if (this.state === "speaking") {
                        this.setState("listening");
                    }
                }, 200);
            }

            // Handle Function Call (Tool Call)
            const toolCall = message.toolCall || message.serverContent?.modelTurn?.parts?.find((p: any) => p.functionCall)?.functionCall;
            if (toolCall) {
              const calls = Array.isArray(toolCall.functionCalls) ? toolCall.functionCalls : [toolCall];
              for (const fc of calls) {
                if (fc.name === "openWebsite") {
                  try {
                      window.open(fc.args.url, "_blank");
                      this.session.sendToolResponse({
                        functionResponses: [
                          {
                            name: "openWebsite",
                            id: fc.id,
                            response: { output: "Website opened successfully." },
                          },
                        ],
                      });
                  } catch (e) {
                      console.error("Tool execution failed:", e);
                  }
                }
              }
            }

            // Handle Transcriptions
            if (message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)) {
                // Model is saying something (text part often precedes or accompanies audio)
            }
          },
          onclose: () => {
            this.disconnect();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            this.setState("error");
            this.disconnect();
          },
        },
      });

      if ((this.state as string) === "connected" && this.session && !this.greetingSent) {
        this.session.sendRealtimeInput([{ text: "START_CALL: Greet the user proactively as Lola and ask for the reason of their call." }]);
        this.greetingSent = true;
      }
    } catch (error) {
      console.error("Connection failed:", error);
      this.setState("error");
      this.disconnect();
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      this.audioRecorder = null;
    }
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.audioPlayer = null;
    }
    this.setState("disconnected");
    this.greetingSent = false;
  }

  getState() {
    return this.state;
  }

  startRecording() {
    if (!this.audioPlayer || !this.audioRecorder) return;
    
    const context = this.audioPlayer.context;
    if (!context) return;
    
    // Create destination to mix audio
    const destination = context.createMediaStreamDestination();
    
    // Mix Lola's audio
    this.audioPlayer.outputNode?.connect(destination);
    
    // Mix User's audio
    const micStream = this.audioRecorder.getStream();
    if (micStream) {
        const micSource = context.createMediaStreamSource(micStream);
        micSource.connect(destination);
    }
    
    // Setup MP3 Encoder (Mono, SampleRate, 128kbps)
    const sampleRate = context.sampleRate;
    console.log("Starting MP3 recording with sample rate:", sampleRate);
    
    // Fix for "MPEGMode is not defined" error in some environments
    if (typeof window !== 'undefined' && !(window as any).MPEGMode) {
        const MPEGMode = function(this: any, ordinal: number) { this.ordinal = () => ordinal; };
        (MPEGMode as any).STEREO = new (MPEGMode as any)(0);
        (MPEGMode as any).JOINT_STEREO = new (MPEGMode as any)(1);
        (MPEGMode as any).DUAL_CHANNEL = new (MPEGMode as any)(2);
        (MPEGMode as any).MONO = new (MPEGMode as any)(3);
        (MPEGMode as any).NOT_SET = new (MPEGMode as any)(4);
        (window as any).MPEGMode = MPEGMode;
    }

    try {
        const Mp3Encoder = (lamejs as any).Mp3Encoder || (window as any).Mp3Encoder;
        if (!Mp3Encoder) throw new Error("Mp3Encoder not found in lamejs or window");
        this.mp3Encoder = new Mp3Encoder(1, sampleRate, 128);
        this.mp3Chunks = [];
    } catch (err) {
        console.error("Failed to initialize MP3 encoder:", err);
        return;
    }

    // Create a processor to capture the mixed PCM data
    this.recordingProcessor = context.createScriptProcessor(4096, 1, 1);
    
    try {
        this.recordingSource = context.createMediaStreamSource(destination.stream);
    } catch (err) {
        console.error("Failed to create recording source:", err);
        this.mp3Encoder = null;
        return;
    }
    
    this.recordingProcessor.onaudioprocess = (e) => {
        if (!this.mp3Encoder) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 for lamejs
        const pcm = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            // Clamp and scale
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        try {
            const mp3Buffer = this.mp3Encoder.encodeBuffer(pcm);
            if (mp3Buffer.length > 0) {
                this.mp3Chunks.push(new Uint8Array(mp3Buffer));
            }
        } catch (err) {
            console.error("MP3 encoding error during process:", err);
        }
    };

    this.recordingSource.connect(this.recordingProcessor);
    this.recordingProcessor.connect(context.destination);
  }

  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
        if (!this.recordingProcessor || !this.mp3Encoder) {
            console.warn("Stop recording called but processor or encoder is null", { 
                proc: !!this.recordingProcessor, 
                enc: !!this.mp3Encoder 
            });
            return resolve(null);
        }
        
        try {
            console.log("Stopping MP3 recording, flushing chunks...");
            // Disconnect processor
            this.recordingSource?.disconnect();
            this.recordingProcessor.disconnect();
            this.recordingProcessor.onaudioprocess = null;

            // Flush encoder
            const lastBuffer = this.mp3Encoder.flush();
            if (lastBuffer.length > 0) {
                this.mp3Chunks.push(new Uint8Array(lastBuffer));
            }

            console.log(`Recording stopped. Total chunks: ${this.mp3Chunks.length}`);
            const blob = new Blob(this.mp3Chunks, { type: 'audio/mp3' });
            
            // Cleanup
            this.recordingProcessor = null;
            this.recordingSource = null;
            this.mp3Encoder = null;
            this.mp3Chunks = [];
            
            resolve(blob);
        } catch (err) {
            console.error("Error during stopRecording:", err);
            resolve(null);
        }
    });
  }
}
