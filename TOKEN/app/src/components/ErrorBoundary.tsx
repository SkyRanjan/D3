import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Notice } from "./ui";

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("View crashed", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg space-y-3 py-12">
        <Notice tone="critical" title="Something went wrong">{this.state.error.message}</Notice>
        <Button onClick={() => this.setState({ error: null })}>Try again</Button>
      </div>
    );
  }
}
