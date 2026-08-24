"use client";

import { useEffect, useRef } from "react";

/**
 * Full-screen headshot viewer. Uploads are downscaled to 512px on the way in
 * (see PhotoSection), so the image is capped rather than stretched to the
 * viewport — blowing it up past its real size just makes it mushy.
 */
export function PhotoLightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  // See MemberProfileDialog: a drag released on the backdrop fires its click
  // there, so the press has to have started on the backdrop as well.
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
      >
        Close
      </button>
      <figure className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are dynamic; next/image needs remotePatterns config */}
        <img
          src={src}
          alt={alt}
          className="max-h-[70vh] w-auto max-w-[min(32rem,100%)] rounded-2xl object-contain shadow-2xl ring-1 ring-white/20"
        />
        {caption && (
          <figcaption className="text-sm font-medium text-slate-200">{caption}</figcaption>
        )}
      </figure>
    </div>
  );
}
