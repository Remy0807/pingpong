import { createContext, useContext } from "react";
import type {
  PortalGroup,
  PortalMembership,
  PortalSession,
  PortalUser,
} from "../lib/api";

export type PortalContextValue = {
  ready: boolean;
  user: PortalUser | null;
  groups: PortalGroup[];
  memberships: PortalMembership[];
  activeGroupId: string | null;
  activeGroup: PortalGroup | null;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  createGroup: (payload: { name: string; joinCode: string }) => Promise<void>;
  joinGroup: (payload: { groupId: string; joinCode: string }) => Promise<void>;
  selectGroup: (groupId: string) => Promise<void>;
  session: PortalSession | null;
};

const PortalContext = createContext<PortalContextValue | undefined>(undefined);

export function PortalProvider({
  value,
  children,
}: {
  value: PortalContextValue;
  children: React.ReactNode;
}) {
  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortal must be used within PortalProvider");
  }
  return context;
}

