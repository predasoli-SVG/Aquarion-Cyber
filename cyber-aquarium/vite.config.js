import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { three: ['three'], motion: ['gsap', 'gsap/ScrollTrigger', 'lenis'] } }
    }
  }
});
