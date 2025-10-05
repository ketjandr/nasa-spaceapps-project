"use client";

import { useRouter } from 'next/navigation';
import GlassSearchBar from './components/search_bar';

export default function Home() {
  const router = useRouter();

  const handleGlobalSearch = (query: string) => {
    // Navigate to the explorer page with the search query
    router.push(`/explorer?search=${encodeURIComponent(query)}`);
  };

  const handleSurpriseClick = () => {
    // Navigate to the surprise page
    router.push('/surprise');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex flex-col">
      {/* Hero Section with Glass Search Bar - Full Screen */}
      <section className="relative flex flex-col items-center justify-center flex-1 px-4 sm:px-8">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/globe.svg')] bg-center bg-no-repeat opacity-5 pointer-events-none" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        
        {/* Main content */}
        <div className="relative z-10 text-center mb-12 space-y-6">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight">
            Explore NASA&apos;s<br />Universe
          </h1>
          <p className="text-xl sm:text-2xl text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed">
            Navigate gigapixel images of celestial bodies, discover planetary features, 
            and explore the cosmos like never before
          </p>
        </div>

        {/* Glass Search Bar - Centered and Prominent */}
        <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center">
          <GlassSearchBar 
            onSearch={handleGlobalSearch}
            placeholder="Search for craters, mountains, coordinates (e.g., 'Sinus Lunicus', 'De Vico')..."
          />
          
          {/* Search suggestions */}
          <div className="mt-6 text-center">
            <p className="text-sm text-white/40 mb-3">Popular searches:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Marco Polo P', 'Bürg', 'Brown E', 'Short B'].map((term) => (
                <button
                  key={term}
                  onClick={() => handleGlobalSearch(term)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-full text-sm transition-all border border-white/10 hover:border-white/20"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-4">
          <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <h3 className="text-white font-semibold mb-2">Multiple Planets</h3>
            <p className="text-white/60 text-sm">Explore Moon, Mars, Mercury, and Ceres</p>
          </div>
          <button 
            onClick={handleSurpriseClick}
            className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
          >
            <h3 className="text-white font-semibold mb-2">Surprise me</h3>
            <p className="text-white/60 text-sm">Coming soon</p>
          </button>
          <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <h3 className="text-white font-semibold mb-2">Feature Markers</h3>
            <p className="text-white/60 text-sm">Mark and discover planetary landmarks</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-6 px-4 text-center border-t border-white/10">
        <p className="text-white/40 text-sm">
          Made by Slack Overflow
        </p>
      </footer>
    </div>
  );
}
