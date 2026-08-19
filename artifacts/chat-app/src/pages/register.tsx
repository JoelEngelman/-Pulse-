import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export default function Register() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const register = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register.mutate(
      { data: { username: username.trim(), displayName: displayName.trim(), password } },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetMeQueryKey(), user);
          setLocation("/conversations");
        },
        onError: (err: any) => {
          const message =
            err?.data?.error ||
            err?.message ||
            "Failed to create account. Please try again.";
          setError(message);
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/10 text-primary p-3 rounded-2xl mb-4 electric-glow">
            <Zap className="w-8 h-8 fill-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Join Pulse</h1>
          <p className="text-muted-foreground mt-2 text-center">Create an account to start chatting</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Username</label>
            <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. neo" className="bg-background/50" required minLength={3} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Display Name</label>
            <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Thomas Anderson" className="bg-background/50" required minLength={1} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-background/50" required minLength={6} />
          </div>
          <Button type="submit" className="w-full mt-4" variant="glow" disabled={register.isPending}>
            {register.isPending ? "Creating..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
