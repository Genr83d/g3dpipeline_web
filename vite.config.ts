import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazily loaded `pdf` chunk (react-pdf and its layout engine, ~1.2 MB,
    // ~440 kB gzip) is the only chunk over the default limit, and it never
    // loads until someone downloads a report.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('@firebase') || id.includes('firebase/')) {
            return 'firebase-core';
          }
          // The report PDF engine is large and only needed on demand; keep it
          // out of every other chunk so it loads when a report is generated.
          if (
            id.includes('@react-pdf') ||
            id.includes('pdfkit') ||
            id.includes('fontkit') ||
            id.includes('yoga-layout') ||
            id.includes('restructure') ||
            id.includes('linebreak') ||
            id.includes('unicode-properties') ||
            id.includes('hyphen')
          ) {
            return 'pdf';
          }
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'motion';
          }
          if (id.includes('react-router-dom') || id.includes('@remix-run/router')) {
            return 'router';
          }
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react';
          }
          return 'vendor';
        },
      },
    },
  },
});
