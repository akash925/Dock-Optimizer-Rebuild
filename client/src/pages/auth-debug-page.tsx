import { AuthDebug } from "@/components/debug/auth-debug";

export default function AuthDebugPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Authentication Debugging</h1>
      <p className="mb-8">
        This page helps diagnose authentication and session issues. Use the test login 
        button to create a session with the test user.
      </p>
      <AuthDebug />
    </div>
  );
}