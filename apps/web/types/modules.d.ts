declare module '@surface-studio/studio' {
  export interface StorageAdapter {
    name: string;
    list(kind: string): Promise<any[]>;
    put(kind: string, item: any): Promise<any>;
    remove(kind: string, id: string): Promise<void>;
  }
  export interface Exporter { save(f: { blob: Blob; filename: string; mime: string }): Promise<string>; }
  export interface SceneProvider {
    id: string; name: string; kind: 'procedural' | 'image';
    generate(req: { prompt: string; width: number; height: number; current?: string }): Promise<any>;
  }
  export function createStudio(root: HTMLElement, opts?: { storage?: StorageAdapter; exporter?: Exporter; providers?: SceneProvider[] }): Promise<any>;
  export function apiAdapter(base?: string): StorageAdapter;
  export function localStorageAdapter(prefix?: string): StorageAdapter;
  export function anchorExporter(): Exporter;
}
declare module '@surface-studio/engine' {
  export function interpretPrompt(prompt: string, opts?: { fallbackSurface?: string }): any;
  export function imagePromptFor(description: string): string;
  export function getProvider(id: string): any;
  export function googleFontsUrls(batch?: number): string[];
  export const SURFACES: any[];
  export const TREATMENTS: any[];
}
