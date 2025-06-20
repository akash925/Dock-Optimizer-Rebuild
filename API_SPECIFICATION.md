# Dock Optimizer API Specification v2.0

## Overview
The Dock Optimizer API is a comprehensive, enterprise-grade REST API designed for multi-tenant dock and appointment management systems. This API provides secure, scalable endpoints for managing facilities, appointments, schedules, and real-time dock operations.

## Base URL
- **Production**: `https://your-domain.com/api`
- **Development**: `http://localhost:5001/api`

## Authentication
All API endpoints require authentication via session-based authentication.

### Authentication Flow
```http
POST /api/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "id": 1,
  "username": "user@example.com",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin",
  "tenantId": 5,
  "modules": ["appointments", "doorManager", "analytics"]
}
```

### Session Management
- **Login**: `POST /api/login`
- **Logout**: `POST /api/logout`
- **Current User**: `GET /api/user`

## Core API Endpoints

### 1. Availability Management

#### Get Available Time Slots
```http
GET /api/availability?date=2025-06-20&facilityId=7&appointmentTypeId=17
```

**Parameters:**
- `date` (required): Date in YYYY-MM-DD format
- `facilityId` (required): Facility identifier
- `appointmentTypeId` (required): Appointment type identifier
- `bookingPageSlug` (optional): For external booking pages

**Response:**
```json
{
  "availableTimes": ["09:00", "09:30", "10:00", "10:30"],
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "remainingCapacity": 2,
      "reason": ""
    }
  ]
}
```

#### Enhanced Availability (v2)
```http
GET /api/availability/v2?date=2025-06-20&facilityId=7&appointmentTypeId=17
```

**Response:**
```json
{
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "remainingCapacity": 2,
      "remaining": 2,
      "reason": ""
    }
  ]
}
```

### 2. Schedule Management

#### Get Schedules
```http
GET /api/schedules
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 180,
    "startTime": "2025-06-17T09:00:00.000Z",
    "endTime": "2025-06-17T13:00:00.000Z",
    "dockId": 24,
    "appointmentTypeId": 17,
    "status": "scheduled",
    "customerName": "Example Corp",
    "carrierName": "FedEx",
    "confirmationCode": "HZL-000108"
  }
]
```

#### Schedule Operations
- **Check In**: `PATCH /api/schedules/{id}/check-in`
- **Check Out**: `PATCH /api/schedules/{id}/check-out`
- **Cancel**: `PATCH /api/schedules/{id}/cancel`

### 3. Appointment Types

#### Get Appointment Types
```http
GET /api/appointment-types
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 17,
    "name": "4 Hour Container Appointment",
    "duration": 240,
    "bufferTime": 60,
    "maxConcurrent": 2,
    "facilityId": 7,
    "tenantId": 5,
    "type": "INBOUND"
  }
]
```

#### Create Appointment Type
```http
POST /api/appointment-types
Authorization: Required
Content-Type: application/json

{
  "name": "Express Delivery",
  "duration": 60,
  "facilityId": 7,
  "type": "INBOUND",
  "maxConcurrent": 1
}
```

### 4. Facility Management

#### Get Facilities
```http
GET /api/facilities
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 7,
    "name": "Fresh Connect HQ",
    "address": "123 Main St",
    "timezone": "America/New_York",
    "isActive": true
  }
]
```

### 5. Dock Management

#### Get Docks
```http
GET /api/docks
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 24,
    "name": "A-01",
    "facilityId": 7,
    "isActive": true,
    "status": "available"
  }
]
```

#### Get Specific Dock
```http
GET /api/docks/{id}
Authorization: Required
```

### 6. User Management

#### Get Users
```http
GET /api/users
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 5,
    "username": "admin@company.com",
    "email": "admin@company.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",
    "organizationRole": "admin"
  }
]
```

#### User Profile Operations
- **Get Profile**: `GET /api/user`
- **Update Profile**: `PUT /api/user/profile`
- **Change Password**: `PUT /api/user/password`
- **Get Preferences**: `GET /api/user-preferences`
- **Update Preferences**: `PUT /api/user-preferences`

### 7. Organization Management

#### Current Organization
```http
GET /api/organizations/current
Authorization: Required
```

#### Default Hours
```http
GET /api/organizations/default-hours
PATCH /api/organizations/default-hours
Authorization: Required
```

#### Holidays
```http
GET /api/organizations/holidays
POST /api/organizations/holidays
PATCH /api/organizations/holidays/{id}
DELETE /api/organizations/holidays/{id}
Authorization: Required
```

### 8. Booking Pages

#### Get Booking Pages
```http
GET /api/booking-pages
Authorization: Required
```

#### Public Booking Page Access
```http
GET /api/public/booking-pages/slug/{slug}
```

### 9. Analytics

#### Dock Utilization
```http
GET /api/analytics/dock-utilization
Authorization: Required
```

### 10. Carriers

#### Get Carriers
```http
GET /api/carriers
Authorization: Required
```

## Security Features

### Multi-Tenant Isolation
- All endpoints enforce strict tenant isolation
- Users can only access data belonging to their organization
- Cross-tenant data leakage prevention

