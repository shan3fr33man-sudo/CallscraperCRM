import "../globals.css";

export const metadata = { title: "CRM TopBar", referrer: "no-referrer" as const };

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">{children}</body>
    </html>
  );
}
