import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  /** Currently selected client id (drives the sidebar + topbar switcher). */
  activeClientId: string | null;
  /** Currently selected project id. */
  activeProjectId: string | null;
  /** Whether the sidebar is collapsed (mobile / focus mode). */
  sidebarCollapsed: boolean;

  setActiveClient: (clientId: string | null) => void;
  setActiveProject: (projectId: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeClientId: null,
      activeProjectId: null,
      sidebarCollapsed: false,

      setActiveClient: (clientId) =>
        set({ activeClientId: clientId, activeProjectId: null }),
      setActiveProject: (projectId) => set({ activeProjectId: projectId }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: "mosaic-workspace",
      partialize: (s) => ({
        activeClientId: s.activeClientId,
        activeProjectId: s.activeProjectId,
      }),
    },
  ),
);
