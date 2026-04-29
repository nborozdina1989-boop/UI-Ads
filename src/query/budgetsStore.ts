import { create } from "zustand";

export type LastUploadMeta = {
  fileName: string;
  uploadedAt: string;
  rowsOk: number;
  rowsError: number;
};

type BudgetsStore = {
  budgetsByPlacementId: Record<string, number>;
  lastUploadMeta: LastUploadMeta | null;
  upsertBudgets: (next: Record<string, number>, meta: LastUploadMeta) => void;
  clearBudgets: () => void;
};

export const useBudgetsStore = create<BudgetsStore>((set) => ({
  budgetsByPlacementId: {},
  lastUploadMeta: null,
  upsertBudgets: (next, meta) =>
    set((state) => ({
      budgetsByPlacementId: { ...state.budgetsByPlacementId, ...next },
      lastUploadMeta: meta,
    })),
  clearBudgets: () =>
    set({
      budgetsByPlacementId: {},
      lastUploadMeta: null,
    }),
}));

