import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDashboardData } from "@/services/loadDashboardData";
import { saveImport } from "@/services/importPersistence";
import { migrateDataset } from "@/services/datasetMigration";
import { useDataStore } from "@/stores/useDataStore";
import type { ImportMemorise } from "@/services/importPersistence";
import { importDataset } from "../helpers/importFixture";

const TRANSACTIONS = {
  fields: ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"],
  s: ["Banque Horizon - Courant", "Courses", "Débit", "Démonstration"],
  t: [[0, 1, "2025-01-10", 10, -1, -1, -1, -1, -1, 2, 3]],
};
const SALARY = { months: [], cotLast: [], patronLast: [], lastMonth: "2025-01" };
const CONFIG = {
  init: {},
  comptes: [],
  coverage: { dateMin: "2025-01-01", dateMax: "2025-01-31" },
};
const BUDGETS = {
  budgets: [{ cat2: "Alimentation", target: 400, active: true, updated_at: null }],
};

function memorisedImport(): ImportMemorise {
  return { ...importDataset(), storageVersion: 2, fileName: "Mon budget.xlsx", importedAt: "2026-09-15T18:00:00.000Z" };
}

function mockStaticFetch() {
  return vi.fn((url: string) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(
      url.includes("transactions") ? TRANSACTIONS
        : url.includes("salary") ? SALARY
          : url.includes("budgets") ? BUDGETS
            : CONFIG,
    ),
  }));
}

beforeEach(() => {
  localStorage.clear();
  useDataStore.getState().reset();
});

afterEach(() => vi.restoreAllMocks());

describe("loadDashboardData", () => {
  it("charge les quatre fichiers statiques sans requête API", async () => {
    const fetchMock = mockStaticFetch();
    vi.stubGlobal("fetch", fetchMock);

    await loadDashboardData();

    const state = useDataStore.getState();
    expect(state.status).toBe("success");
    expect(state.dataOrigin).toBe("static");
    expect(state.transactions).toHaveLength(1);
    expect(state.config).toEqual(CONFIG);
    expect(state.budgets).toEqual(BUDGETS);
    expect(state.coverage.completeMonths).toEqual(["2025-01"]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain("data/");
      expect(url).not.toContain("/" + "api/");
    }
  });

  it("restaure le paquet personnel complet sans charger la démo", async () => {
    saveImport(memorisedImport());
    vi.stubGlobal("fetch", mockStaticFetch());

    await loadDashboardData();

    const state = useDataStore.getState();
    expect(state.isFromUpload).toBe(true);
    expect(state.dataOrigin).toBe("upload");
    expect(state.transactions).toHaveLength(6);
    expect(state.config).toEqual(migrateDataset(memorisedImport()).config);
    expect(state.budgets).toEqual(memorisedImport().budgets);
    expect(fetch).not.toHaveBeenCalled();
    expect(state.importFileName).toBe("Mon budget.xlsx");
  });

  it("affiche encore un import mémorisé si les fichiers statiques sont indisponibles", async () => {
    saveImport(memorisedImport());
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));

    await loadDashboardData();

    const state = useDataStore.getState();
    expect(state.status).toBe("success");
    expect(state.dataOrigin).toBe("upload");
    expect(state.transactions).toHaveLength(6);
  });

  it("remonte l'erreur si la démo et l'import sont indisponibles", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));
    await loadDashboardData();
    expect(useDataStore.getState().status).toBe("error");
    expect(useDataStore.getState().error).toContain("hors ligne");
  });
});
