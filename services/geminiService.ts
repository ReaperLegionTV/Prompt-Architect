
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMediaPart = async (
  mediaData: string | string[], // Can be single base64 or array of base64 frames
  agentInstructions: string,
  context?: string
): Promise<string> => {
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
    Context from previous nodes: ${context || 'None'}
    
    Specific Agent Role & Instructions:
    ${agentInstructions}
    
    Audit the provided visual data. If multiple frames are provided, analyze the movement, changes, and temporal qualities. Keep your report extremely precise and technically dense.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [...mediaParts, { text: prompt }] },
  });

  return response.text || 'Analysis node timed out.';
};

export const AGENT_PROMPTS: Record<string, string> = {
  analyst: "You are the Subject Specialist. Identify core subjects, their physical traits, and how they interact with the environment. In video, note the continuity of movement.",
  style: "You are the Cinematography Node. Analyze the camera work: static, handheld, dolly, or drone. Define the lighting temperature, shadows, and framing logic.",
  technical: "You are the Optical Architect. Evaluate textures (grain, smoothness), optical properties (bokeh, lens flares), and motion artifacts. Define the visual 'fidelity' level.",
  emotional: "You are the Temporal Narrative Agent. Extract the atmospheric tone. Is it tense, ethereal, gritty, or nostalgic? Describe the 'story' told in the frames.",
  research: "You are the Style Historian. Identify the specific aesthetic: Cyberpunk, French New Wave, Baroque, or Neo-Futurism. Name influential directors or artists if applicable.",
  consolidator: "You are the Synthesis Nexus. Distill all technical and creative reports into a single, high-density paragraph describing the media's DNA.",
  optimizer: "You are the Prompt Engineer. Convert the synthesis into a comma-separated prompt for AI generators. Use weights (e.g., ::1.5) or technical tags where appropriate. Maximize for aesthetic output."
};
