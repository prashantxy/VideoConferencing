'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Video, Users, Globe, Zap, Camera, Mic, MicOff, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface User {
  id?: string;
  name: string;
  username: string;
  email?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null); // Store the initial stream
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(true);
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/Authpage');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setName(parsedUser.name || parsedUser.username);
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/Authpage');
    }
  }, [router]);

  // Initialize media stream on mount or user change
  useEffect(() => {
    if (!user) return;

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    setupMedia();

    return () => {
      localAudioTrack?.stop();
      localVideoTrack?.stop();
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [user]);

  // Toggle camera
  const toggleCamera = () => {
    if (!localStream || !localVideoTrack) return;

    setCameraEnabled((prev) => {
      const newEnabled = !prev;
      if (localVideoTrack.enabled !== newEnabled) {
        localVideoTrack.enabled = newEnabled;
        if (videoRef.current && localStream) {
          videoRef.current.srcObject = new MediaStream(
            localStream.getTracks().filter((track) => track.enabled)
          );
          videoRef.current.play().catch(console.error);
        }
      }
      return newEnabled;
    });
  };

  // Toggle microphone
  const toggleMic = () => {
    if (!localStream || !localAudioTrack) return;

    setMicEnabled((prev) => {
      const newEnabled = !prev;
      if (localAudioTrack.enabled !== newEnabled) {
        localAudioTrack.enabled = newEnabled;
        if (videoRef.current && localStream) {
          videoRef.current.srcObject = new MediaStream(
            localStream.getTracks().filter((track) => track.enabled)
          );
          videoRef.current.play().catch(console.error);
        }
      }
      return newEnabled;
    });
  };

  const handleLogout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleStartChat = (): void => {
    if (name.trim()) {
      
      localStorage.setItem('chatData', JSON.stringify({
        name: name.trim(),
        hasAudio: micEnabled,
        hasVideo: cameraEnabled,
      }));
      router.push('/Room');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">
              Hey there, <span className="text-purple-300">{user.name}</span>! 👋
            </h1>
            <p className="text-xl text-blue-200">Ready to meet someone awesome?</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors border border-red-500/30"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Video Preview Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8 border border-white/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Setup Your Camera</h2>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full aspect-video bg-gray-800 rounded-lg shadow-lg border-2 border-purple-500/30"
              />
              <div className="absolute bottom-4 left-4 flex gap-2">
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-full transition-all ${micEnabled ? 'bg-green-500/80 hover:bg-green-500' : 'bg-red-500/80 hover:bg-red-500'}`}
                >
                  {micEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`p-3 rounded-full transition-all ${cameraEnabled ? 'bg-green-500/80 hover:bg-green-500' : 'bg-red-500/80 hover:bg-red-500'}`}
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-2">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Enter your name for the chat"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleStartChat}
                disabled={!name.trim()}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="flex items-center justify-center gap-2">
                  <Video className="w-5 h-5" />
                  Start Video Chat
                </div>
              </button>

              <div className="text-center">
                <p className="text-white/70 text-sm">
                  🎭 Meet random strangers • 🌍 Global connections • ⚡ Instant matching
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center bg-white/5 rounded-lg p-4 border border-white/10">
            <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">1.2M+</p>
            <p className="text-white/70">Active Users</p>
          </div>
          <div className="text-center bg-white/5 rounded-lg p-4 border border-white/10">
            <Globe className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">190+</p>
            <p className="text-white/70">Countries</p>
          </div>
          <div className="text-center bg-white/5 rounded-lg p-4 border border-white/10">
            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">2S</p>
            <p className="text-white/70">Connection Time</p>
          </div>
        </div>
      </div>
    </div>
  );
}