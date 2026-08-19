import { useState, useRef, useEffect } from "react";
import { Image, Sparkles, Film, Link as LinkIcon, Search, X, Plus, Paperclip, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const STICKERS = [
  "😂","🥰","😎","🔥","💯","🎉","👍","❤️",
  "🤣","😭","🥹","🤩","😤","🤯","🤔","👀",
  "🙌","💀","🫡","🫶","⚡","🌊","🎶","✨",
  "🥳","😈","👻","🤖","🐸","🦋","🌈","💎",
  "🍕","🍔","🧃","🧊","🎯","🚀","🏆","💪",
];

const GIPHY_KEY = "dc6zaTOxFJmzC";
type GifResult = { id: string; url: string; preview: string; title: string };

async function searchGifs(query: string): Promise<GifResult[]> {
  const base = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=16&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=16&rating=g`;
  const res = await fetch(base);
  if (!res.ok) throw new Error("GIPHY request failed");
  const json = await res.json();
  return (json.data || []).map((g: any) => ({ id: g.id, url: g.images.original.url, preview: g.images.fixed_height_small.url, title: g.title }));
}

type Tab = "stickers" | "gifs" | "image" | "file";
interface MediaPickerProps { onSelect: (content: string) => void; onClose: () => void; }

export function MediaPicker({ onSelect, onClose }: MediaPickerProps) {
  const [tab, setTab] = useState<Tab>("stickers");
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => { if (tab === "gifs" && gifs.length === 0) loadGifs(""); }, [tab]);

  const loadGifs = async (q: string) => {
    setGifsLoading(true);
    try { setGifs(await searchGifs(q)); } catch { setGifs([]); } finally { setGifsLoading(false); }
  };

  useEffect(() => {
    if (tab !== "gifs") return;
    const t = setTimeout(() => loadGifs(gifQuery), 450);
    return () => clearTimeout(t);
  }, [gifQuery, tab]);

  const chooseFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("That file is too large. Please choose a file under 5 MB."); return; }
    setFileLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result || "");
        if (!data) { setFileLoading(false); return; }
        // Keep the filename/type with the data so the recipient can download it correctly.
        onSelect(`pulse-file:${JSON.stringify({ name: file.name, type: file.type || "application/octet-stream", data })}`);
        setFileLoading(false);
        onClose();
      };
      reader.onerror = () => { setFileLoading(false); alert("Couldn't read that file."); };
      reader.readAsDataURL(file);
    } catch { setFileLoading(false); alert("Couldn't read that file."); }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "stickers", label: "Stickers", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "gifs", label: "GIFs", icon: <Film className="w-3.5 h-3.5" /> },
    { id: "file", label: "File", icon: <Paperclip className="w-3.5 h-3.5" /> },
    { id: "image", label: "Image URL", icon: <Image className="w-3.5 h-3.5" /> },
  ];

  return <div ref={pickerRef} className="absolute bottom-full mb-2 left-0 z-30 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95 duration-150">
    <div className="flex items-center justify-between px-3 pt-3 pb-2">
      <div className="flex gap-1 bg-secondary/60 p-1 rounded-xl flex-wrap">
        {tabs.map(t => <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t.icon}{t.label}</button>)}
      </div>
      <button type="button" onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><X className="w-4 h-4" /></button>
    </div>

    {tab === "stickers" && <div className="p-2 grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto">{STICKERS.map(s => <button type="button" key={s} onClick={() => { onSelect(s); onClose(); }} className="text-2xl p-1.5 rounded-xl hover:bg-secondary transition-transform hover:scale-125 flex items-center justify-center">{s}</button>)}</div>}

    {tab === "gifs" && <div className="flex flex-col gap-2 p-2">
      <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" /><Input value={gifQuery} onChange={e => setGifQuery(e.target.value)} placeholder="Search GIPHY GIFs…" className="pl-8 h-8 text-sm bg-secondary border-0" autoFocus /></div>
      <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">{gifsLoading ? Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-video bg-secondary animate-pulse rounded-lg" />) : gifs.length === 0 ? <p className="col-span-3 text-center text-xs text-muted-foreground py-6">No GIFs found</p> : gifs.map(g => <button type="button" key={g.id} onClick={() => { onSelect(g.url); onClose(); }} className="aspect-video overflow-hidden rounded-lg hover:ring-2 hover:ring-primary transition-all" title={g.title}><img src={g.preview} alt={g.title} className="w-full h-full object-cover" /></button>)}</div>
      <p className="text-[10px] text-muted-foreground text-center pb-1">Powered by GIPHY</p>
    </div>}

    {tab === "file" && <div className="p-4">
      <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) chooseFile(f); e.currentTarget.value = ""; }} />
      <button type="button" disabled={fileLoading} onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/50 p-7 flex flex-col items-center gap-2 transition-colors disabled:opacity-60">
        {fileLoading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <Paperclip className="w-8 h-8 text-primary" />}
        <span className="font-semibold text-sm">Upload a file</span>
        <span className="text-xs text-muted-foreground text-center">Images, videos, PDFs, documents and more<br />Maximum 5 MB</span>
      </button>
    </div>}

    {tab === "image" && <div className="p-3 flex flex-col gap-3">
      <div className="relative"><LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" /><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Paste image URL…" className="pl-8 h-9 text-sm bg-secondary border-0" autoFocus onKeyDown={e => { if (e.key === "Enter" && imageUrl.trim()) { onSelect(imageUrl.trim()); onClose(); } }} /></div>
      {imageUrl.trim() && <div className="rounded-xl overflow-hidden border border-border max-h-32 flex items-center justify-center bg-secondary/40"><img src={imageUrl} alt="Preview" className="max-h-32 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>}
      <button type="button" onClick={() => { if (imageUrl.trim()) { onSelect(imageUrl.trim()); onClose(); } }} disabled={!imageUrl.trim()} className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">Send Image</button>
    </div>}
  </div>;
}

interface MediaButtonProps { onSelect: (content: string) => void; }
export function MediaButton({ onSelect }: MediaButtonProps) {
  const [open, setOpen] = useState(false);
  return <div className="relative"><button type="button" onClick={() => setOpen(o => !o)} className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${open ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="Add file, sticker, GIF, or image"><Plus className={`w-5 h-5 transition-transform ${open ? "rotate-45" : ""}`} /></button>{open && <MediaPicker onSelect={onSelect} onClose={() => setOpen(false)} />}</div>;
}
