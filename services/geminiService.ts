
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Exponential backoff for 429 errors
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429;
    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const analyzeMediaPart = async (
  mediaData: string | string[],
  agentInstructions: string,
  context?: string,
  useProModel: boolean = false
): Promise<string> => {
  return withRetry(async () => {
    // Create instance right before API call as per guidelines
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
      
      --- CONSTRAINTS ---
      1. Technical terminology only.
      2. Analyze physics, optics, and material science.
      3. For video frames: Note temporal shifts and motion persistence.
      4. Output must be dense, professional, and devoid of fluff.
    `;

    // Pro model for complex reasoning tasks, Flash for high-speed analysis
    const model = useProModel ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: [...mediaParts, { text: prompt }] },
    });

    // Use .text property directly as per guidelines
    return response.text || 'Node silent.';
  });
};

export const AGENT_PROMPTS: Record<string, string> = {
  analyst: `
ROLE: SUBJECT ONTOLOGIST
TASK: Deconstruct every physical entity. Define collision physics, weight, and surface interaction.
  `,
  style: `
ROLE: LIGHTING & OPTICS NODE
TASK: Define light temperature (Kelvin), decay rates, and camera lens specifications (e.g. Anamorphic 40mm).
  `,
  technical: `
ROLE: RENDER SCIENTIST
TASK: Extract PBR values: Albedo, Roughness, Metalness. Identify particle systems and fluid dynamics.
  `,
  emotional: `
ROLE: ATMOSPHERIC AGENT
TASK: Map color grading profiles and cinematic tension beats. Define the narrative frequency.
  `,
  research: `
ROLE: STYLE HISTORIAN
TASK: Identify cinematic references, artistic movements, and historical lighting techniques.
  `,
  consolidator: `
ROLE: SYNTHESIS CORE (PRO LEVEL)
TASK: Merge all previous agent telemetry into a unified architectural report. Resolve all contradictions.
  `,
  optimizer: `
ROLE: GENERATIVE COMPILER (PRO LEVEL)
TASK: Encode the synthesis into a high-density generation string for Midjourney/Sora. 
FORMAT: [Physics] + [Optics] + [Render Tags]. Use comma-separated technical phrases.
  `
};
