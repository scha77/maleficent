import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "14px",
            background: "rgba(168,92,92,0.1)",
            border: "1px solid rgba(168,92,92,0.2)",
            borderRadius: "14px",
            color: "rgba(255,255,255,0.4)",
            fontSize: "13px",
            textAlign: "center",
          }}
          role="alert"
        >
          Something went wrong rendering this item.
        </div>
      );
    }
    return this.props.children;
  }
}
