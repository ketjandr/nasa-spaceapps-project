"use client";

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function SurprisePage() {
  const router = useRouter();

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex flex-col">
      {/* Background decoration - same as home page */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/globe.svg')] bg-center bg-no-repeat opacity-5 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 sm:px-8">
        {/* Back button */}
        <button
          onClick={handleBackToHome}
          className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:border-white/20"
        >
          <ArrowLeft size={20} />
          <span>Back to Home</span>
        </button>

        {/* Main content area - currently blank */}
        <div className="text-center">
          <div className="text-8xl mb-6">🙈</div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
            Surprise!
          </h1>
          <p className="text-xl text-white/70">
            Coming soon...
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative py-6 px-4 text-center border-t border-white/10">
        <p className="text-white/40 text-sm">
          Made with ❤️ by Slack Overflow
        </p>
      </footer>
    </div>
  );
}
