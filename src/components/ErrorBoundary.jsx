import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  reset = () => this.setState({ hasError: false, error: null, errorInfo: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8">
        <div className="rounded-2xl bg-red-50 p-5">
          <AlertTriangle className="h-12 w-12 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Une erreur est survenue</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            La page n'a pas pu s'afficher correctement. Vous pouvez recharger ou revenir à l'accueil.
          </p>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre className="max-w-2xl overflow-auto rounded-lg bg-muted px-4 py-3 text-[11px] text-muted-foreground">
            {this.state.error?.message ?? String(this.state.error)}
            {this.state.errorInfo?.componentStack && '\n' + this.state.errorInfo.componentStack}
          </pre>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
