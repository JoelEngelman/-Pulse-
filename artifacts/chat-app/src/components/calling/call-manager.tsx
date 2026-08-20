import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const PEER_SCRIPT = "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js";
type CallMode = "voice" | "video";
type CallTarget = { id: number; displayName: string; username: string; avatarUrl?: string | null };
type ActiveCall = { remote: CallTarget; incoming: boolean; mode: CallMode };

declare global { interface Window { Peer?: any } }

function loadPeer(): Promise<any> {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pulse-peerjs]');
    if (existing) { existing.addEventListener("load", () => resolve(window.Peer)); existing.addEventListener("error", reject); return; }
    const script = document.createElement("script");
    script.src = PEER_SCRIPT; script.async = true; script.dataset.pulsePeerjs = "true";
    script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error("Calling service failed to load"));
    script.onerror = () => reject(new Error("Calling service failed to load"));
    document.head.appendChild(script);
  });
}
function stopStream(stream: MediaStream | null) { stream?.getTracks().forEach(track => track.stop()); }
export function startPulseCall(target: CallTarget, mode: CallMode = "voice") { window.dispatchEvent(new CustomEvent("pulse:start-call", { detail: { target, mode } })); }

export function CallManager() {
  const { user } = useAuth();
  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [incoming, setIncoming] = useState<{ target: CallTarget; mode: CallMode } | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");

  const attachRemote = (stream: MediaStream, mode: CallMode) => {
    if (mode === "video" && remoteVideoRef.current) { remoteVideoRef.current.srcObject = stream; void remoteVideoRef.current.play().catch(() => {}); }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = stream; void remoteAudioRef.current.play().catch(() => {}); }
  };
  const attachLocal = (stream: MediaStream, mode: CallMode) => {
    if (mode === "video" && localVideoRef.current) { localVideoRef.current.srcObject = stream; void localVideoRef.current.play().catch(() => {}); }
  };
  const cleanup = () => {
    try { currentCallRef.current?.close(); } catch {}
    currentCallRef.current = null; stopStream(localStreamRef.current); localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setIncoming(null); setActive(null); setConnecting(false); setMuted(false); setCameraOff(false);
  };
  const getPeer = async () => {
    if (peerRef.current && !peerRef.current.destroyed) return peerRef.current;
    const Peer = await loadPeer(); if (!user) throw new Error("Not signed in");
    const peer = new Peer(`pulse-${user.id}`, { debug: 0 });
    peer.on("error", (err: any) => { if (err?.type !== "disconnected") setError(err?.type === "unavailable-id" ? "Pulse calling is already open in another tab for this account." : "Could not connect to calling."); });
    peer.on("call", (call: any) => {
      const meta = call.metadata?.from as (CallTarget & { mode?: CallMode }) | undefined;
      if (!meta || currentCallRef.current) { call.close(); return; }
      const target: CallTarget = { id: meta.id, displayName: meta.displayName, username: meta.username, avatarUrl: meta.avatarUrl };
      currentCallRef.current = call; setIncoming({ target, mode: meta.mode === "video" ? "video" : "voice" });
      call.on("close", () => { if (currentCallRef.current === call) cleanup(); });
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} }); peerRef.current = peer; return peer;
  };

  useEffect(() => {
    if (!user) return; let cancelled = false;
    getPeer().catch(e => { if (!cancelled) setError(e.message || "Calling unavailable"); });
    const onStart = (event: Event) => { const detail = (event as CustomEvent<{ target: CallTarget; mode: CallMode }>).detail; if (!detail?.target || detail.target.id === user.id || currentCallRef.current) return; void beginCall(detail.target, detail.mode); };
    window.addEventListener("pulse:start-call", onStart);
    return () => { cancelled = true; window.removeEventListener("pulse:start-call", onStart); cleanup(); try { peerRef.current?.destroy(); } catch {} peerRef.current = null; };
  }, [user?.id]);

  const beginCall = async (target: CallTarget, mode: CallMode) => {
    setError(""); setConnecting(true);
    try {
      const peer = await getPeer();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
      localStreamRef.current = stream; attachLocal(stream, mode);
      const call = peer.call(`pulse-${target.id}`, stream, { metadata: { from: { id: user!.id, displayName: user!.displayName, username: user!.username, avatarUrl: user!.avatarUrl }, mode } });
      currentCallRef.current = call; setActive({ remote: target, incoming: false, mode });
      call.on("stream", (remoteStream: MediaStream) => { attachRemote(remoteStream, mode); setConnecting(false); });
      call.on("close", cleanup); call.on("error", () => { setError("The call could not connect."); cleanup(); });
    } catch (e: any) { setError(e?.message || (mode === "video" ? "Camera and microphone permission is required." : "Microphone permission is required.")); cleanup(); }
  };

  const accept = async () => {
    const call = currentCallRef.current; const request = incoming; if (!call || !request || !user) return;
    setError(""); setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: request.mode === "video" });
      localStreamRef.current = stream; attachLocal(stream, request.mode); call.answer(stream);
      setIncoming(null); setActive({ remote: request.target, incoming: true, mode: request.mode });
      call.on("stream", (remoteStream: MediaStream) => { attachRemote(remoteStream, request.mode); setConnecting(false); });
      call.on("close", cleanup); call.on("error", () => { setError("The call ended unexpectedly."); cleanup(); });
    } catch (e: any) { setError(e?.message || "Camera and microphone permission is required to answer."); try { call.close(); } catch {} cleanup(); }
  };
  const decline = () => { try { currentCallRef.current?.close(); } catch {} cleanup(); };
  const hangup = () => { try { currentCallRef.current?.close(); } catch {} cleanup(); };
  const toggleMute = () => { const next = !muted; localStreamRef.current?.getAudioTracks().forEach(track => track.enabled = !next); setMuted(next); };
  const toggleCamera = () => { const next = !cameraOff; localStreamRef.current?.getVideoTracks().forEach(track => track.enabled = !next); setCameraOff(next); };

  if (!user) return null;
  return <>
    <audio ref={remoteAudioRef} autoPlay playsInline />
    {active?.mode === "video" && <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-3 md:p-6"><video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full max-w-6xl max-h-[90vh] object-contain rounded-2xl" /><video ref={localVideoRef} autoPlay muted playsInline className="absolute right-5 top-5 w-36 md:w-52 aspect-video object-cover rounded-2xl border border-white/20 shadow-2xl bg-black" /><div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur"><button onClick={toggleMute} className="h-11 w-11 rounded-xl bg-white/10 text-white grid place-items-center">{muted ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}</button><button onClick={toggleCamera} className="h-11 w-11 rounded-xl bg-white/10 text-white grid place-items-center">{cameraOff ? <VideoOff className="w-5 h-5"/> : <Video className="w-5 h-5"/>}</button><button onClick={hangup} className="h-11 px-5 rounded-xl bg-red-600 text-white font-semibold flex items-center gap-2"><PhoneOff className="w-4 h-4"/>End</button></div>{connecting && <div className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white px-4 py-2 text-sm">Connecting…</div>}</div>}
    {error && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 rounded-2xl border border-destructive/30 bg-card px-4 py-3 shadow-2xl"><span className="text-sm text-destructive">{error}</span><button onClick={() => setError("")} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4"/></button></div>}
    {incoming && <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><section className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl p-7 text-center"><div className="mx-auto mb-5 w-20 h-20 rounded-full bg-primary/10 text-primary grid place-items-center">{incoming.mode === "video" ? <Video className="w-9 h-9"/> : <Phone className="w-9 h-9"/>}</div><p className="text-sm text-muted-foreground">Incoming {incoming.mode} call</p><h2 className="text-2xl font-bold mt-1">{incoming.target.displayName}</h2><p className="text-sm text-muted-foreground">@{incoming.target.username}</p><div className="flex gap-3 mt-7"><button onClick={decline} className="flex-1 h-12 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"><PhoneOff className="w-5 h-5"/>Decline</button><button onClick={accept} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2">{incoming.mode === "video" ? <Video className="w-5 h-5"/> : <Phone className="w-5 h-5"/>}Answer</button></div></section></div>}
    {active && active.mode === "voice" && <div className="fixed bottom-5 right-5 z-[75] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-border bg-card shadow-2xl p-5"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-primary/10 text-primary grid place-items-center"><Phone className="w-5 h-5"/></div><div className="flex-1 min-w-0"><p className="font-semibold truncate">{active.remote.displayName}</p><p className="text-xs text-muted-foreground">{connecting ? "Connecting…" : "Voice call"}</p></div><div className="w-2.5 h-2.5 rounded-full bg-green-500"/></div><div className="flex gap-2 mt-5"><button onClick={toggleMute} className="h-11 flex-1 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-2">{muted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}{muted ? "Unmute" : "Mute"}</button><button onClick={hangup} className="h-11 px-5 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center gap-2"><PhoneOff className="w-4 h-4"/>End</button></div></div>}
  </>;
}
