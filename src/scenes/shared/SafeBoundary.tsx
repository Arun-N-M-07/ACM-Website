'use client';
import { Component, type ReactNode } from 'react';

interface Props {
  /** Rendered if a child throws (e.g. a GLB fails to parse). */
  fallback: ReactNode;
  name?: string;
  children: ReactNode;
  onError?: (error: Error) => void;
}

/**
 * Error boundary for 3D subtrees: a failing asset or scene degrades to its
 * fallback instead of taking down the canvas.
 */
export class SafeBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[scene] ${this.props.name ?? 'subtree'} failed, using fallback:`, error.message);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
