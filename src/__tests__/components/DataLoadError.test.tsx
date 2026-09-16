import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataLoadError } from "@/components/ui/DataLoadError";

describe("DataLoadError", () => {
  it("explique l’échec et permet de relancer le chargement au clavier", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();

    render(<DataLoadError detail="HTTP 503" onRetry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les données");
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503");

    await user.tab();
    expect(screen.getByRole("button", { name: "Réessayer" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(retry).toHaveBeenCalledOnce();
  });
});
