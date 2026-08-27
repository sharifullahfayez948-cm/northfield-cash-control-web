export default function manifest() {
  return {
    name: "Northfield Cash Control",
    short_name: "Northfield",
    description: "Company cash, bank, transfers and daily closing control.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f6f8",
    theme_color: "#08243a",
    icons: [
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  };
}
