import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const API = "https://pulse-api.joeldavidengelman.workers.dev";

type CallTarget = { id: number; displayName: string; username: string; avatarUrl?: string | null };
type ActiveCall = { peerCall: any; remote: CallTarget; incoming: boolean };

declare global { interface Window { Peer?: any } }

function loadPeer(): Promise<any> {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pulse-peerjs]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Peer));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js";
    script.async = true;
    script.dataset.pulsePeerjs = "true";
    script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error("Calling service failed to load"));
    script.onerror = () => reject(new Error("Calling service failed to load"));
    document.head.appendChild(script);
  });
}

function stopStream(stream: MediaStream | null) { stream?.getTracks().forEach(track => track.stop()); }

export function startPulseCall(target: CallTarget) {
  window.dispatchEvent(new CustomEvent("pulse:start-call", { detail: target }));
}

export function CallManager() {
  const { user } = useAuth();
  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [incoming, setIncoming] = useState<CallTarget | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");

  const cleanup = () => {
    try { currentCallRef.current?.close(); } catch {}
    currentCallRef.current = null;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setIncoming(null); setActive(null); setConnecting(false); setMuted(false);
  };

  const getPeer = async () => {
    if (peerRef.current && !peerRef.current.destroyed) return peerRef.current;
    const Peer = await loadPeer();
    if (!user) throw new Error("Not signed in");
    const peer = new Peer(`pulse-${user.id}`, { debug: 0 });
    peer.on("error", (err: any) => {
      if (err?.type !== "disconnected") setError(err?.type === "unavailable-id" ? "Pulse calling is already open in another tab for this account." : "Could not connect to calling.");
    });
    peer.on("call", (call: any) => {
      const meta = call.metadata?.from as CallTarget | undefined;
      if (!meta) { call.close(); return; }
      if (currentCallRef.current) { call.close(); return; }
      currentCallRef.current = call;
      setIncoming(meta);
      call.on("close", () => { if (currentCallRef.current === call) cleanup(); });
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} });
    peerRef.current = peer;
    return peer;
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPeer().catch((e) => { if (!cancelled) setError(e.message || "Calling unavailable"); });
    const onStart = (event: Event) => {
      const target = (event as CustomEvent<CallTarget>).detail;
      if (!target || target.id === user.id || currentCallRef.current) return;
      void beginCall(target);
    };
    window.addEventListener("pulse:start-call", onStart);
    return () => { cancelled = true; window.removeEventListener("pulse:start-call", onStart); cleanup(); try { peerRef.current?.destroy(); } catch {} peerRef.current = null; };
  }, [user?.id]);

  const beginCall = async (target: CallTarget) => {
    setError(""); setConnecting(true);
    try {
      const peer = await getPeer();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const call = peer.call(`pulse-${target.id}`, stream, { metadata: { from: { id: user!.id, displayName: user!.displayName, username: user!.username, avatarUrl: user!.avatarUrl } } });
      currentCallRef.current = call;
      setActive({ peerCall: call, remote: target, incoming: false });
      call.on("stream", (remoteStream: MediaStream) => { if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = remoteStream; void remoteAudioRef.current.play().catch(() => {}); } setConnecting(false); });
      call.on("close", cleanup);
      call.on("error", () => { setError("The call could not connect."); cleanup(); });
    } catch (e: any) { setError(e?.message || "Microphone permission is required to call."); cleanup(); }
  };

  const accept = async () => {
    const call = currentCallRef.current; const remote = incoming;
    if (!call || !remote || !user) return;
    setError(""); setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      call.answer(stream);
      setIncoming(null); setActive({ peerCall: call, remote, incoming: true });
      call.on("stream", (remoteStream: MediaStream) => { if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = remoteStream; void remoteAudioRef.current.play().catch(() => {}); } setConnecting(false); });
      call.on("close", cleanup);
      call.on("error", () => { setError("The call ended unexpectedly."); cleanup(); });
    } catch (e: any) { setError(e?.message || "Microphone permission is required to answer."); try { call.close(); } catch {} cleanup(); }
  };

  const decline = () => { try { currentCallRef.current?.close(); } catch {} cleanup(); };
  const hangup = () => { try { currentCallRef.current?.close(); } catch {} cleanup(); };
  const toggleMute = () => { const next = !muted; localStreamRef.current?.getAudioTracks().forEach(track => track.enabled = !next); setMuted(next); };

  if (!user) return null;
  return <>
    <audio ref={remoteAudioRef} autoPlay playsInline />
    {error && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 rounded-2xl border border-destructive/30 bg-card px-4 py-3 shadow-2xl"><span className="text-sm text-destructive">{error}</span><button onClick={() => setError("")} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4"/></button></div>}
    {incoming && <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><section className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl p-7 text-center"><div className="mx-auto mb-5 w-20 h-20 rounded-full bg-primary/10 text-primary grid place-items-center"><Phone className="w-9 h-9"/></div><p className="text-sm text-muted-foreground">Incoming voice call</p><h2 className="text-2xl font-bold mt-1">{incoming.displayName}</h2><p className="text-sm text-muted-foreground">@{incoming.username}</p><div className="flex gap-3 mt-7"><button onClick={decline} className="flex-1 h-12 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"><PhoneOff className="w-5 h-5"/>Decline</button><button onClick={accept} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"><Phone className="w-5 h-5"/>Answer</button></div></section></div>}
    {active && <div className="fixed bottom-5 right-5 z-[75] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-border bg-card shadow-2xl p-5"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-primary/10 text-primary grid place-items-center"><Phone className="w-5 h-5"/></div><div className="flex-1 min-w-0"><p className="font-semibold truncate">{active.remote.displayName}</p><p className="text-xs text-muted-foreground">{connecting ? "Connecting…" : "Voice call"}</p></div><div className="w-2.5 h-2.5 rounded-full bg-green-500"/></div><div className="flex gap-2 mt-5"><button onClick={toggleMute} className="h-11 flex-1 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-2">{muted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}{muted ? "Unmute" : "Mute"}</button><button onClick={hangup} className="h-11 px-5 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center gap-2"><PhoneOff className="w-4 h-4"/>End</button></div></div>}
  </>;
}
