# 🚀 Dock Optimizer

[![License: Commercial](https://img.shields.io/badge/License-Commercial-blue.svg)]
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0%2B-blue.svg)](https://reactjs.org/)

> **Transform your warehouse operations with intelligent dock scheduling, real-time monitoring, and powerful analytics.**

Dock Optimizer is an enterprise-grade warehouse management system that streamlines truck scheduling, optimizes dock utilization, and provides comprehensive operational insights for logistics facilities.

## 🎯 **Key Features**

### 🚛 **Intelligent Scheduling**
- **Smart Appointment Management**: AI-powered scheduling that optimizes dock assignments
- **Multi-Facility Support**: Manage multiple warehouse locations from a single platform
- **Flexible Time Slots**: Customizable appointment durations and buffer times
- **Concurrent Booking**: Support for multiple appointments per time slot
- **Break Time Management**: Automatic handling of facility break periods

### 📊 **Real-Time Operations Dashboard**
- **Live Dock Status**: Monitor all docks in real-time with visual status indicators
- **Door Manager Console**: Comprehensive dock management interface for operators
- **Capacity Planning**: Track utilization rates and optimize resource allocation
- **Queue Management**: Visual representation of appointment queues and wait times

### 📋 **Advanced Appointment System**
- **External Booking Portal**: Public-facing appointment booking for carriers
- **Internal Scheduling**: Staff interface for creating and managing appointments
- **Bill of Lading (BOL) Management**: Digital BOL upload and OCR processing
- **QR Code Integration**: Generate and scan QR codes for streamlined check-ins
- **Email Notifications**: Automated confirmations and reminders

### 📈 **Analytics & Reporting**
- **Dock Utilization Analytics**: Comprehensive utilization reports and trends
- **Performance Metrics**: KPI tracking for operational efficiency
- **Custom Dashboards**: Configurable views for different user roles
- **Data Export**: Export capabilities for further analysis

### 🏢 **Enterprise Features**
- **Multi-Tenant Architecture**: Secure tenant isolation for enterprise deployments
- **Role-Based Access Control**: Granular permissions for different user types
- **Module Management**: Enable/disable features per organization
- **Asset Management**: Track and manage warehouse equipment and resources

## 🏗️ **Architecture**

### **Technology Stack**
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Authentication**: Passport.js with session management
- **File Storage**: Multi-provider support (local, cloud)
- **Deployment**: Docker + Replit + Neon Database

### **System Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express API    │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tailwind CSS │    │   Drizzle ORM   │    │  Neon Database  │
│     shadcn/ui   │    │   WebSockets    │    │    (Cloud)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### **1. Clone the Repository**
```bash
git clone https://github.com/your-org/dock-optimizer.git
cd dock-optimizer
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Configure your database URL
echo "DATABASE_URL=your_postgresql_connection_string" >> .env
echo "NODE_ENV=development" >> .env
```

### **4. Database Setup**
```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### **5. Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 📖 **Usage Guide**

### **For Administrators**
1. **Organization Setup**: Configure facilities, docks, and appointment types
2. **User Management**: Create and manage user accounts with appropriate roles
3. **Module Configuration**: Enable/disable features per organization
4. **Analytics Review**: Monitor system performance and utilization metrics

### **For Dock Managers**
1. **Door Management**: Monitor and control dock assignments in real-time
2. **Appointment Oversight**: View and manage all scheduled appointments
3. **Capacity Planning**: Analyze utilization and optimize scheduling
4. **Report Generation**: Create operational reports for stakeholders

### **For Carriers (External Users)**
1. **Online Booking**: Use the public portal to schedule appointments
2. **Appointment Management**: Modify or cancel existing bookings
3. **Document Upload**: Submit BOL and required documentation
4. **QR Code Check-in**: Use mobile devices for streamlined arrival process

## 🛠️ **Configuration**

### **Environment Variables**
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Application
NODE_ENV=development|production
PORT=5000
SESSION_SECRET=your-session-secret

# Features
ENABLE_OCR=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_QR_CODES=true

# Storage
UPLOAD_PROVIDER=local|aws|azure
AWS_BUCKET_NAME=your-bucket
AZURE_STORAGE_ACCOUNT=your-account
```

### **Appointment Types Configuration**
```javascript
{
  "name": "Standard Loading",
  "duration": 120, // minutes
  "bufferTime": 30, // minutes
  "maxConcurrent": 2,
  "allowThroughBreaks": false,
  "requiresBOL": true
}
```

### **Facility Hours Setup**
```javascript
{
  "monday": { "open": "06:00", "close": "18:00", "breakStart": "12:00", "breakEnd": "13:00" },
  "tuesday": { "open": "06:00", "close": "18:00", "breakStart": "12:00", "breakEnd": "13:00" },
  // ... other days
}
```

## 🧪 **Testing**

### **Run Test Suite**
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### **Manual Testing Scripts**
```bash
# Test database connectivity
npm run test:db

# Test email notifications
npm run test:email

# Test OCR processing
npm run test:ocr
```

## 🚀 **Deployment**

### **Production Deployment (Replit)**
1. Fork or import the repository to Replit
2. Configure environment variables in Replit Secrets
3. Connect to Neon PostgreSQL database
4. Deploy using the Run button

### **Docker Deployment**
```bash
# Build image
docker build -t dock-optimizer .

# Run container
docker run -p 5000:5000 \
  -e DATABASE_URL=your_db_url \
  -e NODE_ENV=production \
  dock-optimizer
```

### **Traditional Server Deployment**
```bash
# Build application
npm run build

# Start production server
npm start
```

## 📊 **API Documentation**

### **Authentication Endpoints**
- `POST /api/login` - User authentication
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user info

### **Appointment Management**
- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

### **Availability**
- `GET /api/availability` - Get available time slots
- `GET /api/availability/v2` - Enhanced availability with capacity info

### **Dock Management**
- `GET /api/docks` - List all docks
- `GET /api/docks/:id/status` - Get dock status
- `POST /api/docks/:id/assign` - Assign appointment to dock

## 🔧 **Development**

### **Project Structure**
```
dock-optimizer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   └── middleware/    # Express middleware
├── shared/                 # Shared types and schemas
├── migrations/            # Database migrations
└── public/               # Static assets
```

### **Development Commands**
```bash
# Start development with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Database operations
npm run db:migrate
npm run db:reset
npm run db:studio

# Build for production
npm run build
```

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Process**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is proprietary software. All rights reserved by Conmitto Inc.

## 🆘 **Support**

- **Documentation**: [docs.conmitto.io](https://docs.conmitto.io)
- **Issues**: [GitHub Issues](https://github.com/your-org/dock-optimizer/issues)
- **Community**: [Discord Server](https://discord.gg/dock-optimizer)
- **Email**: support@conmitto.io

## 🏢 **About Conmitto**

Dock Optimizer is developed by [Conmitto Inc](https://conmitto.io), a leading provider of logistics and warehouse management solutions. We specialize in creating intelligent systems that optimize supply chain operations.

- **Website**: [conmitto.io](https://conmitto.io)
- **Privacy Policy**: [conmitto.io/privacy-policy](https://conmitto.io/privacy-policy)
- **Terms of Service**: [conmitto.io/terms-of-service](https://conmitto.io/terms-of-service)

---

<div align="center">
  <p><strong>Made with ❤️ by the Conmitto Team</strong></p>
  <p>© 2025 Conmitto Inc. All rights reserved.</p>
</div> 