export type SubTab = { slug: string; label: string; children?: SubTab[] };
export type Section = { slug: string; label: string; icon: string; subtabs: SubTab[] };

export const NAV: Section[] = [
  { slug: "home", label: "Home", icon: "LayoutDashboard", subtabs: [
    { slug: "overview", label: "Overview" },
    { slug: "activity", label: "Activity Feed" },
    { slug: "alerts", label: "Alerts" },
  ]},
  { slug: "calendars", label: "Calendars", icon: "Calendar", subtabs: [
    { slug: "team", label: "Team" },
    { slug: "mine", label: "Mine" },
    { slug: "follow-ups", label: "Follow-ups" },
  ]},
  { slug: "tasks", label: "Tasks", icon: "CheckSquare", subtabs: [
    { slug: "open", label: "Open" },
    { slug: "due-today", label: "Due Today" },
    { slug: "overdue", label: "Overdue" },
    { slug: "completed", label: "Completed" },
  ]},
  { slug: "sales", label: "Sales", icon: "TrendingUp", subtabs: [
    { slug: "dashboard", label: "Dashboard" },
    { slug: "new-leads", label: "New Leads", children: [
      { slug: "all", label: "All" },
      { slug: "hot", label: "Hot" },
    ]},
    { slug: "my-leads", label: "My Leads" },
    { slug: "follow-ups", label: "Follow-ups" },
    { slug: "goals", label: "Sales Goals" },
  ]},
  { slug: "customers", label: "Customers", icon: "Users", subtabs: [
    { slug: "opportunities", label: "Opportunities" },
    { slug: "active-storage", label: "Active Storage" },
    { slug: "all-profiles", label: "All Customer Profiles" },
  ]},
  { slug: "dispatch", label: "Dispatch", icon: "Truck", subtabs: [
    { slug: "resource-calendar", label: "Resource Calendar", children: [
      { slug: "month", label: "Month" },
      { slug: "week", label: "Week" },
    ]},
    { slug: "scheduling", label: "Scheduling" },
    { slug: "customer-confirmation", label: "Customer Confirmation" },
    { slug: "crew-confirmation", label: "Crew Confirmation" },
    { slug: "monitoring", label: "Monitoring" },
    { slug: "trips", label: "Trips" },
  ]},
  { slug: "customer-service", label: "Customer Service", icon: "Headphones", subtabs: [
    { slug: "tickets", label: "Tickets", children: [
      { slug: "active", label: "Active" },
      { slug: "completed", label: "Completed" },
    ]},
    { slug: "ratings", label: "Ratings" },
    { slug: "claims", label: "Claims" },
  ]},
  { slug: "marketing", label: "Marketing", icon: "Megaphone", subtabs: [
    { slug: "overview", label: "Overview" },
    { slug: "reviews", label: "Reviews" },
    { slug: "listings", label: "Listings" },
    { slug: "socials", label: "Socials" },
    { slug: "affiliates", label: "Affiliates" },
    { slug: "leads", label: "Leads" },
    { slug: "scoreboard", label: "Scoreboard" },
  ]},
  { slug: "smart-marketing", label: "Smart Marketing", icon: "Sparkles", subtabs: [
    { slug: "campaigns", label: "Campaigns", children: [
      { slug: "all", label: "All" },
      { slug: "active", label: "Active" },
      { slug: "scheduled", label: "Scheduled" },
      { slug: "archived", label: "Archived" },
    ]},
    { slug: "templates", label: "Templates" },
    { slug: "segments", label: "Segments" },
    { slug: "contacts", label: "Contacts" },
  ]},
  { slug: "storage", label: "Storage", icon: "Box", subtabs: [
    { slug: "dashboard", label: "Dashboard" },
    { slug: "accounts", label: "Accounts" },
    { slug: "containers", label: "Containers" },
    { slug: "aging", label: "Aging" },
    { slug: "invoices", label: "Invoices" },
  ]},
  { slug: "accounting", label: "Accounting", icon: "DollarSign", subtabs: [
    { slug: "jobs", label: "Jobs", children: [
      { slug: "pending-finalize", label: "Pending Finalize" },
      { slug: "pending-close", label: "Pending Close" },
      { slug: "closed", label: "Closed" },
      { slug: "all", label: "All" },
    ]},
    { slug: "payroll", label: "Payroll" },
    { slug: "account-balances", label: "Account Balances" },
  ]},
  { slug: "reports", label: "Reports", icon: "BarChart3", subtabs: [
    { slug: "favorites", label: "Favorites" },
    { slug: "my-insights", label: "My Insights" },
    { slug: "shared", label: "Shared With Me" },
    { slug: "recent", label: "Recent" },
    { slug: "all", label: "All Reports" },
  ]},
  { slug: "settings", label: "Settings", icon: "Settings", subtabs: [
    { slug: "company", label: "Company", children: [
      { slug: "details", label: "Company Details" },
      { slug: "audit", label: "Company Audit Activity" },
      { slug: "branches", label: "Branches" },
      { slug: "branding", label: "Branding" },
      { slug: "distribution-lists", label: "Distribution Lists" },
      { slug: "payment-gateways", label: "Payment Gateways" },
      { slug: "roles-permissions", label: "Roles & Permissions" },
      { slug: "user-management", label: "User Management" },
      { slug: "user-licenses", label: "User Application Licenses" },
      { slug: "social-media", label: "Social Media" },
      { slug: "sms-usage", label: "Text Message Usage" },
      { slug: "sms-campaigns", label: "SMS Campaigns" },
      { slug: "templates", label: "Email / SMS Templates" },
      { slug: "labs", label: "Labs" },
    ]},
    { slug: "estimates", label: "Estimates", children: [
      { slug: "common", label: "Common" },
      { slug: "custom-fields", label: "Custom Information Fields" },
      { slug: "room-sizes", label: "Move & Room Sizes" },
      { slug: "price-ranges", label: "Price Ranges" },
      { slug: "cancellation-reasons", label: "Cancellation Reasons" },
      { slug: "inventory", label: "Inventory" },
      { slug: "parking", label: "Parking Options" },
      { slug: "property-types", label: "Property Types" },
      { slug: "regions", label: "Regions" },
      { slug: "service-types", label: "Service Types" },
      { slug: "tags", label: "Tags" },
    ]},
    { slug: "tariffs", label: "Tariffs", children: [
      { slug: "library", label: "Tariff Library" },
      { slug: "opportunity-types", label: "Opportunity Types" },
      { slug: "valuation-templates", label: "Valuation Templates" },
      { slug: "handicaps", label: "Handicaps" },
    ]},
    { slug: "sales", label: "Sales", children: [
      { slug: "common", label: "Common" },
      { slug: "bad-lead-reasons", label: "Bad Lead Reasons" },
      { slug: "lost-reasons", label: "Lead Lost Reasons" },
      { slug: "providers", label: "Lead Providers" },
      { slug: "statuses", label: "Lead Statuses" },
      { slug: "referral-sources", label: "Referral Sources" },
      { slug: "scripts", label: "Sales Scripts" },
      { slug: "templates", label: "Sales Templates" },
    ]},
    { slug: "customer-portal", label: "Customer Portal", children: [
      { slug: "common", label: "Common" },
      { slug: "online-estimates", label: "Online Estimates" },
    ]},
    { slug: "marketing-settings", label: "Marketing", children: [
      { slug: "auto-reply", label: "Auto-Reply Rules" },
      { slug: "review-bonuses", label: "Crew Review Bonuses" },
      { slug: "accounts", label: "Manage Accounts" },
      { slug: "spend", label: "Marketing Spend" },
      { slug: "review-tickets", label: "Public Review Tickets" },
      { slug: "reply-templates", label: "Reply Templates" },
      { slug: "review-notification", label: "Review Notification" },
      { slug: "review-reminders", label: "Review Reminders" },
      { slug: "review-screening", label: "Review Screening" },
    ]},
    { slug: "smart-marketing-settings", label: "Smart Marketing", children: [
      { slug: "brand", label: "Brand Settings" },
      { slug: "affiliate", label: "Affiliate" },
      { slug: "contacts-sync", label: "Contacts Sync" },
    ]},
    { slug: "forms", label: "Forms & Documents", children: [
      { slug: "library", label: "Document Library" },
      { slug: "embedded-form", label: "Embedded Form" },
      { slug: "javascript-form", label: "JavaScript Form" },
    ]},
    { slug: "dispatch-settings", label: "Dispatch", children: [
      { slug: "common", label: "Common" },
      { slug: "arrival-windows", label: "Arrival Windows" },
      { slug: "fleet", label: "Fleet" },
      { slug: "crew", label: "Crew Members" },
      { slug: "tags", label: "Truck and Crew Tags" },
      { slug: "capacity", label: "Capacity" },
      { slug: "event-templates", label: "Crew Event Templates" },
    ]},
    { slug: "claims-settings", label: "Claims", children: [
      { slug: "general", label: "General Settings" },
      { slug: "statuses", label: "Statuses" },
      { slug: "commodities", label: "Commodities" },
      { slug: "complaint-types", label: "Complaint Types" },
      { slug: "settlement-types", label: "Settlement Types" },
      { slug: "audit", label: "Claims Audit Log" },
    ]},
    { slug: "crew-app", label: "Crew App", children: [
      { slug: "general", label: "General Settings" },
      { slug: "permissions", label: "Crew App Permissions" },
      { slug: "descriptive-inventory", label: "Descriptive Inventory" },
      { slug: "time-deductions", label: "Time Deduction Reasons" },
    ]},
    { slug: "storage-settings", label: "Storage", children: [
      { slug: "common", label: "Common" },
      { slug: "rates", label: "Storage Rates" },
      { slug: "warehouses", label: "Warehouses" },
      { slug: "zones", label: "Zones" },
      { slug: "container-types", label: "Container Types" },
      { slug: "containers", label: "Containers" },
      { slug: "oversized", label: "Oversized Items" },
      { slug: "discounts", label: "Storage Discounts" },
      { slug: "account-import", label: "Account Import" },
    ]},
    { slug: "accounting-settings", label: "Accounting & Profitability", children: [
      { slug: "common", label: "Common" },
      { slug: "cc-fees", label: "Credit Card Fees" },
      { slug: "deduction-reasons", label: "Deduction Reasons" },
      { slug: "deposits", label: "Deposits" },
      { slug: "discounts", label: "Job Discounts" },
      { slug: "payment-types", label: "Payment Types" },
      { slug: "pre-auth", label: "Pre-authorization" },
      { slug: "gp-targets", label: "Gross Profit Targets" },
      { slug: "auto-expense", label: "Automatic Expense Rules" },
      { slug: "manual-expense", label: "Manual Expense Categories" },
      { slug: "estimated-profitability", label: "Estimated Profitability" },
    ]},
    { slug: "integrations", label: "Integrations", children: [
      { slug: "library", label: "Integration Library" },
    ]},
    { slug: "workflow", label: "Workflow Automation", children: [
      { slug: "rules", label: "Automation Rules" },
      { slug: "task-templates", label: "Task Templates" },
    ]},
    { slug: "objects", label: "Custom Objects" },
  ]},
];

export function findSection(slug: string) {
  return NAV.find((s) => s.slug === slug);
}

export function findSubtab(section: Section, slug: string) {
  return section.subtabs.find((s) => s.slug === slug);
}
