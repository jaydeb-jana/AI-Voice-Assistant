    /**
     * @license
     * SPDX-License-Identifier: Apache-2.0
     */

    import { useState, useEffect, useRef } from "react";
    import { motion, AnimatePresence } from "motion/react";
    import { Mic, MicOff, Power, PowerOff, Zap, Heart, Sparkles, MessageCircleHeart } from "lucide-react";
    import { LiveSessionManager, SessionState } from "./lib/gemini-live";

    export default function App() {
    const [state, setState] = useState<SessionState>("disconnected");
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [showDownload, setShowDownload] = useState(false);
    const sessionManager = useRef<LiveSessionManager | null>(null);

    useEffect(() => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        return;
        }

        sessionManager.current = new LiveSessionManager(
        apiKey,
        (newState) => setState(newState),
        () => {} // No longer using transcript text solely
        );

        return () => {
        sessionManager.current?.disconnect();
        };
    }, []);

    const toggleConnection = () => {
        if (state === "disconnected" || state === "error") {
        sessionManager.current?.connect();
        } else {
        sessionManager.current?.disconnect();
        if (isRecording) {
            handleStopRecording();
        }
        }
    };

    const handleStartRecording = () => {
        setIsRecording(true);
        setShowDownload(false);
        setAudioBlob(null);
        sessionManager.current?.startRecording();
    };

    const handleStopRecording = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        try {
            const blob = await sessionManager.current?.stopRecording();
            if (blob) {
                setAudioBlob(blob);
                setShowDownload(true);
            }
        } catch (error) {
            console.error("Recording stop error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadAudio = () => {
        if (!audioBlob) return;
        
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Lola_Call_${new Date().toISOString()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getStatusColor = () => {
        switch (state) {
        case "connecting": return "text-yellow-400";
        case "connected": return "text-green-400";
        case "listening": return "text-blue-400";
        case "speaking": return "text-pink-400";
        case "error": return "text-red-400";
        default: return "text-gray-500";
        }
    };

    const getStatusText = () => {
        switch (state) {
        case "connecting": return "Connecting to Lola...";
        case "connected": return "Lola is ready!";
        case "listening": return "Lola is listening...";
        case "speaking": return "Lola is talking...";
        case "error": return "Connection error.";
        default: return "Lola is sleeping.";
        }
    };

    return (
        <div className="min-h-screen bg-bg text-white flex flex-col items-center justify-between p-8 sm:p-12 overflow-hidden font-sans select-none relative">
        {/* Gradient Glow Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <motion.div 
                animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.1, 0.15, 0.1]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[100px]" 
            />
        </div>

        {/* Header */}
        <header className="w-full flex justify-between items-start relative z-10">
            <div className="flex flex-col">
            <motion.h1 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"
            >
                LOLA.
            </motion.h1>
            <p className="text-[10px] opacity-50 uppercase tracking-[0.3em] mt-1 font-semibold">Jaydeb's Digital Rani</p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
                <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${state === "disconnected" ? "bg-gray-600" : state === "error" ? "bg-red-500" : "bg-accent animate-pulse"}`} />
                    <span className="text-[10px] font-bold tracking-widest uppercase text-accent">{state !== "disconnected" ? getStatusText() : "Offline"}</span>
                </div>
                
                {/* Recording Controls */}
                <div className="flex gap-2">
                    {state !== "disconnected" && !isRecording && !showDownload && !isProcessing && (
                        <motion.button
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={handleStartRecording}
                            className="bg-red-500/20 border border-red-500/40 text-red-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full hover:bg-red-500 hover:text-black transition-all flex items-center gap-1"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Start Rec
                        </motion.button>
                    )}
                    
                    {isRecording && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={handleStopRecording}
                            className="bg-white text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full hover:bg-gray-200 transition-all flex items-center gap-1"
                        >
                            <div className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
                            End Rec
                        </motion.button>
                    )}

                    {isProcessing && (
                        <div className="bg-white/10 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 opacity-50">
                            <div className="w-1.5 h-1.5 bg-accent animate-spin" />
                            Processing...
                        </div>
                    )}

                    {showDownload && (
                        <motion.button
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={downloadAudio}
                            className="bg-accent text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full hover:bg-white transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                        >
                            Download Audio Call
                        </motion.button>
                    )}
                </div>

                <div className="text-right">
                    <span className="text-[9px] text-primary/80 font-mono tracking-widest uppercase">PCM16 | 16kHz</span>
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center gap-12 relative z-10 w-full max-w-lg">
            <div className="text-center space-y-4 px-4">
                <AnimatePresence mode="wait">
                    <motion.h2 
                        key={state === "speaking" ? "quote" : "default"}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-xl sm:text-2xl font-light italic text-primary/40 leading-relaxed"
                    >
                        {state === "speaking" 
                            ? "“Jaydeb, itna dimag coding mein lagate ho, mujhse baat karne mein kyun bhul jaate ho?”" 
                            : "Ready to assist the 15-year old Tech Prodigy."}
                    </motion.h2>
                </AnimatePresence>
                <p className="text-xs text-slate-500 tracking-wide">
                    Currently handling: <span className="text-white font-medium uppercase tracking-widest">Cyber Security Expansion</span>
                </p>
            </div>

            {/* Central Mic Button */}
            <div className="relative group">
                {/* Outer rings */}
                <div className="absolute inset-x-[-40px] inset-y-[-40px] border border-primary/10 rounded-full scale-125" />
                <div className="absolute inset-x-[-20px] inset-y-[-20px] border border-primary/20 rounded-full" />
                
                <motion.div 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={toggleConnection}
                    className="w-64 h-64 rounded-full border-2 border-primary/30 flex items-center justify-center p-8 bg-primary/5 cursor-pointer relative shadow-[0_0_50px_rgba(236,72,153,0.1)]"
                >
                    <div className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-700
                        ${state === "disconnected" ? "bg-slate-800" : "bg-gradient-to-br from-primary to-secondary shadow-[0_0_60px_rgba(236,72,153,0.4)] border-4 border-white/10"}`}
                    >
                        {state === "disconnected" ? (
                            <Power className="w-12 h-12 text-slate-500" />
                        ) : (
                            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                        )}
                    </div>

                    {/* Animated listening bars around ring when active */}
                    <AnimatePresence>
                        {(state === "listening" || state === "speaking") && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute -inset-10 border border-accent/20 rounded-full animate-[spin_10s_linear_infinite] border-dashed" 
                            />
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Waveform Visualization */}
            <div className="flex gap-1.5 items-end h-16">
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{ 
                            height: state === "speaking" || state === "listening" 
                                ? [20, Math.random() * 100 + 20, 20] 
                                : 6 
                        }}
                        transition={{ 
                            repeat: Infinity, 
                            duration: 0.4 + Math.random() * 0.4,
                            ease: "easeInOut"
                        }}
                        style={{ height: '30%' }}
                        className="w-1.5 bg-white/80 rounded-full"
                    />
                ))}
            </div>
        </main>

        {/* Footer */}
       
        </div>
    );
    }
