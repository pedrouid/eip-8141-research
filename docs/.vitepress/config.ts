import { defineConfig } from "vitepress";

export default defineConfig({
  title: "EIP-8141 Research",
  description:
    "Comprehensive analysis of EIP-8141 (Frame Transaction) — origin, evolution, and current state",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Current Spec", link: "/01-current-spec" },
      { text: "Competing Standards", link: "/06-competing-standards" },
    ],
    sidebar: [
      {
        text: "Research",
        items: [
          { text: "Current Spec", link: "/01-current-spec" },
          { text: "Feedback Evolution", link: "/02-feedback-evolution" },
          { text: "Original Spec", link: "/03-original-spec" },
          { text: "Merged Changes", link: "/04-merged-changes" },
          { text: "Original vs Latest", link: "/05-original-vs-latest" },
          { text: "Competing Standards", link: "/06-competing-standards" },
          { text: "Appendix", link: "/07-appendix" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/pedrouid/eip-8141-research",
      },
    ],
  },
});
