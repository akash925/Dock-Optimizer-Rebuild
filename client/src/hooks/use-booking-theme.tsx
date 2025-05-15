import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import dockOptimizerLogo from '@/assets/logo-text-horizontal.svg';

interface BookingThemeContextType {
  theme: {
    primaryColor: string;
    textColor: string;
    backgroundColor: string;
  };
  logo: string | null;
  isLoading: boolean;
}

const defaultTheme = {
  primaryColor: '#2563eb', // Blue
  textColor: '#1f2937', // Dark gray
  backgroundColor: '#ffffff', // White
};

const BookingThemeContext = createContext<BookingThemeContextType>({
  theme: defaultTheme,
  logo: null,
  isLoading: false,
});

interface BookingThemeProviderProps {
  children: ReactNode;
  slug: string;
}

export function BookingThemeProvider({ children, slug }: BookingThemeProviderProps) {
  const [theme, setTheme] = useState(defaultTheme);
  const [logo, setLogo] = useState<string | null>(null);
  
  // Define BookingPage interface
  interface BookingPage {
    id: number;
    tenantId: number;
    themeColor?: string;
    textColor?: string;
    backgroundColor?: string;
  }
  
  // Fetch booking page data to get tenant ID
  const { data: bookingPage, isLoading: isBookingPageLoading } = useQuery<BookingPage>({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
  });

  // Fetch tenant theme data
  useEffect(() => {
    if (bookingPage?.tenantId) {
      // Try to fetch the logo
      fetch(`/api/booking-pages/logo/${bookingPage.id}`)
        .then(response => {
          if (response.ok) {
            return response.blob();
          }
          return null;
        })
        .then(blob => {
          if (blob) {
            const logoUrl = URL.createObjectURL(blob);
            setLogo(logoUrl);
          }
        })
        .catch(error => {
          console.error('Error fetching booking page logo:', error);
        });

      // Get theme data
      // For now using a simplified approach with default values
      const tenantTheme = {
        primaryColor: bookingPage.themeColor || defaultTheme.primaryColor,
        textColor: bookingPage.textColor || defaultTheme.textColor,
        backgroundColor: bookingPage.backgroundColor || defaultTheme.backgroundColor,
      };
      
      setTheme(tenantTheme);
    }
  }, [bookingPage]);

  return (
    <BookingThemeContext.Provider value={{ theme, logo, isLoading: isBookingPageLoading }}>
      {children}
    </BookingThemeContext.Provider>
  );
}

export function useBookingTheme() {
  const context = useContext(BookingThemeContext);
  if (!context) {
    throw new Error('useBookingTheme must be used within a BookingThemeProvider');
  }
  return context;
}