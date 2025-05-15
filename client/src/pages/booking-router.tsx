// This file replaces: client/src/pages/booking-router.tsx

import React from 'react';
import { Route, Switch } from 'wouter';
import ExternalBooking from './external-booking';

export default function BookingRouter() {
  return (
    <Switch>
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
