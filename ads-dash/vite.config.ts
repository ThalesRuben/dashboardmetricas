import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// TanStack Router plugin será ligado na Fase 2 (quando criarmos rotas file-based):
// import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    // TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
  ],
  resolve: {
    // Mantém o alias antigo `@` pra compatibilidade com imports existentes em .jsx.
    // Os novos aliases (@/features, @/shared, @/app) vêm via tsconfigPaths.
    alias: { '@': '/src' },
  },
});
