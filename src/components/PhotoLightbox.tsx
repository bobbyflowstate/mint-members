"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen headshot viewer. Uploads are downscaled to 512px on the way in
 * (see PhotoSection), so the image is capped rather than stretched to the
 * viewport — blowing it up past its real size just makes it mushy.
 *
 * Rendered through a portal on purpose: several of the cards this opens from
 * carry `backdrop-blur`, and an element with a backdrop-filter becomes the
 * containing block for its fixed-position descendants. Nested inline, the
 * overlay gets clipped to the card instead of covering the viewport.
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
  const imageRef = useRef<HTMLImageElement>(null);
  // A drag released outside the photo fires its click on the backdrop (their
  // common ancestor), so the press has to have landed outside the photo too —
  // otherwise selecting the caption text would dismiss the viewer.
  const pressedOutside = useRef(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isOutsideImage = (target: EventTarget | null) =>
    !(target instanceof Node) || !imageRef.current?.contains(target);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onMouseDown={(event) => {
        pressedOutside.current = isOutsideImage(event.target);
      }}
      onClick={(event) => {
        if (pressedOutside.current && isOutsideImage(event.target)) onClose();
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
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-h-[70vh] w-auto max-w-[min(32rem,100%)] rounded-2xl object-contain shadow-2xl ring-1 ring-white/20"
        />
        {caption && (
          <figcaption className="text-sm font-medium text-slate-200">{caption}</figcaption>
        )}
      </figure>
    </div>,
    document.body
  );
}
