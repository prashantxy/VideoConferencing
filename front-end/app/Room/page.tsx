"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  ArrowLeft, MessageSquare, Mic, MicOff, RefreshCw, Send, SkipForward, Square, Video, VideoOff, Volume2, X,
} from "lucide-react";
import { Button, Logo } from "@/components/ui";
import { API_URL, session, useOnlineCount } from "@/lib/api";
import { mediaErrorText, useLocalMedia } from "@/lib/media";

type Phase = "connecting" | "searching" | "matched" | "stopped";

interface Message {
  id: number;
  from: "me" | "them" | "system";
  text: string;
}

const iceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
// A TURN server is needed for users behind strict NATs; configure one via env.
if (process.env.NEXT_PUBLIC_TURN_URL) {
  iceServers.push({
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME,
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
  });
}

let messageId = 0;

function formatClock(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RoomPage() {
  const router = useRouter();
  const polledOnline = useOnlineCount();
  const [liveOnline, setLiveOnline] = useState<number | null>(null);
  const online = liveOnline ?? polledOnline;
  const [prefs] = useState(() => (typeof window === "undefined" ? null : session.chatPrefs()));
  const media = useLocalMedia({ audio: prefs?.hasAudio ?? true, video: prefs?.hasVideo ?? true });

  const [phase, setPhase] = useState<Phase>("connecting");
  const [partner, setPartner] = useState<string | null>(null);
  const [peerState, setPeerState] = useState<RTCPeerConnectionState>("new");
  const [partnerMedia, setPartnerMedia] = useState({ audio: true, video: true });
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const [mounted, setMounted] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<string | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const stoppedRef = useRef(false);
  const partnerRef = useRef<string | null>(null);
  const leftNotice = useRef<string | null>(null);
  const mediaStateRef = useRef({ audio: media.audioOn, video: media.videoOn });
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const displayName = prefs?.name || session.user()?.name || "Guest";

  // No session or no lobby prefs → go through the dashboard first.
  useEffect(() => {
    if (!session.token()) router.replace("/Authpage");
    else if (!prefs) router.replace("/Dashboard");
  }, [prefs, router]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = media.stream;
  }, [media.stream, mounted]);

  const addMessage = useCallback((from: Message["from"], text: string) => {
    setMessages((m) => [...m, { id: ++messageId, from, text }]);
  }, []);

  // Signaling: one socket and at most one peer connection at a time.
  useEffect(() => {
    const stream = media.stream;
    const token = session.token();
    if (!stream || !token || !prefs) return;

    const closePeer = () => {
      pcRef.current?.close();
      pcRef.current = null;
      roomRef.current = null;
      pendingIce.current = [];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setPeerState("new");
      setPartner(null);
      setPartnerTyping(false);
      setPartnerMedia({ audio: true, video: true });
    };

    const createPeer = (roomId: string) => {
      const pc = new RTCPeerConnection({ iceServers });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        const video = remoteVideoRef.current;
        if (!video || video.srcObject === e.streams[0]) return;
        video.srcObject = e.streams[0];
        video.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("add-ice-candidate", { roomId, candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pcRef.current === pc) setPeerState(pc.connectionState);
      };

      pcRef.current = pc;
      return pc;
    };

    const flushIce = async (pc: RTCPeerConnection) => {
      const queued = pendingIce.current;
      pendingIce.current = [];
      for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
    };

    const socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!stoppedRef.current) socket.emit("ready", { name: displayName });
    });

    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized") {
        session.clear();
        router.replace("/Authpage");
      }
    });

    socket.on("disconnect", () => {
      closePeer();
      if (!stoppedRef.current) setPhase("connecting");
    });

    socket.on("lobby", () => {
      closePeer();
      setPhase("searching");
    });

    socket.on("matched", ({ roomId, partner }: { roomId: string; partner: { name: string } }) => {
      closePeer();
      roomRef.current = roomId;
      createPeer(roomId);
      partnerRef.current = partner.name;
      setPartner(partner.name);
      setPhase("matched");
      // Start a fresh transcript, but keep "X moved on" so an instant rematch isn't confusing.
      const notice = leftNotice.current;
      leftNotice.current = null;
      setMessages([
        ...(notice ? [{ id: ++messageId, from: "system" as const, text: notice }] : []),
        { id: ++messageId, from: "system", text: `You're now talking to ${partner.name}. Say hi!` },
      ]);
      socket.emit("media-state", { roomId, ...mediaStateRef.current });
    });

    socket.on("send-offer", async ({ roomId }: { roomId: string }) => {
      const pc = pcRef.current;
      if (!pc || roomRef.current !== roomId) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId, sdp: pc.localDescription });
    });

    socket.on("offer", async ({ roomId, sdp }: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc || roomRef.current !== roomId) return;
      await pc.setRemoteDescription(sdp);
      await flushIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId, sdp: pc.localDescription });
    });

    socket.on("answer", async ({ roomId, sdp }: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc || roomRef.current !== roomId || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(sdp);
      await flushIce(pc);
    });

    socket.on("add-ice-candidate", ({ roomId, candidate }: { roomId: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc || roomRef.current !== roomId) return;
      if (pc.remoteDescription) pc.addIceCandidate(candidate).catch(() => {});
      else pendingIce.current.push(candidate);
    });

    socket.on("media-state", ({ audio, video }: { audio: boolean; video: boolean }) => {
      setPartnerMedia({ audio, video });
    });

    socket.on("chat-message", ({ text }: { text: string }) => {
      setPartnerTyping(false);
      addMessage("them", text);
    });

    socket.on("typing", ({ typing }: { typing: boolean }) => setPartnerTyping(typing));

    socket.on("online-count", (count: number) => setLiveOnline(count));

    socket.on("partner-left", ({ reason }: { reason: string }) => {
      const who = partnerRef.current ?? "Your partner";
      leftNotice.current = reason === "skipped" ? `${who} moved on.` : `${who} left.`;
      addMessage("system", leftNotice.current);
      closePeer();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      closePeer();
    };
     
  }, [media.stream, prefs, router, addMessage]);

  // Tell the partner when we mute or turn the camera off.
  useEffect(() => {
    mediaStateRef.current = { audio: media.audioOn, video: media.videoOn };
    if (roomRef.current) socketRef.current?.emit("media-state", { roomId: roomRef.current, ...mediaStateRef.current });
  }, [media.audioOn, media.videoOn]);

  // Call timer, counted from when media actually starts flowing.
  useEffect(() => {
    if (peerState !== "connected") {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [peerState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partnerTyping]);

  const next = useCallback(() => {
    stoppedRef.current = false;
    const socket = socketRef.current;
    if (!socket?.connected) return;
    leftNotice.current = null;
    if (roomRef.current) socket.emit("next");
    else socket.emit("ready", { name: displayName });
    setPhase("searching");
  }, [displayName]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    socketRef.current?.emit("leave");
    setPhase("stopped");
    setPartner(null);
    setPeerState("new");
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pcRef.current?.close();
    pcRef.current = null;
    roomRef.current = null;
  }, []);

  // Esc skips, M mutes, V toggles the camera, unless you're typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.key === "Escape") {
        if (typing) (e.target as HTMLElement).blur();
        else if (phase !== "connecting") next();
      } else if (!typing && e.key.toLowerCase() === "m") media.toggleAudio();
      else if (!typing && e.key.toLowerCase() === "v") media.toggleVideo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, phase, media]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !roomRef.current) return;
    socketRef.current?.emit("chat-message", { roomId: roomRef.current, text });
    socketRef.current?.emit("typing", { roomId: roomRef.current, typing: false });
    addMessage("me", text);
    setDraft("");
  };

  const onDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    if (!roomRef.current) return;
    socketRef.current?.emit("typing", { roomId: roomRef.current, typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (roomRef.current) socketRef.current?.emit("typing", { roomId: roomRef.current, typing: false });
    }, 1500);
  };

  const unmuteRemote = () => {
    remoteVideoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {});
  };

  // Everything below depends on localStorage, so skip the server render.
  if (!mounted) return null;

  if (media.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <VideoOff className="h-10 w-10 text-danger" />
        <h1 className="font-serif text-4xl">Camera unavailable</h1>
        <p className="max-w-md text-muted">{mediaErrorText[media.error]}</p>
        <div className="flex gap-3">
          <Button onClick={media.retry}><RefreshCw className="h-4 w-4" /> Try again</Button>
          <Button variant="ghost" onClick={() => router.push("/Dashboard")}>Back</Button>
        </div>
      </div>
    );
  }

  const connected = phase === "matched" && peerState === "connected";
  const statusText =
    phase === "connecting" ? "Connecting" :
    phase === "searching" ? "Searching" :
    phase === "stopped" ? "Paused" :
    peerState === "connected" ? "Live" :
    peerState === "failed" ? "Connection failed" :
    peerState === "disconnected" ? "Reconnecting" : "Connecting to peer";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/Dashboard")} aria-label="Back to dashboard" className="text-muted hover:text-cream">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="hidden sm:block"><Logo /></span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`label inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${connected ? "border-signal/40 text-signal" : "border-line"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-signal blink" : peerState === "failed" ? "bg-danger" : "bg-muted"}`} />
            {statusText}
            {connected && <span className="text-cream">{formatClock(elapsed)}</span>}
          </span>
          <span className="label hidden md:inline">{online ?? "–"} online</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Stage */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative m-3 flex-1 overflow-hidden rounded-3xl border border-line bg-ink-2 sm:m-4">
            <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-cover transition-opacity duration-500 ${connected && partnerMedia.video ? "opacity-100" : "opacity-0"}`} />

            {/* Partner is here but their camera is off */}
            {connected && !partnerMedia.video && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <span className="flex h-32 w-32 items-center justify-center rounded-full bg-ink-3 font-serif text-6xl italic">
                  {partner?.[0]?.toUpperCase()}
                </span>
                <span className="label">Camera off</span>
              </div>
            )}

            {/* Searching / connecting */}
            {(phase === "searching" || phase === "connecting" || (phase === "matched" && !connected)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6 text-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <span className="ring absolute inset-0 rounded-full border border-signal/70" />
                  <span className="ring absolute inset-0 rounded-full border border-signal/70" style={{ animationDelay: "0.8s" }} />
                  <span className="ring absolute inset-0 rounded-full border border-signal/70" style={{ animationDelay: "1.6s" }} />
                  <span className="h-3 w-3 rounded-full bg-signal" />
                </div>
                <div>
                  <h2 className="font-serif text-4xl sm:text-5xl">
                    {phase === "connecting" && <>Getting <em className="text-signal">ready…</em></>}
                    {phase === "searching" && <>Looking for <em className="text-signal">someone…</em></>}
                    {phase === "matched" && peerState !== "failed" && <>Saying hi to <em className="text-signal">{partner}…</em></>}
                    {phase === "matched" && peerState === "failed" && <>Couldn&apos;t reach <em className="text-signal">{partner}.</em></>}
                  </h2>
                  <p className="mt-3 text-sm text-muted">
                    {phase === "matched" && peerState === "failed"
                      ? "Their network may be blocking direct connections. Try someone else."
                      : phase === "searching" && online !== null && online <= 1
                        ? "It's quiet right now. Invite a friend, or hang tight."
                        : "This usually takes a second or two."}
                  </p>
                </div>
              </div>
            )}

            {phase === "stopped" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 text-center">
                <h2 className="font-serif text-5xl">Taking a <em className="text-signal">breather.</em></h2>
                <p className="text-muted">You&apos;re out of the queue. Nobody can see you.</p>
                <div className="flex gap-3">
                  <Button size="lg" onClick={next}>Find someone</Button>
                  <Button size="lg" variant="ghost" onClick={() => router.push("/Dashboard")}>Dashboard</Button>
                </div>
              </div>
            )}

            {/* Partner name tag */}
            {phase === "matched" && partner && (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 backdrop-blur">
                <span className="font-serif text-xl italic">{partner}</span>
                {!partnerMedia.audio && <MicOff className="h-4 w-4 text-danger" aria-label="Partner is muted" />}
              </div>
            )}

            {needsTap && connected && (
              <button onClick={unmuteRemote} className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-ink">
                <Volume2 className="h-4 w-4" /> Tap to hear
              </button>
            )}

            {/* Self view */}
            <div className="absolute bottom-4 right-4 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-line-strong bg-ink-3 shadow-2xl sm:w-40 md:aspect-video md:w-56">
              <video ref={localVideoRef} autoPlay playsInline muted className={`mirror h-full w-full object-cover ${media.videoOn ? "" : "invisible"}`} />
              {!media.videoOn && (
                <div className="absolute inset-0 flex items-center justify-center font-serif text-3xl italic">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
              <span className="label absolute bottom-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 text-[0.6rem]">You</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center justify-center gap-2 px-4 pb-4 sm:gap-3">
            <IconToggle on={media.audioOn} onClick={media.toggleAudio} labelOn="Mute (M)" labelOff="Unmute (M)" iconOn={Mic} iconOff={MicOff} />
            <IconToggle on={media.videoOn} onClick={media.toggleVideo} labelOn="Camera off (V)" labelOff="Camera on (V)" iconOn={Video} iconOff={VideoOff} />
            <Button size="lg" onClick={next} disabled={phase === "connecting"} className="min-w-36">
              <SkipForward className="h-5 w-5" /> {phase === "stopped" ? "Start" : "Next"}
              <kbd className="ml-1 hidden rounded border border-ink/30 px-1.5 font-mono text-[0.65rem] sm:inline">Esc</kbd>
            </Button>
            {phase !== "stopped" && (
              <button onClick={stop} aria-label="Stop" title="Stop" className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger transition-colors hover:bg-danger hover:text-ink">
                <Square className="h-5 w-5" fill="currentColor" />
              </button>
            )}
            <button
              onClick={() => setChatOpen(true)}
              aria-label="Open chat"
              className="relative flex h-14 w-14 items-center justify-center rounded-full border border-line-strong hover:border-cream lg:hidden"
            >
              <MessageSquare className="h-5 w-5" />
              {messages.some((m) => m.from === "them") && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-signal" />}
            </button>
          </div>
        </main>

        {/* Chat */}
        <aside
          className={`fixed inset-0 z-40 flex flex-col bg-ink transition-transform duration-300 lg:static lg:z-auto lg:w-[360px] lg:translate-x-0 lg:border-l lg:border-line ${chatOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
            <span className="label">Chat {partner && <>with <span className="text-cream">{partner}</span></>}</span>
            <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-muted hover:text-cream lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="pt-10 text-center font-serif text-2xl italic text-muted">Messages will show up here.</p>
            )}
            {messages.map((m) =>
              m.from === "system" ? (
                <p key={m.id} className="label py-2 text-center">{m.text}</p>
              ) : (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <p
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.from === "me" ? "rounded-br-md bg-signal text-ink" : "rounded-bl-md bg-ink-3 text-cream"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ),
            )}
            {partnerTyping && (
              <p className="label blink">{partner} is typing…</p>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="flex shrink-0 gap-2 border-t border-line p-4">
            <input
              value={draft}
              onChange={onDraftChange}
              maxLength={500}
              disabled={phase !== "matched"}
              placeholder={phase === "matched" ? "Type a message…" : "Waiting for a partner…"}
              aria-label="Message"
              className="h-12 min-w-0 flex-1 rounded-full border border-line bg-ink-2 px-5 text-sm placeholder:text-muted/60 focus:border-signal focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!draft.trim() || phase !== "matched"}
              aria-label="Send"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-signal text-ink transition-colors hover:bg-cream disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function IconToggle({
  on, onClick, labelOn, labelOff, iconOn: IconOn, iconOff: IconOff,
}: {
  on: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
  iconOn: React.ElementType;
  iconOff: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={on ? labelOn : labelOff}
      title={on ? labelOn : labelOff}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${on ? "border border-line-strong hover:border-cream" : "bg-danger text-ink"}`}
    >
      {on ? <IconOn className="h-5 w-5" /> : <IconOff className="h-5 w-5" />}
    </button>
  );
}
