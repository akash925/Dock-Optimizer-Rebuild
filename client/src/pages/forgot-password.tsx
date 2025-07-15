import React, { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddEmailForm, setShowAddEmailForm] = useState(false);
  const [username, setUsername] = useState('');

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('POST', '/api/auth/request-password-reset', data);
      
      if (response.ok) {
        setIsSubmitted(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmailToAccount = async () => {
    if (!username || !form.getValues('email')) {
      setError('Please enter both username and email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('POST', '/api/auth/add-email-to-account', {
        username,
        email: form.getValues('email'),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.canRequestReset) {
          // Now try to request password reset
          await onSubmit({ email: form.getValues('email') });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add email to account');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="mt-4">Check Your Email</CardTitle>
            <CardDescription>
              We've sent password reset instructions to your email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                If an account with that email exists, you'll receive a password reset link within a few minutes.
              </AlertDescription>
            </Alert>
            
            <div className="text-center text-sm text-gray-600">
              <p>Didn't receive the email?</p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• Check your spam folder</li>
                <li>• Make sure the email address is correct</li>
                <li>• Wait a few minutes for delivery</li>
              </ul>
            </div>

            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSubmitted(false);
                  setError(null);
                  form.reset();
                }}
                className="w-full"
              >
                Try Different Email
              </Button>
              
              <Link href="/auth">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                {...form.register('email')}
                disabled={isLoading}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          {/* Option for users without email */}
          <div className="mt-6 border-t pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Don't have an email associated with your account?
              </p>
              
              {!showAddEmailForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowAddEmailForm(true)}
                  className="w-full"
                >
                  Add Email to My Account
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleAddEmailToAccount}
                      disabled={isLoading || !username || !form.getValues('email')}
                      className="flex-1"
                    >
                      {isLoading ? 'Adding...' : 'Add Email & Send Reset'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddEmailForm(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/auth">
              <Button variant="ghost" className="text-sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 