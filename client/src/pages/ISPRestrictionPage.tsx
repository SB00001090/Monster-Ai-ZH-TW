import { useEffect, useState } from "react";
import { AlertCircle, Wifi, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ISPRestrictionPage() {
  const [ispInfo, setIspInfo] = useState<{
    isp: string;
    ipAddress?: string;
    isBlocked: boolean;
    isUnlimited: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Fetch ISP information from API
    const fetchISPInfo = async () => {
      try {
        const response = await fetch("/api/isp-info");
        if (response.ok) {
          const data = await response.json();
          setIspInfo(data);
        }
      } catch (error) {
        console.error("Failed to fetch ISP info:", error);
      }
    };

    fetchISPInfo();
  }, []);

  if (!ispInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (ispInfo.isBlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="border-destructive">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>服務不可用</CardTitle>
              </div>
              <CardDescription>您的網絡提供商不支持此服務</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{ispInfo.message}</AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">檢測到的 ISP：</span>
                  <span className="ml-2 text-muted-foreground">{ispInfo.isp.toUpperCase()}</span>
                </div>
                {ispInfo.ipAddress && (
                  <div>
                    <span className="font-semibold">IP 地址：</span>
                    <span className="ml-2 text-muted-foreground">{ispInfo.ipAddress}</span>
                  </div>
                )}
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p className="font-semibold">解決方案：</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>使用其他網絡提供商（例如：WiFi、移動熱點）</li>
                  <li>聯繫您的網絡提供商了解更多信息</li>
                  <li>使用 VPN 可能會有幫助（取決於您的地區政策）</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (ispInfo.isUnlimited) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="border-green-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <CardTitle>無限訪問</CardTitle>
              </div>
              <CardDescription>您可以無限使用 Guardian Ai</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{ispInfo.message}</AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">檢測到的 ISP：</span>
                  <span className="ml-2 text-muted-foreground">{ispInfo.isp.toUpperCase()}</span>
                </div>
                {ispInfo.ipAddress && (
                  <div>
                    <span className="font-semibold">IP 地址：</span>
                    <span className="ml-2 text-muted-foreground">{ispInfo.ipAddress}</span>
                  </div>
                )}
              </div>

              <div className="bg-green-50 p-4 rounded-lg text-sm text-green-800">
                <p className="font-semibold mb-2">✨ 特殊優惠</p>
                <p>作為 SmarTone 用戶，您可以享受 Guardian Ai 的所有高級功能，無需任何限制！</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="h-6 w-6 text-primary" />
              <CardTitle>網絡檢測</CardTitle>
            </div>
            <CardDescription>您的網絡提供商信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">檢測到的 ISP：</span>
                <span className="ml-2 text-muted-foreground">{ispInfo.isp.toUpperCase()}</span>
              </div>
              {ispInfo.ipAddress && (
                <div>
                  <span className="font-semibold">IP 地址：</span>
                  <span className="ml-2 text-muted-foreground">{ispInfo.ipAddress}</span>
                </div>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{ispInfo.message}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
