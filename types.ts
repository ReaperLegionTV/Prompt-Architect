
export enum StepStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface AgentStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  output?: string;
}

export interface AppState {
  media: string | null;
  mediaType: 'image' | 'video' | null;
  originalPrompt: string;
  steps: AgentStep[];
  isAnalyzing: boolean;
  currentStepIndex: number;
}
