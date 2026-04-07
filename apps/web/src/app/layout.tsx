import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata = { title: "CallscraperCRM", description: "AI-native open-source CRM" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
