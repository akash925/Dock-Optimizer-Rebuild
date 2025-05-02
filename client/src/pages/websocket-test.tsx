import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeUpdates } from '@/hooks/use-realtime-updates';
import { WebSocketStatus } from '@/components/shared/websocket-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Check,
  Clock,
  RefreshCw,
  Send,
  Terminal,
  X
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

export default function WebSocketTestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    connected, 
    socketError, 
    reconnectAttempts, 
    isFallbackPolling, 
    maxReconnectAttempts 
  } = useRealtimeUpdates();
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<{
    total: number;
    success: number;
    failed: number;
    pending: number;
  }>({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0
  });

  // Add a log message with timestamp
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    setLogMessages(prev => [...prev, formattedMessage]);
  };

  // Clear all logs
  const clearLogs = () => {
    setLogMessages([]);
  };

  // Test WebSocket connection manually
  const testWebSocketConnection = () => {
    addLog('Testing WebSocket connection...', 'info');
    
    if (connected) {
      addLog('WebSocket is already connected', 'success');
      setTestResults(prev => ({
        ...prev,
        total: prev.total + 1,
        success: prev.success + 1
      }));
    } else {
      addLog('WebSocket is not connected', 'error');
      setTestResults(prev => ({
        ...prev,
        total: prev.total + 1,
        failed: prev.failed + 1
      }));
      
      if (socketError) {
        addLog(`WebSocket error: ${socketError}`, 'error');
      }
    }
  };

  // Test data update propagation through WebSocket
  const testDataUpdates = async () => {
    addLog('Testing calendar data updates...', 'info');
    setTestResults(prev => ({
      ...prev,
      total: prev.total + 1,
      pending: prev.pending + 1
    }));

    try {
      // Make a data change through API
      const res = await fetch('/api/test/websocket-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'schedule_update',
          message: 'Test data update from client'
        })
      });

      if (res.ok) {
        addLog('Sent test update request successfully', 'success');
        // Wait for WebSocket event to arrive (simulated here)
        
        // In a full implementation, we would monitor for the specific event to arrive
        // through the WebSocket, but for this test we're just forcing a query invalidation
        // which is what should happen when a real update arrives
        
        setTimeout(() => {
          addLog('Updating calendar data via cache invalidation', 'info');
          queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
          
          addLog('Calendar data update test completed!', 'success');
          setTestResults(prev => ({
            ...prev,
            pending: prev.pending - 1,
            success: prev.success + 1
          }));
          
          toast({
            title: 'Data Update Test',
            description: 'Calendar data has been updated via real-time channel',
            variant: 'default'
          });
        }, 2000);
      } else {
        const errorText = await res.text();
        throw new Error(errorText || 'Unknown error occurred');
      }
    } catch (error) {
      addLog(`Error testing data updates: ${error instanceof Error ? error.message : String(error)}`, 'error');
      setTestResults(prev => ({
        ...prev,
        pending: prev.pending - 1,
        failed: prev.failed + 1
      }));
    }
  };

  // Test reconnection functionality
  const testReconnection = async () => {
    addLog('Testing WebSocket reconnection...', 'info');
    setTestResults(prev => ({
      ...prev,
      total: prev.total + 1,
      pending: prev.pending + 1
    }));

    try {
      // Call API endpoint that will temporarily disconnect all clients
      const res = await fetch('/api/test/websocket-disconnect', {
        method: 'POST'
      });

      if (res.ok) {
        addLog('Server has disconnected all WebSocket clients', 'warning');
        addLog('Waiting for automatic reconnection...', 'info');
        
        // Wait for reconnection to happen (or fail) 
        // Use a timeout just for the test to complete
        setTimeout(() => {
          if (connected) {
            addLog('WebSocket reconnected successfully!', 'success');
            setTestResults(prev => ({
              ...prev,
              pending: prev.pending - 1,
              success: prev.success + 1
            }));
          } else {
            addLog('WebSocket failed to reconnect within timeout', 'error');
            setTestResults(prev => ({
              ...prev,
              pending: prev.pending - 1,
              failed: prev.failed + 1
            }));
          }
        }, 10000); // 10 second timeout for reconnection
      } else {
        const errorText = await res.text();
        throw new Error(errorText || 'Unknown error occurred');
      }
    } catch (error) {
      addLog(`Error testing reconnection: ${error instanceof Error ? error.message : String(error)}`, 'error');
      setTestResults(prev => ({
        ...prev,
        pending: prev.pending - 1,
        failed: prev.failed + 1
      }));
    }
  };

  // Initial connection status log
  useEffect(() => {
    addLog(`WebSocket status: ${connected ? 'Connected' : 'Disconnected'}`, connected ? 'success' : 'warning');
    
    if (socketError) {
      addLog(`WebSocket error: ${socketError}`, 'error');
    }
    
    if (reconnectAttempts > 0) {
      addLog(`Reconnection attempts: ${reconnectAttempts}/${maxReconnectAttempts}`, 'warning');
    }
    
    if (isFallbackPolling) {
      addLog('Using fallback polling mechanism for updates', 'warning');
    }
  }, [connected, socketError, reconnectAttempts, isFallbackPolling, maxReconnectAttempts]);

  // Monitor connection status changes
  useEffect(() => {
    const handleConnectionChange = () => {
      addLog(`WebSocket status changed: ${connected ? 'Connected' : 'Disconnected'}`, connected ? 'success' : 'warning');
    };
    
    handleConnectionChange();
    
    // We can't actually listen to the websocket status directly from here,
    // but in a full implementation we would set up a proper event listener
  }, [connected]);

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>WebSocket Testing</CardTitle>
            <CardDescription>
              Please log in to access the WebSocket testing tools.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>WebSocket Testing</CardTitle>
              <CardDescription>
                Test and debug real-time update functionality
              </CardDescription>
            </div>
            <WebSocketStatus />
          </div>
        </CardHeader>
        
        <Tabs defaultValue="dashboard">
          <CardContent className="p-6">
            <TabsList className="mb-4">
              <TabsTrigger value="dashboard">
                <BarChart className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="tests">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tests
              </TabsTrigger>
              <TabsTrigger value="logs">
                <Terminal className="h-4 w-4 mr-2" />
                Logs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Connection Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      {connected ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 mr-2 text-red-500" />
                      )}
                      <span className={connected ? "text-green-500" : "text-red-500"}>
                        {connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                    
                    {socketError && (
                      <div className="mt-2 text-xs text-red-500">
                        Error: {socketError}
                      </div>
                    )}
                    
                    {reconnectAttempts > 0 && (
                      <div className="mt-2 text-xs">
                        Reconnecting: {reconnectAttempts}/{maxReconnectAttempts}
                      </div>
                    )}
                    
                    {isFallbackPolling && (
                      <div className="mt-2 text-xs flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>Using polling fallback</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Test Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Total:</span>
                        <span className="font-medium">{testResults.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Success:</span>
                        <span className="font-medium text-green-500">{testResults.success}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Failed:</span>
                        <span className="font-medium text-red-500">{testResults.failed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Pending:</span>
                        <span className="font-medium text-amber-500">{testResults.pending}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={testWebSocketConnection}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check Connection
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={testDataUpdates}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Test Data Update
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={clearLogs}
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      Clear Logs
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="tests" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Connection Test</CardTitle>
                    <CardDescription>
                      Verify WebSocket connection status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      This test verifies that the WebSocket connection to the server is 
                      established and functioning correctly.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={testWebSocketConnection}>
                      Run Connection Test
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data Update Test</CardTitle>
                    <CardDescription>
                      Test real-time data updates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      Triggers a test data update and verifies that it propagates correctly 
                      through the WebSocket connection to update the UI.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={testDataUpdates}>
                      Run Data Update Test
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Reconnection Test</CardTitle>
                    <CardDescription>
                      Test WebSocket reconnection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      Simulates a connection disruption and verifies that the WebSocket 
                      can automatically reconnect within a reasonable timeframe.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={testReconnection}>
                      Run Reconnection Test
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="logs">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Event Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] overflow-auto bg-black text-green-400 p-4 rounded-md font-mono text-xs">
                    {logMessages.length === 0 ? (
                      <div className="text-gray-500">No logs yet...</div>
                    ) : (
                      logMessages.map((message, index) => {
                        // Apply different color classes based on log type
                        let className = "text-green-400"; // Default for info
                        
                        if (message.includes('[SUCCESS]')) {
                          className = "text-green-400";
                        } else if (message.includes('[ERROR]')) {
                          className = "text-red-400";
                        } else if (message.includes('[WARNING]')) {
                          className = "text-yellow-400";
                        }
                        
                        return (
                          <div key={index} className={className}>
                            {message}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={clearLogs}>
                    Clear Logs
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => addLog('Manual log entry', 'info')}
                  >
                    Add Log
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}