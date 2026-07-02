import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Baby, CreditCard, Globe, Home, Library, Shield } from "lucide-react";
import { useLocation } from "wouter";

const QUICK_LINKS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/guardian-sync", label: "Guardian Sync", icon: Shield },
  { path: "/network-learning", label: "Network Learning", icon: Globe },
  { path: "/toddler-learning", label: "Toddler Learning", icon: Baby },
  { path: "/guardian-characters", label: "Character Lifecycle", icon: Library },
  { path: "/pricing", label: "Pricing & Trial", icon: CreditCard },
] as const;

export default function NotFound() {
  const [location, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 dark:bg-red-950 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">404</h1>

          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Page Not Found
          </h2>

          <p className="text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
            Sorry, the page you are looking for doesn&apos;t exist.
            <br />
            It may have been moved or deleted.
          </p>

          {location && location !== "/404" ? (
            <p className="text-sm text-muted-foreground mb-6 font-mono break-all">
              {location}
            </p>
          ) : (
            <div className="mb-6" />
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button
              onClick={() => setLocation("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {QUICK_LINKS.slice(1).map(({ path, label, icon: Icon }) => (
              <Button
                key={path}
                variant="outline"
                className="justify-start"
                onClick={() => setLocation(path)}
              >
                <Icon className="w-4 h-4 mr-2 shrink-0" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}