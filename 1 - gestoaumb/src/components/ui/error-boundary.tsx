import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-muted/30 rounded-lg border border-border/30">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Não foi possível carregar este componente
            </p>
            <p className="text-xs text-muted-foreground">
              Ocorreu um erro inesperado. Tente novamente.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
