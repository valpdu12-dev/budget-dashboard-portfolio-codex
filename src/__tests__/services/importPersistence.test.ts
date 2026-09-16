import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { saveImport, loadImport, clearImport, restoreImport } from "@/services/importPersistence";
import type { ImportMemorise } from "@/services/importPersistence";
import { importDataset } from "../helpers/importFixture";

/**
 * Mémorisation du dernier fichier importé.
 *
 * Besoin mesuré sur A56 le 11/08/2026 : onglet fermé puis rouvert, l'import
 * était perdu et il fallait recharger le classeur.
 */

function memo(over: Partial<ImportMemorise> = {}): ImportMemorise {
  return {
    ...importDataset(),
    storageVersion: 2,
    fileName: "Budget 2025.xlsx",
    importedAt: "2026-08-11T18:00:00.000Z",
    ...over,
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("importPersistence", () => {
  it("ne restaure pas l'ancien format sans comptes et le signale", () => {
    localStorage.setItem("budget-demo.import.v1", JSON.stringify({ transactions: [], salary: {} }));
    expect(restoreImport()).toEqual({ data: null, notice: expect.stringContaining("ancien import") });
  });
  it("refuse un paquet altéré avec un montant non numérique", () => {
    const invalid = memo();
    localStorage.setItem("budget-demo.import.v2", JSON.stringify({ ...invalid, transactions: [{ ...invalid.transactions[0], montant: "50" }] }));
    expect(loadImport()).toBeNull(); expect(restoreImport().notice).toContain("incomplet");
  });
  it("efface les deux versions du stockage", () => {
    saveImport(memo()); localStorage.setItem("budget-demo.import.v1", "ancien");
    expect(clearImport()).toBe(true);
    expect(localStorage.getItem("budget-demo.import.v1")).toBeNull();
    expect(localStorage.getItem("budget-demo.import.v2")).toBeNull();
  });
  it("relit ce qui a été mémorisé", () => {
    expect(saveImport(memo())).toBe(true);
    const lu = loadImport();
    expect(lu?.fileName).toBe("Budget 2025.xlsx");
    expect(lu?.importedAt).toBe("2026-08-11T18:00:00.000Z");
    expect(lu?.transactions).toHaveLength(6);
  });

  it("rend null quand rien n'a été mémorisé", () => {
    expect(loadImport()).toBeNull();
  });

  it("oublie l'import après clearImport", () => {
    saveImport(memo());
    clearImport();
    expect(loadImport()).toBeNull();
  });

  it("remplace l'import précédent — un seul est conservé", () => {
    saveImport(memo({ fileName: "ancien.xlsx" }));
    saveImport(memo({ fileName: "nouveau.xlsx" }));
    expect(loadImport()?.fileName).toBe("nouveau.xlsx");
  });

  it("ignore un contenu tronqué plutôt que de peupler à moitié", () => {
    // Mieux vaut repartir des données de démonstration qu'afficher un dashboard
    // incomplet sans le dire.
    localStorage.setItem("budget-demo.import.v1", JSON.stringify({ transactions: [] }));
    expect(loadImport()).toBeNull();
  });

  it("ignore un contenu illisible sans lever d'exception", () => {
    localStorage.setItem("budget-demo.import.v1", "{ ceci n'est pas du JSON");
    expect(() => loadImport()).not.toThrow();
    expect(loadImport()).toBeNull();
  });

  it("survit à un stockage saturé sans empêcher l'affichage", () => {
    // Le quota dépassé ne doit jamais faire échouer l'import en cours :
    // l'utilisateur voit ses données, elles ne sont simplement pas retenues.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(saveImport(memo())).toBe(false);
  });

  it("conserve le nom de fichier vide sans casser la relecture", () => {
    saveImport(memo({ fileName: "" }));
    expect(loadImport()?.fileName).toBe("");
  });
});
