import { defineConfig } from "vitepress";

export default defineConfig({
  title: "EIP-8141 Proposal",
  description:
    "Comprehensive analysis of EIP-8141 (Frame Transaction) - origin, evolution, and current state",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      {
        text: "Spec",
        items: [
          { text: "Current Spec", link: "/current-spec" },
          { text: "Feedback Evolution", link: "/feedback-evolution" },
          { text: "Original Spec", link: "/original-spec" },
          { text: "Merged Changes", link: "/merged-changes" },
          { text: "Original vs Latest", link: "/original-vs-latest" },
        ],
      },
      {
        text: "Topics",
        items: [
          { text: "Competing Standards", link: "/competing-standards" },
          { text: "Pending Concerns", link: "/pending-concerns" },
          { text: "Mempool Strategy", link: "/mempool-strategy" },
          { text: "Developer Tooling", link: "/developer-tooling" },
        ],
      },

      { text: "FAQ", link: "/faq" },
      { text: "Demo", link: "https://demo.eip-8141.ethrex.xyz/" },
    ],
    sidebar: [
      {
        text: "Spec",
        items: [
          { text: "Current Spec", link: "/current-spec" },
          { text: "Feedback Evolution", link: "/feedback-evolution" },
          { text: "Original Spec", link: "/original-spec" },
          { text: "Merged Changes", link: "/merged-changes" },
          { text: "Original vs Latest", link: "/original-vs-latest" },
        ],
      },
      {
        text: "Topics",
        items: [
          { text: "Competing Standards", link: "/competing-standards" },
          { text: "Pending Concerns", link: "/pending-concerns" },
          { text: "Mempool Strategy", link: "/mempool-strategy" },
          { text: "Developer Tooling", link: "/developer-tooling" },
        ],
      },
      {
        text: "Resources",
        items: [
          { text: "FAQ", link: "/faq" },
          { text: "Appendix", link: "/appendix" },
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
