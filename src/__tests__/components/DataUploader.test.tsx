import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { DataUploader } from "@/components/upload/DataUploader";
import { useUIStore } from "@/stores/useUIStore";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { parseWorkbook } from "@/services/workbookImport";
import { saveImport } from "@/services/importPersistence";
import { importDataset, importWorkbook } from "../helpers/importFixture";

class ReaderWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror = null;
  terminate = vi.fn();
  postMessage({ buffer }: { buffer: ArrayBuffer }) {
    const result = parseWorkbook(XLSX.read(buffer, { type: "array", cellDates: false, cellFormula: true }));
    this.onmessage?.({ data: { type: "result", ...result } } as MessageEvent);
  }
}
const demoSalary = { months: [], cotLast: [], patronLast: [] };
const demoConfig = { init: { "Compte démo": 100 }, comptes: ["Compte démo"], coverage: { dateMin: "2025-01-01", dateMax: "2025-01-31" } };
const demoBudgets = { budgets: [{ cat2: "Démo", target: 200, active: true, updated_at: null }] };
const demoRaw = { s: ["Compte démo", "CB", "Dépense Courante", "Démo", "Débit"], t: [[0, 1, "2025-01-10", 10, 2, 3, -1, -1, -1, 4, -1]] };
beforeEach(() => {
  localStorage.clear(); useDataStore.getState().reset();
  useUIStore.getState().setUploaderOpen(true);
  vi.stubGlobal("Worker", ReaderWorker);
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes("transactions") ? demoRaw : url.includes("salary") ? demoSalary : url.includes("budgets") ? demoBudgets : demoConfig) })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Parcours d'import dans l'interface", () => {
  it("lit un fichier, applique sans requête réseau et efface le paquet en revenant à la démo", async () => {
    const user = userEvent.setup();
    const { container } = render(<DataUploader />);
    const buffer = XLSX.write(importWorkbook(false, false), { type: "array", bookType: "xlsx" });
    await user.upload(container.querySelector('input[type="file"]')!, new File([buffer], "mon-budget.xlsx"));
    const apply = await screen.findByRole("button", { name: "Appliquer au dashboard" });
    useFilterStore.setState({ cat1Filter: "Dépense Fixe", showTransfers: true });
    await user.click(apply);
    expect(useDataStore.getState().config?.comptes).toEqual(["Mon compte", "Mon livret"]);
    expect(useDataStore.getState().salary?.months).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(useFilterStore.getState().cat1Filter).toBe("all");
    await user.click(screen.getByRole("button", { name: "Effacer mes données et revenir à la démo" }));
    await waitFor(() => expect(useDataStore.getState().dataOrigin).toBe("static"));
    expect(localStorage.getItem("budget-demo.import.v2")).toBeNull();
    expect(useDataStore.getState().config).toEqual(demoConfig);
    expect(useDataStore.getState().budgets).toEqual(demoBudgets);
    expect(screen.queryByRole("button", { name: "Appliquer au dashboard" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("affiche une erreur de ligne et interdit l'application d'un montant invalide", async () => {
    const user = userEvent.setup(); const { container } = render(<DataUploader />);
    const wb = importWorkbook(false, false); wb.Sheets.Transactions.E2 = { t: "s", v: "50 euros" };
    await user.upload(container.querySelector('input[type="file"]')!, new File([XLSX.write(wb, { type: "array", bookType: "xlsx" })], "erreur.xlsx"));
    await screen.findByText(/Transactions, ligne 2, Montant/);
    expect(screen.queryByRole("button", { name: "Appliquer au dashboard" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled(); expect(useDataStore.getState().dataOrigin).toBe("unknown");
  });
  it("signale un effacement impossible et conserve le jeu affiché", async () => {
    const data = importDataset(); useDataStore.getState().setImportedDataset(data, "test.xlsx", "2026-09-15T12:00:00Z");
    saveImport({ ...data, storageVersion: 2, fileName: "test.xlsx", importedAt: "2026-09-15T12:00:00Z" });
    render(<DataUploader />);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("bloqué"); });
    await userEvent.click(screen.getByRole("button", { name: "Effacer mes données et revenir à la démo" }));
    await screen.findByText(/L'effacement a échoué/);
    expect(useDataStore.getState().dataOrigin).toBe("upload"); expect(fetch).not.toHaveBeenCalled();
  });
});
