import { useState, useEffect } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { User as UserIcon, Camera, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export default function Profile() {
  const { data: user, isLoading } = useGetMe();
  const queryClient = useQueryClient();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setBio(user.bio || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe.mutate(
      { data: { displayName, bio, avatarUrl } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3000);
        }
      }
    );
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full max-w-3xl mx-auto p-4 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/10 text-primary p-3 rounded-2xl">
          <UserIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground">Manage your identity and presence</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 md:p-10 shadow-sm relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-10 relative z-10">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 flex-shrink-0">
            <div className="relative group cursor-pointer">
              <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="text-4xl bg-secondary">{getInitials(displayName || user.username)}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-background" title="Online status" />
            </div>
            <div className="text-center">
              <p className="font-medium">@{user.username}</p>
              <p className="text-xs text-muted-foreground mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you appear to others"
                className="bg-background/50 h-12 text-base"
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Avatar URL</label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="bg-background/50 h-12 text-base"
              />
              <p className="text-xs text-muted-foreground">Provide a link to an image. Leave empty to use initials.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A little bit about yourself..."
                className="flex w-full rounded-xl border border-input bg-background/50 px-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px] resize-y custom-scrollbar"
                maxLength={200}
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-4">
              {isSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-500 animate-in fade-in slide-in-from-right-4">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved successfully
                </span>
              )}
              <Button 
                type="submit" 
                variant="glow" 
                size="lg"
                disabled={updateMe.isPending}
                className="px-8"
              >
                {updateMe.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                )}
              </Button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
