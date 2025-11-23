import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // Revert to standard root base
  optimizeDeps: { // CRITICAL FIX: Explicitly optimize Firebase packages
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
    ],
  },
});
