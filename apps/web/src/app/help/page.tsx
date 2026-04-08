import { TopBar } from "@/components/TopBar";

export default function HelpPage() {
  return (
    <div>
      <TopBar title="Help & Support" />
      <div className="p-6 max-w-2xl">
        <h1 className="text-lg font-semibold mb-2">Help & Support</h1>
        <p className="text-sm text-muted-foreground mb-4">CallscraperCRM is open source. File issues or feature requests on GitHub.</p>
        <a className="text-accent text-sm underline" href="https://github.com/shan3fr33man-sudo/CallscraperCRM/issues" target="_blank" rel="noreferrer">github.com/shan3fr33man-sudo/CallscraperCRM/issues</a>
      </div>
    </div>
  );
}
