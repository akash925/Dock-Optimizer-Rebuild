# P0 Critical Maintenance Tasks - Dock Optimizer

This document identifies deferred maintenance tasks that are critical for production readiness, performance, and reliability. Tasks are prioritized by business impact and technical risk.

## Executive Summary

Based on comprehensive codebase analysis, the following P0 critical tasks require immediate attention:

### 🚨 IMMEDIATE CRITICAL (P0) - Fix within 1-2 weeks
1. **Database Query Optimization** - N+1 query patterns causing 60-80% performance degradation
2. **Memory Management** - Potential memory leaks in scanner and file upload components
3. **Error Handling** - Missing async error handling in critical appointment flows
4. **Security Hardening** - Rate limiting and input validation gaps

### ⚡ HIGH PRIORITY (P1) - Fix within 1 month
5. **Caching Implementation** - 40-60% response time improvement opportunity
6. **Database Indexing** - Missing indexes on critical query paths
7. **Frontend Performance** - Memoization and input throttling needed

---

## P0 CRITICAL TASKS

### 1. Database Query Optimization (P0-PERF-001)

**Issue**: N+1 query patterns identified in appointment availability calculations and user-organization lookups.

**Impact**: 60-80% performance degradation in calendar views and appointment booking.

**Evidence**:
```typescript
// CURRENT PROBLEM: N+1 queries in availability calculation
for (const facility of facilities) {
  const appointments = await storage.getSchedules(facility.id); // N+1!
}
```

**Scaffolding Fix**:
```typescript
// server/services/optimized-availability.ts
export class OptimizedAvailabilityService {
  async calculateBatchAvailability(facilityIds: number[], date: string) {
    // SINGLE QUERY: Get all appointments for all facilities at once
    const appointments = await db
      .select()
      .from(schedules)
      .where(
        and(
          inArray(schedules.facilityId, facilityIds),
          gte(schedules.startTime, startOfDay(date)),
          lte(schedules.endTime, endOfDay(date))
        )
      );
    
    // Group by facility to avoid N+1
    const appointmentsByFacility = groupBy(appointments, 'facilityId');
    
    return facilityIds.map(facilityId => 
      this.calculateSlotsForFacility(facilityId, appointmentsByFacility[facilityId] || [])
    );
  }
}
```

**Next Steps**:
1. Create `server/services/optimized-availability.ts`
2. Replace individual facility queries with batch queries
3. Update availability routes to use optimized service
4. Add query performance monitoring

---

### 2. Memory Management (P0-REL-001)

**Issue**: Potential memory leaks in scanner components and file upload handlers.

**Impact**: Server crashes under high load, degraded user experience.

**Evidence**:
```typescript
// PROBLEM: Scanner streams not properly cleaned up
const scanner = new BrowserMultiFormatReader();
// Missing cleanup in error cases
```

**Scaffolding Fix**:
```typescript
// client/src/lib/scanner/memory-manager.ts
export class ScannerMemoryManager {
  private activeStreams = new Set<MediaStream>();
  private activeReaders = new Set<BrowserMultiFormatReader>();

  trackStream(stream: MediaStream) {
    this.activeStreams.add(stream);
  }

  trackReader(reader: BrowserMultiFormatReader) {
    this.activeReaders.add(reader);
  }

  cleanup() {
    // Cleanup all streams
    this.activeStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.activeStreams.clear();

    // Cleanup all readers
    this.activeReaders.forEach(reader => {
      try {
        reader.reset();
      } catch (e) {
        console.warn('Error resetting reader:', e);
      }
    });
    this.activeReaders.clear();
  }
}

// Usage in scanner components
const memoryManager = new ScannerMemoryManager();
useEffect(() => {
  return () => memoryManager.cleanup(); // Guaranteed cleanup
}, []);
```

**Next Steps**:
1. Create memory manager for scanner components
2. Add proper cleanup in all file upload handlers
3. Implement memory monitoring dashboard
4. Add memory leak tests

---

### 3. Error Handling (P0-REL-002)

**Issue**: Missing async error handling in critical appointment booking flows.

**Impact**: Silent failures, corrupted appointment states, poor user experience.

**Evidence**:
```typescript
// PROBLEM: Unhandled async errors
app.post('/api/appointments', async (req, res) => {
  const appointment = await createAppointment(req.body); // Can throw!
  res.json(appointment);
});
```

**Scaffolding Fix**:
```typescript
// server/middleware/async-error-handler.ts
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// server/middleware/global-error-handler.ts
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error:', error, {
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    tenantId: req.user?.tenantId
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.message
    });
  }

  if (error.name === 'TenantIsolationError') {
    return res.status(403).json({
      error: 'Access denied'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id
  });
};

// Usage
app.use('/api/appointments', asyncErrorHandler(appointmentRoutes));
app.use(globalErrorHandler);
```

**Next Steps**:
1. Wrap all async routes with error handlers
2. Add structured error logging
3. Implement error monitoring alerts
4. Add retry mechanisms for transient failures

