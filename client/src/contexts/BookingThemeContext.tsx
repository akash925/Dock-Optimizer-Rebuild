import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Define the theme interface
export interface BookingTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  buttonStyle: 'rounded' | 'square' | 'pill';
  progressHeight: number;
  borderRadius: number;
  headerFontSize: string;
  subheaderFontSize: string;
  bodyFontSize: string;
  spacing: {
    page: {
      maxWidth: string;
      padding: string;
    },
    section: {
      marginBottom: string;
    },
    field: {
      marginBottom: string;
    }
  };
}

// Default theme values
const defaultTheme: BookingTheme = {
  primaryColor: '#4CAF50',
  secondaryColor: '#2196F3',
  accentColor: '#FF9800',
  backgroundColor: '#ffffff',
  textColor: '#333333',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  buttonStyle: 'rounded',
  progressHeight: 6,
  borderRadius: 8,
  headerFontSize: '24px',
  subheaderFontSize: '18px',
  bodyFontSize: '16px',
  spacing: {
    page: {
      maxWidth: '600px',
      padding: '2rem',
    },
    section: {
      marginBottom: '2rem',
    },
    field: {
      marginBottom: '1.5rem',
    }
  }
};

// Create the theme context
interface BookingThemeContextType {
  theme: BookingTheme;
  setTheme: (theme: Partial<BookingTheme>) => void;
  isLoading: boolean;
}

const BookingThemeContext = createContext<BookingThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {},
  isLoading: false,
});

// Custom hook to use the theme context
export function useBookingTheme() {
  const context = useContext(BookingThemeContext);
  
  if (!context) {
    throw new Error('useBookingTheme must be used within a BookingThemeProvider');
  }
  
  return context;
}

// Provider component
export function BookingThemeProvider({ children, slug }: { 
  children: ReactNode;
  slug: string;
}) {
  const [theme, setThemeState] = useState<BookingTheme>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);
  
  // Function to update theme
  const setTheme = (newTheme: Partial<BookingTheme>) => {
    setThemeState(prevTheme => ({
      ...prevTheme,
      ...newTheme
    }));
  };
  
  // Fetch theme settings from the server
  useEffect(() => {
    const fetchTheme = async () => {
      try {
        setIsLoading(true);
        
        // First try to get booking page specific styles
        const response = await fetch(`/api/admin/booking-styles?slug=${slug}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch booking styles');
        }
        
        const data = await response.json();
        
        // Update theme with fetched data
        setTheme({
          primaryColor: data.primaryColor || defaultTheme.primaryColor,
          secondaryColor: data.secondaryColor || defaultTheme.secondaryColor,
          accentColor: data.accentColor || defaultTheme.accentColor,
          backgroundColor: data.backgroundColor || defaultTheme.backgroundColor,
          textColor: data.textColor || defaultTheme.textColor,
          fontFamily: data.fontFamily || defaultTheme.fontFamily,
          buttonStyle: data.buttonStyle || defaultTheme.buttonStyle,
          progressHeight: data.progressHeight || defaultTheme.progressHeight,
          borderRadius: data.borderRadius || defaultTheme.borderRadius,
          headerFontSize: data.headerFontSize || defaultTheme.headerFontSize,
          subheaderFontSize: data.subheaderFontSize || defaultTheme.subheaderFontSize,
          bodyFontSize: data.bodyFontSize || defaultTheme.bodyFontSize,
          spacing: {
            page: {
              maxWidth: data.pageMaxWidth || defaultTheme.spacing.page.maxWidth,
              padding: data.pagePadding || defaultTheme.spacing.page.padding,
            },
            section: {
              marginBottom: data.sectionMarginBottom || defaultTheme.spacing.section.marginBottom,
            },
            field: {
              marginBottom: data.fieldMarginBottom || defaultTheme.spacing.field.marginBottom,
            }
          }
        });
      } catch (error) {
        console.error('Error fetching booking styles:', error);
        // Keep default theme on error
      } finally {
        setIsLoading(false);
      }
    };
    
    if (slug) {
      fetchTheme();
    } else {
      setIsLoading(false);
    }
  }, [slug]);
  
  // Apply CSS variables for the theme
  useEffect(() => {
    // Get the document root element
    const root = document.documentElement;
    
    // Set CSS variables
    root.style.setProperty('--booking-primary-color', theme.primaryColor);
    root.style.setProperty('--booking-secondary-color', theme.secondaryColor);
    root.style.setProperty('--booking-accent-color', theme.accentColor);
    root.style.setProperty('--booking-background-color', theme.backgroundColor);
    root.style.setProperty('--booking-text-color', theme.textColor);
    root.style.setProperty('--booking-font-family', theme.fontFamily);
    root.style.setProperty('--booking-progress-height', `${theme.progressHeight}px`);
    root.style.setProperty('--booking-border-radius', `${theme.borderRadius}px`);
    root.style.setProperty('--booking-header-font-size', theme.headerFontSize);
    root.style.setProperty('--booking-subheader-font-size', theme.subheaderFontSize);
    root.style.setProperty('--booking-body-font-size', theme.bodyFontSize);
    root.style.setProperty('--booking-page-max-width', theme.spacing.page.maxWidth);
    root.style.setProperty('--booking-page-padding', theme.spacing.page.padding);
    root.style.setProperty('--booking-section-margin-bottom', theme.spacing.section.marginBottom);
    root.style.setProperty('--booking-field-margin-bottom', theme.spacing.field.marginBottom);
    
    // Apply button style as a class
    if (theme.buttonStyle === 'rounded') {
      root.style.setProperty('--booking-button-radius', '8px');
    } else if (theme.buttonStyle === 'square') {
      root.style.setProperty('--booking-button-radius', '0px');
    } else if (theme.buttonStyle === 'pill') {
      root.style.setProperty('--booking-button-radius', '9999px');
    }
  }, [theme]);
  
  return (
    <BookingThemeContext.Provider
      value={{
        theme,
        setTheme,
        isLoading
      }}
    >
      {children}
    </BookingThemeContext.Provider>
  );
}