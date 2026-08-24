"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen headshot viewer.
 *
 * Uses a native <dialog> opened with showModal(), which renders in the
 * browser's top layer: unaffected by ancestor stacking contexts, z-index,
 * overflow, transforms, or backdrop-filter. That matters because the cards
 * this opens from carry `backdrop-blur`, and an element with a
 * backdrop-filter becomes the containing block for its fixed-position
 * descendants — a plain `fixed inset-0` overlay nested in one gets clipped to
 * the card instead of covering the viewport. It is also portalled to <body>
 * so no ancestor can affect it even if the top layer is unavailable.
 *
 * showModal() additionally makes the rest of the page inert, so a second
 * headshot cannot be clicked while one is open.
 *
 * Uploads are downscaled to 512px on the way in (see PhotoSection), so the
 * image is capped rather than stretched — blowing it up past its real size
 * just makes it mushy.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // A drag released outside the photo fires its click on their common
  // ancestor, so the press has to have landed outside the photo too —
  // otherwise selecting the caption text would dismiss the viewer.
  const pressedOutside = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Test environments without HTMLDialogElement fall back to the plain
    // `open` attribute so the click/Escape behaviour stays exercisable.
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    return () => {
      if (typeof dialog.close === "function") {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    };
  }, []);

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
    <dialog
      ref={dialogRef}
      aria-label={alt}
      // Escape fires `cancel`; own the teardown so React unmounts us.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        pressedOutside.current = isOutsideImage(event.target);
      }}
      onClick={(event) => {
        if (pressedOutside.current && isOutsideImage(event.target)) onClose();
      }}
      // Reset the UA dialog box (margin/border/padding/size caps) so it fills
      // the viewport and the dim layer is ours, not ::backdrop.
      className="fixed inset-0 m-0 h-full max-h-full w-full max-w-full border-0 bg-transparent p-0 backdrop:bg-transparent"
    >
      <div className="flex h-full w-full items-center justify-center bg-slate-950/90 p-6 backdrop-blur-sm">
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
      </div>
    </dialog>,
    document.body
  );
}
