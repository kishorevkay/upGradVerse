import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        world: resolve(root, 'index.html'),
        controller: resolve(root, 'controller.html'),
      },
    },
  },
})
