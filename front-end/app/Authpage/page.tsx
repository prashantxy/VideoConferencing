'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FormData {
  name: string;
  email: string;
  username: string;
  password: string;
}

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    username: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleAuth = async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, ""); 
     const endpoint = authMode === "signin" ? "/signin" : "/signup";
     const response = await fetch(`${apiUrl}/auth${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
    });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (authMode === 'signin') {
        localStorage.setItem('token', data.token);
        const userInfo = { 
          name: formData.username, 
          username: formData.username 
        };
        localStorage.setItem('user', JSON.stringify(userInfo));
        router.push('/Dashboard');
      } else {
        setAuthMode('signin');
        setError('Account created successfully! Please sign in.');
        setFormData({ ...formData, password: '' });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back to landing */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 text-white/70 hover:text-white transition-colors"
        >
          ← Back to home
        </button>

        {/* Auth Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <Video className="w-16 h-16 text-purple-300 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">
              {authMode === 'signin' ? 'Welcome Back!' : 'Join VideoMeet'}
            </h2>
            <p className="text-white/70">
              {authMode === 'signin' 
                ? 'Sign in to start meeting new people' 
                : 'Create your account and start connecting'}
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-4 rounded-lg text-center ${
              error.includes('successfully') 
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              {error}
            </div>
          )}

          <div className="space-y-6">
            {authMode === 'signup' && (
              <>
                <div>
                  <label className="block text-white font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-white font-medium mb-2">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Choose a username"
              />
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAuth}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {authMode === 'signin' ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                authMode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-white/70">
              {authMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => {
                  setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                  setError('');
                  setFormData({ name: '', email: '', username: '', password: '' });
                }}
                className="text-purple-300 hover:text-purple-200 font-semibold transition-colors"
              >
                {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Fun fact */}
        <div className="mt-8 text-center">
          <p className="text-white/50 text-sm">
            🎉 Fun fact: People make an average of 5 new friends every day on VideoMeet!
          </p>
        </div>
      </div>
    </div>
  );
}