import { createOpenAI } from '@ai-sdk/openai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export type ModelOverride = {
  provider?: string;
  model?: string;
};

// NVIDIA NIM — OpenAI-compatible endpoint
const nvidia = createOpenAI({
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY || '',
});

export function getDefaultConfig() {
  return {
    provider: (process.env.LLM_PROVIDER || 'codex').toLowerCase(),
    model: process.env.LLM_MODEL || 'z-ai/glm-5.2',
  };
}

export function getModel(override?: ModelOverride) {
  const cfg = getDefaultConfig();
  const provider = (override?.provider || cfg.provider).toLowerCase();
  const modelName = override?.model || cfg.model;

  switch (provider) {
    case 'nvidia':
      return nvidia.chat(modelName || 'z-ai/glm-5.2');
    case 'openai':
      return openai(modelName || 'gpt-4o');
    case 'google':
      return google(modelName || 'gemini-2.0-flash');
    case 'anthropic':
    default:
      return anthropic(modelName || 'claude-sonnet-4-5');
  }
}
