import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// `vite preview` (used by the browser tests) sends the same site-wide
// headers Vercel does, including the Content Security Policy, so the tests
// see the policy the real site ships. Source: the "/(.*)" rule in vercel.json.
const siteHeaders = Object.fromEntries(
  (JSON.parse(readFileSync('vercel.json', 'utf8')).headers.find(r => r.source === '/(.*)')?.headers || [])
    .map(h => [h.key, h.value]),
);

// Builds src/elements/main.js into dist/assets/elements.js.
// Runs after generate.js, which owns the rest of dist/.
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  preview: {
    headers: siteHeaders,
  },
  build: {
    outDir: 'dist/assets',
    // Only empties dist/assets, never the pages generate.js wrote.
    emptyOutDir: true,
    rolldownOptions: {
      input: 'src/elements/main.js',
      output: {
        // Fixed name (no hash): Vercel revalidates files without cache rules.
        entryFileNames: 'elements.js',
      },
    },
  },
});
