import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  info: ErrorInfo | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info)
    this.setState({ info })
  }

  reset = (): void => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        padding: '40px 24px',
        maxWidth: 540,
        margin: '40px auto',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textAlign: 'center',
        color: 'var(--text)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Algo deu errado</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          A tela encontrou um erro inesperado. O time foi notificado.
        </p>
        <details style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-subtle)', marginBottom: 18 }}>
          <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
          <pre style={{
            marginTop: 8,
            padding: 10,
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 160,
            fontSize: 11,
          }}>{String(this.state.error?.stack || this.state.error)}</pre>
        </details>
        <button
          onClick={this.reset}
          style={{
            padding: '9px 18px',
            background: 'var(--color-brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            marginRight: 8,
          }}
        >
          Tentar novamente
        </button>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '9px 18px',
            background: 'var(--bg-elevated)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Voltar ao início
        </button>
      </div>
    )
  }
}
