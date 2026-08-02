"use client";

import { Component } from "react";
import ErrorState from "./ui/ErrorState";

export default class FeatureErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`${this.props.name || "Feature"} boundary recovered an error`, error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const name = this.props.name || "This section";
      return (
        <section className={`feature-error-boundary ${this.props.className || ""}`.trim()}>
          <ErrorState
            title={`${name} is temporarily unavailable`}
            description="This section could not be displayed. Your saved server data has not been changed."
            retryLabel="Retry section"
            onRetry={this.retry}
            showHome={false}
          />
        </section>
      );
    }

    return this.props.children;
  }
}
