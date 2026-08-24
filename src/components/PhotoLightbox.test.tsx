import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhotoLightbox } from "./PhotoLightbox";

function renderLightbox(onClose = vi.fn()) {
  // The real call sites (MemberCard, MemberProfileDialog) sit inside elements
  // with `backdrop-blur`, which makes them the containing block for fixed
  // descendants — the overlay has to escape that.
  const { container } = render(
    <div className="backdrop-blur-sm">
      <PhotoLightbox src="/headshot.jpg" alt="Robin's photo" caption="Robin" onClose={onClose} />
    </div>
  );
  return { onClose, container, dialog: screen.getByRole("dialog", { name: "Robin's photo" }) };
}

describe("PhotoLightbox", () => {
  it("renders outside its backdrop-blurred parent so the overlay is not clipped", () => {
    const { container, dialog } = renderLightbox();

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog.parentElement).toBe(document.body);
  });

  it("closes when the click lands outside the photo", () => {
    const { onClose, dialog } = renderLightbox();

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the caption beside the photo is clicked", () => {
    const { onClose } = renderLightbox();

    const caption = screen.getByText("Robin");
    fireEvent.mouseDown(caption);
    fireEvent.click(caption);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when the photo itself is clicked", () => {
    const { onClose } = renderLightbox();

    const photo = screen.getByAltText("Robin's photo");
    fireEvent.mouseDown(photo);
    fireEvent.click(photo);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open when a drag starts on the photo and is released outside it", () => {
    const { onClose, dialog } = renderLightbox();

    fireEvent.mouseDown(screen.getByAltText("Robin's photo"));
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const { onClose } = renderLightbox();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
