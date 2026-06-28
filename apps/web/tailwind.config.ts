import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        steel: "#3f4a5a",
        mint: "#2f8f83",
        amber: "#d18b24",
        cloud: "#f6f7f9"
      }
    }
  },
  plugins: []
} satisfies Config;
