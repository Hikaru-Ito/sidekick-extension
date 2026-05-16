import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const demosDirUrl = new URL('../../public/demos', import.meta.url);
const demosDir = fileURLToPath(demosDirUrl);

const demoFiles = existsSync(demosDir)
  ? readdirSync(demosDir).filter((f) => f.endsWith('.webm'))
  : [];

const demoIds = new Set(demoFiles.map((f) => f.replace(/\.webm$/, '')));

export function hasDemo(featureId: string): boolean {
  return demoIds.has(featureId);
}

export function demoUrl(baseUrl: string, featureId: string): string {
  return `${baseUrl}/demos/${featureId}.webm`;
}
