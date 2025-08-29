import { useEffect, useRef, useState } from "react";
import { Room } from "./Room";
import { motion } from "framer-motion";
import { Mic, Video, User, ArrowRight } from "lucide-react";

export const Landing = () => {
  const [name, setName] = useState("");
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [joined, setJoined] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  const getCam = async () => {
    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = new MediaStream([videoTrack]);
        videoRef.current.play();
      }
    } catch (err) {
      setError("Failed to access camera or microphone. Please check permissions.");
    }
  };

  const toggleMic = () => {
    if (localAudioTrack) {
      localAudioTrack.enabled = !localAudioTrack.enabled;
      setIsMicOn(localAudioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      localVideoTrack.enabled = !localVideoTrack.enabled;
      setIsVideoOn(localVideoTrack.enabled);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      getCam();
    }
    return () => {
      localAudioTrack?.stop();
      localVideoTrack?.stop();
    };
  }, []);

  if (joined) {
    return <Room name={name} localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-400 via-purple-500 to-blue-500 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-pink-300 rounded-full opacity-20 animate-pulse top-[-10%] left-[-10%]" />
        <div className="absolute w-96 h-96 bg-yellow-300 rounded-full opacity-20 animate-pulse bottom-[-10%] right-[-10%]" />
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Video Preview */}
        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl overflow-hidden mb-6"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <video
            ref={videoRef}
            autoPlay
            className="w-full h-auto rounded-2xl"
          />
          {error && (
            <div className="absolute inset-0 bg-red-500 bg-opacity-75 flex items-center justify-center">
              <p className="text-white text-center font-semibold">{error}</p>
            </div>
          )}
          {/* Video and Mic Controls */}
          <div className="absolute bottom-4 left-4 flex gap-3">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full text-white shadow-md transition-all ${
                isMicOn ? "bg-blue-500 hover:bg-blue-600" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={toggleVideo}
              className={` expectativas p-3 rounded-full text-white shadow-md transition-all ${
                isVideoOn ? "bg-blue-500 hover:bg-blue-600" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              <Video className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Input and Join Button */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="relative w-full max-w-xs">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full pl-10 pr-4 py-3 bg-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 placeholder-gray-400 transition-all"
            />
          </div>
          <motion.button
            onClick={() => name.trim() && setJoined(true)}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-gray-800 font-bold rounded-lg shadow-md hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Join Room <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Fun Footer */}
      <motion.p
        className="text-white text-sm mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        🎉 Get ready for an epic video chat adventure!
      </motion.p>
    </div>
  );
};