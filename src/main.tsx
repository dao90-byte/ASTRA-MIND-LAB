import { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw } from 'lucide-react';
import App from './App.tsx';
import './index.css';

class CosmicErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="h-screen w-screen bg-[#06071A] flex items-center justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            aria-label="Reload"
            className="w-16 h-16 rounded-2xl bg-[#101746] border-2 border-[#22EBFF] text-[#22EBFF] flex items-center justify-center shadow-[0_0_32px_rgba(34,235,255,0.4)] cursor-pointer"
          >
            <RotateCcw className="w-7 h-7" />
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <CosmicErrorBoundary>
    <App />
  </CosmicErrorBoundary>
);
