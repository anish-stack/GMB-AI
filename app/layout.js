import "./globals.css";

export const metadata = {
  title: "GMB AI Manager",
  description:
    "AI-assisted Google Business Profile post management for SEO teams",
};

const NO_FLASH_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (dark) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>

      <body>{children}</body>
    </html>
  );
}