import { defineConfig } from "vitepress";

export default defineConfig({
  title: "EIP-8141 Research",
  description:
    "Comprehensive analysis of EIP-8141 (Frame Transaction) — origin, evolution, and current state",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      {
        text: "Research",
        items: [
          { text: "Current Spec", link: "/01-current-spec" },
          { text: "Feedback Evolution", link: "/02-feedback-evolution" },
          { text: "Original Spec", link: "/03-original-spec" },
          { text: "Merged Changes", link: "/04-merged-changes" },
          { text: "Original vs Latest", link: "/05-original-vs-latest" },
        ],
      },
      {
        text: "Competing Standards",
        items: [
          {
            text: "Overview",
            link: "/06-competing-standards",
          },
          {
            text: "EIP-8130 — Account Configuration",
            link: "/06-competing-standards#eip-8130-account-abstraction-by-account-configuration",
          },
          {
            text: "EIP-8202 — Schemed Transactions",
            link: "/06-competing-standards#eip-8202-scheme-agile-transactions-schemed-transactions",
          },
          {
            text: "EIP-XXXX — Tempo-like Transactions",
            link: "/06-competing-standards#eip-xxxx-tempo-like-transactions",
          },
        ],
      },
      { text: "Appendix", link: "/07-appendix" },
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
