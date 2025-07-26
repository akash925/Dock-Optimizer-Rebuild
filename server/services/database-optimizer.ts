import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';

type DrizzleDBInstance = typeof db;

interface QueryPerformanceMetrics {
  queryTime: number;
  rowsAffected: number;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  tenantId?: number;
}

interface OptimizationRecommendation {
  type: 'index' | 'query' | 'cache' | 'partition';
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImprovement: string;
  sqlStatements?: string[];
}

class DatabaseOptimizer {
  private static instance: DatabaseOptimizer;
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private slowQueries: Map<string, number> = new Map();
  private indexRecommendations: OptimizationRecommendation[] = [];

  private constructor() {
    this.initializeOptimizations();
  }

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer();
    }
    return DatabaseOptimizer.instance;
  }

  private initializeOptimizations() {
    // Add essential indexes for calendar queries
    this.indexRecommendations = [
      {
        type: 'index',
        description: 'Composite index on schedules for tenant + time range queries',
        priority: 'high',
        estimatedImprovement: '70-90% faster calendar queries',
        sqlStatements: [
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_tenant_time ON schedules (tenant_id, start_time, end_time);',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_tenant_status ON schedules (tenant_id, status);',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_facility_time ON schedules (facility_id, start_time) WHERE facility_id IS NOT NULL;'
        ]
      },
      {
        type: 'index',
        description: 'Index on notifications for real-time queries',
        priority: 'high',
        estimatedImprovement: '60-80% faster notification queries',
        sqlStatements: [
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read, created_at DESC);',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_tenant_type ON notifications (user_id, type, created_at DESC);'
        ]
      },
      {
        type: 'index',
        description: 'Facility and dock relationship indexes',
        priority: 'medium',
        estimatedImprovement: '40-60% faster facility queries',
        sqlStatements: [
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_docks_facility ON docks (facility_id);',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_tenant ON facilities (tenant_id);'
        ]
      },
      {
        type: 'index',
        description: 'User and authentication indexes',
        priority: 'medium',
        estimatedImprovement: '50-70% faster auth queries',
        sqlStatements: [
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_active ON users (tenant_id, is_active);',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_unique ON users (email) WHERE is_active = true;'
        ]
      }
    ];
  }

  // Apply database optimizations
  async applyOptimizations(db: DrizzleDBInstance): Promise<void> {
    logger.info('DatabaseOptimizer', 'Starting database optimization process');

    try {
      for (const recommendation of this.indexRecommendations) {
        if (recommendation.sqlStatements) {
          for (const sqlStatement of recommendation.sqlStatements) {
            try {
              const startTime = performance.now();
              await db.execute(sql.raw(sqlStatement));
              const executionTime = performance.now() - startTime;
              
              logger.info('DatabaseOptimizer', `Applied optimization: ${recommendation.description}`, {
                executionTime: `${executionTime.toFixed(2)}ms`,
                sqlStatement
              });
            } catch (error) {
              logger.warn('DatabaseOptimizer', `Failed to apply optimization: ${sqlStatement}`, error);
            }
          }
        }
      }

      await this.analyzeTableStatistics(db);
      await this.optimizePostgreSQLSettings(db);
      
      logger.info('DatabaseOptimizer', 'Database optimization completed successfully');
    } catch (error) {
      logger.error('DatabaseOptimizer', 'Database optimization failed', error);
      throw error;
    }
  }

  // Analyze table statistics for optimization insights
  private async analyzeTableStatistics(db: DrizzleDBInstance): Promise<void> {
    try {
      const tableStats = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          most_common_vals
        FROM pg_stats 
        WHERE schemaname = 'public' 
        AND tablename IN ('schedules', 'notifications', 'facilities', 'users', 'docks')
        ORDER BY tablename, attname;
      `);

      logger.info('DatabaseOptimizer', 'Table statistics analyzed', {
        tablesAnalyzed: ((tableStats as any).rows?.length ?? 0)
      });
    } catch (error) {
      logger.warn('DatabaseOptimizer', 'Failed to analyze table statistics', error);
    }
  }

  // Optimize PostgreSQL settings for better performance
  private async optimizePostgreSQLSettings(db: DrizzleDBInstance): Promise<void> {
    const optimizations = [
      // Increase work memory for complex queries
      "SET work_mem = '256MB'",
      // Optimize for calendar range queries
      "SET enable_seqscan = off", // Prefer index scans for small result sets
      // Improve join performance
      "SET join_collapse_limit = 12",
      // Optimize for real-time workloads
      "SET commit_delay = 0",
      "SET commit_siblings = 5"
    ];

    for (const optimization of optimizations) {
      try {
        await db.execute(sql.raw(optimization));
        logger.debug('DatabaseOptimizer', `Applied PostgreSQL setting: ${optimization}`);
      } catch (error) {
        logger.warn('DatabaseOptimizer', `Failed to apply setting: ${optimization}`, error);
      }
    }
  }

  // Optimized calendar queries
  async getOptimizedSchedules(
    db: DrizzleDBInstance,
    tenantId: number,
    startDate?: Date,
    endDate?: Date,
    facilityId?: number,
    limit: number = 1000
  ): Promise<any[]> {
    const startTime = performance.now();

    try {
      let query = sql`
        SELECT 
          s.*,
          f.name as facility_name,
          f.timezone as facility_timezone,
          d.name as dock_name,
          at.name as appointment_type_name
        FROM schedules s
        LEFT JOIN facilities f ON s.facility_id = f.id
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        WHERE s.tenant_id = ${tenantId}
      `;

      const conditions = [];
      
      if (startDate) {
        conditions.push(sql`s.start_time >= ${startDate.toISOString()}`);
      }
      
      if (endDate) {
        conditions.push(sql`s.end_time <= ${endDate.toISOString()}`);
      }
      
      if (facilityId) {
        conditions.push(sql`s.facility_id = ${facilityId}`);
      }

      if (((conditions as any).rows?.length ?? 0) > 0) {
        query = sql`${query} AND ${sql.join(conditions, sql` AND `)}`;
      }

      query = sql`${query} ORDER BY s.start_time ASC LIMIT ${limit}`;

      const result = await db.execute(query);
      const executionTime = performance.now() - startTime;

      this.recordQueryMetrics({
        queryTime: executionTime,
        rowsAffected: ((result as any).rows?.length ?? 0),
        queryType: 'SELECT',
        tableName: 'schedules',
        tenantId
      });

      if (executionTime > 1000) { // Log slow queries
        logger.warn('DatabaseOptimizer', 'Slow calendar query detected', {
          executionTime: `${executionTime.toFixed(2)}ms`,
          rowCount: ((result as any).rows?.length ?? 0),
          tenantId,
          facilityId
        });
      }

      return (result as any).rows || [];
    } catch (error) {
      logger.error('DatabaseOptimizer', 'Failed to execute optimized schedule query', error);
      throw error;
    }
  }

  // Optimized notification queries with pagination
  async getOptimizedNotifications(
    db: DrizzleDBInstance,
    userId: number,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<any[]> {
    const startTime = performance.now();

    try {
      let query = sql`
        SELECT 
          n.*,
          s.truck_number,
          s.customer_name,
          s.start_time as appointment_start_time,
          f.name as facility_name
        FROM notifications n
        LEFT JOIN schedules s ON n.related_schedule_id = s.id
        LEFT JOIN facilities f ON s.facility_id = f.id
        WHERE n.user_id = ${userId}
      `;

      if (unreadOnly) {
        query = sql`${query} AND n.is_read = false`;
      }

      query = sql`
        ${query}
        ORDER BY n.created_at DESC 
        LIMIT ${limit} 
        OFFSET ${offset}
      `;

      const result = await db.execute(query);
      const executionTime = performance.now() - startTime;

      this.recordQueryMetrics({
        queryTime: executionTime,
        rowsAffected: ((result as any).rows?.length ?? 0),
        queryType: 'SELECT',
        tableName: 'notifications',
      });

      return result;
    } catch (error) {
      logger.error('DatabaseOptimizer', 'Failed to execute optimized notification query', error);
      throw error;
    }
  }

  // Record query performance metrics
  private recordQueryMetrics(metrics: QueryPerformanceMetrics): void {
    this.queryMetrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }

    // Track slow queries
    if (metrics.queryTime > 500) { // Queries taking more than 500ms
      const key = `${metrics.tableName}:${metrics.queryType}`;
      this.slowQueries.set(key, (this.slowQueries.get(key) || 0) + 1);
    }
  }

  // Get performance insights
  getPerformanceInsights(): {
    averageQueryTime: number;
    slowQueryCount: number;
    mostSlowQueries: Array<{ query: string; count: number }>;
    recommendations: OptimizationRecommendation[];
  } {
    const totalQueries = this.queryMetrics.length;
    const averageQueryTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, m) => sum + m.queryTime, 0) / totalQueries 
      : 0;

    const slowQueryCount = this.queryMetrics.filter(m => m.queryTime > 500).length;

    const mostSlowQueries = Array.from(this.slowQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query, count]) => ({ query, count }));

    return {
      averageQueryTime,
      slowQueryCount,
      mostSlowQueries,
      recommendations: this.generateDynamicRecommendations()
    };
  }

  // Generate dynamic optimization recommendations based on query patterns
  private generateDynamicRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze query patterns
    const scheduleQueries = this.queryMetrics.filter(m => m.tableName === 'schedules');
    const avgScheduleQueryTime = ((scheduleQueries as any).rows?.length ?? 0) > 0
      ? scheduleQueries.reduce((sum, m) => sum + m.queryTime, 0) / ((scheduleQueries as any).rows?.length ?? 0)
      : 0;

    if (avgScheduleQueryTime > 300) {
      recommendations.push({
        type: 'cache',
        description: 'Implement Redis caching for frequently accessed schedule data',
        priority: 'high',
        estimatedImprovement: '50-80% reduction in query time',
        sqlStatements: []
      });
    }

    const slowNotificationQueries = this.queryMetrics.filter(
      m => m.tableName === 'notifications' && m.queryTime > 200
    ).length;

    if (slowNotificationQueries > 10) {
      recommendations.push({
        type: 'partition',
        description: 'Consider partitioning notifications table by user_id or date',
        priority: 'medium',
        estimatedImprovement: '30-50% faster notification queries',
        sqlStatements: [
          `CREATE TABLE notifications_partition (LIKE notifications INCLUDING ALL) PARTITION BY HASH (user_id);`,
          `CREATE TABLE notifications_p0 PARTITION OF notifications_partition FOR VALUES WITH (modulus 4, remainder 0);`,
          `CREATE TABLE notifications_p1 PARTITION OF notifications_partition FOR VALUES WITH (modulus 4, remainder 1);`,
          `CREATE TABLE notifications_p2 PARTITION OF notifications_partition FOR VALUES WITH (modulus 4, remainder 2);`,
          `CREATE TABLE notifications_p3 PARTITION OF notifications_partition FOR VALUES WITH (modulus 4, remainder 3);`
        ]
      });
    }

    return recommendations;
  }

  // Clean up old metrics and data
  cleanup(): void {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24); // Keep last 24 hours

    this.queryMetrics = this.queryMetrics.filter(
      m => new Date() > cutoffDate
    );

    logger.info('DatabaseOptimizer', 'Cleaned up old performance metrics');
  }

  // Export performance data for monitoring
  exportMetrics(): {
    metrics: QueryPerformanceMetrics[];
    slowQueries: Record<string, number>;
    insights: ReturnType<DatabaseOptimizer['getPerformanceInsights']>;
  } {
    return {
      metrics: this.queryMetrics,
      slowQueries: Object.fromEntries(this.slowQueries),
      insights: this.getPerformanceInsights()
    };
  }
}

export const databaseOptimizer = DatabaseOptimizer.getInstance(); 