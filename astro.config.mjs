import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://dev-blog-v1.vercel.app',
  server: {
    port: 4322,
    host: true,
  },
});
