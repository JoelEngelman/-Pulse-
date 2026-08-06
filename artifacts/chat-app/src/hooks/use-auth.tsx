import { createContext, useContext } from "react";
import { useGetMe, AuthUser, getGetMeQueryKey } from "@workspace/api-client-react";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Auth data only changes on login / logout / register — all of which
      // update the cache via setQueryData or queryClient.clear() directly.
      // Never auto-refetch; let the explicit mutations own the lifecycle.
      staleTime: Infinity,
      queryKey: getGetMeQueryKey(),
    },
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
