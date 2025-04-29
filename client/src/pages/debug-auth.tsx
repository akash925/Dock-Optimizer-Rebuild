import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function DebugAuthPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>
      
      {isLoading ? (
        <p>Loading user data...</p>
      ) : user ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">User Information</h2>
          <pre className="bg-muted p-4 rounded-md overflow-x-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
          
          <div className="flex gap-2 mt-4">
            <Button asChild variant="outline">
              <Link href="/">Back to Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin">Try Admin Page</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p>Not authenticated.</p>
          <Button asChild className="mt-2">
            <Link href="/auth">Go to Login</Link>
          </Button>
        </div>
      )}
    </div>
  );
}