
import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, RotateCcw, Loader2, Send, Copy, Terminal, Key,
  Shield, Activity, Zap, Layers, Cpu, Search, Video, Maximize2,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, History,
  X, Trash2, Share2, Download, Cog
} from 'lucide-react';
import { INITIAL_STEPS, SYSTEM_PROMPT } from './constants';
import { AppState, StepStatus, AgentStep } from './types';
import { analyzeMediaPart, AGENT_PROMPTS } from './services/geminiService';

// Fix: Augment Window interface correctly to avoid "identical modifiers" conflict.
// Assuming the environment defines aistudio as optional or with specific modifiers.
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface HistoryItem {
  id: string;
  timestamp: number;
  media: string;
  blueprint: string;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    media: null,
    mediaType: null,
    originalPrompt: SYSTEM_PROMPT,
    steps: INITIAL_STEPS,
    isAnalyzing: false,
    currentStepIndex: -1,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [globalDirective, setGlobalDirective] = useState('');
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [precisionMode, setPrecisionMode] = useState(true); // Toggle between Pro and Flash for final steps
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaDataRef = useRef<string | string[] | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nexus_logs');
    if (saved) setHistory(JSON.parse(saved));

    const checkKey = async () => {
      // Use optional chaining for safe access to pre-configured aistudio
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPersonalKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // Race condition mitigation: assume success and update state immediately after triggering
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasPersonalKey(true);
    }
  };

  const updateStep = (id: string, updates: Partial<AgentStep>) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => step.id === id ? { ...step, ...updates } : step)
    }));
  };

  const saveToHistory = (media: string, blueprint: string) => {
    const newItem: HistoryItem = { id: Date.now().toString(), timestamp: Date.now(), media, blueprint };
    const updated = [newItem, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('nexus_logs', JSON.stringify(updated));
  };

  const extractFrames = async (videoUrl: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = "anonymous";
      video.load();
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      video.onloadeddata = async () => {
        const times = [0.1, video.duration / 2, video.duration - 0.1];
        for (const time of times) {
          video.currentTime = time;
          await new Promise(r => video.onseeked = r);
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          frames.push(canvas.toDataURL('image/jpeg', 0.8));
        }
        resolve(frames);
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      setState(prev => ({
        ...prev,
        media: url,
        mediaType: mediaType as 'video' | 'image',
        steps: INITIAL_STEPS.map(s => ({ ...s, status: StepStatus.IDLE, output: undefined })),
      }));
      
      let inputData: string | string[];
      if (mediaType === 'video') {
        inputData = await extractFrames(url);
      } else {
        inputData = await new Promise(r => {
          const reader = new FileReader();
          reader.onloadend = () => r(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      
      mediaDataRef.current = inputData;
      updateStep('input', { status: StepStatus.COMPLETED, output: `INGEST_COMPLETE: READY FOR DECONSTRUCTION.` });
      startAudit(inputData);
    }
  };

  const startAudit = async (mediaData: string | string[]) => {
    setState(prev => ({ 
      ...prev, 
      isAnalyzing: true,
      steps: prev.steps.map(s => s.id === 'input' ? s : { ...s, status: StepStatus.IDLE, output: undefined })
    }));
    
    let context = `Directive: ${state.originalPrompt}\nGlobal Constraint: ${globalDirective}`;
    
    const agents = [
      { id: 'analyst', pro: false },
      { id: 'style', pro: false },
      { id: 'technical', pro: false },
      { id: 'emotional', pro: false },
      { id: 'research', pro: false },
      { id: 'consolidator', pro: precisionMode }, 
      { id: 'optimizer', pro: precisionMode }
    ];

    for (const agent of agents) {
      setExpandedStep(agent.id);
      updateStep(agent.id, { status: StepStatus.PROCESSING });
      
      try {
        const result = await analyzeMediaPart(
          mediaData, 
          AGENT_PROMPTS[agent.id], 
          (retries, delay) => {
            updateStep(agent.id, { output: `RATE LIMIT HIT. RETRYING IN ${delay/1000}s... (${retries} ATTEMPTS LEFT)` });
          },
          context, 
          agent.pro
        );
        context += `\n[${agent.id}]: ${result}`;
        updateStep(agent.id, { status: StepStatus.COMPLETED, output: result });
      } catch (error: any) {
        const errorMessage = error?.message || "";
        const isQuota = errorMessage.includes('429');
        const isNotFound = errorMessage.includes('Requested entity was not found');
        
        // Reset key selection if entity not found as per Gemini API guidelines
        if (isNotFound) {
          setHasPersonalKey(false);
          await handleSelectKey();
        }

        updateStep(agent.id, { 
          status: StepStatus.ERROR, 
          output: isNotFound ? "KEY_INVALID: Please re-authenticate Nexus link." :
                  isQuota ? "RESOURCE_EXHAUSTED: Shared quota hit. Enable personal Nexus Key or toggle Efficiency Mode." : 
                  "NODE_TIMEOUT: Nexus link severed."
        });
        setState(prev => ({ ...prev, isAnalyzing: false }));
        return;
      }
    }

    const finalPrompt = context.split('[optimizer]:').pop()?.trim() || "";
    if (state.media && finalPrompt) {
      saveToHistory(state.media, finalPrompt);
    }
    setState(prev => ({ ...prev, isAnalyzing: false }));
  };

  const copyPrompt = () => {
    const output = state.steps.find(s => s.id === 'optimizer')?.output;
    if (output) {
      navigator.clipboard.writeText(output);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setState(prev => ({
      ...prev,
      media: item.media,
      steps: INITIAL_STEPS.map(s => s.id === 'optimizer' ? { ...s, status: StepStatus.COMPLETED, output: item.blueprint } : s)
    }));
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#000] text-[#eee] font-sans selection:bg-indigo-500/40 overflow-hidden">
      {/* Nexus Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/80 backdrop-blur-3xl z-[60]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)] group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">Prompt Architect</h1>
              <div className="text-[8px] font-bold text-indigo-400 tracking-[0.4em] uppercase mt-1.5 flex items-center gap-2">
                <span className="animate-pulse">●</span> V3.1 NEXUS // {hasPersonalKey ? 'High-Throughput' : 'Limited-Throughput'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Precision Toggle */}
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/5">
            <span className={`text-[8px] font-black uppercase tracking-widest ${!precisionMode ? 'text-emerald-400' : 'text-white/20'}`}>Efficiency</span>
            <button 
              onClick={() => setPrecisionMode(!precisionMode)}
              className="w-10 h-5 bg-white/10 rounded-full relative p-1 transition-all"
            >
              <div className={`w-3 h-3 bg-white rounded-full transition-all ${precisionMode ? 'translate-x-5 bg-indigo-500 shadow-[0_0_10px_indigo]' : 'translate-x-0'}`}></div>
            </button>
            <span className={`text-[8px] font-black uppercase tracking-widest ${precisionMode ? 'text-indigo-400' : 'text-white/20'}`}>Precision</span>
          </div>

          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all"
          >
            <History className="w-4 h-4" /> Archive
          </button>
          
          <div className="h-6 w-[1px] bg-white/5"></div>
          
          <button 
            onClick={handleSelectKey}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              hasPersonalKey ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <Key className="w-3.5 h-3.5" /> {hasPersonalKey ? 'Nexus Linked' : 'Uplink Key'}
          </button>

          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5">
            <Activity className={`w-3.5 h-3.5 ${state.isAnalyzing ? 'text-indigo-400 animate-pulse' : 'text-emerald-500'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{state.isAnalyzing ? 'Analyzing' : 'Standby'}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Dynamic Scan Overlay */}
        {state.isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none z-[100]">
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_indigo] animate-scanline"></div>
          </div>
        )}

        {/* History Sidebar */}
        <aside className={`absolute inset-y-0 left-0 w-80 bg-[#020202] border-r border-white/10 z-[70] transition-transform duration-500 ease-in-out ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/50">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Nexus Logs</h3>
            <button onClick={() => setShowHistory(false)} className="text-white/20 hover:text-white transition-all"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center opacity-20">
                <Database className="w-8 h-8 mb-4" />
                <span className="text-[8px] uppercase tracking-widest">Logs Empty</span>
              </div>
            ) : (
              history.map(item => (
                <div 
                  key={item.id} 
                  className="p-3 bg-white/5 border border-white/5 hover:border-indigo-500/30 cursor-pointer group transition-all rounded-xl"
                  onClick={() => loadFromHistory(item)}
                >
                  <img src={item.media} className="w-full aspect-video object-cover opacity-40 group-hover:opacity-100 transition-all mb-2 rounded-lg" />
                  <div className="text-[8px] font-mono text-white/30 uppercase flex justify-between">
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    <span className="group-hover:text-indigo-400 transition-all">Restore Node</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Sidebar: Pipeline */}
        <aside className="w-[380px] border-r border-white/5 bg-[#030303] flex flex-col z-40">
          <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] px-2">Neural Nodes</h3>
              <div className="space-y-3">
                {state.steps.filter(s => s.id !== 'input').map((step, idx) => {
                  const isExpanded = expandedStep === step.id;
                  const isError = step.status === StepStatus.ERROR;
                  const isProcessing = step.status === StepStatus.PROCESSING;
                  const isCompleted = step.status === StepStatus.COMPLETED;
                  
                  return (
                    <div 
                      key={step.id} 
                      className={`rounded-2xl border transition-all duration-500 overflow-hidden ${
                        isError ? 'border-red-500/30 bg-red-500/5' : 
                        isProcessing ? 'border-indigo-500/30 bg-indigo-500/5' : 
                        isCompleted ? 'border-white/10 bg-white/[0.02]' : 'border-white/5'
                      }`}
                    >
                      <button onClick={() => setExpandedStep(isExpanded ? null : step.id)} className="w-full flex items-center gap-4 p-5 text-left">
                        <div className="shrink-0">
                          {isError ? <AlertCircle className="w-4 h-4 text-red-500" /> : 
                           isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" /> : 
                           isProcessing ? <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /> : 
                           <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center"><span className="text-[7px]">{idx+1}</span></div>}
                        </div>
                        <div className="flex-1">
                          <div className={`text-[10px] font-black uppercase tracking-wider ${isError ? 'text-red-400' : 'text-white/80'}`}>{step.name}</div>
                          <div className="text-[8px] text-white/20 mt-1 uppercase tracking-tighter">{step.description}</div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-white/10" /> : <ChevronDown className="w-3 h-3 text-white/10" />}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
                          <div className={`p-4 rounded-xl bg-black border border-white/5 text-[9px] font-mono leading-relaxed italic whitespace-pre-wrap uppercase ${isError ? 'text-red-400' : 'text-white/40'}`}>
                            {step.output || "Handshake pending..."}
                          </div>
                          {isError && (
                            <button 
                              onClick={handleSelectKey}
                              className="mt-4 w-full py-2 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-600 transition-all"
                            >
                              Uplink Personal Key
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-[#020202]">
            <div className="relative group">
              <input 
                value={globalDirective}
                onChange={(e) => setGlobalDirective(e.target.value)}
                placeholder="GLOBAL STEERING DIRECTIVE..."
                className="w-full bg-[#080808] border border-white/10 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-white/5"
                onKeyDown={(e) => e.key === 'Enter' && mediaDataRef.current && startAudit(mediaDataRef.current)}
              />
              <button 
                disabled={!state.media || state.isAnalyzing} 
                onClick={() => mediaDataRef.current && startAudit(mediaDataRef.current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-white/20 hover:text-indigo-400 disabled:opacity-5 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Interface */}
        <main className="flex-1 flex flex-col bg-[#010101] relative p-12 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.06),transparent_70%)]"></div>
          
          <div className="flex-1 bg-[#050505] rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col">
            {!state.media ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 animate-in zoom-in-95 duration-1000">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="absolute inset-0 bg-indigo-600/10 blur-[80px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-1000"></div>
                  <div className="relative w-48 h-48 rounded-[3rem] bg-black border border-white/10 flex items-center justify-center group-hover:scale-105 transition-all duration-700">
                    <Database className="w-14 h-14 text-indigo-500/10 group-hover:text-indigo-500 transition-all" />
                  </div>
                </div>
                <div className="space-y-4 max-w-sm">
                  <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Injest Material</h2>
                  <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20 leading-relaxed px-8">Awaiting visual input for architectural audit</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="px-16 py-6 bg-white text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-3xl hover:bg-indigo-500 hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-2xl">
                  Deploy Asset
                </button>
                <input type="file" className="hidden" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileUpload} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-20 px-10 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl">
                  <div className="flex items-center gap-8">
                    <button 
                      onClick={() => {
                        mediaDataRef.current = null;
                        setState({ ...state, media: null, steps: INITIAL_STEPS });
                      }} 
                      className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4 text-indigo-500" /> Purge Memory
                    </button>
                    <div className="h-6 w-[1px] bg-white/5"></div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Node Active</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-16 bg-black relative">
                   <div className="relative w-full max-w-5xl aspect-video rounded-[3rem] overflow-hidden border border-white/5 shadow-[0_0_50px_rgba(0,0,0,1)] bg-[#080808] group">
                      <img src={state.media} className={`w-full h-full object-contain transition-all duration-1000 ${state.isAnalyzing ? 'blur-3xl opacity-10 scale-110' : 'opacity-60 group-hover:opacity-100'}`} />
                      
                      {state.isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Layers className="w-20 h-20 text-indigo-600 animate-pulse mb-8" />
                          <div className="text-[14px] font-black text-white uppercase tracking-[1.2em] animate-pulse">Scanning_Volumes...</div>
                        </div>
                      )}

                      {!state.isAnalyzing && state.steps.find(s => s.id === 'optimizer')?.output && (
                        <div className="absolute inset-0 p-16 bg-black/70 backdrop-blur-2xl flex flex-col justify-end animate-in fade-in slide-in-from-bottom-12 duration-1000">
                           <div className="space-y-8">
                              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                                <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400">Master Blueprint Synthesis</span>
                                <div className="flex gap-4">
                                  <button onClick={copyPrompt} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all flex items-center gap-3 border border-white/5">
                                    {copyFeedback ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-white/40" />}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{copyFeedback ? 'Copied' : 'Copy Code'}</span>
                                  </button>
                                </div>
                              </div>
                              <p className="text-3xl font-black italic uppercase text-white leading-[1.2] tracking-tight select-all">
                                {state.steps.find(s => s.id === 'optimizer')?.output}
                              </p>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes scanline {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scanline {
          position: absolute;
          animation: scanline 4s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default App;
