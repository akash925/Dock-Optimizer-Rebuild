import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DebugAPI() {
  const { user } = useAuth();
  
  // Test schedules API
  const { data: schedules, isLoading: loadingSchedules, error: schedulesError } = useQuery({
    queryKey: ["/api/schedules"],
    queryFn: async () => {
      const response = await fetch("/api/schedules", {
        credentials: 'include'
      });
      console.log('Schedules response status:', response.status);
      const data = await response.json();
      console.log('Schedules raw data:', data);
      return data;
    },
  });

  // Test users API
  const { data: users, isLoading: loadingUsers, error: usersError } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users", {
        credentials: 'include'
      });
      console.log('Users response status:', response.status);
      const data = await response.json();
      console.log('Users raw data:', data);
      return data;
    },
  });

  // Test booking pages API
  const { data: bookingPages, isLoading: loadingBookingPages, error: bookingPagesError } = useQuery({
    queryKey: ["/api/booking-pages"],
    queryFn: async () => {
      const response = await fetch("/api/booking-pages", {
        credentials: 'include'
      });
      console.log('Booking pages response status:', response.status);
      const data = await response.json();
      console.log('Booking pages raw data:', data);
      return data;
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">API Debug Page</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Schedules API 
            <Badge variant={schedulesError ? "destructive" : "default"}>
              {loadingSchedules ? "Loading..." : schedules ? `${Array.isArray(schedules) ? schedules.length : 'Not Array'} items` : "Error"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedulesError && (
            <div className="text-red-600 mb-4">
              Error: {schedulesError.message}
            </div>
          )}
          <div className="space-y-2">
            <div><strong>Type:</strong> {Array.isArray(schedules) ? 'Array' : typeof schedules}</div>
            <div><strong>Length:</strong> {Array.isArray(schedules) ? schedules.length : 'N/A'}</div>
            <div><strong>First Item Type:</strong> {schedules && schedules[0] ? typeof schedules[0] : 'N/A'}</div>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">Raw Response</summary>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto mt-2 max-h-60">
              {JSON.stringify(schedules, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Users API 
            <Badge variant={usersError ? "destructive" : "default"}>
              {loadingUsers ? "Loading..." : users ? `${Array.isArray(users) ? users.length : 'Not Array'} items` : "Error"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersError && (
            <div className="text-red-600 mb-4">
              Error: {usersError.message}
            </div>
          )}
          <div className="space-y-2">
            <div><strong>Type:</strong> {Array.isArray(users) ? 'Array' : typeof users}</div>
            <div><strong>Length:</strong> {Array.isArray(users) ? users.length : 'N/A'}</div>
            <div><strong>First Item Type:</strong> {users && users[0] ? typeof users[0] : 'N/A'}</div>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">Raw Response</summary>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto mt-2 max-h-60">
              {JSON.stringify(users, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Booking Pages API 
            <Badge variant={bookingPagesError ? "destructive" : "default"}>
              {loadingBookingPages ? "Loading..." : bookingPages ? `${Array.isArray(bookingPages) ? bookingPages.length : 'Not Array'} items` : "Error"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookingPagesError && (
            <div className="text-red-600 mb-4">
              Error: {bookingPagesError.message}
            </div>
          )}
          <div className="space-y-2">
            <div><strong>Type:</strong> {Array.isArray(bookingPages) ? 'Array' : typeof bookingPages}</div>
            <div><strong>Length:</strong> {Array.isArray(bookingPages) ? bookingPages.length : 'N/A'}</div>
            <div><strong>First Item Type:</strong> {bookingPages && bookingPages[0] ? typeof bookingPages[0] : 'N/A'}</div>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">Raw Response</summary>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto mt-2 max-h-60">
              {JSON.stringify(bookingPages, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 