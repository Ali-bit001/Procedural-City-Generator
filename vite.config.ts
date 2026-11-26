import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two pages: the Building Lab (index.html) and the Terrain Lab (terrain.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        terrain: resolve(__dirname, 'terrain.html'),
      },
    },
  },
});
