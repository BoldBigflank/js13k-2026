import { viteExternalsPlugin } from "vite-plugin-externals";

export default {
  base: "",
  server: {
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "ada3d69471bb.ngrok-free.app",
      "d2f8-205-178-114-243.ngrok-free.app",
      "together-horribly-lamprey.ngrok-free.app",
    ],
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
};
