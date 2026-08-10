import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Baut alles (JS, CSS) in eine einzige HTML-Datei ein.
// Ziel: Doppelklick-Öffnen im Browser, keine externen Requests, kein Server nötig.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
})

