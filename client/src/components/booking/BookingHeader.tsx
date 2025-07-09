import React from 'react';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';

interface BookingHeaderProps {
  bookingPage: {
    name: string;
    logo?: string;
  };
}

export function BookingHeader({ bookingPage }: BookingHeaderProps) {
  return (
    <>
      {/* Header with organization logo */}
      <div className="flex items-center mb-6">
        {/* Show organization initial as default - simpler and more reliable */}
        <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
          <span className="text-primary font-bold text-xl">
            {bookingPage.name?.charAt(0) || 'O'}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{bookingPage.name} Dock Appointment Scheduler</h1>
          <p className="text-muted-foreground">
            Please use this form to pick the type of Dock Appointment that
            you need at {bookingPage.name}.
          </p>
        </div>
      </div>

      {/* Dock Optimizer footer */}
      <div className="flex justify-center items-center mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center space-x-2 opacity-60 hover:opacity-100 transition-opacity">
          <img 
            src={dockOptimizerLogo} 
            alt="Powered by Dock Optimizer" 
            className="h-8" 
          />
          <span className="text-sm text-gray-600">
            Powered by Dock Optimizer
          </span>
        </div>
      </div>
    </>
  );
} 