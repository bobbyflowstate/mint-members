"use client";

interface DepartureNoticeProps {
  cutoffDate: string;
  requestedDeparture: string;
}

export function DepartureNotice({ cutoffDate, requestedDeparture }: DepartureNoticeProps) {
  return (
    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-amber-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-amber-400">
            Early Departure Requires Approval
          </h3>
          <div className="mt-2 text-sm text-amber-200/80">
            <p>
              Your requested departure date ({requestedDeparture}) is before our
              standard cutoff date ({cutoffDate}).
            </p>
            <p className="mt-2">
              Early departures require approval from our operations team. After
              submitting your application, you&apos;ll need to wait for approval
              before you can complete payment.
            </p>
            <p className="mt-2 font-medium text-amber-300">
              We&apos;ll contact you via WhatsApp to discuss your request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
