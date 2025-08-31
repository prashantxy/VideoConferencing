"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

const URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function RoomPage() {
  const router = useRouter();
  const [lobby, setLobby] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sendingPc, setSendingPc] = useState<RTCPeerConnection | null>(null);
  const [receivingPc, setReceivingPc] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<string>("initializing");
  const [roomId, setRoomId] = useState<string>("");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnecting = useRef(false);
  const senderCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const receiverCandidateQueue = useRef<RTCIceCandidate[]>([]);

  // Debug logging function
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setDebugLogs(prev => [...prev.slice(-9), logEntry]); // Keep last 10 logs
  }, []);

  // Get user name from localStorage
  const chatData = typeof window !== "undefined" ? localStorage.getItem("chatData") : null;
  const parsedData = chatData ? JSON.parse(chatData) : { name: "Guest" };
  const name = parsedData.name;

  // Global error handling
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      addDebugLog(`🚨 Global error: ${error.message}`);
      console.error('🚨 Global error details:', error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addDebugLog(`🚨 Unhandled rejection: ${event.reason}`);
      console.error('🚨 Unhandled promise rejection details:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [addDebugLog]);

  // Initialize local media ONCE
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        addDebugLog("Requesting media access...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: true 
        });
        
        if (!mounted) {
          addDebugLog("Component unmounted, skipping stream setup");
          return;
        }
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch((err) => {
            addDebugLog(`⚠️ Local video play error: ${err.message}`);
          });
        }
        addDebugLog("✅ Local stream initialized successfully");
        setConnectionState("ready");
      } catch (error) {
        addDebugLog(`❌ Media access error: ${error}`);
        setConnectionState("media_error");
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [addDebugLog]);

  // Helper function to create peer connection with common configuration
  const createPeerConnection = useCallback((type: "sender" | "receiver") => {
    try {
      addDebugLog(`📡 Creating ${type} peer connection`);
      
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" }
        ],
        iceCandidatePoolSize: 10
      });

      // Add connection state monitoring
      pc.onconnectionstatechange = () => {
        addDebugLog(`📡 ${type} PC connection state: ${pc.connectionState}`);
        if (pc.connectionState === "connected") {
          setConnectionState("connected");
        } else if (pc.connectionState === "failed") {
          addDebugLog(`❌ ${type} connection failed, restarting ICE`);
          setConnectionState("reconnecting");
          pc.restartIce();
        } else if (pc.connectionState === "disconnected") {
          setConnectionState("disconnected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        addDebugLog(`🧊 ${type} PC ICE state: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setConnectionState("connected");
        } else if (pc.iceConnectionState === "failed") {
          addDebugLog(`❌ ${type} ICE connection failed`);
          setConnectionState("connection_failed");
        }
      };

      pc.onsignalingstatechange = () => {
        addDebugLog(`📋 ${type} PC signaling state: ${pc.signalingState}`);
      };

      pc.onicegatheringstatechange = () => {
        addDebugLog(`🧊 ${type} PC ICE gathering state: ${pc.iceGatheringState}`);
      };

      // Add error handling
     

      // Add local tracks if available
      if (localStream) {
        try {
          localStream.getTracks().forEach((track) => {
            addDebugLog(`➕ Adding ${track.kind} track to ${type} PC`);
            pc.addTrack(track, localStream);
          });
        } catch (error) {
          addDebugLog(`❌ Error adding tracks to ${type} PC: ${error}`);
          throw error; // Re-throw to prevent connection setup
        }
      } else {
        addDebugLog(`⚠️ No local stream available when creating ${type} PC`);
        throw new Error("No local stream available");
      }

      addDebugLog(`✅ ${type} PC created successfully`);
      return pc;
    } catch (error) {
      addDebugLog(`❌ Failed to create ${type} PC: ${error}`);
      throw error;
    }
  }, [localStream, addDebugLog]);

  // Process queued ICE candidates
  const processQueuedCandidates = useCallback(async (pc: RTCPeerConnection, queue: RTCIceCandidate[], type: string) => {
    if (queue.length === 0) return;
    
    addDebugLog(`🔄 Processing ${queue.length} queued ICE candidates for ${type}`);
    
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
        addDebugLog(`✅ Added queued ICE candidate for ${type}`);
      } catch (error) {
        addDebugLog(`❌ Error adding queued ICE candidate for ${type}: ${error}`);
      }
    }
    
    // Clear the queue
    queue.length = 0;
    addDebugLog(`🧹 Cleared ${type} candidate queue`);
  }, [addDebugLog]);

  // Initialize socket connection ONCE when localStream is ready
  useEffect(() => {
    if (!localStream || socketRef.current || isConnecting.current) {
      return;
    }

    isConnecting.current = true;
    addDebugLog("🚀 Initializing socket connection...");
    
    const s = io(URL, { 
      transports: ["websocket"],
      forceNew: true,
      timeout: 10000 // Add timeout
    });
    
    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => {
      addDebugLog(`✅ Connected with socket id: ${s.id}`);
      setConnectionState("waiting_for_partner");
      
      // Add error handling for the ready event
      try {
        s.emit("ready", name);
        addDebugLog(`📢 Sent ready signal with name: ${name}`);
      } catch (error) {
        addDebugLog(`❌ Error sending ready signal: ${error}`);
      }
    });

    s.on("connect_error", (error) => {
      addDebugLog(`❌ Socket connection error: ${error}`);
      setConnectionState("connection_error");
    });

    s.on("disconnect", (reason) => {
      addDebugLog(`🔌 Socket disconnected. Reason: ${reason}`);
      setConnectionState("disconnected");
    });

    s.on("lobby", () => {
      addDebugLog("🏠 Moved back to lobby");
      setLobby(true);
      setConnectionState("waiting_for_partner");
      setRoomId("");
      
      // Clear queues
      senderCandidateQueue.current = [];
      receiverCandidateQueue.current = [];
      
      // Clean up existing connections
      if (sendingPc) {
        addDebugLog("🧹 Closing sender PC");
        sendingPc.close();
        setSendingPc(null);
      }
      if (receivingPc) {
        addDebugLog("🧹 Closing receiver PC");
        receivingPc.close();
        setReceivingPc(null);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    // CRITICAL: Wrap send-offer in try-catch to prevent crashes
    s.on("send-offer", async ({ roomId: incomingRoomId }) => {
      addDebugLog(`🚀 Received send-offer for room: ${incomingRoomId}`);
      
      try {
        addDebugLog("🔄 Starting send-offer processing...");
        
        setLobby(false);
        setRoomId(incomingRoomId);
        setConnectionState("creating_offer");
        
        // Ensure we have local stream
        if (!localStream) {
          addDebugLog("❌ No local stream available for offer creation");
          return;
        }
        
        addDebugLog("✅ Local stream available, proceeding...");
        
        // Clean up any existing sending PC
        if (sendingPc) {
          addDebugLog("🧹 Cleaning up existing sender PC");
          sendingPc.close();
          setSendingPc(null);
        }
        
        addDebugLog("📡 About to create new sender peer connection...");
        
        // Create peer connection with extra error handling
        let pc: RTCPeerConnection;
        try {
          pc = createPeerConnection("sender");
          addDebugLog("✅ Sender PC created successfully");
        } catch (pcError) {
          addDebugLog(`❌ Failed to create sender PC: ${pcError}`);
          setConnectionState("pc_creation_error");
          return;
        }
        
        // Set up remote stream handling
        const remoteStream = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        pc.ontrack = (e) => {
          addDebugLog(`📺 Received remote track on sender PC: ${e.track.kind}`);
          e.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
          
          // Auto-play remote video
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().catch((playError) => {
                addDebugLog(`⚠️ Remote video play error: ${playError}`);
              });
            }
          }, 100);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            addDebugLog("📤 Sending ICE candidate (sender)");
            try {
              s.emit("add-ice-candidate", { 
                candidate: e.candidate, 
                type: "sender", 
                roomId: incomingRoomId 
              });
            } catch (emitError) {
              addDebugLog(`❌ Error emitting ICE candidate: ${emitError}`);
            }
          } else {
            addDebugLog("🏁 ICE gathering complete for sender");
          }
        };

        // Set the PC in state
        setSendingPc(pc);
        addDebugLog("✅ Sender PC set in state");

        // Create offer with delay and extra error handling
        addDebugLog("⏱️ Scheduling offer creation...");
        setTimeout(async () => {
          try {
            addDebugLog("🤝 Creating offer...");
            
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true
            });
            
            addDebugLog("✅ Offer created, setting local description...");
            await pc.setLocalDescription(offer);
            addDebugLog("✅ Local description set");
            
            addDebugLog("📤 Emitting offer to server...");
            s.emit("offer", { sdp: offer, roomId: incomingRoomId });
            
            setConnectionState("offer_sent");
            addDebugLog("✅ Offer sent successfully!");
            
          } catch (offerError) {
            addDebugLog(`❌ Error in offer creation process: ${offerError}`);
            setConnectionState("offer_error");
            console.error("Full offer error:", offerError);
          }
        }, 200);
        
        addDebugLog("✅ Send-offer handler completed without immediate errors");
        
      } catch (error) {
        addDebugLog(`❌ Error in send-offer handler: ${error}`);
        setConnectionState("send_offer_error");
        console.error("Full send-offer error:", error);
      }
    });

    s.on("offer", async ({ roomId: incomingRoomId, sdp: remoteSdp }) => {
      addDebugLog(`📥 Received offer for room: ${incomingRoomId}`);
      
      try {
        setLobby(false);
        setRoomId(incomingRoomId);
        setConnectionState("processing_offer");
        
        // Clean up any existing receiving PC
        if (receivingPc) {
          addDebugLog("🧹 Cleaning up existing receiver PC");
          receivingPc.close();
          setReceivingPc(null);
        }
        
        const pc = createPeerConnection("receiver");
        setReceivingPc(pc);

        // Set up remote stream
        const remoteStream = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        pc.ontrack = (e) => {
          addDebugLog(`📺 Received remote track: ${e.track.kind}`);
          e.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
          
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().catch((playError) => {
                addDebugLog(`⚠️ Remote video play error: ${playError}`);
              });
            }
          }, 100);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            addDebugLog("📤 Sending ICE candidate (receiver)");
            s.emit("add-ice-candidate", { 
              candidate: e.candidate, 
              type: "receiver", 
              roomId: incomingRoomId 
            });
          }
        };

        // Process the offer
        await pc.setRemoteDescription(new RTCSessionDescription(remoteSdp));
        addDebugLog("✅ Set remote description (offer)");

        // Process any queued ICE candidates for receiver
        await processQueuedCandidates(pc, senderCandidateQueue.current, "receiver");

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        addDebugLog("🤝 Created answer, sending to peer");

        s.emit("answer", { roomId: incomingRoomId, sdp: answer });
        setConnectionState("answer_sent");
        
      } catch (error) {
        addDebugLog(`❌ Error handling offer: ${error}`);
        setConnectionState("offer_processing_error");
      }
    });

    s.on("answer", async ({ sdp: remoteSdp }) => {
      addDebugLog("📥 Received answer");
      setConnectionState("processing_answer");
      
      try {
        if (sendingPc && sendingPc.signalingState === "have-local-offer") {
          await sendingPc.setRemoteDescription(new RTCSessionDescription(remoteSdp));
          addDebugLog("✅ Set remote description (answer)");
          
          // Process any queued ICE candidates for sender
          await processQueuedCandidates(sendingPc, receiverCandidateQueue.current, "sender");
          
          setConnectionState("establishing");
        } else {
          addDebugLog(`⚠️ Cannot set answer - wrong signaling state: ${sendingPc?.signalingState}`);
        }
      } catch (error) {
        addDebugLog(`❌ Error setting remote description: ${error}`);
      }
    });

    s.on("add-ice-candidate", async ({ candidate, type }) => {
      addDebugLog(`📥 Received ICE candidate, type: ${type}`);
      
      try {
        const iceCandidate = new RTCIceCandidate(candidate);
        
        if (type === "sender" && receivingPc) {
          if (receivingPc.remoteDescription && receivingPc.remoteDescription.type) {
            await receivingPc.addIceCandidate(iceCandidate);
            addDebugLog("✅ Added ICE candidate to receiving PC immediately");
          } else {
            addDebugLog("📋 Queueing ICE candidate for receiving PC");
            senderCandidateQueue.current.push(iceCandidate);
          }
        } else if (type === "receiver" && sendingPc) {
          if (sendingPc.remoteDescription && sendingPc.remoteDescription.type) {
            await sendingPc.addIceCandidate(iceCandidate);
            addDebugLog("✅ Added ICE candidate to sending PC immediately");
          } else {
            addDebugLog("📋 Queueing ICE candidate for sending PC");
            receiverCandidateQueue.current.push(iceCandidate);
          }
        } else {
          addDebugLog("⏳ Queueing ICE candidate - PC not ready yet");
          if (type === "sender") {
            senderCandidateQueue.current.push(iceCandidate);
          } else {
            receiverCandidateQueue.current.push(iceCandidate);
          }
        }
      } catch (error) {
        addDebugLog(`❌ Error handling ICE candidate: ${error}`);
      }
    });

    return () => {
      addDebugLog("🧹 Cleaning up socket connection");
      isConnecting.current = false;
      socketRef.current = null;
      senderCandidateQueue.current = [];
      receiverCandidateQueue.current = [];
      s.disconnect();
    };
  }, [localStream, name, createPeerConnection, processQueuedCandidates, addDebugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      addDebugLog("🧹 Component unmounting - cleaning up everything");
      if (sendingPc) {
        sendingPc.close();
        setSendingPc(null);
      }
      if (receivingPc) {
        receivingPc.close();
        setReceivingPc(null);
      }
      localStream?.getTracks().forEach((track) => track.stop());
      socketRef.current?.disconnect();
      senderCandidateQueue.current = [];
      receiverCandidateQueue.current = [];
    };
  }, [sendingPc, receivingPc, localStream, addDebugLog]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraEnabled(videoTrack.enabled);
      addDebugLog(`📹 Camera toggled: ${videoTrack.enabled ? "ON" : "OFF"}`);
    }
  }, [localStream, addDebugLog]);

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
      addDebugLog(`🎤 Microphone toggled: ${audioTrack.enabled ? "ON" : "OFF"}`);
    }
  }, [localStream, addDebugLog]);

  const handleExit = useCallback(() => {
    addDebugLog("🚪 User exiting room");
    
    // Stop all tracks
    localStream?.getTracks().forEach((track) => {
      track.stop();
      addDebugLog(`🛑 Stopped ${track.kind} track`);
    });
    
    // Close peer connections
    if (sendingPc) {
      sendingPc.close();
      setSendingPc(null);
    }
    if (receivingPc) {
      receivingPc.close();
      setReceivingPc(null);
    }
    
    // Clear queues
    senderCandidateQueue.current = [];
    receiverCandidateQueue.current = [];
    
    // Disconnect socket
    socketRef.current?.disconnect();
    
    router.push("/Dashboard");
  }, [localStream, sendingPc, receivingPc, router, addDebugLog]);

  // Skip partner function
  const skipPartner = useCallback(() => {
    if (socketRef.current) {
      addDebugLog("⏭️ Skipping current partner");
      
      // Clean up current connections
      if (sendingPc) {
        sendingPc.close();
        setSendingPc(null);
      }
      if (receivingPc) {
        receivingPc.close();
        setReceivingPc(null);
      }
      
      // Clear remote video
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      // Clear queues
      senderCandidateQueue.current = [];
      receiverCandidateQueue.current = [];
      
      // Emit skip event
      socketRef.current.emit("skip");
      
      setLobby(true);
      setConnectionState("waiting_for_partner");
      setRoomId("");
    }
  }, [sendingPc, receivingPc, addDebugLog]);

  return (
    <div className="min-h-screen bg-gray-900 p-6 flex flex-col items-center">
      <div className="flex justify-between w-full max-w-4xl mb-4">
        <div>
          <h1 className="text-white text-2xl">Hi {name}</h1>
          <div className="text-gray-400 text-sm">
            <p>Connection: {connectionState}</p>
            {roomId && <p>Room: {roomId}</p>}
            {lobby ? <p>Status: Looking for partner...</p> : <p>Status: In call</p>}
            <p>Socket: {socket?.id || "Not connected"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!lobby && (
            <button
              onClick={skipPartner}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleExit}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Local Video */}
        <div className="relative bg-black rounded-xl overflow-hidden border border-white/20">
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
              className={`p-3 text-sm rounded-full text-white font-medium ${
                micEnabled ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {micEnabled ? "🎤 ON" : "🔇 OFF"}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3 text-sm rounded-full text-white font-medium ${
                cameraEnabled ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {cameraEnabled ? "📹 ON" : "📷 OFF"}
            </button>
          </div>
          <div className="absolute top-4 left-4 text-white text-sm bg-black/70 px-3 py-1 rounded">
            You ({name})
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative bg-black rounded-xl overflow-hidden border border-white/20">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full aspect-video object-cover"
          />
          {lobby ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 bg-black/50">
              <div className="text-xl mb-3">🔍 Looking for someone...</div>
              <div className="text-sm mb-2">Status: {connectionState}</div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          ) : (
            <>
              <div className="absolute top-4 left-4 text-white text-sm bg-black/70 px-3 py-1 rounded">
                Remote User
              </div>
              <div className="absolute top-4 right-4 text-white text-xs bg-green-500/80 px-2 py-1 rounded">
                🟢 {connectionState === "connected" ? "Connected" : "Connecting..."}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Debug Panel - Shows recent logs and connection state */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg text-xs text-gray-300 max-w-4xl w-full">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-white font-semibold mb-2">Connection Status</h3>
            <div>Sender PC: {sendingPc?.connectionState || "none"}</div>
            <div>Receiver PC: {receivingPc?.connectionState || "none"}</div>
            <div>Sender ICE: {sendingPc?.iceConnectionState || "none"}</div>
            <div>Receiver ICE: {receivingPc?.iceConnectionState || "none"}</div>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">Queue Status</h3>
            <div>Sender Queue: {senderCandidateQueue.current.length}</div>
            <div>Receiver Queue: {receiverCandidateQueue.current.length}</div>
            <div>Local Stream: {localStream ? "✅" : "❌"}</div>
            <div>Socket Connected: {socket?.connected ? "✅" : "❌"}</div>
          </div>
        </div>
        
        <h3 className="text-white font-semibold mb-2">Recent Debug Logs</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {debugLogs.map((log, index) => (
            <div key={index} className="font-mono">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}