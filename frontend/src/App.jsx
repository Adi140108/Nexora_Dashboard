import React from 'react';
import InteractiveBackground from './components/InteractiveBackground';
import NexoraDashboard from './components/NexoraDashboard';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '4rem', color: 'white', textAlign: 'center' }}>
          <h2>Something went wrong in the Dashboard.</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div className="app-main">
      <InteractiveBackground />
      <ErrorBoundary>
        <NexoraDashboard />
      </ErrorBoundary>
      <footer>
        <p>© 2026 Nexora Vibe Coding Club. All rights reserved.</p>
      </footer>
      <style>{`
        .app-main {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        footer {
          margin-top: auto;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.9rem;
          padding: 2rem;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

export default App;
