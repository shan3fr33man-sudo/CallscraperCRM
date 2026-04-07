import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        panel: "#111113",
        border: "#1f1f23",
        muted: "#7a7a85",
        text: "#e7e7ea",
        accent: "#7c5cff",
      },
    },
  },
  plugins: [],
} satisfies Config;
