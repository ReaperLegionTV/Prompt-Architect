
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMediaPart = async (
  mediaData: string | string[],
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
    --- SYSTEM ARCHITECTURE CONTEXT ---
    Current Workflow Context: ${context || 'Initial Phase'}
    
    --- INDIVIDUAL AGENT DEPLOYMENT ---
    ${agentInstructions}
    
    --- OPERATIONAL GUIDELINES ---
    1. For Video: Analyze frames as a sequence. Focus on TRANSIENT PHYSICS (how shadows move, how light reflects off moving surfaces).
    2. SORA 2 RECREATION: If this is video, prioritize "Motion Persistence". Ensure subjects don't morph.
    3. Use technical vocabulary: (e.g., 'Subsurface scattering', 'Global illumination', 'Motion vectors', 'Anamorphic flare').
    4. Keep your output dense and analytical.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [...mediaParts, { text: prompt }] },
  });

  return response.text || 'Node silent.';
};

export const AGENT_PROMPTS: Record<string, string> = {
  analyst: `
ROLE: SUBJECT ONTOLOGIST (ENTITY DECONSTRUCTION)
TASK: 
- Identify every distinct entity. For Sora 2, define the "collision physics" of subjects.
- Describe subject interaction: How do feet touch the ground? How do hands grip objects?
- Note surface materials: Reflective index, tactile roughness, organic vs synthetic.
- Temporal: Note how subjects maintain their identity across frames.
  `,

  style: `
ROLE: DIRECTOR OF PHOTOGRAPHY (LIGHT & OPTICS)
TASK:
- LIGHTING: Specify light source Kelvin. Describe light decay (Inverse Square Law) and volumetrics (god rays, haze).
- CAMERA: Exact lens specs (e.g., "Cooke S4/i 35mm Prime"). Note camera vibration frequency if handheld.
- SORA 2 LOGIC: Describe the camera's path in 3D space (Dolly in, Crane down, Pan left 45 degrees).
  `,

  technical: `
ROLE: VIRTUAL CINEMATOGRAPHER (RENDER SCIENCE)
TASK:
- TEXTURES: Identify PBR (Physically Based Rendering) values. Roughness, Metallic, Ambient Occlusion.
- MOTION BLUR: Calculate shutter angle (e.g., 180-degree shutter). Describe the trail of moving objects.
- SIMULATION: Describe fluid dynamics, smoke density, and particle systems (sparks, dust motes).
  `,

  emotional: `
ROLE: PSYCHOLOGICAL ATMOSPHERE AGENT
TASK:
- COLOR: Define the color grading (e.g., "Teal and Orange", "Bleach Bypass", "Kodachrome 64").
- NARRATIVE BEAT: Define the cinematic tension. Is it a "Moment of Wonder" or "High-Stakes Pursuit"?
- PACING: Describe the frames-per-second feel. Slow motion (120fps) or jittery (8fps stop motion).
  `,

  research: `
ROLE: AESTHETIC HISTORIAN
TASK:
- REFERENCES: Cite specific films or artists (e.g., "Blade Runner 2049 aesthetic", "Rembrandt lighting", "Ghibli-style clouds").
- GENRE: Define the specific sub-genre (Neo-Noir, Solarpunk, Retro-futurism).
- ERA: Identify the film stock look (e.g., "Technicolor Process 4", "Fujifilm Superia").
  `,

  consolidator: `
ROLE: SYNTHESIS NEXUS (DATA AGGREGATOR)
TASK:
- Integrate all node data. Extract the "Core Visual DNA".
- Resolve inconsistencies into a single technical report.
- Focus on the "Motion Signature" for video or "Textural Fidelity" for images.
  `,

  optimizer: `
ROLE: GENERATIVE COMPILER (SORA 2 & MJ SPECIALIST)
TASK:
- Compile the final generation string. 
- FOR SORA 2: Use "Temporal Directives". Start with the camera movement, then the subject action, then the environment.
- Format: [Action/Subject] + [Environment/Lighting] + [Camera/Optics] + [Render/Style tags].
- Suffixes: Append "high resolution, physics-accurate simulation, cinematic consistency, professional color grade".
- IMPORTANT: Use comma-separated phrases. No conversational text.
  `
};
