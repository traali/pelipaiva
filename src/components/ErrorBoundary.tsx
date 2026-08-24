import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[PELIPAIVA:CRASH]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui',
            background: '#0a0a0a',
            color: '#e5e5e5'
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚽ Jotain meni pieleen</h1>
          <p style={{ color: '#999', marginBottom: '1.5rem', textAlign: 'center' }}>
            {this.state.error?.message || 'Odottamaton virhe'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '0.75rem',
              border: '1px solid #333',
              background: '#1a1a1a',
              color: '#faff69',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Lataa uudelleen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
