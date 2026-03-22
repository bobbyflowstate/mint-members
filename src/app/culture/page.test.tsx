import { render, screen } from "@testing-library/react";
import CulturePage from "./page";

describe("CulturePage", () => {
  it("renders the culture commitments content with clear section navigation", () => {
    render(<CulturePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /dementha culture & commitments/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /dementha camp expectations/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /sponsorship at dementha/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /return to home/i }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: /apply to join camp/i }),
    ).toHaveAttribute("href", "/apply");
  });
});
