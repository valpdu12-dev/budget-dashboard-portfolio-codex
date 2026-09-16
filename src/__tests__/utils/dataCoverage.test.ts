import { describe, expect, it } from "vitest";
import { declareDataCoverage, inferDataCoverage } from "@/utils/dataCoverage";
import { makeTx } from "../helpers/factories";

describe("declareDataCoverage", () => {
  it("retient uniquement les mois entièrement compris dans les bornes", () => {
    expect(declareDataCoverage("2025-01-15", "2025-04-10")).toEqual({
      dateMin: "2025-01-15",
      dateMax: "2025-04-10",
      completeMonths: ["2025-02", "2025-03"],
      basis: "declared",
    });
  });

  it("retient un mois complet même sans exiger de jour avec transaction", () => {
    expect(declareDataCoverage("2025-02-01", "2025-02-28").completeMonths)
      .toEqual(["2025-02"]);
  });

  it("refuse des bornes invalides", () => {
    expect(declareDataCoverage("2025-02-30", "2025-03-31").basis).toBe("none");
    expect(declareDataCoverage("2025-04-01", "2025-03-31").basis).toBe("none");
  });
});

describe("inferDataCoverage", () => {
  it("exclut prudemment les mois de bord", () => {
    const coverage = inferDataCoverage([
      makeTx({ date: "2025-01-20", monthKey: "2025-01" }),
      makeTx({ date: "2025-04-02", monthKey: "2025-04" }),
    ]);

    expect(coverage).toEqual({
      dateMin: "2025-01-20",
      dateMax: "2025-04-02",
      completeMonths: ["2025-02", "2025-03"],
      basis: "inferred",
    });
  });

  it("ne prétend pas qu'un mois isolé est complet", () => {
    const coverage = inferDataCoverage([
      makeTx({ date: "2025-01-15", monthKey: "2025-01" }),
    ]);

    expect(coverage.completeMonths).toEqual([]);
    expect(coverage.basis).toBe("inferred");
  });

  it("ignore les dates invalides", () => {
    expect(inferDataCoverage([
      makeTx({ date: "date inconnue", monthKey: "" }),
    ]).basis).toBe("none");
  });
});
