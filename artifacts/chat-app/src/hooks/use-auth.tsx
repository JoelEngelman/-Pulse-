import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, AuthUser, getGetMeQueryKey } from "@workspace/api-client-react";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({ 
    query: { 
      retry: false,
      refetchOnWindowFocus: false,
      queryKey: getGetMeQueryKey()
    } 
  });

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
