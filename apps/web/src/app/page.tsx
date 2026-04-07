export default function Home() {
  return (
    <main style={{ padding: 48, maxWidth: 720 }}>
      <h1>CallscraperCRM</h1>
      <p>Open-source, AI-native CRM. v0.0.1 scaffold.</p>
      <ul>
        <li><a href="/leads">Leads</a></li>
        <li><a href="/pipeline">Pipeline</a></li>
        <li><a href="/settings/integrations">Integrations</a></li>
      </ul>
    </main>
  );
}
