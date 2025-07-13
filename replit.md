# Dock Optimizer - Replit Development Guide

## Overview

Dock Optimizer is an enterprise-grade warehouse management system that streamlines truck scheduling, optimizes dock utilization, and provides comprehensive operational insights for logistics facilities. The application features intelligent scheduling, real-time operations dashboard, advanced appointment system, analytics & reporting, and enterprise features with multi-tenant architecture.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: Radix UI components with Tailwind CSS for styling
- **State Management**: Built-in React state with context for global state
- **Routing**: Client-side routing for single-page application experience
- **Real-time Updates**: WebSocket integration for live dock status updates

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Authentication**: Passport.js with local strategy and session management
- **Session Storage**: PostgreSQL-based sessions with memory fallback
- **File Handling**: Multer for file uploads with organized directory structure
- **WebSocket**: Secure WebSocket handler with tenant isolation
- **API Design**: RESTful APIs with proper error handling and validation

### Database Architecture
- **Primary Database**: PostgreSQL via Neon serverless platform
- **ORM**: Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless connection with WebSocket support
- **Schema Management**: Drizzle migrations with comprehensive schema definitions
- **Multi-tenancy**: Tenant isolation at the database level with foreign key constraints

## Key Components

### Authentication & Authorization
- **Strategy**: Local authentication with bcrypt password hashing
- **Session Management**: Express sessions with PostgreSQL storage
- **Role-Based Access Control**: Granular permissions with organization-level roles
- **Multi-tenant Security**: Tenant isolation middleware ensuring data separation

### Appointment Management
- **Scheduling Engine**: Intelligent appointment scheduling with conflict detection
- **Time Slot Management**: Configurable time slots with buffer periods and break times
- **External Booking**: Public-facing booking pages for carriers
- **Email Notifications**: Automated confirmations, reminders, and updates via SendGrid
- **QR Code Integration**: Dynamic QR code generation for appointment check-ins

### Facility Management
- **Multi-facility Support**: Organization can manage multiple warehouse locations
- **Dock Management**: Real-time dock status tracking and assignment
- **Hours Configuration**: Flexible facility hours with break period support
- **Holiday Management**: Company-wide and facility-specific closure handling

### Document Processing
- **BOL Management**: Bill of Lading upload and OCR processing
- **File Storage**: Organized file system with categorized uploads
- **OCR Integration**: Python-based OCR processing with PaddleOCR
- **Document Validation**: Pre-processing validation for optimal OCR results

### Real-time Features
- **WebSocket Communication**: Secure, tenant-isolated real-time updates
- **Live Dashboard**: Real-time dock status and appointment updates
- **Push Notifications**: Instant updates for status changes
- **Auto-refresh**: Fallback polling mechanism for reliability

## Data Flow

### Appointment Booking Flow
1. External carrier accesses public booking page
2. System checks facility availability and appointment type constraints
3. Available time slots calculated based on facility hours and existing appointments
4. Appointment created with confirmation email sent
5. QR code generated for check-in process
6. Real-time updates broadcast to connected clients

### Authentication Flow
1. User credentials validated against database
2. Session created and stored in PostgreSQL
3. User enriched with tenant and role information
4. Module permissions loaded based on organization settings
5. Tenant-specific data access enforced throughout application

### Document Processing Flow
1. File uploaded via multer to organized directory structure
2. Document validated for type, size, and quality
3. OCR processing initiated via Python script
4. Extracted data validated and stored
5. Results linked to appointment record
6. Processing metrics recorded for performance monitoring

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **Connection**: Uses @neondatabase/serverless driver with WebSocket support

### Email Services
- **SendGrid**: Email delivery service for notifications
- **Configuration**: API key and verified sender email required
- **Templates**: HTML email templates with embedded QR codes

### File Processing
- **Multer**: File upload middleware with size and type restrictions
- **Python OCR**: PaddleOCR for document text extraction
- **PDF Processing**: pdf2image for PDF to image conversion

### UI Libraries
- **Radix UI**: Accessible component library for React
- **Tailwind CSS**: Utility-first CSS framework
- **FullCalendar**: Calendar component for appointment visualization
- **Nivo**: Data visualization library for analytics

### Development Tools
- **Vite**: Fast build tool with hot module replacement
- **TypeScript**: Type checking and enhanced development experience
- **Drizzle Kit**: Database migration and introspection tools
- **Vitest**: Unit testing framework

## Deployment Strategy

