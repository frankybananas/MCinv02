import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Car Inventory Management",
    short_name: "CarInventory",
    description: "Mobile car inventory management application",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      {
        src: "/placeholder-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    categories: ["business", "productivity"],
    lang: "en",
  }
}
