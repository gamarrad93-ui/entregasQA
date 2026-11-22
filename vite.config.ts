/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' hace que la app funcione en cualquier subcarpeta de GitHub Pages
// (aunque se le cambie el nombre al repositorio).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
