import { Component, type ReactNode } from 'react';
import { vscode } from '../lib/rpc';
import { Empty, Icon } from './ui';

/** Shows render errors instead of a blank view, with a way to recover. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Git Workspace]', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Empty icon="error" title="Something went wrong">
        <p className="mono" style={{ fontSize: 11, userSelect: 'text', wordBreak: 'break-word' }}>
          {error.message}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            // Saved view state may be what triggers the crash: drop it.
            vscode.setState(undefined);
            this.setState({ error: null });
          }}
        >
          <Icon name="refresh" /> Reset view
        </button>
      </Empty>
    );
  }
}
