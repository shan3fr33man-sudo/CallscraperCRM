export const QUICK_ACTIONS: Record<string, string[]> = {
  "sales.command-center": [
    "Show me today's hottest leads",
    "Which leads haven't been contacted in 48 hours?",
    "Create a follow-up task for the most recent hot lead",
    "What's our win rate this month?",
  ],
  "sales.new-leads": [
    "Which of these leads is most likely to book?",
    "Create tasks for all leads without a follow-up",
    "Summarize the pipeline for this week",
  ],
  "customers.detail": [
    "What did this customer call about?",
    "Draft an estimate based on their call history",
    "Create a follow-up task for tomorrow",
    "Send them a booking confirmation template",
  ],
  "dispatch.command-center": [
    "Which jobs today are missing a crew member?",
    "List all unconfirmed customer jobs for tomorrow",
    "Create crew confirmation tasks for today's jobs",
  ],
  "customer-service.tickets": [
    "Summarize all open high-priority tickets",
    "Which tickets are past their follow-up date?",
    "Create a task to follow up on the oldest open ticket",
  ],
};
