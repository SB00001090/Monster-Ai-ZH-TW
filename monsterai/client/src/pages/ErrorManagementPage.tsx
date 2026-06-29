import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation, Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

interface ErrorStats {
  totalErrors: number;
  fixedErrors: number;
  recurringErrors: number;
  fixRate: number;
  errors: any[];
}

export function ErrorManagementPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const getStatsQuery = trpc.errorManagement.getStats.useQuery();

  useEffect(() => {
    // Only admins can access this page
    if (user && user.role !== 'admin') {
      navigate('/');
      return;
    }

    if (getStatsQuery.data) {
      setStats(getStatsQuery.data);
      setLoading(false);
    }
  }, [getStatsQuery.data, user, navigate]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only administrators can access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading error statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Error Management Dashboard</h1>
          <p className="text-gray-600">Monitor and manage system errors in real-time</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalErrors}</div>
            <p className="text-xs text-gray-500 mt-1">All errors recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Fixed Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.fixedErrors}</div>
            <p className="text-xs text-gray-500 mt-1">Errors with known fixes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Recurring Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.recurringErrors}</div>
            <p className="text-xs text-gray-500 mt-1">Errors occurring multiple times</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Fix Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(stats.fixRate * 100)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Percentage of fixed errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Error History</CardTitle>
          <CardDescription>Recent errors and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Error Type</th>
                  <th className="text-left py-2 px-4">Message</th>
                  <th className="text-left py-2 px-4">Count</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-left py-2 px-4">Last Occurred</th>
                </tr>
              </thead>
              <tbody>
                {stats.errors && stats.errors.length > 0 ? (
                  stats.errors.map((error: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-mono text-xs bg-gray-100 rounded">
                        {error.errorType}
                      </td>
                      <td className="py-2 px-4 max-w-xs truncate">{error.errorMessage}</td>
                      <td className="py-2 px-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {error.occurrenceCount}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        {error.isFixed ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            Fixed
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                            Unfixed
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-xs text-gray-500">
                        {new Date(error.lastOccurredAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-center text-gray-500">
                      No errors recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About Error Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Real-Time Error Tracking</h3>
            <p className="text-sm text-gray-600">
              The system automatically tracks all errors and identifies recurring issues. When the same error occurs multiple times, known fixes are automatically applied to prevent the issue from recurring.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Auto-Fix System</h3>
            <p className="text-sm text-gray-600">
              Once a fix is registered for an error type, the system will automatically apply it when that error is detected again. This ensures consistent error resolution across the application.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Fix Types</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
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
