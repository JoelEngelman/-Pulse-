import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Conversations from "@/pages/conversations";
import Chat from "@/pages/chat";
import Users from "@/pages/users";
import Search from "@/pages/search";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-[100dvh] w-full flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-[100dvh] w-full flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  
  if (isAuthenticated) {
    return <Redirect to="/conversations" />;
  }
  return <Redirect to="/login" />;
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />

              {/* Protected Routes */}
              <Route path="/conversations" component={() => <ProtectedRoute component={Conversations} />} />
              <Route path="/conversations/:id" component={() => <ProtectedRoute component={Chat} />} />
              <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
              <Route path="/search" component={() => <ProtectedRoute component={Search} />} />
              <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />

              <Route component={NotFound} />
            </Switch>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
