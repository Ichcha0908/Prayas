import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AppDataProvider } from '@/hooks/useAppData';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui';
import { Landing } from '@/pages/Landing';
import { Dashboard } from '@/pages/Dashboard';
import { Forecast } from '@/pages/Forecast';
import { Cashflow } from '@/pages/Cashflow';
import { StressTest } from '@/pages/StressTest';
import { IncomeCalendar } from '@/pages/IncomeCalendar';
import { Insights } from '@/pages/Insights';

/** Keeps one broken chart from taking down the whole application. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
          <div className="card max-w-md p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-serious-ink" aria-hidden />
            <h1 className="font-display text-lg font-700 text-ink">Something broke on this screen</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              The rest of the app is fine. Reloading usually clears it.
            </p>
            <Button variant="primary" className="mt-6" onClick={() => window.location.reload()}>
              Reload the app
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-display text-5xl font-700 text-ink-faint">404</p>
      <h1 className="mt-4 font-display text-lg font-600 text-ink">That page does not exist</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        The link may be out of date. Your dashboard has everything.
      </p>
      <Link to="/app" className="mt-6">
        <Button variant="primary">Back to dashboard</Button>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/app"
            element={
              <AppDataProvider>
                <AppShell />
              </AppDataProvider>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="cashflow" element={<Cashflow />} />
            <Route path="stress-test" element={<StressTest />} />
            <Route path="calendar" element={<IncomeCalendar />} />
            <Route path="insights" element={<Insights />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
