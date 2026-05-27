# Lola: Real-time AI Voice Agent & Business Manager

An advanced, real-time, bidirectional voice agent infrastructure built with the **Gemini Realtime API (`gemini-3.1-flash-live-preview`)** and Web Audio API. This system serves as a high-performance, low-latency AI twin named **Lola**, representing the brand identity of software automation and SaaS workflows.

---

## 🔥 Key Features

* **Low-Latency Bidirectional Audio:** Continuous streaming of 16kHz PCM input and 24kHz audio output.
* **Proactive Engagement:** Automatically triggers an initial greeting to the user upon a successful WebSocket connection.
* **Intelligent Interruption Handling:** Instantly stops the audio queue and clears the playback buffer if the user speaks over the agent.
* **Live Session MP3 Recording:** Mixes both user mic input and agent output into a single channel and encodes it into a 128kbps MP3 on-the-fly using `lamejs`.
* **Native Tool Calling:** Integrated support for browser-side tool executions (e.g., dynamically opening web pages via function calling).

---

## 🛠️ Architecture & Modules

The system is split into four cohesive TypeScript modules structured for clean code standards and human-readable logic:

### 1. `audio-utils.ts`
Handles low-level data transformation, bit-clamping, and conversions between raw linear PCM audio and network-friendly formats.
* `floatTo16BitPCM` / `pcm16ToFloat32`: Seamless conversion between Web Audio's standard Float32Array and Gemini's expected Int16Array.
* `base64ToPcm16` / `pcm16ToBase64`: Fast binary-to-string encoding for WebSocket payloads.

### 2. `AudioRecorder.ts`
Manages native microphone access using the MediaDevices API. Uses a low-buffer `ScriptProcessorNode` (2048 samples) downsampled to 16000Hz to guarantee the lowest possible input latency.

### 3. `AudioPlayer.ts`
An optimized queue manager for receiving and playing back chunked audio buffers from the Gemini server at 24000Hz. Supports proactive audio state management (auto-resuming suspended contexts).

### 4. `LiveSessionManager.ts`
The core state-machine and controller orchestrating the `@google/genai` WebSocket layer, injection of the **Lola** system instructions, speech transcripts parsing, function call resolutions, and mixed MP3 encoding pipelines.

---

## 🚀 Getting Started

### Prerequisites
Ensure you have the official Google Gen AI SDK and `lamejs` installed in your Vite/frontend environment:

```bash
npm install

```bash
npm run dev
