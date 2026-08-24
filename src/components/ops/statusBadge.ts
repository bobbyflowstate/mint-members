/** Application-status pill styling, shared by the members table and the profile view. */
export function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" };
    case "pending_payment":
      return { label: "Pending", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" };
    case "needs_ops_review":
      return { label: "Needs Review", cls: "bg-orange-500/15 text-orange-300 ring-orange-400/30" };
    case "rejected":
      return { label: "Rejected", cls: "bg-red-500/15 text-red-300 ring-red-400/30" };
    case "invited":
      return { label: "Invited", cls: "bg-violet-500/15 text-violet-300 ring-violet-400/30" };
    default:
      return { label: status, cls: "bg-slate-500/10 text-slate-300 ring-slate-400/30" };
  }
}
