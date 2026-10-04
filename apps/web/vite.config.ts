import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// In development this app is served by the API server through Vite's middleware mode
// (`pnpm dev` at the repo root), so the API, Socket.IO and the UI share http://localhost:3000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/` = src/, the import alias the shadcn components use.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
