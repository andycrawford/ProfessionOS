import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Profession OS",
    short_name: "ProfOS",
    description:
      "Professional dashboard for monitoring services, mailboxes, calendars, and alerts with an agentic AI assistant.",
    start_url: "/",
    display: "standalone",
    background_color: "#161A1F",
    theme_color: "#161A1F",
    icons: [
      {
        src: "/brand/logo-icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/brand/logo-icon-96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/logo-icon-96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
