"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { InfoNote, ProfileData, SectionCard, useSaveState } from "./shared";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 512;

/**
 * Downscale to a small square-ish JPEG so roster pages stay light. Falls
 * back to the original file when the browser can't decode it (e.g. HEIC
 * outside Safari) — the 5 MB cap still applies either way.
 */
async function downscaleImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export function PhotoSection({
  data,
  complete,
}: {
  data: ProfileData;
  complete: boolean;
}) {
  const generateUploadUrl = useMutation(api.attendeeProfiles.generatePhotoUploadUrl);
  const savePhoto = useMutation(api.attendeeProfiles.savePhoto);
  const { state, error, run, markDirty } = useSaveState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const currentPhotoUrl = previewUrl ?? data.profile.profilePhotoUrl;

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setPreviewUrl((old) => {
      if (old) {
        URL.revokeObjectURL(old);
      }
      return file ? URL.createObjectURL(file) : null;
    });
    markDirty();
  };

  const handleSave = () =>
    run(async () => {
      if (!selectedFile) {
        throw new Error("Choose a photo first");
      }
      if (!selectedFile.type.startsWith("image/")) {
        throw new Error("Please choose an image file");
      }

      const blob = await downscaleImage(selectedFile);
      if (blob.size > MAX_UPLOAD_BYTES) {
        throw new Error("Photo is too large — please choose one under 5 MB");
      }

      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!response.ok) {
        throw new Error("Upload failed — please try again");
      }
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await savePhoto({ storageId });

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });

  return (
    <SectionCard
      title="Profile Photo"
      sub="Shown next to your name on the camp dashboard so campmates can put a face to the name."
      complete={complete}
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <div className="flex items-center gap-5">
        {currentPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are dynamic; next/image needs remotePatterns config
          <img
            src={currentPhotoUrl}
            alt="Your profile photo"
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-white/20"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl ring-2 ring-white/10">
            📷
          </div>
        )}
        <div className="min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20 file:transition-colors"
          />
          <p className="mt-2 text-xs text-slate-500">
            {selectedFile
              ? "Hit Save to upload your new photo."
              : "JPG/PNG/etc. We resize it, so any size under 5 MB works."}
          </p>
        </div>
      </div>
      {!currentPhotoUrl && (
        <InfoNote>
          A face photo helps — costumes and dust goggles make everyone hard to
          recognize out there.
        </InfoNote>
      )}
    </SectionCard>
  );
}
