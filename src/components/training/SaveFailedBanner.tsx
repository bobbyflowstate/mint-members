/**
 * Shown when a background progress save has failed.
 *
 * Progress saves are fire-and-forget, so without this a backend mismatch is
 * invisible until the member holds to sign at the very end — which is exactly
 * how the Aug 2026 General outage stayed hidden for a full module's worth of
 * work. Surfacing it on the first failed save makes the next one obvious.
 */
export function SaveFailedBanner() {
  return (
    <div
      role="alert"
      className="mx-4 mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100"
    >
      <strong className="block font-semibold text-amber-200">
        We&apos;re not saving your progress right now.
      </strong>
      Check your connection. If this doesn&apos;t clear up, stop here and tell Ops — carrying
      on won&apos;t record anything, and you&apos;d have to start over.
    </div>
  );
}
