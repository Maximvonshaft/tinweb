import { create } from 'zustand';

type ViewMode = 'table' | 'grid';
type SortKey = 'name' | 'updated_at' | 'size';
type SortOrder = 'asc' | 'desc';

export interface DriveState {
  disk: string;
  parentId: string | null;
  viewMode: ViewMode;
  sortKey: SortKey;
  sortOrder: SortOrder;
  search: string;
  selectedIds: Set<string>;
  setDisk: (disk: string) => void;
  setParentId: (parentId: string | null) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setSort: (key: SortKey, order: SortOrder) => void;
  setSearch: (value: string) => void;
  toggleSelect: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  disk: 'local',
  parentId: null,
  viewMode: 'table',
  sortKey: 'updated_at',
  sortOrder: 'desc',
  search: '',
  selectedIds: new Set<string>(),
  setDisk: (disk) => set({ disk, parentId: null, selectedIds: new Set() }),
  setParentId: (parentId) => set({ parentId, selectedIds: new Set() }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSort: (sortKey, sortOrder) => set({ sortKey, sortOrder }),
  setSearch: (value) => set({ search: value }),
  toggleSelect: (id, multi = false) =>
    set(() => {
      const current = new Set(get().selectedIds);
      if (!multi) {
        if (current.has(id) && current.size === 1) {
          current.clear();
        } else {
          current.clear();
          current.add(id);
        }
        return { selectedIds: current };
      }
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      return { selectedIds: current };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
}));
