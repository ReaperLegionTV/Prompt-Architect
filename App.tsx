
import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, RotateCcw, Loader2, Send, Copy, Terminal, Key,
  Shield, Activity, Zap, Layers, Cpu, Search, Video, Maximize2,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2
} from 'lucide-react';
import { INITIAL_STEPS, SYSTEM_PROMPT } from './constants';
import { AppState, StepStatus, AgentStep } from './types';
import { analyzeMediaPart, AGENT_PROMPTS } from './services/geminiService';

// Fix TS errors: All declarations of 'aistudio' must have identical modifiers and match the platform's AIStudio type.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    readonly aistudio: AIStudio;
  }
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

  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [globalDirective, setGlobalDirective] = useState('');
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Store media data for re-auditing with new directives
  const mediaDataRef = useRef<string | string[] | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPersonalKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success after triggering the dialog to avoid race conditions.
      setHasPersonalKey(true);
    }
  };

  const updateStep = (id: string, updates: Partial<AgentStep>) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => step.id === id ? { ...step, ...updates } : step)
    }));
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
      updateStep('input', { status: StepStatus.COMPLETED, output: `INGEST COMPLETE: ${mediaType === 'video' ? 'TEMPORAL' : 'STATIC'} BUFFER FILLED.` });
      startAudit(inputData);
    }
  };

  const startAudit = async (mediaData: string | string[]) => {
    setState(prev => ({ 
      ...prev, 
      isAnalyzing: true,
      steps: prev.steps.map(s => s.id === 'input' ? s : { ...s, status: StepStatus.IDLE, output: undefined })
    }));
    let context = `Directive: ${state.originalPrompt}\nUser Override: ${globalDirective}`;
    
    // Core Agent Sequence
    const agents = [
      { id: 'analyst', pro: false },
      { id: 'style', pro: false },
      { id: 'technical', pro: false },
      { id: 'emotional', pro: false },
      { id: 'research', pro: false },
      { id: 'consolidator', pro: true },
      { id: 'optimizer', pro: true }
    ];

    for (const agent of agents) {
      setExpandedStep(agent.id);
      updateStep(agent.id, { status: StepStatus.PROCESSING });
      try {
        const result = await analyzeMediaPart(mediaData, AGENT_PROMPTS[agent.id], context, agent.pro);
        context += `\n[${agent.id}]: ${result}`;
        updateStep(agent.id, { status: StepStatus.COMPLETED, output: result });
      } catch (error: any) {
        const errorMessage = error?.message || "";
        const isQuota = errorMessage.includes('429');
        const isNotFound = errorMessage.includes('Requested entity was not found');
        
        // Handle "Requested entity was not found" by resetting the key state and prompting the user.
        if (isNotFound) {
          setHasPersonalKey(false);
          await handleSelectKey();
        }

        updateStep(agent.id, { 
          status: StepStatus.ERROR, 
          output: isNotFound ? "KEY INVALID: Please re-authenticate Nexus link via paid billing project." :
                  isQuota ? "QUOTA EXHAUSTED: Please uplink a personal Nexus Key." : 
                  "NODE TIMEOUT: Nexus link severed."
        });
        setState(prev => ({ ...prev, isAnalyzing: false }));
        return;
      }
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

  return (
    <div className="flex flex-col h-screen bg-[#000] text-[#eee] font-sans selection:bg-indigo-500/40 overflow-hidden">
      {/* Nexus Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/80 backdrop-blur-3xl z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)] group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">Prompt Architect</h1>
              <div className="text-[8px] font-bold text-indigo-400 tracking-[0.4em] uppercase mt-1.5 flex items-center gap-2">
                <span className="animate-pulse">●</span> V3.1 NEXUS // {hasPersonalKey ? 'Personal High-Quota' : 'Shared Shared-Quota'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleSelectKey}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              hasPersonalKey ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <Key className="w-3.5 h-3.5" /> {hasPersonalKey ? 'Nexus Key Active' : 'Configure Nexus Key'}
          </button>
          <div className="h-10 w-[1px] bg-white/5"></div>
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5">
            <Activity className={`w-3.5 h-3.5 ${state.isAnalyzing ? 'text-indigo-400 animate-pulse' : 'text-emerald-500'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{state.isAnalyzing ? 'Analyzing' : 'Ready'}</span>
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

        {/* Sidebar: Pipeline */}
        <aside className="w-[380px] border-r border-white/5 bg-[#030303] flex flex-col z-40">
          <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] px-2">Pipeline Logic</h3>
              <div className="space-y-3">
                {state.steps.filter(s => s.id !== 'input').map((step, idx) => {
                  const isExpanded = expandedStep === step.id;
                  const isError = step.status === StepStatus.ERROR;
                  return (
                    <div 
                      key={step.id} 
                      className={`rounded-2xl border transition-all duration-500 overflow-hidden ${
                        isError ? 'border-red-500/30 bg-red-500/5' : 
                        step.status === StepStatus.PROCESSING ? 'border-indigo-500/30 bg-indigo-500/5' : 
                        step.status === StepStatus.COMPLETED ? 'border-white/10 bg-white/[0.02]' : 'border-white/5'
                      }`}
                    >
                      <button onClick={() => setExpandedStep(isExpanded ? null : step.id)} className="w-full flex items-center gap-4 p-5 text-left">
                        <div className="shrink-0">
                          {isError ? <AlertCircle className="w-4 h-4 text-red-500" /> : 
                           step.status === StepStatus.COMPLETED ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                           step.status === StepStatus.PROCESSING ? <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /> : 
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
                            {step.output || "Awaiting neural handshake..."}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-[#020202]">
            <div className="relative">
              <input 
                value={globalDirective}
                onChange={(e) => setGlobalDirective(e.target.value)}
                placeholder="GLOBAL STEERING DIRECTIVE..."
                className="w-full bg-[#080808] border border-white/10 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-indigo-500/40 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && mediaDataRef.current && startAudit(mediaDataRef.current)}
              />
              <button 
                disabled={!state.media || state.isAnalyzing} 
                onClick={() => mediaDataRef.current && startAudit(mediaDataRef.current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-white/20 hover:text-indigo-400 disabled:opacity-10 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Interface */}
        <main className="flex-1 flex flex-col bg-[#010101] relative p-12 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.05),transparent_70%)]"></div>
          
          <div className="flex-1 bg-[#050505] rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col">
            {!state.media ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 animate-in zoom-in-95 duration-1000">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="absolute inset-0 bg-indigo-600/10 blur-[80px] rounded-full group-hover:bg-indigo-600/20 transition-all"></div>
                  <div className="relative w-40 h-40 rounded-[2.5rem] bg-black border border-white/10 flex items-center justify-center group-hover:scale-105 transition-all duration-700">
                    <Database className="w-12 h-12 text-indigo-500/20 group-hover:text-indigo-500 transition-all" />
                  </div>
                </div>
                <div className="space-y-4 max-w-sm">
                  <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Injest Visuals</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 leading-relaxed">Prime the nodes for architectural reconstruction</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="px-14 py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl hover:bg-indigo-500 hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-2xl">
                  Deploy Material
                </button>
                <input type="file" className="hidden" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileUpload} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-16 px-8 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl">
                  <div className="flex items-center gap-6">
                    <button onClick={() => {
                      mediaDataRef.current = null;
                      setState({ ...state, media: null, steps: INITIAL_STEPS });
                    }} className="text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-500" /> Purge Memory
                    </button>
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-[0.6em] text-white/10">Neural Map: Active</div>
                </div>

                <div className="flex-1 flex items-center justify-center p-12 bg-black relative">
                   <div className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-[#080808] group">
                      <img src={state.media} className={`w-full h-full object-contain transition-all duration-1000 ${state.isAnalyzing ? 'blur-2xl opacity-20 scale-110' : 'opacity-60 group-hover:opacity-100'}`} />
                      
                      {state.isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Layers className="w-16 h-16 text-indigo-500 animate-pulse mb-6" />
                          <div className="text-[12px] font-black text-white uppercase tracking-[1em] animate-pulse">Extracting_Geometry...</div>
                        </div>
                      )}

                      {!state.isAnalyzing && state.steps.find(s => s.id === 'optimizer')?.output && (
                        <div className="absolute inset-0 p-12 bg-black/60 backdrop-blur-md flex flex-col justify-end animate-in fade-in slide-in-from-bottom-8">
                           <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400">Master Blueprint</span>
                                <div className="flex gap-4">
                                  <button onClick={copyPrompt} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                                    {copyFeedback ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-white/40" />}
                                  </button>
                                </div>
                              </div>
                              <p className="text-2xl font-black italic uppercase text-white leading-tight tracking-tight select-all">
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
          animation: scanline 3s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
      `}</style>
    </div>
  );
};

export default App;
