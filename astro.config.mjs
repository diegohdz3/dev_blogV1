import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog.diegocortes.dev',
  server: {
    port: 4322,
    host: true,
  },
});
