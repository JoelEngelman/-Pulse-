import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "pulse-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
    setVisible(false);
  };

  const deny = () => {
    try { localStorage.setItem(STORAGE_KEY, "denied"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Icon */}
        <div className="flex-shrink-0 bg-primary/10 text-primary p-2.5 rounded-xl">
          <Cookie className="w-5 h-5" />
        </div>

        {/* Text */}
        <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Pulse uses cookies</span> to help provide the best
          possible experience, keep you signed in, and remember your preferences.
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={deny}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Deny All
          </button>
          <button
            onClick={accept}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Accept All Cookies
          </button>
          <button
            onClick={deny}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
