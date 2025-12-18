
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
      
      updateStep('input', { status: StepStatus.COMPLETED, output: `Stream established. Protocol: ${mediaType.toUpperCase()}` });
      
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
    
    let context = `Global System Directive: ${state.originalPrompt}\nUser Override: ${globalDirective}`;
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
        updateStep(agentId, { status: StepStatus.ERROR, output: 'Critical node timeout.' });
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
      link.download = 'blueprint.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020202] text-[#e0e0e0] font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#080808]/95 backdrop-blur-2xl border-b border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={reset}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-all duration-500">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">
                Prompt Architect
              </span>
              <span className="text-[8px] font-bold text-indigo-400 tracking-[0.4em] uppercase mt-1">Sora 2 Enabled / v2.2</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${state.isAnalyzing ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
            <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">
               {state.isAnalyzing ? 'Processing' : 'Standby'}
            </span>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[340px] flex flex-col border-r border-white/5 bg-[#040404] overflow-hidden">
          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            
            {/* Logic Config */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Neural Directives</h3>
                <button 
                  onClick={() => setIsPromptEditable(!isPromptEditable)}
                  className="text-[8px] text-indigo-500 hover:text-indigo-400 font-black uppercase tracking-widest"
                >
                  {isPromptEditable ? '[ Commit ]' : '[ Edit ]'}
                </button>
              </div>
              <div className={`transition-all duration-500 rounded-xl border ${isPromptEditable ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5 bg-[#080808]'}`}>
                <textarea 
                  value={state.originalPrompt}
                  onChange={(e) => setState(prev => ({ ...prev, originalPrompt: e.target.value }))}
                  readOnly={!isPromptEditable}
                  className="w-full h-28 p-4 text-[9px] text-gray-400 bg-transparent resize-none focus:outline-none font-mono leading-relaxed uppercase tracking-tighter"
                  placeholder="System logic override..."
                />
              </div>
            </div>

            {/* Agent Pipeline */}
            <div className="space-y-3">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Pipeline Stream</h3>
              <div className="space-y-2">
                {state.steps.map((step, idx) => {
                  const isExpanded = expandedStep === step.id;
                  return (
                    <div 
                      key={step.id} 
                      className={`group flex flex-col rounded-xl border transition-all duration-500 overflow-hidden ${
                        step.status === StepStatus.PROCESSING 
                          ? 'border-indigo-500/40 bg-indigo-500/5' 
                          : step.status === StepStatus.COMPLETED 
                          ? 'border-white/10 bg-[#080808]' 
                          : 'border-white/5 bg-[#030303]'
                      }`}
                    >
                      <button 
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className="flex items-center gap-3 p-4 text-left transition-colors"
                      >
                        <div className="shrink-0">
                          {step.status === StepStatus.COMPLETED ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : step.status === StepStatus.PROCESSING ? (
                            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                          ) : (
                            <div className="w-4 h-4 rounded border border-white/5 flex items-center justify-center">
                              <span className="text-[8px] font-black text-gray-700">{idx + 1}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-black text-gray-300 tracking-wider uppercase">{step.name}</div>
                          <div className="text-[8px] text-gray-600 line-clamp-1 mt-0.5">{step.description}</div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-700" /> : <ChevronDown className="w-3 h-3 text-gray-700" />}
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-[9px] leading-[1.5] text-gray-400 font-mono italic whitespace-pre-wrap uppercase tracking-tight">
                            {step.output || "Handshake pending..."}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/5 bg-[#020202]">
            <div className="relative group">
              <input 
                value={globalDirective}
                onChange={(e) => setGlobalDirective(e.target.value)}
                type="text" 
                placeholder="GLOBAL MODIFIER..." 
                className="w-full bg-[#080808] border border-white/5 rounded-xl px-4 py-3 pr-12 text-[9px] font-black uppercase tracking-[0.2em] focus:outline-none focus:border-indigo-500/30 transition-all placeholder:text-gray-800"
              />
              <button 
                onClick={() => state.media && startAgentWorkflow(state.media)}
                disabled={!state.media || state.isAnalyzing}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-indigo-500 disabled:opacity-20 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Interface */}
        <main className="flex-1 flex flex-col bg-[#010101] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.03),transparent_60%)]"></div>
          
          <div className="flex items-center justify-between px-8 py-4 shrink-0 relative z-10 border-b border-white/5 bg-[#010101]/80 backdrop-blur-xl">
            <h2 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">Temporal Reconstruction Core</h2>
            <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-widest text-gray-600">
               <button className="flex items-center gap-2 hover:text-white transition-all group">
                 <ExternalLink className="w-3.5 h-3.5 text-indigo-500/30 group-hover:text-indigo-400" /> Export
               </button>
               <button className="flex items-center gap-2 hover:text-white transition-all group">
                 <Share2 className="w-3.5 h-3.5 text-indigo-500/30 group-hover:text-indigo-400" /> Dispatch
               </button>
            </div>
          </div>

          <div className="flex-1 p-8 flex flex-col min-h-0 overflow-hidden relative z-10">
            <div className="flex-1 bg-[#040404] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10 relative">
              
              <div className="h-14 border-b border-white/5 flex items-center px-6 justify-between shrink-0 bg-[#080808]">
                <div className="flex gap-4">
                  <button onClick={reset} className="flex items-center gap-2 text-[9px] font-black text-gray-600 hover:text-white uppercase transition-all">
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-500" /> Purge
                  </button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse"></div>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Live Telemetry</span>
                </div>
                <button className="p-2 hover:bg-white/5 rounded-lg text-gray-600 hover:text-white transition-all group">
                  <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-12 flex flex-col items-center">
                {!state.media ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-xl animate-in fade-in zoom-in-95 duration-700">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-indigo-600/5 blur-[100px] rounded-full"></div>
                        <div className="relative w-36 h-36 rounded-[2.5rem] bg-[#080808] flex items-center justify-center border border-white/10 shadow-3xl transform group-hover:scale-105 transition-all duration-700">
                            <Video className="w-12 h-12 text-indigo-500/10 group-hover:text-indigo-500/30 transition-colors" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">Establish Stream</h1>
                        <p className="text-gray-500 text-sm leading-relaxed font-medium tracking-tight">
                          Initiate a high-density visual audit. Nodes are primed for Sora 2 temporal reconstruction.
                        </p>
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-12 py-4 bg-white text-black font-black text-[9px] uppercase tracking-[0.3em] rounded-xl hover:bg-indigo-500 hover:text-white transition-all transform hover:-translate-y-1 active:translate-y-0"
                      >
                        Upload Data
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
                  <div className="w-full max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-10">
                    <div className="text-center space-y-2">
                        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.5em]">Synthesis Logic Stream</div>
                        <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">Master Blueprint</h2>
                    </div>
                    
                    {/* Console View */}
                    <div className="relative group">
                      <div className="absolute -inset-2 bg-gradient-to-br from-indigo-600/10 to-transparent rounded-[2.5rem] blur-2xl opacity-40"></div>
                      <div className="relative bg-[#020202] rounded-[2.5rem] border border-white/10 p-12 min-h-[400px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center">
                        {state.isAnalyzing ? (
                          <div className="w-full space-y-6 animate-pulse">
                            <div className="h-3 w-3/4 bg-white/5 rounded-full mx-auto"></div>
                            <div className="h-3 w-full bg-white/5 rounded-full mx-auto"></div>
                            <div className="h-3 w-2/3 bg-white/5 rounded-full mx-auto"></div>
                            <div className="mt-12 flex justify-center">
                                <div className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Compiling...</span>
                                </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full text-center">
                            <div className="absolute -top-10 -left-10 opacity-5 pointer-events-none">
                                <span className="text-[140px] font-black text-white italic">“</span>
                            </div>
                            {/* FONT SIZE FIX: Adjusted to text-sm for technical density and readability */}
                            <div className="max-w-2xl mx-auto px-4">
                                <p className="text-sm md:text-base font-bold leading-[1.7] text-white/70 font-mono tracking-tight selection:bg-indigo-500/50 uppercase break-words">
                                    {state.steps.find(s => s.id === 'optimizer')?.output || "Nodes operational."}
                                </p>
                            </div>
                            <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none rotate-180">
                                <span className="text-[140px] font-black text-white italic">“</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Media Preview Pip */}
                        <div className="absolute -top-4 -right-4 group/pip z-20">
                           <div className="w-44 h-44 border-2 border-white/10 rounded-[2rem] overflow-hidden shadow-3xl transition-all duration-700 group-hover/pip:scale-105 group-hover/pip:rotate-2 ring-8 ring-black/80">
                              {state.mediaType === 'video' ? (
                                <video ref={videoRef} src={state.media!} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                              ) : (
                                <img src={state.media!} alt="Source" className="w-full h-full object-cover" />
                              )}
                           </div>
                           <div className="absolute bottom-4 right-4 flex gap-2">
                               <div className="px-2 py-1 bg-indigo-600 rounded text-[8px] font-black text-white uppercase tracking-widest shadow-2xl">
                                 {state.mediaType?.toUpperCase()}
                               </div>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4">
                      <button 
                        onClick={copyToClipboard}
                        disabled={state.isAnalyzing}
                        className="flex items-center gap-3 px-10 py-4 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-indigo-500 hover:text-white transition-all active:scale-95 disabled:opacity-20 shadow-xl"
                      >
                        {copySuccess ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copySuccess ? 'Synced' : 'Copy Blueprint'}
                      </button>
                      <button 
                        onClick={() => state.steps.find(s => s.id === 'optimizer')?.output && downloadPrompt()}
                        disabled={state.isAnalyzing}
                        className="flex items-center gap-3 px-10 py-4 bg-[#080808] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 hover:text-white hover:bg-[#111] transition-all disabled:opacity-20 shadow-xl"
                      >
                        <Download className="w-4 h-4" />
                        Save Data
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="h-14 border-t border-white/5 bg-black/80 flex items-center px-8 shrink-0">
                 <div className="flex items-center gap-8 text-[8px] font-black tracking-[0.3em] text-gray-600 uppercase">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${state.isAnalyzing ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                      Core: {state.isAnalyzing ? 'Processing' : 'Locked'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-indigo-500/30" />
                      Gemini 3 Pro
                    </div>
                 </div>
                 <div className="ml-auto flex items-center gap-4">
                    <div className="h-0.5 w-24 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full bg-indigo-500 transition-all duration-1000 ${state.isAnalyzing ? 'w-2/3 animate-pulse' : 'w-full opacity-20'}`}></div>
                    </div>
                    <span className="text-[8px] font-black text-indigo-500/30 uppercase tracking-[0.4em]">Protocol 2.2.0</span>
                 </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #111; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #222; }
      `}</style>
    </div>
  );
};

export default App;
