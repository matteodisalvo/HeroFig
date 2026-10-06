import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Equivalente Node del glob Vite, usato dalle anteprime e dai controlli. */
export async function readGeneratedAssetSources(): Promise<Record<string, string>> {
  const root = fileURLToPath(new URL('../src/assets/generated/', import.meta.url));
  const sources: Record<string, string> = {};
  for (const category of ['medical', 'bio', 'signals', 'icons']) {
    const directory = path.join(root, category);
    const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const name of files.filter((file) => /\.(png|jpg)$/.test(file)).sort()) {
      const id = name.slice(0, -4);
      if (id in sources) throw new Error(`Id asset duplicato: ${id}`);
      const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      sources[id] = `data:${mime};base64,${(await readFile(path.join(directory, name))).toString('base64')}`;
    }
  }
  return sources;
}
