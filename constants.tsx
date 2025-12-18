
import { AgentStep, StepStatus } from './types';

export const INITIAL_STEPS: AgentStep[] = [
  {
    id: 'input',
    name: 'Media Ingest',
    description: 'Analyzing source encoding and extracting visual keyframes.',
    status: StepStatus.IDLE
  },
  {
    id: 'analyst',
    name: 'Subject Specialist',
    description: 'Deconstructing subjects, actions, and environmental persistence.',
    status: StepStatus.IDLE
  },
  {
    id: 'style',
    name: 'Cinematography Node',
    description: 'Analyzing camera movement, focal shifts, and lighting dynamics.',
    status: StepStatus.IDLE
  },
  {
    id: 'technical',
    name: 'Optical Architect',
    description: 'Evaluating textures, motion blur, and technical rendering quality.',
    status: StepStatus.IDLE
  },
  {
    id: 'emotional',
    name: 'Temporal Narrative',
    description: 'Mapping the mood progression and symbolic storytelling arc.',
    status: StepStatus.IDLE
  },
  {
    id: 'research',
    name: 'Style Historian',
    description: 'Cross-referencing cinematic eras and artistic movements.',
    status: StepStatus.IDLE
  },
  {
    id: 'consolidator',
    name: 'Synthesis Nexus',
    description: 'Merging multi-perspective temporal data into a coherent audit.',
    status: StepStatus.IDLE
  },
  {
    id: 'optimizer',
    name: 'Prompt Engineer',
    description: 'Encoding the analysis into hyper-optimized generative syntax.',
    status: StepStatus.IDLE
  }
];

export const SYSTEM_PROMPT = `You are a sophisticated Multi-Agent Prompt Engineering System specialized in both static and temporal visual analysis.
Your goal is to perform a deep visual audit of the provided media (image or video) and construct a prompt that captures its technical, emotional, and stylistic essence.
Use professional terminology suitable for high-end generative models like Midjourney v6, Luma Dream Machine, Sora, or Runway Gen-3.`;
