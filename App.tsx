
import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp,
  Image as ImageIcon, 
  Cpu, 
  RotateCcw, 
  ExternalLink, 
  Share2, 
  Download,
  CheckCircle2,
  Circle,
  Loader2,
  Send,
  Copy,
  Terminal,
  Settings2,
  AlertCircle,
  Maximize2,
  Video,
  Play
} from 'lucide-react';
import { INITIAL_STEPS, SYSTEM_PROMPT } from './constants';
import { AppState, StepStatus, AgentStep } from './types';
import { analyzeMediaPart, AGENT_PROMPTS } from './services/geminiService';

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
  const [isPromptEditable, setIsPromptEditable] = useState(false);
  const [globalDirective, setGlobalDirective] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
        currentStepIndex: 0
      }));
      
      updateStep('input', { status: StepStatus.COMPLETED, output: `${mediaType.toUpperCase()} ingested. Calibrating sensors...` });
      
      let inputData: string | string[];
      if (mediaType === 'video') {
        inputData = await extractFrames(url);
      } else {
        inputData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      
      startAgentWorkflow(inputData);
    }
  };

  const startAgentWorkflow = async (mediaData: string | string[]) => {
    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    let context = `Global System Directive: ${state.originalPrompt}\nUser Modification: ${globalDirective}`;
    const agentIds = ['analyst', 'style', 'technical', 'emotional', 'research', 'consolidator', 'optimizer'];

    for (const agentId of agentIds) {
      setExpandedStep(agentId);
      updateStep(agentId, { status: StepStatus.PROCESSING });
      
      try {
        const result = await analyzeMediaPart(mediaData, AGENT_PROMPTS[agentId], context);
        context += `\n[${agentId}]: ${result}`;
        updateStep(agentId, { status: StepStatus.COMPLETED, output: result });
      } catch (error) {
        console.error(`Error in node ${agentId}:`, error);
        updateStep(agentId, { status: StepStatus.ERROR, output: 'Neural node failed to respond.' });
        setState(prev => ({ ...prev, isAnalyzing: false }));
        return;
      }
    }

    setState(prev => ({ ...prev, isAnalyzing: false }));
  };

  const reset = () => {
    setState({
      media: null,
      mediaType: null,
      originalPrompt: SYSTEM_PROMPT,
      steps: INITIAL_STEPS,
      isAnalyzing: false,
      currentStepIndex: -1,
    });
    setExpandedStep(null);
    setGlobalDirective('');
  };

  const copyToClipboard = () => {
    const output = state.steps.find(s => s.id === 'optimizer')?.output;
    if (output) {
      navigator.clipboard.writeText(output);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const downloadPrompt = () => {
    const output = state.steps.find(s => s.id === 'optimizer')?.output;
    if (output) {
      const blob = new Blob([output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'synthesized_blueprint.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020202] text-[#e0e0e0] font-sans selection:bg-indigo-500/40">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 bg-[#080808]/90 backdrop-blur-2xl border-b border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={reset}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)] group-hover:scale-105 transition-all duration-500">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent uppercase italic leading-none">
                Prompt Architect
              </span>
              <span className="text-[9px] font-bold text-indigo-500/80 tracking-[0.3em] uppercase mt-1">Multimodal OS v2.0</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 rounded-full border border-white/10 shadow-inner">
            <div className={`w-2 h-2 rounded-full ${state.isAnalyzing ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
            <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
               {state.isAnalyzing ? 'Analyzing Stream' : 'System Secure'}
            </span>
          </div>
          <button className="p-2.5 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10">
            <Settings2 className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[380px] flex flex-col border-r border-white/5 bg-[#050505] overflow-hidden">
          <div className="p-7 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            
            {/* Logic Config */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Core Logic Override</h3>
                <button 
                  onClick={() => setIsPromptEditable(!isPromptEditable)}
                  className="text-[9px] text-indigo-500 hover:text-indigo-400 font-black uppercase tracking-widest"
                >
                  {isPromptEditable ? '[ Commit ]' : '[ Unlock ]'}
                </button>
              </div>
              <div className={`transition-all duration-500 rounded-2xl border ${isPromptEditable ? 'border-indigo-500/50 bg-indigo-500/5 ring-8 ring-indigo-500/5' : 'border-white/5 bg-[#0a0a0a] shadow-inner'}`}>
                <textarea 
                  value={state.originalPrompt}
                  onChange={(e) => setState(prev => ({ ...prev, originalPrompt: e.target.value }))}
                  readOnly={!isPromptEditable}
                  className="w-full h-36 p-5 text-[11px] text-gray-400 bg-transparent resize-none focus:outline-none font-mono leading-relaxed"
                  placeholder="Redefining agent behavior..."
                />
              </div>
            </div>

            {/* Agent Pipeline */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Active Neural Pipeline</h3>
              <div className="space-y-2.5">
                {state.steps.map((step, idx) => {
                  const isExpanded = expandedStep === step.id;
                  return (
                    <div 
                      key={step.id} 
                      className={`group flex flex-col rounded-2xl border transition-all duration-500 overflow-hidden ${
                        step.status === StepStatus.PROCESSING 
                          ? 'border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' 
                          : step.status === StepStatus.COMPLETED 
                          ? 'border-white/10 bg-[#080808]' 
                          : 'border-white/5 bg-[#030303]'
                      }`}
                    >
                      <button 
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className="flex items-center gap-4 p-5 text-left transition-colors"
                      >
                        <div className="shrink-0">
                          {step.status === StepStatus.COMPLETED ? (
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          ) : step.status === StepStatus.PROCESSING ? (
                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center">
                              <span className="text-[10px] font-black text-gray-600 italic">{String(idx + 1).padStart(2, '0')}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-black text-gray-100 tracking-wider uppercase italic">{step.name}</div>
                          <div className="text-[10px] text-gray-600 line-clamp-1 mt-0.5">{step.description}</div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-700" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-700" />}
                      </button>
                      
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-0 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="p-4 rounded-xl bg-black/60 border border-white/5 text-[11px] leading-[1.6] text-gray-400 font-mono italic whitespace-pre-wrap">
                            {step.output || "Awaiting neural handshake..."}
                          </div>
                        </div>
                      )}
                      
                      {step.status === StepStatus.PROCESSING && (
                        <div className="h-[2px] w-full bg-gray-900 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full animate-shimmer" style={{backgroundSize: '200% 100%'}}></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-7 border-t border-white/5 bg-[#030303]">
            <div className="relative group">
              <input 
                value={globalDirective}
                onChange={(e) => setGlobalDirective(e.target.value)}
                type="text" 
                placeholder="GLOBAL MODIFIER (E.G. 'ANIME STYLE')..." 
                className="w-full bg-[#080808] border border-white/10 rounded-2xl px-5 py-4 pr-14 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-gray-800"
              />
              <button 
                onClick={() => state.media && startAgentWorkflow(state.media)}
                disabled={!state.media || state.isAnalyzing}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-indigo-500 disabled:opacity-20 transition-all active:scale-90"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Interface */}
        <main className="flex-1 flex flex-col bg-[#010101] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.06),transparent_60%)]"></div>
          
          <div className="flex items-center justify-between px-10 py-5 shrink-0 relative z-10 border-b border-white/5 bg-[#010101]/60 backdrop-blur-xl">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Integrated Media Environment</h2>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-600">
               <button className="flex items-center gap-2.5 hover:text-white transition-all group">
                 <ExternalLink className="w-4 h-4 text-indigo-500/40 group-hover:text-indigo-400 group-hover:rotate-12 transition-transform" /> Sync JSON
               </button>
               <button className="flex items-center gap-2.5 hover:text-white transition-all group">
                 <Share2 className="w-4 h-4 text-indigo-500/40 group-hover:text-indigo-400" /> Dispatch
               </button>
            </div>
          </div>

          <div className="flex-1 p-12 flex flex-col min-h-0 overflow-hidden relative z-10">
            <div className="flex-1 bg-[#050505] rounded-[3rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10 relative">
              
              <div className="h-16 border-b border-white/5 flex items-center px-8 justify-between shrink-0 bg-[#080808]">
                <div className="flex gap-6">
                  <button onClick={reset} className="flex items-center gap-2.5 text-[10px] font-black text-gray-500 hover:text-white uppercase transition-all">
                    <RotateCcw className="w-4 h-4 text-indigo-500" /> System Re-init
                  </button>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Main Display</span>
                </div>
                <div className="flex items-center gap-2">
                   <button className="p-2.5 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all">
                     <Maximize2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-14 flex flex-col items-center">
                {!state.media ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 max-w-2xl animate-in fade-in zoom-in-95 duration-1000">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-indigo-600/20 blur-[100px] rounded-full group-hover:bg-indigo-600/30 transition-all"></div>
                        <div className="relative w-40 h-40 rounded-[3rem] bg-[#0c0c0c] flex items-center justify-center border border-white/10 shadow-3xl transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-700">
                            <Video className="w-16 h-16 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors" />
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h1 className="text-5xl font-black text-white tracking-tighter italic leading-none">UPLOAD VISUAL INTEL</h1>
                        <p className="text-gray-500 text-lg leading-relaxed font-medium">
                          Deploy multi-modal agent nodes to audit your image or video source and synthesize a high-density generation protocol.
                        </p>
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-12 py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-indigo-500 hover:text-white transition-all transform hover:-translate-y-2 active:translate-y-0 shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:shadow-indigo-500/40"
                      >
                        Select Source File
                      </button>
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef} 
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                      />
                   </div>
                ) : (
                  <div className="w-full max-w-5xl space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 pb-10">
                    <div className="text-center space-y-3">
                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.5em] animate-pulse">Neural Synthesis Results</div>
                        <h2 className="text-5xl font-black text-white tracking-tighter italic uppercase">Master Blueprint</h2>
                    </div>
                    
                    {/* Console View */}
                    <div className="relative group">
                      <div className="absolute -inset-2 bg-gradient-to-r from-indigo-600/20 via-blue-600/10 to-purple-600/20 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                      <div className="relative bg-[#020202]/80 backdrop-blur-sm rounded-[3rem] border border-white/10 p-14 min-h-[520px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center">
                        {state.isAnalyzing ? (
                          <div className="w-full space-y-8 animate-pulse">
                            <div className="h-5 w-3/4 bg-white/5 rounded-full mx-auto"></div>
                            <div className="h-5 w-full bg-white/5 rounded-full mx-auto"></div>
                            <div className="h-5 w-5/6 bg-white/5 rounded-full mx-auto"></div>
                            <div className="h-5 w-2/3 bg-white/5 rounded-full mx-auto"></div>
                            <div className="mt-16 flex justify-center">
                                <div className="flex items-center gap-4 px-8 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 ring-4 ring-indigo-500/5">
                                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                    <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">Quantum Decoding...</span>
                                </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full text-center">
                            <div className="absolute -top-10 -left-10 opacity-10 pointer-events-none">
                                <span className="text-[160px] font-black text-white">“</span>
                            </div>
                            {/* FONT FIX: Clean, sized for readability, not "outrageous" */}
                            <p className="text-xl md:text-2xl font-bold leading-[1.8] text-white/90 font-mono tracking-tight selection:bg-indigo-500/50">
                                {state.steps.find(s => s.id === 'optimizer')?.output || "Awaiting initialization..."}
                            </p>
                            <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none rotate-180">
                                <span className="text-[160px] font-black text-white">“</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Media Preview Pip */}
                        <div className="absolute -top-6 -right-6 group/pip z-20">
                           <div className="w-48 h-48 border-2 border-white/10 rounded-[2rem] overflow-hidden shadow-3xl transition-all duration-700 group-hover/pip:scale-110 group-hover/pip:rotate-3 ring-8 ring-black/50">
                              {state.mediaType === 'video' ? (
                                <video ref={videoRef} src={state.media!} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                              ) : (
                                <img src={state.media!} alt="Source" className="w-full h-full object-cover" />
                              )}
                           </div>
                           <div className="absolute top-4 right-4 flex gap-2">
                               <div className="px-2 py-1 bg-indigo-600 rounded text-[8px] font-black text-white uppercase tracking-tighter">
                                 {state.mediaType?.toUpperCase()}
                               </div>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6">
                      <button 
                        onClick={copyToClipboard}
                        disabled={state.isAnalyzing}
                        className="flex items-center gap-4 px-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 disabled:opacity-20 shadow-xl"
                      >
                        {copySuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-indigo-500" />}
                        {copySuccess ? 'Copied' : 'Copy Blueprint'}
                      </button>
                      <button 
                        onClick={() => state.steps.find(s => s.id === 'optimizer')?.output && downloadPrompt()}
                        disabled={state.isAnalyzing}
                        className="flex items-center gap-4 px-10 py-4 bg-[#111] border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-all disabled:opacity-20 shadow-xl"
                      >
                        <Download className="w-5 h-5" />
                        Save Data
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="h-14 border-t border-white/5 bg-black/60 flex items-center px-10 shrink-0">
                 <div className="flex items-center gap-10 text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${state.isAnalyzing ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`}></div>
                      Core: {state.isAnalyzing ? 'Processing Visuals' : 'Synapses Locked'}
                    </div>
                    <div className="flex items-center gap-3">
                      <Cpu className="w-4 h-4 text-indigo-500/40" />
                      Infrastructure: Gemini-Pro-Multimodal
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white/5"></div>
                      Region: Local-Node-Alpha
                    </div>
                 </div>
                 <div className="ml-auto flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-500/40 uppercase tracking-[0.4em]">Proprietary Architect Protocol</span>
                 </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #111;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #222;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default App;
