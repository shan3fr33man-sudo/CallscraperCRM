"use client";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { NewButton } from "@/components/NewButton";
import { EmptyState } from "@/components/ui";

/**
 * /customers/all-profiles — full customer directory.
 *
 * Loads up to 200 records via the existing GET /api/customers endpoint and
 * lets the user narrow them client-side via search + status chips. The
 * search box uses EntityTable's built-in `search` filter, which does
 * case-insensitive substring match across the column you key it to.
 *
 * Ordering: most-recently-created first via the API's default ordering
 * (`created_at desc`). For 6k+ row workspaces this page is the highest-
 * traffic customer surface in the app, so the search bar is the
 * difference between "useful" and "scroll forever."
 *
 * v1.1 limit: 200 rows ceiling matches the API's hard cap. Server-side
 * search (PostgreSQL ilike) is in place if `q=` is sent — extending the
 * client to send `q=` per keystroke is a small follow-up; today's
 * client-side filter is sufficient when the dataset fits in the page
 * payload.
 */
export default function AllProfilesPage() {
  const router = useRouter();
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/customers");
    const j = await r.json();
    return j.customers ?? [];
  }
  return (
    <div>
      <TopBar title="All Customer Profiles" />
      <div className="p-5">
        <EntityTable
          query={load}
          onRowClick={(r) => router.push(`/customers/${r.id}`)}
          columns={[
            { key: "customer_name", label: "Name" },
            { key: "customer_phone", label: "Phone" },
            { key: "customer_email", label: "Email" },
            { key: "brand", label: "Brand" },
            { key: "source", label: "Source" },
            { key: "status", label: "Status" },
            {
              key: "created_at",
              label: "Created",
              render: (r) =>
                r.created_at ? new Date(r.created_at as string).toLocaleDateString() : "—",
            },
          ]}
          filters={[
            { key: "customer_name", label: "Search by name", type: "search" },
            { key: "customer_phone", label: "Phone", type: "search" },
            {
              key: "status",
              label: "Status",
              type: "chip",
              options: [
                { value: "new", label: "New" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ],
            },
            {
              key: "brand",
              label: "Brand",
              type: "select",
              options: [
                { value: "APM", label: "APM" },
                { value: "AFM", label: "AFM" },
                { value: "crewready", label: "CrewReady" },
                { value: "apex", label: "Apex" },
                { value: "other", label: "Other" },
              ],
            },
          ]}
          actions={<NewButton kind="customer" label="New Customer" />}
          empty={
            <EmptyState
              icon={<Users className="w-8 h-8 opacity-60" aria-hidden="true" />}
              title="No customer profiles yet"
              description="Customers populate from inbound callscraper.com calls and from manual entry. Click New Customer to add one for a walk-in or referral."
              action={<NewButton kind="customer" label="New Customer" />}
            />
          }
        />
      </div>
    </div>
  );
}
