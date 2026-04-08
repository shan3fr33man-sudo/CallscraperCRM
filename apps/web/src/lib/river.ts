// River engine: event bus + automation runner. Imported by app routes via @/lib/river.
export { emitEvent } from "./events";
export type { EventType, EmitEventArgs } from "./events";
export { runAutomations } from "./automations";
export type { Action, ActionType } from "./automations";