### Input Validation
- Comprehensive parameter validation
- SQL injection prevention
- XSS protection

### Rate Limiting
- Configurable rate limits per endpoint
- Tenant-specific rate limiting

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-06-17T10:00:00.000Z"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## WebSocket Support

### Real-Time Updates
```javascript
const ws = new WebSocket('ws://localhost:5001/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  tenantId: 5,
  userId: 1
}));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle schedule_update, dock_status, etc.
};
```

## Data Models

### Schedule
```typescript
interface Schedule {
  id: number;
  startTime: string;
  endTime: string;
  dockId: number | null;
  appointmentTypeId: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  customerName: string;
  carrierName: string;
  confirmationCode: string;
  facilityId: number;
}
```

### AppointmentType
```typescript
interface AppointmentType {
  id: number;
  name: string;
  duration: number; // minutes
  bufferTime: number; // minutes
  maxConcurrent: number;
  facilityId: number;
  tenantId: number;
  type: 'INBOUND' | 'OUTBOUND';
}
```

### Facility
```typescript
interface Facility {
  id: number;
  name: string;
  address: string;
  timezone: string;
  isActive: boolean;
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
class DockOptimizerAPI {
  constructor(baseURL, credentials) {
    this.baseURL = baseURL;
    this.credentials = credentials;
  }

  async login() {
    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.credentials)
    });
    return response.json();
  }

  async getAvailability(date, facilityId, appointmentTypeId) {
    const params = new URLSearchParams({
      date, facilityId, appointmentTypeId
    });
    const response = await fetch(`${this.baseURL}/availability?${params}`);
    return response.json();
  }

  async getSchedules() {
    const response = await fetch(`${this.baseURL}/schedules`);
    return response.json();
  }
}
```

### Python
```python
import requests

class DockOptimizerAPI:
    def __init__(self, base_url, credentials):
        self.base_url = base_url
        self.session = requests.Session()
        self.login(credentials)
    
    def login(self, credentials):
        response = self.session.post(
            f"{self.base_url}/login",
            json=credentials
        )
        return response.json()
    
    def get_availability(self, date, facility_id, appointment_type_id):
        params = {
            'date': date,
            'facilityId': facility_id,
            'appointmentTypeId': appointment_type_id
        }
        response = self.session.get(
            f"{self.base_url}/availability",
            params=params
        )
        return response.json()
```

## MCP Server Compatibility

### Tools Definition
```json
{
  "tools": [
    {
      "name": "get_availability",
      "description": "Get available appointment time slots",
      "inputSchema": {
        "type": "object",
        "properties": {
          "date": {"type": "string", "format": "date"},
          "facilityId": {"type": "number"},
          "appointmentTypeId": {"type": "number"}
        },
        "required": ["date", "facilityId", "appointmentTypeId"]
      }
    },
    {
      "name": "get_schedules",
      "description": "Get all schedules for the authenticated tenant",
      "inputSchema": {
        "type": "object",
        "properties": {}
      }
    },
    {
      "name": "create_appointment",
      "description": "Create a new appointment",
      "inputSchema": {
        "type": "object",
        "properties": {
          "startTime": {"type": "string", "format": "date-time"},
          "endTime": {"type": "string", "format": "date-time"},
          "appointmentTypeId": {"type": "number"},
          "dockId": {"type": "number"},
          "customerName": {"type": "string"}
        },
        "required": ["startTime", "endTime", "appointmentTypeId", "customerName"]
      }
    }
  ]
}
```

## Performance Specifications

### Response Times
- **Availability queries**: < 200ms
- **Schedule operations**: < 100ms
- **User authentication**: < 150ms
- **Data retrieval**: < 300ms

### Scalability
- **Concurrent users**: 1000+
- **Requests per second**: 500+
- **Database connections**: Auto-scaling pool
- **WebSocket connections**: 10,000+

## Compliance & Standards

### Security Standards
- **OWASP Top 10** compliance
- **SOC 2 Type II** ready
- **GDPR** compliant data handling
- **Multi-tenant** data isolation

### API Standards
- **RESTful** design principles
- **OpenAPI 3.0** specification
- **JSON:API** format compatibility
- **GraphQL** query support (planned)

## Deployment & Infrastructure

### Production Requirements
- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher (for sessions)
- **Memory**: 2GB minimum
- **CPU**: 2 cores minimum

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port

# Security
SESSION_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# Email
SENDGRID_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@yourdomain.com

# Features
ENABLE_WEBSOCKETS=true
ENABLE_ANALYTICS=true
```

---

## Support & Documentation

### Resources
- **API Documentation**: `/docs`
- **Postman Collection**: Available on request
- **SDK Downloads**: GitHub releases
- **Status Page**: `https://status.yourdomain.com`

### Contact
- **Technical Support**: api-support@yourdomain.com
- **Sales**: sales@yourdomain.com
- **Documentation**: docs@yourdomain.com

---

**Version**: 2.0  
**Last Updated**: June 17, 2025  
**License**: Proprietary License - All Rights Reserved by Conmitto Inc. 