import { Link, useLocation } from "wouter";
import { MessageSquare, Users, Search, User as UserIcon, LogOut, Zap, Sun, Moon, Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useLogout, useHeartbeat } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const heartbeat = useHeartbeat();

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => heartbeat.mutate(undefined), 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const navItems = [
    { href: "/feed", icon: Home, label: "Home" },
    { href: "/conversations", icon: MessageSquare, label: "Chat" },
    { href: "/users", icon: Users, label: "Directory" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/profile", icon: UserIcon, label: "Profile" },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">
      <nav className="w-[72px] lg:w-64 border-r border-border bg-card flex flex-col justify-between py-5 px-3 lg:px-4 flex-shrink-0 z-10">
        <div className="flex flex-col gap-8">
          <Link href="/feed" className="group outline-none flex items-center justify-center lg:justify-start gap-3" title="Pulse">
            <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary/20 transition-colors">
              <Zap className="w-6 h-6 fill-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden lg:block text-foreground">Pulse</span>
          </Link>
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl transition-all outline-none cursor-pointer ${isActive ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,200,200,0.15)]" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title={item.label}>
                  <item.icon className="w-[22px] h-[22px] flex-shrink-0" />
                  <span className={`font-medium hidden lg:block ${isActive ? "text-primary-foreground" : ""}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors outline-none cursor-pointer">
            {theme === "dark" ? <Sun className="w-[22px] h-[22px] flex-shrink-0" /> : <Moon className="w-[22px] h-[22px] flex-shrink-0" />}
            <span className="font-medium hidden lg:block">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <button onClick={handleLogout} className="flex items-center justify-center lg:justify-start gap-3.5 p-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors outline-none cursor-pointer">
            <LogOut className="w-[22px] h-[22px] flex-shrink-0" />
            <span className="font-medium hidden lg:block">Log out</span>
          </button>
          {user && (
            <div className="hidden lg:flex items-center gap-3 px-1 pt-2 mt-1 border-t border-border">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
              </div>
              <div className="flex flex-col overflow-hidden min-w-0">
                <span className="text-sm font-medium truncate">{user.displayName}</span>
                <span className="text-xs text-muted-foreground truncate">@{user.username}</span>
              </div>
            </div>
          )}
          <p className="hidden lg:block text-[10px] text-muted-foreground/40 text-center pt-2 tracking-wide select-none">Made by Joel Engelman</p>
        </div>
      </nav>
      <main className="flex-1 flex overflow-hidden bg-background relative">{children}</main>
    </div>
  );
}
