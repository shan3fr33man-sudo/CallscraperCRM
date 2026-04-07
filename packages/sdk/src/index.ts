/** Public TS client for the CallscraperCRM REST API. */
export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class CallscraperCRM {
  constructor(private opts: ClientOptions) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
    return r.json() as Promise<T>;
  }

  contacts = {
    list: () => this.req<{ data: unknown[] }>("GET", "/api/v1/contacts"),
    create: (data: unknown) => this.req<{ id: string }>("POST", "/api/v1/contacts", data),
  };
  leads = {
    list: () => this.req<{ data: unknown[] }>("GET", "/api/v1/leads"),
    create: (data: unknown) => this.req<{ id: string }>("POST", "/api/v1/leads", data),
  };
  deals = {
    list: () => this.req<{ data: unknown[] }>("GET", "/api/v1/deals"),
    create: (data: unknown) => this.req<{ id: string }>("POST", "/api/v1/deals", data),
  };
  calls = {
    list: () => this.req<{ data: unknown[] }>("GET", "/api/v1/calls"),
    ingest: (data: unknown) => this.req<{ id: string }>("POST", "/api/v1/calls", data),
  };
}
