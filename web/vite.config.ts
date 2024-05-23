import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { resolve } from 'path'

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
})
