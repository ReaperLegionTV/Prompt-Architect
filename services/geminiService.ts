
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Enhanced exponential backoff for 429 errors with UI callback
 */
const withRetry = async <T>(
  fn: () => Promise<T>, 
  onRetry?: (attempt: number, delay: number) => void,
  retries = 3, 
  delay = 2000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = error?.message || "";
    const isRateLimit = errorStr.includes('429') || error?.status === 429;
    
    if (isRateLimit && retries > 0) {
      if (onRetry) onRetry(retries, delay);
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, onRetry, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Analyzes media using specific agent instructions.
 * Orchestrates between Gemini 3 Flash (for high-speed vision) and Gemini 3 Pro (for architectural synthesis).
 */
export const analyzeMediaPart = async (
  mediaData: string | string[],
  agentInstructions: string,
  onRetry?: (attempt: number, delay: number) => void,
  context?: string,
  useProModel: boolean = false
): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    
    const mediaParts = Array.isArray(mediaData) 
      ? mediaData.map(data => ({
          inlineData: {
            mimeType: 'image/jpeg',
            data: data.split(',')[1] || data,
          },
        }))
      : [{
          inlineData: {
            mimeType: 'image/jpeg',
            data: mediaData.split(',')[1] || mediaData,
          },
        }];
    
    const prompt = `
      --- NEURAL ARCHITECT PROTOCOL ---
      Directive: ${context || 'Analyze visual material.'}
      
      --- AGENT ASSIGNMENT ---
      ${agentInstructions}
      
      --- OPERATIONAL CONSTRAINTS ---
      1. Use dense, technical terminology only.
      2. Analyze physics, optics, lighting, and material science.
      3. For video frames: Prioritize temporal shifts and motion persistence.
      4. Avoid conversational filler. Output the raw architectural data.
    `;

    // Strategy: Flash for most tasks (higher quota), Pro for reasoning tasks (lower quota)
    const modelName = useProModel ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [...mediaParts, { text: prompt }] },
    });

    return response.text || 'NODE_SILENT';
  }, onRetry);
};

export const AGENT_PROMPTS: Record<string, string> = {
  analyst: `
ROLE: SUBJECT ONTOLOGIST (VISION PHASE)
TASK: Identify all distinct entities. Define collision physics, weight, and surface interaction. 
Note material types: PBR textures, organic matter, or synthetic composites.
  `,
  style: `
ROLE: CINEMATOGRAPHY NODE (VISION PHASE)
TASK: Specify light temperature (Kelvin), light decay curves, and camera lens optics. 
Identify lens flare types (anamorphic/spherical) and depth-of-field metrics.
  `,
  technical: `
ROLE: RENDER SCIENTIST (VISION PHASE)
TASK: Extract PBR data: Albedo, Roughness, Metallic. Identify simulation components: 
Fluid dynamics, smoke density, and motion vector trails.
  `,
  emotional: `
ROLE: ATMOSPHERIC AGENT (VISION PHASE)
TASK: Map the color grading profile (e.g., Bleach Bypass, Technicolor). 
Define the narrative tension beats and symbolic storytelling frequency.
  `,
  research: `
ROLE: STYLE HISTORIAN (VISION PHASE)
TASK: Cite specific artistic movements, historical lighting techniques (Chiaroscuro), 
and film director references (e.g., Villeneuve, Tarkovsky, Kubrick).
  `,
  consolidator: `
ROLE: SYNTHESIS CORE (REASONING PHASE - PRO)
TASK: Integrate all node data into a unified, high-fidelity architectural report. 
Resolve contradictions and define the "Visual DNA" of the asset.
  `,
  optimizer: `
ROLE: GENERATIVE COMPILER (REASONING PHASE - PRO)
TASK: Encode the synthesis into a hyper-optimized prompt string.
FORMAT: [Physics] + [Optics] + [Narrative/Style] + [Render Tags].
USE: Comma-separated technical descriptors. No conversation.
  `
};
