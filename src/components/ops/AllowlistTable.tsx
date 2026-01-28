"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import clsx from "clsx";

interface AllowlistEntry {
  _id: string;
  email: string;
  addedBy: string;
  addedAt: number;
  notes?: string;
}

interface AllowlistTableProps {
  emails: AllowlistEntry[];
  opsPassword: string;
}

export function AllowlistTable({ emails, opsPassword }: AllowlistTableProps) {
  const removeEmail = useMutation(api.allowlist.removeEmail);
  const removeEmails = useMutation(api.allowlist.removeEmails);

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [processing, setProcessing] = useState(false);

  // Filter emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;

    const query = searchQuery.toLowerCase();
    return emails.filter(
      (entry) =>
        entry.email.toLowerCase().includes(query) ||
        entry.addedBy.toLowerCase().includes(query) ||
        entry.notes?.toLowerCase().includes(query)
    );
  }, [emails, searchQuery]);

  // Check if all filtered emails are selected
  const allSelected = filteredEmails.length > 0 &&
    filteredEmails.every(entry => selectedEmails.has(entry.email));

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all filtered emails
      setSelectedEmails((prev) => {
        const newSet = new Set(prev);
        filteredEmails.forEach((entry) => newSet.delete(entry.email));
        return newSet;
      });
    } else {
      // Select all filtered emails
      setSelectedEmails((prev) => {
        const newSet = new Set(prev);
        filteredEmails.forEach((entry) => newSet.add(entry.email));
        return newSet;
      });
    }
  };

  const handleSelectEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  const handleRemoveSingle = async (email: string) => {
    setProcessing(true);
    try {
      await removeEmail({
        email,
        opsPassword,
      });
      setSelectedEmails((prev) => {
        const newSet = new Set(prev);
        newSet.delete(email);
        return newSet;
      });
    } catch (error) {
      console.error("Failed to remove email:", error);
      alert(`Failed to remove email: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveBulk = async () => {
    if (selectedEmails.size === 0) return;

    const confirmed = confirm(
      `Are you sure you want to remove ${selectedEmails.size} email(s) from the allowlist?`
    );

    if (!confirmed) return;

    setProcessing(true);
    try {
      await removeEmails({
        emails: Array.from(selectedEmails),
        opsPassword,
      });
      setSelectedEmails(new Set());
    } catch (error) {
      console.error("Failed to remove emails:", error);
      alert(`Failed to remove emails: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  };

  if (emails.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
        <svg
          className="mx-auto h-12 w-12 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-white">No Emails Yet</h3>
        <p className="mt-2 text-slate-400">Upload a CSV to add emails to the allowlist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and bulk actions */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search emails, added by, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white/5 border-0 rounded-lg px-4 py-2 text-sm text-white placeholder:text-slate-500 ring-1 ring-white/10 focus:ring-emerald-500"
        />
        {selectedEmails.size > 0 && (
          <button
            onClick={handleRemoveBulk}
            disabled={processing}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              processing
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            )}
          >
            {processing ? "Removing..." : `Remove ${selectedEmails.size} selected`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Added By
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Added At
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredEmails.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                  No emails match your search.
                </td>
              </tr>
            ) : (
              filteredEmails.map((entry) => (
                <tr
                  key={entry._id}
                  className={clsx(
                    "transition-colors",
                    selectedEmails.has(entry.email) ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(entry.email)}
                      onChange={() => handleSelectEmail(entry.email)}
                      className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{entry.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{entry.addedBy}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(entry.addedAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      {entry.notes ? (
                        <p className="text-sm text-slate-300 truncate">{entry.notes}</p>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No notes</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleRemoveSingle(entry.email)}
                      disabled={processing}
                      className={clsx(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                        processing
                          ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                          : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      )}
                    >
                      {processing ? "..." : "Remove"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Results info */}
      <div className="text-sm text-slate-400">
        Showing {filteredEmails.length} of {emails.length} email(s)
        {selectedEmails.size > 0 && ` • ${selectedEmails.size} selected`}
      </div>
    </div>
  );
}
