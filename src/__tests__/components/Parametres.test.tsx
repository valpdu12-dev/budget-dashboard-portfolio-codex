import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Parametres from "@/pages/Parametres";
import { useDataStore } from "@/stores/useDataStore";
import { restoreImport } from "@/services/importPersistence";
import { importDataset } from "../helpers/importFixture";

beforeEach(() => {
  localStorage.clear(); useDataStore.getState().reset();
  useDataStore.getState().setImportedDataset(importDataset(false, false), "budget.xlsx", "2026-09-15T12:00:00Z");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Écran de paramètres", () => {
  it("enregistre les noms et la quote-part sans requête réseau", async () => {
    const user = userEvent.setup(); render(<Parametres />);
    const name = screen.getByLabelText("Nom du compte 1"); await user.clear(name); await user.type(name, "Compte commun");
    const share = screen.getByLabelText("Ma quote-part du compte 1 (%)"); await user.clear(share); await user.type(share, "50");
    await user.selectOptions(screen.getByLabelText("Montants affichés"), "personal");
    await user.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    await screen.findByText("Paramètres enregistrés dans ce navigateur.");
    expect(useDataStore.getState().config?.accounts![0]).toMatchObject({ id: "account-001", label: "Compte commun", share: 50 });
    expect(restoreImport().data?.config.perspective).toBe("personal"); expect(fetch).not.toHaveBeenCalled();
  });
  it("une valeur numérique vide n'est pas enregistrée comme zéro", async () => {
    const before = useDataStore.getState().config;
    const user = userEvent.setup(); render(<Parametres />);
    await user.clear(screen.getByLabelText("Solde initial du compte 1 (€)"));
    await user.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    await screen.findByRole("alert"); expect(useDataStore.getState().config).toBe(before);
  });
  it("signale une mémorisation impossible tout en appliquant les réglages", async () => {
    const user = userEvent.setup(); render(<Parametres />);
    const name = screen.getByLabelText("Nom du compte 1"); await user.clear(name); await user.type(name, "Nouveau nom");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    await user.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
    await waitFor(() => expect(useDataStore.getState().config?.accounts![0].label).toBe("Nouveau nom"));
    expect(useDataStore.getState().storageNotice).toContain("cette session");
  });
});
