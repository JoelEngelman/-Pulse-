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
    const script = document.createElement("script"); script.src = PEER_SCRIPT; script.async = true; script.dataset.pulsePeerjs = "true";
    script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error("Calling service failed to load")); script.onerror = () => reject(new Error("Calling service failed to load")); document.head.appendChild(script);
  });
}
function stopStream(stream: MediaStream | null) { stream?.getTracks().forEach(t => t.stop()); }
export function startPulseCall(target: CallTarget, mode: CallMode = "voice") { window.dispatchEvent(new CustomEvent("pulse:start-call", { detail: { target, mode } })); }

export function CallManager() {
  const { user } = useAuth(); const peerRef = useRef<any>(null); const localStreamRef = useRef<MediaStream | null>(null); const currentCallRef = useRef<any>(null); const remoteAudioRef = useRef<HTMLAudioElement | null>(null); const remoteVideoRef = useRef<HTMLVideoElement | null>(null); const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [incoming,setIncoming]=useState<{target:CallTarget;mode:CallMode}|null>(null); const [active,setActive]=useState<ActiveCall|null>(null); const [connecting,setConnecting]=useState(false); const [muted,setMuted]=useState(false); const [cameraOff,setCameraOff]=useState(false); const [error,setError]=useState("");
  const userRef = useRef(user); useEffect(()=>{userRef.current=user},[user]);

  const cleanup=()=>{try{currentCallRef.current?.close()}catch{} currentCallRef.current=null; stopStream(localStreamRef.current); localStreamRef.current=null; if(remoteAudioRef.current)remoteAudioRef.current.srcObject=null; if(remoteVideoRef.current)remoteVideoRef.current.srcObject=null; if(localVideoRef.current)localVideoRef.current.srcObject=null; setIncoming(null);setActive(null);setConnecting(false);setMuted(false);setCameraOff(false)};
  const attachRemote=(stream:MediaStream,mode:CallMode)=>{if(remoteAudioRef.current){remoteAudioRef.current.srcObject=stream;void remoteAudioRef.current.play().catch(()=>{})} if(mode==="video"&&remoteVideoRef.current){remoteVideoRef.current.srcObject=stream;void remoteVideoRef.current.play().catch(()=>{})}};
  const attachLocal=(stream:MediaStream,mode:CallMode)=>{if(mode==="video"&&localVideoRef.current){localVideoRef.current.srcObject=stream;void localVideoRef.current.play().catch(()=>{})}};

  const getPeer=async()=>{
    if(peerRef.current && !peerRef.current.destroyed) return peerRef.current;
    const Peer=await loadPeer(); const me=userRef.current; if(!me)throw new Error("Not signed in");
    const peer=new Peer(`pulse-${me.id}`,{host:"0.peerjs.com",port:443,path:"/",secure:true,debug:1});
    peer.on("open",(id:string)=>{console.info("[Pulse] Calling ready:",id);setError("")});
    peer.on("error",(err:any)=>{console.error("[Pulse] Peer error",err);if(err?.type!=="disconnected")setError(err?.type==="unavailable-id"?"Pulse calling is already open in another tab for this account.":"Could not connect to Pulse calling.")});
    peer.on("call",(call:any)=>{
      console.info("[Pulse] Incoming call",call.peer,call.metadata);
      if(currentCallRef.current){call.close();return}
      const meta=call.metadata?.from; const target:CallTarget=meta?{id:Number(meta.id),displayName:meta.displayName||"Pulse user",username:meta.username||"",avatarUrl:meta.avatarUrl||null}:{id:Number(String(call.peer).replace("pulse-","")),displayName:"Pulse user",username:""};
      const mode:CallMode=call.metadata?.mode==="video"?"video":"voice";
      currentCallRef.current=call;setIncoming({target,mode});
      call.on("close",()=>{if(currentCallRef.current===call)cleanup()}); call.on("error",()=>{if(currentCallRef.current===call){setError("The incoming call failed.");cleanup()}});
    });
    peer.on("disconnected",()=>{console.warn("[Pulse] Calling disconnected; reconnecting");try{peer.reconnect()}catch{}}); peerRef.current=peer; return peer;
  };

  useEffect(()=>{if(!user?.id)return;let cancelled=false;void getPeer().catch(e=>{if(!cancelled)setError(e.message||"Calling unavailable")});const onStart=(event:Event)=>{const d=(event as CustomEvent<{target:CallTarget;mode:CallMode}>).detail;if(d?.target&&d.target.id!==user.id&&!currentCallRef.current)void beginCall(d.target,d.mode)};window.addEventListener("pulse:start-call",onStart);return()=>{cancelled=true;window.removeEventListener("pulse:start-call",onStart);cleanup();try{peerRef.current?.destroy()}catch{}peerRef.current=null}},[user?.id]);

  const beginCall=async(target:CallTarget,mode:CallMode)=>{setError("");setConnecting(true);try{const peer=await getPeer();const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==="video"});localStreamRef.current=stream;attachLocal(stream,mode);const call=peer.call(`pulse-${target.id}`,stream,{metadata:{from:{id:userRef.current!.id,displayName:userRef.current!.displayName,username:userRef.current!.username,avatarUrl:userRef.current!.avatarUrl},mode}});currentCallRef.current=call;setActive({remote:target,incoming:false,mode});call.on("stream",(s:MediaStream)=>{attachRemote(s,mode);setConnecting(false)});call.on("close",cleanup);call.on("error",()=>{setError("The call could not connect. Make sure both people have Pulse open.");cleanup()})}catch(e:any){setError(e?.message||"Microphone permission is required.");cleanup()}};
  const accept=async()=>{const call=currentCallRef.current;const req=incoming;if(!call||!req)return;setError("");setConnecting(true);try{const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:req.mode==="video"});localStreamRef.current=stream;attachLocal(stream,req.mode);call.answer(stream);setIncoming(null);setActive({remote:req.target,incoming:true,mode:req.mode});call.on("stream",(s:MediaStream)=>{attachRemote(s,req.mode);setConnecting(false)});call.on("close",cleanup);call.on("error",()=>{setError("The call ended unexpectedly.");cleanup()})}catch(e:any){setError(e?.message||"Microphone permission is required to answer.");try{call.close()}catch{}cleanup()}};
  const decline=()=>{try{currentCallRef.current?.close()}catch{}cleanup()};const hangup=decline;const toggleMute=()=>{const next=!muted;localStreamRef.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next)};const toggleCamera=()=>{const next=!cameraOff;localStreamRef.current?.getVideoTracks().forEach(t=>t.enabled=!next);setCameraOff(next)};
  if(!user)return null;
  return <><audio ref={remoteAudioRef} autoPlay playsInline/><div aria-live="assertive" className="fixed inset-x-0 top-0 z-[100] pointer-events-none">{incoming&&<div className="pointer-events-auto mx-auto mt-4 w-[min(420px,calc(100vw-2rem))] rounded-3xl border border-primary/30 bg-card shadow-2xl p-5"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center"><Phone className="w-5 h-5 animate-pulse"/></div><div className="flex-1 min-w-0"><p className="font-semibold truncate">{incoming.target.displayName}</p><p className="text-sm text-muted-foreground">Incoming {incoming.mode} call · @{incoming.target.username}</p></div></div><div className="flex gap-2 mt-4"><button onClick={decline} className="flex-1 h-11 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"><PhoneOff className="w-4 h-4"/>Decline</button><button onClick={accept} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"><Phone className="w-4 h-4"/>Answer</button></div></div>}</div>
    {active?.mode==="voice"&&<div className="fixed bottom-5 right-5 z-[75] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-border bg-card shadow-2xl p-5"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-primary/10 text-primary grid place-items-center"><Phone className="w-5 h-5"/></div><div className="flex-1 min-w-0"><p className="font-semibold truncate">{active.remote.displayName}</p><p className="text-xs text-muted-foreground">{connecting?"Connecting…":"Voice call"}</p></div></div><div className="flex gap-2 mt-5"><button onClick={toggleMute} className="h-11 flex-1 rounded-xl bg-secondary flex items-center justify-center gap-2">{muted?<MicOff className="w-4 h-4"/>:<Mic className="w-4 h-4"/>}{muted?"Unmute":"Mute"}</button><button onClick={hangup} className="h-11 px-5 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center gap-2"><PhoneOff className="w-4 h-4"/>End</button></div></div>}
    {active?.mode==="video"&&<div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-3"><video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain"/><video ref={localVideoRef} autoPlay muted playsInline className="absolute right-5 top-5 w-40 aspect-video object-cover rounded-xl bg-black"/><div className="absolute bottom-5 flex gap-2"><button onClick={toggleMute} className="h-11 w-11 rounded-xl bg-white/10 text-white grid place-items-center">{muted?<MicOff/>:<Mic/>}</button><button onClick={toggleCamera} className="h-11 w-11 rounded-xl bg-white/10 text-white grid place-items-center">{cameraOff?<VideoOff/>:<Video/>}</button><button onClick={hangup} className="h-11 px-5 rounded-xl bg-red-600 text-white"><PhoneOff className="inline w-4 h-4 mr-2"/>End</button></div></div>}
    {error&&<div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 rounded-2xl border border-destructive/30 bg-card px-4 py-3 shadow-2xl"><span className="text-sm text-destructive">{error}</span><button onClick={()=>setError("")} className="p-1"><X className="w-4 h-4"/></button></div>}</>;
}
