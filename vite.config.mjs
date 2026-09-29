import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Builds src/elements/main.js into dist/assets/elements.js.
// Runs after generate.js, which owns the rest of dist/.
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
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
