import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ontology-viewer/',
  optimizeDeps: {
    include: ['n3', 'cytoscape'],
  },
})
