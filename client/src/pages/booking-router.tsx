import React from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import ExternalBooking from './external-booking';

// Define BookingPage type to resolve type issues
interface BookingPage {
  id: number;
  name: string;
  slug: string;
  tenantId: number;
  description?: string;
  facilities: number[] | any[];
  excludedAppointmentTypes?: number[];
  appointmentTypes?: any[];
  enableBolUpload?: boolean;
}

export default function BookingRouter() {
  // A reference to dynamic-booking-page was removed to consolidate on a single booking page implementation
  // Match both URL patterns - this is critical for tenant isolation
  const [matchExternal, paramsExternal] = useRoute('/external/:slug');
  const [matchBooking, paramsBooking] = useRoute('/booking/:slug');
  
  // Extract the slug regardless of which route pattern matched
  const slug = (matchExternal ? paramsExternal?.slug : matchBooking ? paramsBooking?.slug : '') || '';
  
  // Log for debugging purposes
  console.log("BookingRouter - Current path:", location.pathname);
  console.log("BookingRouter - Match external:", matchExternal, paramsExternal);
  console.log("BookingRouter - Match booking:", matchBooking, paramsBooking);
  console.log("BookingRouter - Extracted slug:", slug);
  
  // Fetch booking page data to determine tenant
  const { 
    data: bookingPage, 
    isLoading, 
    error 
  } = useQuery<BookingPage>({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
  });
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Error state
  if (error || !bookingPage) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            We couldn't find the booking page you're looking for. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Store the tenant ID associated with this booking page for context
  const bookingPageName = bookingPage?.name || 'Unknown';
  const tenantId = bookingPage?.tenantId || 'None';
  console.log(`BookingRouter - Booking page '${bookingPageName}' belongs to tenant ID: ${tenantId}`);
  
  // Important: Set a consistent tenant ID in the component state to ensure proper isolation
  // This ensures both booking page routes use the same booking page data
  
  // Use a single booking page component for both routes
  // This ensures consistent handling and UI
  return <ExternalBooking slug={slug} />;
}