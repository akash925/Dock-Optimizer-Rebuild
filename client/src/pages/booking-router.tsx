// This file replaces: client/src/pages/booking-router.tsx

import React from 'react';
import { Route, Switch, useRoute, useLocation } from 'wouter';
import ExternalBooking from './external-booking';
import BookingConfirmation from './booking-confirmation';

export default function BookingRouter() {
  const [_, params] = useRoute('/booking/:slug');
  const [_isExternal, externalParams] = useRoute('/external/:slug');
  const [__, setLocation] = useLocation();
  
  // If accessed via /booking/:slug, redirect to /external/:slug
  if (params?.slug) {
    // Redirecting to the proper /external/:slug URL
    React.useEffect(() => {
      setLocation(`/external/${params.slug}`);
    }, [params.slug, setLocation]);
    
    return <div className="p-6 text-center">Redirecting to the correct booking page URL...</div>;
  }
  
  return (
    <Switch>
      <Route path="/external/:slug/confirmation/:code">
        {(params) => <BookingConfirmation confirmationCode={params.code} />}
      </Route>
      <Route path="/external/:slug">
        {(params) => <ExternalBooking slug={params.slug} />}
      </Route>
      <Route>
        <div className="p-6 text-center text-gray-500">
          Invalid booking link. Please check your URL.
        </div>
      </Route>
    </Switch>
  );
}
