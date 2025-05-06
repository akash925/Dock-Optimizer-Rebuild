# Dock Optimizer - Architecture Document

## 1. Overview

Dock Optimizer is a comprehensive dock appointment scheduling system designed to optimize loading dock operations for logistics facilities. The application enables facilities to manage incoming and outgoing shipments efficiently through appointment scheduling, real-time tracking, and notifications. 

The system supports multi-tenancy, allowing different organizations to maintain their own isolated environments within the same application. It features modular architecture, with components like appointment scheduling, calendar management, asset tracking, email notifications, and analytics that can be enabled or disabled per tenant.

## 2. System Architecture

Dock Optimizer follows a modern full-stack JavaScript/TypeScript architecture with clear separation of concerns:

### 2.1 High-Level Architecture

The application is built as a single codebase with distinct front-end and back-end sections:

- **Client-side**: React-based single-page application (SPA)
- **Server-side**: Express.js Node.js API server
- **Database**: PostgreSQL database with Drizzle ORM
- **Shared code**: Common TypeScript types and schemas used by both client and server

### 2.2 Directory Structure

```
/
├── client/            # Frontend React application
├── server/            # Backend Express.js application
├── shared/            # Shared TypeScript types and schemas
│   └── schema.ts      # Database schema definition using Drizzle
├── migrations/        # Database migration files
└── cypress/           # End-to-end testing
```

### 2.3 Technology Stack

- **Frontend**: React, TypeScript, Vite, Shadcn UI (built on Radix UI)
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based authentication
- **Email**: SendGrid for email notifications
- **Testing**: Jest for unit tests, Cypress for E2E tests
- **Deployment**: Configured for Replit deployment with autoscaling

## 3. Key Components

### 3.1 Frontend Architecture

The frontend is built with React and uses Vite as the build tool. Key architectural decisions include:

- **UI Framework**: Uses Shadcn UI components library (built on Radix UI primitives) for accessible, customizable components
- **State Management**: Uses React Query for server state management
- **Routing**: React Router for client-side navigation
- **Form Handling**: React Hook Form with Zod validation
- **Calendar Integration**: FullCalendar for calendar views and scheduling
- **Theming**: Custom theme configuration via `theme.json`

### 3.2 Backend Architecture

The backend is an Express.js application written in TypeScript:

- **API Structure**: RESTful API endpoints organized by domain
- **Middleware Pattern**: Uses Express middleware for cross-cutting concerns
- **Module System**: Supports pluggable modules that can be enabled/disabled per tenant
- **Authentication**: Session-based authentication with Passport.js
- **Database Access**: Drizzle ORM for type-safe database queries

### 3.3 Multi-tenancy System

Dock Optimizer employs a multi-tenant architecture where multiple organizations can use the application while maintaining data isolation:

- Each tenant (organization) has its own set of facilities, users, and configuration
- Tenant-specific modules can be enabled or disabled
- Middleware ensures users can only access data from their organization
- Super-admin role can access all tenants for administrative purposes

### 3.4 Notification System

The application includes a comprehensive notification system:

- **Email Templates**: HTML and plain text templates for various notifications
- **QR Code Integration**: Generates QR codes for driver check-ins
- **Calendar Attachments**: ICS files for calendar integration
- **Reminder Scheduler**: Automatic sending of appointment reminders
- **Provider**: SendGrid for email delivery

## 4. Data Flow

### 4.1 Appointment Scheduling Flow

1. User selects a facility and appointment type
2. System checks availability based on facility constraints and displays available time slots
3. User enters appointment details (driver, truck, trailer, etc.)
4. System creates the appointment and sends confirmation email with QR code
5. Reminder emails are sent based on configured schedule
6. Upon arrival, driver can check in using the QR code

### 4.2 Tenant Data Isolation

1. User authenticates with username/password
2. System identifies the user's organization (tenant)
3. Tenant middleware restricts data access to the user's organization
4. API endpoints filter data based on the user's tenant
5. Role-based permissions further restrict actions within the tenant

### 4.3 Module Activation Flow

1. System loads base functionality regardless of tenant
2. Tenant configuration is retrieved from database
3. Tenant-specific modules are dynamically loaded based on configuration
4. UI adapts to show only features from enabled modules
5. API endpoints check module availability before processing requests

## 5. External Dependencies

### 5.1 Key Third-Party Services

- **SendGrid**: Email delivery service for sending notifications
- **Neon Database**: PostgreSQL database provider (serverless)

### 5.2 Frontend Dependencies

- **@fullcalendar**: Calendar UI components
- **@radix-ui**: UI component primitives
- **@tanstack/react-query**: Data fetching and caching
- **@hookform/resolvers**: Form validation integration

### 5.3 Backend Dependencies

- **@neondatabase/serverless**: PostgreSQL database client
- **drizzle-orm**: Type-safe ORM for database access
- **passport**: Authentication middleware
- **@sendgrid/mail**: Email service integration

## 6. Deployment Strategy

### 6.1 Hosting Environment

The application is configured for deployment on Replit, with the following characteristics:

- **Build Process**: Uses Vite for frontend build and esbuild for backend build
- **Runtime**: Node.js 20
- **Database**: PostgreSQL 16
- **Autoscaling**: Configured for automatic scaling
- **Environment Variables**: Configuration via .env file

### 6.2 CI/CD Approach

- Basic test checking scripts provided for pre-deployment verification
- Environment-specific configuration via NODE_ENV
- Separate build and start scripts defined in package.json

### 6.3 Database Management

- Schema defined using Drizzle ORM
- Migrations managed through drizzle-kit
- Initial data setup scripts for creating admin users and tenant data

### 6.4 Scaling Considerations

- Application is designed to scale horizontally
- Serverless database (Neon) supports scaling
- Session management may need to be adjusted for multi-instance deployment
- Static assets are served from the application for simplicity, but could be moved to a CDN

## 7. Security Considerations

### 7.1 Authentication and Authorization

- Password storage uses scrypt with salt for secure hashing
- Session-based authentication with secure cookies
- Role-based authorization with tenant isolation
- Input validation with Zod schemas

### 7.2 Data Protection

- Multi-tenant isolation prevents access to other organizations' data
- Data encryption at rest through the database
- API routes check tenant permissions before allowing access
- Account credentials stored with proper password hashing