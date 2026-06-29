import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation, Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

export function ErrorManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const getStatsQuery = trpc.errorManagement.getStats.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });
  const retryFixMutation = trpc.errors.retryFix.useMutation({
    onSuccess: () => getStatsQuery.refetch(),
  });

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('errorManagement.accessDenied')}</CardTitle>
            <CardDescription>{t('errorManagement.adminOnly')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (getStatsQuery.isLoading || !getStatsQuery.data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">{t('errorManagement.loading')}</p>
        </div>
      </div>
    );
  }

  const stats = getStatsQuery.data;
  const fixRatePercent = Math.round((stats.fixRate ?? 0) * 100);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('errorManagement.title')}</h1>
          <p className="text-muted-foreground">{t('errorManagement.subtitle')}</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('errorManagement.back')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('errorManagement.totalErrors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalErrors}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('errorManagement.totalErrorsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('errorManagement.fixedErrors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.fixedErrors}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('errorManagement.fixedErrorsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('errorManagement.recurringErrors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.recurringErrors}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('errorManagement.recurringErrorsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('errorManagement.fixRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{fixRatePercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('errorManagement.fixRateDesc')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('errorManagement.errorHistory')}</CardTitle>
          <CardDescription>{t('errorManagement.errorHistoryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">{t('errorManagement.errorType')}</th>
                  <th className="text-left py-2 px-4">{t('errorManagement.message')}</th>
                  <th className="text-left py-2 px-4">{t('errorManagement.count')}</th>
                  <th className="text-left py-2 px-4">{t('errorManagement.status')}</th>
                  <th className="text-left py-2 px-4">{t('errorManagement.fixAction')}</th>
                  <th className="text-left py-2 px-4">{t('errorManagement.lastOccurred')}</th>
                  <th className="text-left py-2 px-4">{t('errorManagement.retryFix')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.errors && stats.errors.length > 0 ? (
                  stats.errors.map((error: any, index: number) => {
                    const message = error.message ?? error.errorMessage ?? "";
                    const count = error.count ?? error.occurrenceCount ?? 1;
                    const isFixed =
                      error.status === "resolved" || Boolean(error.isFixed);
                    const lastAt = error.updatedAt ?? error.lastOccurredAt;
                    const incidentId = error.id;
                    return (
                    <tr key={error.id ?? index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4 font-mono text-xs bg-muted rounded">
                        {error.errorType}
                      </td>
                      <td className="py-2 px-4 max-w-xs truncate">{message}</td>
                      <td className="py-2 px-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs dark:bg-blue-900 dark:text-blue-200">
                          {count}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        {isFixed ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs dark:bg-green-900 dark:text-green-200">
                            {error.status ?? t('errorManagement.fixed')}
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs dark:bg-red-900 dark:text-red-200">
                            {error.status ?? t('errorManagement.unfixed')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-xs font-mono">
                        {error.fixAction ?? "—"}
                      </td>
                      <td className="py-2 px-4 text-xs text-muted-foreground">
                        {lastAt ? new Date(lastAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 px-4">
                        {incidentId ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retryFixMutation.isPending}
                            onClick={() =>
                              retryFixMutation.mutate({ incidentId })
                            }
                          >
                            {t('errorManagement.retryFix')}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 px-4 text-center text-muted-foreground">
                      {t('errorManagement.noErrors')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('errorManagement.about')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{t('errorManagement.tracking')}</h3>
            <p className="text-sm text-muted-foreground">{t('errorManagement.trackingDesc')}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t('errorManagement.autoFix')}</h3>
            <p className="text-sm text-muted-foreground">{t('errorManagement.autoFixDesc')}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t('errorManagement.fixTypes')}</h3>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><strong>database_reconnect</strong> - Reconnect to the database</li>
              <li><strong>cache_clear</strong> - Clear application cache</li>
              <li><strong>config_reset</strong> - Reset configuration</li>
              <li><strong>restart_service</strong> - Restart the service</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}