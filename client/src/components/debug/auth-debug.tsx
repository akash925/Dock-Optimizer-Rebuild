import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthDebug() {
  const { user, isLoading, error, loginMutation } = useAuth();
  const { toast } = useToast();
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    try {
      const res = await fetch('/api/test-login');
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Test login successful",
          description: `Logged in as ${data.user.username}`,
        });
        window.location.reload(); // Reload to update auth state
      } else {
        const error = await res.text();
        toast({
          title: "Test login failed",
          description: error,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error during test login",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth-status');
      const data = await res.json();
      setAuthStatus(data);
    } catch (err) {
      console.error("Error checking auth status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto mt-4">
      <CardHeader>
        <CardTitle>Authentication Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-neutral-100 rounded-md">
            <h3 className="font-medium mb-2">Auth Context:</h3>
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify({
                isAuthenticated: !!user,
                isLoading,
                error: error?.message,
                user: user ? {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  role: user.role
                } : null
              }, null, 2)}
            </pre>
          </div>

          <div className="p-4 bg-neutral-100 rounded-md">
            <h3 className="font-medium mb-2">Auth Status API:</h3>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(authStatus, null, 2)}
              </pre>
            )}
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={checkAuthStatus}>
              Refresh Status
            </Button>
            <Button onClick={testLogin}>
              Test Login
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}