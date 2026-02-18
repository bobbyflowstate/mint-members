"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AllowlistTable } from "@/components/ops/AllowlistTable";
import { parseEmailCSV } from "@/lib/csv/parser";
import clsx from "clsx";

const OPS_PASSWORD_KEY = "ops_password";

export default function AllowlistPage() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });

  const config = useQuery(api.config.getConfig);
  const emails = useQuery(
    api.allowlist.listAllowedEmails,
    opsPassword ? { opsPassword } : "skip"
  );
  const emailCount = useQuery(
    api.allowlist.count,
    opsPassword ? { opsPassword } : "skip"
  );
  const addEmails = useMutation(api.allowlist.addEmails);
  const setConfig = useMutation(api.config.setConfig);

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowlistEnabled = config?.allowlistEnabled === "true";

  const handleToggleAllowlist = async () => {
    if (!opsPassword) return;

    try {
      await setConfig({
        key: "allowlistEnabled",
        value: allowlistEnabled ? "false" : "true",
        opsPassword,
      });
    } catch (error) {
      console.error("Failed to toggle allowlist:", error);
      alert(`Failed to toggle allowlist: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !opsPassword) return;

    setUploading(true);
    setUploadResult(null);

    try {
      // Parse CSV
      const result = await parseEmailCSV(file);

      if (result.valid.length === 0) {
        setUploadResult({
          type: "error",
          message: "No valid emails found in CSV file.",
        });
        setUploading(false);
        return;
      }

      // Upload valid emails
      const uploadResponse = await addEmails({
        emails: result.valid,
        opsPassword,
      });

      // Build result message
      const messages: string[] = [];
      messages.push(`Successfully added ${uploadResponse.added} email(s).`);
      if (uploadResponse.duplicates > 0) {
        messages.push(`Skipped ${uploadResponse.duplicates} duplicate(s).`);
      }
      if (result.invalid.length > 0) {
        messages.push(`Found ${result.invalid.length} invalid email(s).`);
      }

      setUploadResult({
        type: "success",
        message: messages.join(" "),
      });
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadResult({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to upload CSV",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (!config || !opsPassword || emails === undefined || emailCount === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Email Allowlist</h1>
        <p className="mt-2 text-slate-400">
          Control who can submit applications by managing the email allowlist.
        </p>
      </div>

      {/* Toggle Card */}
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Allowlist Enforcement</h2>
            <p className="mt-1 text-sm text-slate-400">
              When enabled, only allowlisted emails can access the signup form.
            </p>
          </div>
          <button
            onClick={handleToggleAllowlist}
            className={clsx(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900",
              allowlistEnabled ? "bg-emerald-500" : "bg-slate-700"
            )}
          >
            <span
              className={clsx(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                allowlistEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
        {allowlistEnabled && (
          <div className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/20">
            <p className="text-sm text-amber-400">
              Allowlist is active. Only emails in the list below can submit applications.
            </p>
          </div>
        )}
      </div>

      {/* Stats Card */}
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <svg
              className="h-6 w-6 text-emerald-400"
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
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{emailCount}</div>
            <div className="text-sm text-slate-400">Allowlisted Email{emailCount !== 1 ? "s" : ""}</div>
          </div>
        </div>
      </div>

      {/* CSV Upload Card */}
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <h2 className="text-lg font-semibold text-white">Upload CSV</h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload a CSV file with an &quot;email&quot; header column to add emails to the allowlist.
        </p>

        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className={clsx(
              "w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              uploading
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-emerald-500 text-white hover:bg-emerald-400"
            )}
          >
            {uploading ? "Uploading..." : "Choose CSV File"}
          </button>
        </div>

        {uploadResult && (
          <div
            className={clsx(
              "mt-4 rounded-lg px-4 py-3 ring-1",
              uploadResult.type === "success"
                ? "bg-emerald-500/10 ring-emerald-500/20"
                : "bg-red-500/10 ring-red-500/20"
            )}
          >
            <p
              className={clsx(
                "text-sm",
                uploadResult.type === "success" ? "text-emerald-400" : "text-red-400"
              )}
            >
              {uploadResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Email List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Allowlisted Emails</h2>
        <AllowlistTable emails={emails} opsPassword={opsPassword} />
      </div>
    </div>
  );
}
