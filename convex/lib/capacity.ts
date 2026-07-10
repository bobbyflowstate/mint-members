export function countsTowardCapacity(application: {
  status: string;
  cancelled?: boolean;
}) {
  return application.status === "confirmed" && !application.cancelled;
}