### Production Environment
- **Platform**: Replit autoscale deployment
- **Database**: Neon PostgreSQL with production connection string
- **Build Process**: Vite production build with asset optimization
- **Environment Variables**: Secure secrets management via Replit Secrets

### Development Setup
- **Local Development**: tsx with dotenv for environment configuration
- **Database**: Same Neon database for consistency (not recommended for team development)
- **Hot Reload**: Vite dev server with WebSocket support disabled to prevent connection errors
- **File Watching**: Automatic TypeScript compilation and server restart

### Configuration Management
- **Environment Variables**: Centralized configuration via .env files
- **Secrets**: Sensitive data stored in Replit Secrets (production) or .env (development)
- **Feature Flags**: Database-driven module enablement per organization
- **Multi-tenant**: Tenant-specific configuration and data isolation

### Build & Deployment
- **Frontend Build**: Vite builds React application to dist/public
- **Backend Build**: esbuild compiles TypeScript server to dist/index.js
- **Production Start**: Node.js serves compiled application
- **Asset Serving**: Express static middleware for uploaded files

## Changelog
- June 16, 2025: Initial setup
- June 16, 2025: Fixed Door Manager empty data issue - Added missing `/api/docks` endpoint that frontend components were calling. Database now successfully returns all 36 docks with proper tenant filtering.
- June 17, 2025: **CRITICAL SECURITY FIX** - Implemented strict tenant isolation across entire system:
  - Fixed cross-tenant data leakage by enforcing INNER JOIN filtering on appointment_types.tenant_id
  - Applied zero-cache strategy (staleTime: 0, gcTime: 30s) to prevent cached data contamination
  - Resolved "No facility assigned" issue with proper field name transformation (snake_case to camelCase)
  - Fixed empty Appointment Master and User Management pages by creating missing components
  - Enhanced date/time display across appointments with proper null validation
- July 12, 2025: **TIMEZONE & AVAILABILITY SYSTEM FIX** - Completely resolved booking system issues:
  - Fixed critical timezone conversion bug causing 4:00 AM slots instead of 8:00 AM
  - Verified system works dynamically across different facilities, appointment types, and tenant accounts
  - Confirmed all dashboard components use real API data (not hardcoded mock data)
  - Validated facility hours properly enforced (8:00 AM - 5:00 PM Eastern Time)
  - Tested appointment master questions load correctly (9 questions per type)
  - Confirmed capacity management works with different limits per appointment type
- July 13, 2025: **BOOKING SYSTEM COMPLETION & OCR INTEGRATION** - Finalized external booking flow:
  - Fixed booking form submission payload structure to use date/time instead of startTime/endTime
  - Verified OCR service is fully operational with Tesseract.js fallback processing
  - Confirmed booking API endpoint works correctly (multiple test bookings created successfully)
  - Created organization_holidays table for proper holiday management in availability system
  - Enhanced BOL upload wizard with proper form integration and OCR data extraction
  - Validated complete booking flow works end-to-end with email confirmations
- July 13, 2025: **EXTERNAL BOOKING SYSTEM FULLY OPERATIONAL** - Complete system integration:
  - **Standard Questions System**: Created 9 standard questions for appointment type 1 (driver name, phone, truck number, etc.)
  - **Database Schema Fixed**: Resolved NOT NULL constraints on truck_number and created_by fields
  - **Booking API Working**: External booking endpoint successfully creates appointments with confirmation codes
  - **Real-time Notifications**: WebSocket integration for instant calendar updates upon booking creation
  - **Organization Branding**: Logo display and tenant-specific styling implemented
  - **BOL Upload Enhanced**: Email-like attachment display with file icons, sizes, and confidence scores
  - **Complete Flow Validated**: External booking at `/external/test-booking-page` works end-to-end
  - **Appointment Details**: All booking data properly stored and accessible in appointment details modal
- July 13, 2025: **CRITICAL UI FIXES AND FUNCTIONALITY VERIFICATION** - Resolved major interface issues:
  - **External Booking UI Fixed**: Removed duplicate nested header structure causing double display
  - **Asset Manager Verified**: Update Asset form submission properly configured with mutation handling
  - **Appointment Master Enhanced**: Questions save functionality implemented with proper API calls
  - **Console Logging Added**: Enhanced debugging for form submissions and mutation tracking
  - **Frontend-Backend Connections**: Verified all API endpoints and form handling mechanisms working

## User Preferences

Preferred communication style: Simple, everyday language.