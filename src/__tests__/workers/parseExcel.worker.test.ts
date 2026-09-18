import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { importWorkbook } from "../helpers/importFixture";
let messages: Record<string, unknown>[] = [];
beforeEach(async () => {
  messages = [];
  vi.resetModules();
  vi.stubGlobal("self", { postMessage: (msg: Record<string, unknown>) => messages.push(msg), onmessage: null });
  await import("@/components/upload/parseExcel.worker");
});
const parse = (buffer: ArrayBuffer) => self.onmessage?.({ data: { type: "parse", buffer } } as MessageEvent);
describe("Worker du modèle public", () => {
  it("lit le modèle Excel livré et renvoie le paquet complet", () => {
    const file = readFileSync("public/modeles/Budget_v1.xlsx");
    const buffer = new ArrayBuffer(file.length);
    new Uint8Array(buffer).set(file);
    parse(buffer);
    const result = messages.find(m => m.type === "result") as { dataset: { transactions: unknown[]; config: { comptes: string[] } }; validation: { ok: boolean; issues: unknown[] } };
    expect(result.validation.issues).toEqual([]); expect(result.validation.ok).toBe(true);
    expect(result.dataset.transactions).toHaveLength(578);
    expect(result.dataset.config.comptes).toEqual(["Banque Horizon - Courant", "Banque Nova - Compte joint", "Banque Équilibre - Compte joint", "Carte repas - Titres restaurant", "Banque Nova - Épargne"]);
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])("lit salaire=%s et prêt=%s depuis un fichier binaire", (salary, loan) => {
    parse(XLSX.write(importWorkbook(salary, loan), { type: "array", bookType: "xlsx" }));
    expect(messages.find(m => m.type === "result")).toMatchObject({ validation: { ok: true } });
  });
  it("renvoie des erreurs de validation sans masquer les lignes incorrectes", () => {
    const wb = importWorkbook(); wb.Sheets.Transactions.E2 = { t: "s", v: "invalide" };
    parse(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(messages.find(m => m.type === "result")).toMatchObject({ validation: { ok: false, issues: expect.arrayContaining([expect.objectContaining({ column: "Montant", row: 2 })]) } });
  });
  it("gère un fichier corrompu", () => {
    parse(new ArrayBuffer(8));
    expect(messages.some(m => m.type === "error") || messages.some(m => m.type === "result" && !(m.validation as { ok: boolean }).ok)).toBe(true);
  });
});
