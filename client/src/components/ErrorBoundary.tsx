import { reportError } from "@/_core/autoErrorReporter";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Guardian Ai] UI error:", error, info);
    void reportError(error, info.componentStack ?? "ErrorBoundary", "ui");
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">
          {t("autoFix.title", "Something went wrong")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? t("autoFix.unknown", "An unexpected error occurred.")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("autoFix.reported", "This error was reported automatically.")}
        </p>
        <Button onClick={() => window.location.reload()}>
          {t("autoFix.reload", "Reload")}
        </Button>
      </div>
    </div>
  );
}