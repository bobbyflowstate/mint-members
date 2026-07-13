"use client";

import { ProfilesTable } from "@/components/ops/ProfilesTable";

export default function OpsProfilesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendee Profiles</h1>
        <p className="mt-2 text-slate-400">
          Who has finished their profile, what they entered, and a CSV export
          for the teams working with the data.
        </p>
      </div>

      <ProfilesTable />
    </div>
  );
}
