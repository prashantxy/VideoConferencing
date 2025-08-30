'use client';

import React, { useEffect } from 'react';
import { Video, Users, Globe, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      router.push('/Dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <Video className="w-20 h-20 text-purple-300 mx-auto mb-4 animate-bounce" />
          </div>
          <h1 className="text-7xl font-bold text-white mb-6 tracking-tight">
            Video<span className="text-purple-300">Meet</span>
          </h1>
          <p className="text-2xl text-blue-200 mb-8 max-w-3xl mx-auto leading-relaxed">
            Connect with strangers from around the world through random video chats. 
            <br />
            <span className="text-purple-300">Make new friends, learn cultures, have fun!</span>
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-4xl">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center hover:bg-white/15 transition-all transform hover:scale-105">
            <Users className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Random Matching</h3>
            <p className="text-white/70">Get connected with random people instantly</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center hover:bg-white/15 transition-all transform hover:scale-105">
            <Globe className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Global Community</h3>
            <p className="text-white/70">Meet people from 190+ countries worldwide</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center hover:bg-white/15 transition-all transform hover:scale-105">
            <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Instant Connect</h3>
            <p className="text-white/70">Lightning fast connections in under 2 seconds</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => router.push('/Authpage')}
            className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg rounded-full transition-all transform hover:scale-105 shadow-2xl"
          >
            Get Started Free
          </button>
          <button
            onClick={() => router.push('/Authpage')}
            className="px-12 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-lg rounded-full transition-all border border-white/30 backdrop-blur-sm"
          >
            Sign In
          </button>
        </div>

    
      </div>
    </div>
  );
}