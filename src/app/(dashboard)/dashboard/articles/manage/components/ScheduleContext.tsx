"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface ScheduleContextType {
  selectedArticleIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  websiteId: string | null;
  setWebsiteId: (id: string | null) => void;
  articlesPerDay: number;
  setArticlesPerDay: (n: number) => void;
  isScheduling: boolean;
  setIsScheduling: (v: boolean) => void;
  previewArticleId: string | null;
  setPreviewArticleId: (id: string | null) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(
    new Set(),
  );
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [articlesPerDay, setArticlesPerDay] = useState<number>(3);
  const [isScheduling, setIsScheduling] = useState(false);
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const toggleSelection = useCallback((id: string) => {
    setSelectedArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedArticleIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedArticleIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selectedArticleIds.has(id);
    },
    [selectedArticleIds],
  );

  return (
    <ScheduleContext.Provider
      value={{
        selectedArticleIds,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
        websiteId,
        setWebsiteId,
        articlesPerDay,
        setArticlesPerDay,
        isScheduling,
        setIsScheduling,
        previewArticleId,
        setPreviewArticleId,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleContext() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error("useScheduleContext must be used within ScheduleProvider");
  }
  return context;
}
