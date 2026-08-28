import "./globals.css";

export const metadata = {
  title: "GMB AI Manager",
  description: "AI-assisted Google Business Profile post management for SEO teams",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