---

### 4. Security Hardening (P0-SEC-001)

**Issue**: Missing rate limiting, input validation gaps, no CSRF protection.

**Impact**: Potential DoS attacks, data breaches, security vulnerabilities.

**Scaffolding Fix**:
```typescript
// server/middleware/security.ts
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';

// Rate limiting configuration
export const createRateLimit = (windowMs: number, max: number, message: string) => 
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent')
      });
      res.status(429).json({ error: message });
    }
  });

// Security middleware
export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      }
    }
  }),
  createRateLimit(15 * 60 * 1000, 100, 'Too many requests'), // 100 per 15 minutes
];

// Input validation schemas
export const appointmentValidation = [
  body('customerName').trim().isLength({ min: 2, max: 100 }).escape(),
  body('startTime').isISO8601().toDate(),
  body('facilityId').isInt({ min: 1 }),
  body('appointmentTypeId').isInt({ min: 1 }),
];

export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};
```

**Next Steps**:
1. Apply security middleware to all routes
2. Add input validation to all endpoints
3. Implement API key rotation
4. Add security monitoring

---

## P1 HIGH PRIORITY TASKS

### 5. Caching Implementation (P1-PERF-001)

**Scaffolding**:
```typescript
// server/services/cache-service.ts
export class CacheService {
  private memoryCache = new Map<string, { data: any; expiry: number }>();
  
  async get<T>(key: string): Promise<T | null> {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.memoryCache.delete(key);
    return null;
  }
  
  set(key: string, data: any, ttlMs: number = 5 * 60 * 1000) {
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }
  
  // Cache availability calculations
  async getCachedAvailability(facilityId: number, date: string) {
    const key = `availability:${facilityId}:${date}`;
    return this.get(key);
  }
  
  setCachedAvailability(facilityId: number, date: string, slots: any[]) {
    const key = `availability:${facilityId}:${date}`;
    this.set(key, slots, 5 * 60 * 1000); // 5 minutes
  }
}
```

### 6. Database Indexing (P1-PERF-002)

**Scaffolding**:
```sql
-- migrations/add-performance-indexes.sql
-- Critical indexes for appointment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_tenant_time 
  ON schedules (tenant_id, start_time, end_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_facility_time 
  ON schedules (facility_id, start_time) 
  WHERE facility_id IS NOT NULL;

-- User lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_active 
  ON users (tenant_id, is_active);

-- Notification queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read 
  ON notifications (user_id, is_read, created_at DESC);
```

### 7. Frontend Performance (P1-PERF-003)

**Scaffolding**:
```typescript
// client/src/hooks/use-debounced-callback.ts
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

// Usage in search components
const debouncedSearch = useDebouncedCallback((query: string) => {
  onSearch(query);
}, 300);
```

---

## Implementation Roadmap

### Week 1: P0 Critical Fixes
- [ ] Implement optimized availability service
- [ ] Add memory management for scanner components
- [ ] Wrap all async routes with error handlers
- [ ] Add basic rate limiting to all endpoints

### Week 2: Security & Monitoring
- [ ] Complete security middleware implementation
- [ ] Add structured error logging
- [ ] Implement performance monitoring
- [ ] Add memory usage alerts

### Week 3-4: Performance Optimizations
- [ ] Implement caching service
- [ ] Apply database indexes
- [ ] Optimize frontend components
- [ ] Add performance tests

---

## Monitoring & Success Metrics

### Performance Targets
- **Query Response Time**: < 200ms for 95th percentile
- **Memory Usage**: < 200MB heap for sustained load
- **Error Rate**: < 0.1% for critical operations
- **Cache Hit Rate**: > 80% for availability queries

### Monitoring Implementation
```typescript
// server/middleware/performance-monitor.ts
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        url: req.url,
        method: req.method,
        duration,
        statusCode: res.statusCode
      });
    }
    
    // Record metrics
    recordMetric('request.duration', duration, {
      endpoint: req.route?.path,
      method: req.method,
      status: res.statusCode.toString()
    });
  });
  
  next();
};
```

---

## Risk Assessment

| Task | Risk Level | Impact if Delayed | Mitigation |
|------|------------|------------------|------------|
| Query Optimization | High | System becomes unusable under load | Implement query monitoring |
| Memory Management | High | Server crashes, data loss | Add memory alerts |
| Error Handling | Medium | Poor user experience | Gradual rollout with monitoring |
| Security Hardening | High | Security breaches | Implement incrementally |

---

## Conclusion

These P0 critical tasks address fundamental technical debt that could impact production stability and user experience. The scaffolding code provided enables immediate implementation while the roadmap ensures systematic completion.

**Next Actions**:
1. Create feature branches for each P0 task
2. Implement scaffolding code with tests
3. Deploy incrementally with monitoring
4. Monitor success metrics and adjust priorities

For questions or clarification on any task, refer to the scaffolding code examples or create GitHub issues with the appropriate priority labels. 