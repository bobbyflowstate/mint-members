"use client";

import { SignupsTable } from "@/components/ops";

export default function SignupsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Sign Ups</h1>
        <p className="mt-2 text-slate-400">
          All member signups with contact and attendance information.
        </p>
      </div>

      <SignupsTable />
    </div>
  );
}
