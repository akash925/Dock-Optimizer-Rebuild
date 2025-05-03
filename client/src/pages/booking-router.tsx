import React from "react";
import { useRoute, Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import DynamicBookingPage from "./dynamic-booking-page";
import ExternalBooking from "./external-booking-fixed";

/**
 * BookingRouter component
 * 
 * This is a unified router component that handles both booking page URL patterns:
 * - /booking/:slug
 * - /external/:slug
 * 
 * It extracts the slug parameter and passes it to the appropriate booking page component.
 */
export default function BookingRouter() {
  // Check if we match either of the booking page URL patterns
  const [matchBooking, paramsBooking] = useRoute('/booking/:slug');
  const [matchExternal, paramsExternal] = useRoute('/external/:slug');
  
  // Get the slug from whichever route matched
  const slug = matchBooking ? paramsBooking?.slug : 
               matchExternal ? paramsExternal?.slug : '';
  
  // Log which route was matched and what slug was extracted
  console.log("BookingRouter - Current path:", window.location.pathname);
  console.log("BookingRouter - Match booking:", matchBooking, paramsBooking);
  console.log("BookingRouter - Match external:", matchExternal, paramsExternal);
  console.log("BookingRouter - Using slug:", slug);
  
  // If we didn't match either route pattern, show an error
  if (!matchBooking && !matchExternal) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Invalid booking page URL. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // If we don't have a slug, show an error
  if (!slug) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No booking page slug provided. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Decide which component to render based on the matched route
  // We keep using the original components for now to minimize disruption
  // In the future, we should unify these into a single component
  if (matchBooking) {
    return <DynamicBookingPage slug={slug} />;
  } else {
    return <ExternalBooking />;
  }
}