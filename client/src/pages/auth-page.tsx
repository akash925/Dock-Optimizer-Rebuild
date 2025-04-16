import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TruckIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";
import hanzoLogo from "@/assets/hanzo_logo.jpeg";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "manager", "worker"]),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Get auth context
  const { loginMutation, registerMutation, user } = useAuth();
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "worker",
    },
  });
  
  // Handle login submission
  async function onLoginSubmit(data: LoginFormValues) {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate("/");
      }
    });
  }
  
  // Handle registration submission
  async function onRegisterSubmit(data: RegisterFormValues) {
    registerMutation.mutate(data, {
      onSuccess: () => {
        navigate("/");
      }
    });
  }

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <div className="flex flex-col md:flex-row w-full">
        {/* Form Section */}
        <div className="flex items-center justify-center w-full md:w-1/2 p-8">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="flex items-center justify-between w-full mb-4">
                  <img 
                    src={dockOptimizerLogo} 
                    alt="Dock Optimizer Logo" 
                    className="h-14"
                  />
                  <img 
                    src={hanzoLogo} 
                    alt="Hanzo Logistics Logo" 
                    className="h-12"
                  />
                </div>
              </div>
              <CardTitle className="text-xl text-center">Welcome back</CardTitle>
              <CardDescription className="text-center">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                {/* Login Form */}
                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Logging in..." : "Login"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
                
                {/* Register Form */}
                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john.doe@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="johndoe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              {...field}
                            >
                              <option value="worker">Dock Worker</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : "Register"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col items-center">
              <p className="text-xs text-center text-neutral-500 mt-4 mb-4">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
              <div className="flex items-center text-xs text-neutral-500">
                <span>© 2025 Conmitto Inc. All rights reserved</span>
              </div>
            </CardFooter>
          </Card>
        </div>
        
        {/* Hero Section */}
        <div className="hidden md:flex md:w-1/2 bg-primary items-center justify-center p-8">
          <div className="max-w-md text-white">
            <h1 className="text-3xl font-bold mb-6">Optimize Your Dock Operations</h1>
            <p className="mb-6">
              Dock Optimizer helps you streamline your warehouse operations with efficient truck scheduling, real-time dock monitoring, and powerful analytics.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="bg-white bg-opacity-20 p-2 rounded-full mr-4">
                  <TruckIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Intelligent Scheduling</h3>
                  <p className="text-sm text-white text-opacity-80">
                    Automatically assign trucks to optimal loading/unloading bays
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="bg-white bg-opacity-20 p-2 rounded-full mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M21 12H3" />
                    <path d="M12 3v18" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Real-time Visibility</h3>
                  <p className="text-sm text-white text-opacity-80">
                    Monitor dock status and truck arrivals in real-time
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="bg-white bg-opacity-20 p-2 rounded-full mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Advanced Analytics</h3>
                  <p className="text-sm text-white text-opacity-80">
                    Track KPIs and identify optimization opportunities
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
