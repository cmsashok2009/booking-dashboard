"use client";

import { Component } from "react";
import ErrorState from "./ui/ErrorState";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    if (process.env.NODE_ENV !== "production") console.error("Application boundary recovered an error", error);
  }
  render() {
    if (this.state.failed)
      return (
        <main className="app-state-page">
          <ErrorState
            description="This section could not be displayed. You can retry without losing previously saved server data."
            onRetry={() => this.setState({ failed: false })}
          />
        </main>
      );
    return this.props.children;
  }
}
