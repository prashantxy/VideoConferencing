"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  ArrowUp, ChevronLeft, MessageCircle, Mic, MicOff, PhoneOff, RefreshCw, SkipForward, Video, VideoOff, Volume2, X,
} from "lucide-react";
import { Avatar, Button, OnlinePill } from "@/components/ui";
import { Insets, SelfView } from "@/components/SelfView";
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
  const [wide, setWide] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);

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
  const chatListRef = useRef<HTMLDivElement>(null);

  const displayName = prefs?.name || session.user()?.name || "Guest";

  // No session or no lobby prefs → go through the dashboard first.
  useEffect(() => {
    if (!session.token()) router.replace("/Authpage");
    else if (!prefs) router.replace("/Dashboard");
  }, [prefs, router]);

  useEffect(() => {
    setMounted(true);
    // Chat sits beside the video on wide screens and starts open there.
    const mq = window.matchMedia("(min-width: 1024px)");
    setWide(mq.matches);
    setChatOpen(mq.matches);
    const onChange = () => {
      setWide(mq.matches);
      // On narrow screens chat covers the video, so don't carry an open panel over.
      if (!mq.matches) setChatOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

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
      if (!chatOpenRef.current) setUnread((n) => n + 1);
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
    // Scroll only the list; scrollIntoView would also scroll the page toward a hidden panel.
    const list = chatListRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
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
        else if (chatOpen && !wide) setChatOpen(false);
        else if (phase !== "connecting") next();
      } else if (!typing && e.key.toLowerCase() === "m") media.toggleAudio();
      else if (!typing && e.key.toLowerCase() === "v") media.toggleVideo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, phase, media, chatOpen, wide]);

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

  // Keep the self view clear of the top bar, the controls and an open chat panel.
  const selfInsets = useMemo<Insets>(
    () => ({ top: 76, bottom: 108, left: 16, right: chatOpen && wide ? 396 : 16 }),
    [chatOpen, wide],
  );

  const unmuteRemote = () => {
    remoteVideoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {});
  };

  // Everything below depends on localStorage, so skip the server render.
  if (!mounted) return null;

  if (media.error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="wallpaper" />
        <main className="glass-thick materialize flex max-w-md flex-col items-center rounded-[32px] p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fill">
            <VideoOff className="h-7 w-7 text-label-2" />
          </span>
          <h1 className="large-title mt-5 text-[28px]">Camera unavailable</h1>
          <p className="mt-2 text-pretty text-[15px] text-label-2">{mediaErrorText[media.error]}</p>
          <div className="mt-7 flex gap-3">
            <Button onClick={media.retry}><RefreshCw className="h-4 w-4" /> Try Again</Button>
            <Button variant="gray" onClick={() => router.push("/Dashboard")}>Back</Button>
          </div>
        </main>
      </div>
    );
  }

  const connected = phase === "matched" && peerState === "connected";
  const failed = phase === "matched" && peerState === "failed";
  const statusText =
    phase === "connecting" ? "Connecting…" :
    phase === "searching" ? "Looking for someone…" :
    phase === "stopped" ? "Not in chat" :
    peerState === "connected" ? "Connected" :
    failed ? "Couldn’t connect" :
    peerState === "disconnected" ? "Reconnecting…" : "Connecting…";
  const sidePad = chatOpen && wide ? 384 : 0;

  return (
    <div className="theme-dark fixed inset-0 overflow-clip bg-black text-label">
      <p className="sr-only-live" role="status">{partner ? `${statusText} ${partner}` : statusText}</p>

      {/* Stage */}
      <div className="absolute inset-0">
        {/* Your own camera, blurred, is the backdrop until someone connects. */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          className={`mirror absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.42] transition-opacity duration-700 ${!connected && media.videoOn ? "opacity-100" : "opacity-0"}`}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${connected && partnerMedia.video ? "opacity-100" : "opacity-0"}`}
        />

        {connected && !partnerMedia.video && partner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#141416] to-black" style={{ paddingRight: sidePad }}>
            <Avatar name={partner} size={128} />
            <p className="text-[22px] font-semibold">{partner}</p>
            <p className="-mt-3 text-[15px] text-label-2">Camera off</p>
          </div>
        )}

        {!connected && phase !== "stopped" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-6 text-center" style={{ paddingRight: sidePad }}>
            <div className="relative flex h-28 w-28 items-center justify-center">
              {!failed && (
                <>
                  <span className="pulse-ring absolute inset-0 rounded-full bg-white/10" />
                  <span className="pulse-ring absolute inset-0 rounded-full bg-white/10" style={{ animationDelay: "1s" }} />
                </>
              )}
              {phase === "matched" && partner ? (
                <Avatar name={partner} size={112} className="relative" />
              ) : (
                <span className="glass-chip relative flex h-28 w-28 items-center justify-center rounded-full">
                  <Video className="h-10 w-10" fill="currentColor" />
                </span>
              )}
            </div>
            <div className="max-w-sm">
              <h1 className="large-title text-[28px] sm:text-[34px]">
                {phase === "matched" && partner ? (failed ? `Couldn’t reach ${partner}` : `Connecting to ${partner}…`) : statusText}
              </h1>
              <p className="mt-2 text-pretty text-[15px] text-label-2">
                {failed
                  ? "Their network may be blocking direct connections."
                  : phase === "searching" && online !== null && online <= 1
                    ? "It’s quiet right now. Invite a friend or hang tight."
                    : "This usually takes a second or two."}
              </p>
            </div>
            {failed && <Button onClick={next}>Try Someone Else</Button>}
          </div>
        )}

        {phase === "stopped" && (
          <div className="absolute inset-0 flex items-center justify-center px-4" style={{ paddingRight: sidePad }}>
            <div className="glass-thick materialize flex max-w-sm flex-col items-center rounded-[32px] p-8 text-center">
              <h1 className="large-title text-[28px]">You’ve left the chat</h1>
              <p className="mt-2 text-[15px] text-label-2">You’re out of the queue. Nobody can see you.</p>
              <div className="mt-7 flex w-full flex-col gap-3">
                <Button size="lg" onClick={next}>Find Someone</Button>
                <Button size="lg" variant="gray" onClick={() => router.push("/Dashboard")}>Back to Dashboard</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 *:pointer-events-auto">
        <SelfView stream={media.stream} videoOn={media.videoOn} name={displayName} insets={selfInsets} />
      </div>

      {/* Top bar */}
      <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => router.push("/Dashboard")}
            aria-label="Leave and go to dashboard"
            className="pressable glass-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          {phase === "matched" && partner && (
            <div className="glass-chip flex h-11 min-w-0 items-center gap-2.5 rounded-full ps-1.5 pe-4">
              <Avatar name={partner} size={32} />
              <span className="truncate text-[15px] font-semibold">{partner}</span>
              {!partnerMedia.audio && <MicOff className="h-4 w-4 shrink-0 text-red" aria-label={`${partner} is muted`} />}
              <span className="tabular flex shrink-0 items-center gap-1.5 text-[13px] text-label-2">
                {connected && <span className="live-dot h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />}
                {connected ? formatClock(elapsed) : statusText}
              </span>
            </div>
          )}
        </div>
        <OnlinePill count={online} className="glass-chip hidden h-11 px-4 sm:inline-flex" />
      </header>

      {needsTap && connected && (
        <div className="absolute inset-x-0 bottom-28 z-20 flex justify-center" style={{ paddingRight: sidePad }}>
          <Button variant="glass" onClick={unmuteRemote}><Volume2 className="h-4 w-4" /> Tap to Hear {partner}</Button>
        </div>
      )}

      {/* Controls: 8px inset in a 64px capsule keeps the radii concentric. */}
      <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 z-20 flex justify-center px-3" style={{ right: sidePad }}>
        <div className="glass-chip flex items-center gap-1.5 rounded-full p-1.5 sm:gap-2 sm:p-2">
          <RoundToggle on={media.audioOn} onClick={media.toggleAudio} labelOn="Mute" labelOff="Unmute" shortcut="M" iconOn={Mic} iconOff={MicOff} />
          <RoundToggle on={media.videoOn} onClick={media.toggleVideo} labelOn="Turn camera off" labelOff="Turn camera on" shortcut="V" iconOn={Video} iconOff={VideoOff} />
          <button
            onClick={() => setChatOpen((o) => !o)}
            aria-label={chatOpen ? "Hide messages" : unread ? `Show messages, ${unread} unread` : "Show messages"}
            aria-pressed={chatOpen}
            title="Messages"
            className={`pressable relative flex size-11 items-center justify-center rounded-full sm:size-12 ${chatOpen ? "bg-accent text-on-accent" : "bg-fill hover:bg-fill-hover"}`}
          >
            <MessageCircle className="h-5 w-5" />
            {unread > 0 && (
              <span className="tabular absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 text-[11px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={next}
            disabled={phase === "connecting"}
            title="Next person (Esc)"
            className="pressable flex h-11 items-center gap-2 rounded-full bg-accent ps-4 pe-5 text-[17px] font-semibold text-on-accent hover:bg-white disabled:opacity-40 sm:h-12 sm:ps-5 sm:pe-6"
          >
            <SkipForward className="h-5 w-5" fill="currentColor" />
            {phase === "stopped" ? "Start" : "Next"}
          </button>
          {phase !== "stopped" && (
            <button
              onClick={stop}
              aria-label="Stop chatting"
              title="Stop chatting"
              className="pressable flex size-11 items-center justify-center rounded-full bg-red text-white hover:brightness-110 sm:size-12"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages: a parallel panel, so translucent and without a scrim. Enters and exits on the right. */}
      <aside
        aria-label="Messages"
        inert={!chatOpen}
        className={`glass-thick absolute inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] top-[calc(68px+env(safe-area-inset-top))] z-30 flex flex-col rounded-[28px] transition-[transform,opacity] duration-[350ms] ease-[var(--ease-drawer)] lg:inset-x-auto lg:bottom-3 lg:right-3 lg:w-[372px] motion-reduce:transition-opacity ${
          chatOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+24px)] opacity-0 motion-reduce:translate-x-0"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-separator ps-5 pe-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">Messages</h2>
            <p className="truncate text-[13px] text-label-2">{partner ? `with ${partner}` : "No one connected"}</p>
          </div>
          <button
            onClick={() => setChatOpen(false)}
            aria-label="Hide messages"
            className="pressable flex h-11 w-11 items-center justify-center rounded-full text-label-2 hover:bg-fill"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={chatListRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <p className="pt-16 text-center text-[15px] text-label-3">Messages you send will appear here.</p>
          )}
          {messages.map((m) =>
            m.from === "system" ? (
              <p key={m.id} className="bubble py-2 text-center text-[12px] font-medium text-label-3">{m.text}</p>
            ) : (
              <div key={m.id} className={`bubble flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[15px] leading-snug ${
                    m.from === "me" ? "rounded-br-[6px] bg-accent text-on-accent" : "rounded-bl-[6px] bg-fill text-label"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ),
          )}
          {partnerTyping && (
            <div className="bubble flex justify-start" aria-label={`${partner} is typing`}>
              <span className="flex gap-1 rounded-[18px] rounded-bl-[6px] bg-fill px-3.5 py-3">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="live-dot h-1.5 w-1.5 rounded-full bg-label-2" style={{ animationDelay: `${d}ms`, animationDuration: "1s" }} />
                ))}
              </span>
            </div>
          )}
        </div>

        {/* 6px inset around a 44px field: 28 outer radius ≈ 22 + 6. */}
        <form onSubmit={sendMessage} className="shrink-0 p-3">
          <div className="flex items-center gap-1.5 rounded-full bg-field p-1.5 ps-4">
            <input
              value={draft}
              onChange={onDraftChange}
              maxLength={500}
              disabled={phase !== "matched"}
              placeholder={phase === "matched" ? "Message" : "Waiting for someone…"}
              aria-label="Message"
              className="h-9 min-w-0 flex-1 bg-transparent text-base placeholder:text-label-3 focus:outline-none disabled:opacity-60 sm:text-[15px]"
            />
            <button
              type="submit"
              disabled={!draft.trim() || phase !== "matched"}
              aria-label="Send"
              className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:bg-fill disabled:text-label-3"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function RoundToggle({
  on, onClick, labelOn, labelOff, shortcut, iconOn: IconOn, iconOff: IconOff,
}: {
  on: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
  shortcut: string;
  iconOn: React.ElementType;
  iconOff: React.ElementType;
}) {
  const label = on ? labelOn : labelOff;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={!on}
      aria-keyshortcuts={shortcut}
      title={`${label} (${shortcut})`}
      className={`pressable flex size-11 items-center justify-center rounded-full sm:size-12 ${on ? "bg-fill hover:bg-fill-hover" : "bg-accent text-on-accent"}`}
    >
      {on ? <IconOn className="h-5 w-5" /> : <IconOff className="h-5 w-5" />}
    </button>
  );
}
