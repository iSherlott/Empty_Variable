import swc from "unplugin-swc";
import { defineConfig, type UserConfig } from "vitest/config";

// O unplugin-swc é tipado contra o vite da raiz (6, trazido pelo Angular), e o vitest 2 usa o vite 5.
// A diferença é só de tipos; em tempo de execução o plugin é compatível.
type PluginsVitest = NonNullable<UserConfig["plugins"]>;

// SWC preserva os metadados de decorators que o NestJS usa para injeção de dependência.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: false,
    globalSetup: ["test/suporte/global-setup.ts"],
    // Os arquivos compartilham o mesmo banco: rodam um de cada vez.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
  plugins: [swc.vite({ module: { type: "es6" } })] as unknown as PluginsVitest,
});
