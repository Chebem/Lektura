import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Catches render/lifecycle faults in one tab so they can't blank the whole app.
 *
 * Without this, a single throw anywhere below — including inside an effect
 * cleanup during a tab switch — tears down the React root and leaves a white
 * page with no explanation. A student would just see the app vanish.
 *
 * `resetKey` lets the boundary recover: when the active tab changes, the
 * previous error is cleared so switching away from a broken panel works.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[StudyBridge] component crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <h2 className="crash__title">This panel hit an error</h2>
        <p className="crash__lead">
          The rest of the app still works — switch tabs and come back, or
          reload the page.
        </p>

        <pre className="crash__detail sb-scroll">
          {String(error?.message || error)}
          {info?.componentStack ? `\n${info.componentStack}` : ''}
        </pre>

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => this.setState({ error: null, info: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
