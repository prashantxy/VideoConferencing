"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Camera, Mic, MicOff, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const URL = process.env.NEXT_PUBLIC_API_URL;

export default function Room() {
  const router = useRouter();
  const [lobby, setLobby] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sendingPc, setSendingPc] = useState<RTCPeerConnection | null>(null);
  const [receivingPc, setReceivingPc] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const chatData = typeof window !== "undefined" ? localStorage.getItem("chatData") : null;
  const parsedData = chatData ? JSON.parse(chatData) : { name: "Guest" };

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!localStream) return;

    const s = io(URL, {
      transports: ["websocket"],
    });

    setSocket(s);

    s.on("connect", () => {
      console.log("Connected with socket id:", s.id);
    });

    s.on("send-offer", async ({ roomId }) => {
      setLobby(false);
      const pc = new RTCPeerConnection();
      setSendingPc(pc);

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          s.emit("add-ice-candidate", { candidate: e.candidate, type: "sender", roomId });
        }
      };

      pc.onnegotiationneeded = async () => {
        const sdp = await pc.createOffer();
        await pc.setLocalDescription(sdp);
        s.emit("offer", { sdp, roomId });
      };
    });

    s.on("offer", async ({ roomId, sdp: remoteSdp }) => {
      setLobby(false);
      const pc = new RTCPeerConnection();
      await pc.setRemoteDescription(remoteSdp);

      const sdp = await pc.createAnswer();
      await pc.setLocalDescription(sdp);
      setReceivingPc(pc);

      const stream = new MediaStream();
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }

      pc.ontrack = (e) => {
        stream.addTrack(e.track);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          s.emit("add-ice-candidate", { candidate: e.candidate, type: "receiver", roomId });
        }
      };

      s.emit("answer", { roomId, sdp });
    });

    s.on("answer", ({ sdp: remoteSdp }) => {
      setLobby(false);
      setSendingPc((pc) => {
        pc?.setRemoteDescription(remoteSdp);
        return pc;
      });
    });

    s.on("add-ice-candidate", ({ candidate, type }) => {
      if (type === "sender") {
        setReceivingPc((pc) => {
          pc?.addIceCandidate(candidate);
          return pc;
        });
      } else {
        setSendingPc((pc) => {
          pc?.addIceCandidate(candidate);
          return pc;
        });
      }
    });

    return () => {
      s.disconnect();
    };
  }, [localStream]);

  // toggle camera
  const toggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraEnabled(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
    }
  };

  const handleExit = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    socket?.disconnect();
    router.push("/Dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6 flex flex-col items-center">
      <div className="flex justify-between w-full max-w-5xl mb-6">
        <h1 className="text-3xl font-bold text-white">
          Room – <span className="text-purple-300">{parsedData.name}</span>
        </h1>
        <button
          onClick={handleExit}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition"
        >
          <LogOut className="w-4 h-4" /> Exit
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-5xl">
        {/* Local Video */}
        <div className="relative bg-black rounded-xl overflow-hidden border border-white/20 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover"
          />
          <div className="absolute bottom-4 left-4 flex gap-2">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full transition-all ${
                micEnabled ? "bg-green-500/80 hover:bg-green-500" : "bg-red-500/80 hover:bg-red-500"
              }`}
            >
              {micEnabled ? (
                <Mic className="w-5 h-5 text-white" />
              ) : (
                <MicOff className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-full transition-all ${
                cameraEnabled ? "bg-green-500/80 hover:bg-green-500" : "bg-red-500/80 hover:bg-red-500"
              }`}
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative bg-black rounded-xl overflow-hidden border border-white/20 shadow-lg">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full aspect-video object-cover"
          />
          {lobby && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-xl">
              Waiting for someone to join...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
