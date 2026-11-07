import { openai } from './openai';
import { gemini } from './gemini';
import { replicate } from './replicate';
import type { ImageProvider } from './types';

/** Register additional image providers here. */
export const IMAGE_PROVIDERS: ImageProvider[] = [openai, gemini, replicate];

export const enabledProviders = () => IMAGE_PROVIDERS.filter((p) => p.enabled());
export const findProvider = (id: string) => enabledProviders().find((p) => p.id === id);
