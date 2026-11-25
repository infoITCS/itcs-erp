export const PROJECTS_MODULE = "projects" as const;

export const PROJECT_STATUSES = ["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];
