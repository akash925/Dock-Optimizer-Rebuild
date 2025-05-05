import { Request, Response } from 'express';
import { db } from '../../db';
import { 
  facilities, 
  carriers, 
  schedules,
  docks,
  tenants,
  organizationFacilities
} from '@shared/schema';
import { sql, and, eq, inArray } from 'drizzle-orm';

/**
 * Get heatmap data for analytics dashboard
 * This endpoint aggregates appointment data by day and hour
 */
export async function getHeatmapData(req: Request, res: Response) {
  try {
    const { facilityId, appointmentTypeId, customerId, carrierId, startDate, endDate } = req.query;
    
    // Get the organization ID (tenant ID) from the authenticated user
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    // First, get all facilities for this tenant through the junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    const facilityIds = tenantFacilities.map(f => f.id);
    if (!facilityIds.length) {
      return res.json([]);
    }
    
    // Build dynamic WHERE clause based on filter params
    let whereClause = sql`WHERE s.facility_id IN (${sql.join(facilityIds)})`;
    
    if (facilityId) {
      whereClause = sql`${whereClause} AND s.facility_id = ${facilityId}`;
    }
    
    if (appointmentTypeId) {
      whereClause = sql`${whereClause} AND s.appointment_type_id = ${appointmentTypeId}`;
    }
    
    if (customerId) {
      whereClause = sql`${whereClause} AND s.customer_name = ${customerId}`;
    }
    
    if (carrierId) {
      whereClause = sql`${whereClause} AND s.carrier_id = ${carrierId}`;
    }
    
    // Add date range filtering
    if (startDate && endDate) {
      whereClause = sql`${whereClause} AND s.start_time >= ${startDate} AND s.start_time <= ${endDate}`;
    } else if (startDate) {
      whereClause = sql`${whereClause} AND s.start_time >= ${startDate}`;
    } else if (endDate) {
      whereClause = sql`${whereClause} AND s.start_time <= ${endDate}`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      whereClause = sql`${whereClause} AND s.start_time >= ${sevenDaysAgo.toISOString()}`;
    }
    
    // Query to aggregate appointments by day and hour with tenant isolation
    const heatmapData = await db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM s.start_time) as day_of_week,
        EXTRACT(HOUR FROM s.start_time) as hour_of_day,
        COUNT(*) as count
      FROM ${schedules} s
      JOIN ${facilities} f ON s.facility_id = f.id
      JOIN ${organizationFacilities} of ON f.id = of.facility_id
      ${whereClause}
      AND of.organization_id = ${tenantId}
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week, hour_of_day
    `);

    return res.json(heatmapData.rows);
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
}

/**
 * Get facility statistics for analytics dashboard
 * Returns appointment counts by facility
 */
export async function getFacilityStats(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    // Get the tenant ID from the authenticated user
    // Authentication is already enforced by middleware, so req.user will always exist
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      console.error('[Analytics] No tenant ID associated with user');
      return res.status(400).json({ error: 'No tenant ID associated with user' });
    }
    
    const effectiveTenantId = tenantId;
    console.log(`[Analytics] Using tenant ID ${effectiveTenantId} for facility stats`);
    
    // First, directly check if there are any facilities for this tenant
    const tenantFacilities = await db.select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, effectiveTenantId));
    
    console.log(`[Analytics] Initial check found ${tenantFacilities.length} facilities for tenant ${effectiveTenantId}`);
    
    if (!tenantFacilities.length) {
      console.log(`[Analytics] No facilities found for tenant ${effectiveTenantId}, returning empty array`);
      return res.json([]);
    }
    
    // Build WHERE clauses for date filtering with tenant isolation using the junction table
    let whereClause = sql`WHERE of.organization_id = ${effectiveTenantId}`;
    
    // Add date range filtering
    if (startDate && endDate) {
      whereClause = sql`${whereClause} AND (s.start_time >= ${startDate} AND s.start_time <= ${endDate})`;
    } else if (startDate) {
      whereClause = sql`${whereClause} AND s.start_time >= ${startDate}`;
    } else if (endDate) {
      whereClause = sql`${whereClause} AND s.start_time <= ${endDate}`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      whereClause = sql`${whereClause} AND (s.start_time IS NULL OR s.start_time >= ${sevenDaysAgo.toISOString()})`;
    }
    
    console.log('[Analytics] Executing facility stats query with tenant isolation');
    
    // Query to get appointment counts by facility location with date filtering and tenant isolation
    // Note the important LEFT JOIN to ensure facilities with no appointments are still returned
    const facilityStats = await db.execute(sql`
      SELECT 
        f.id,
        f.name,
        f.address1 as address,
        COUNT(s.id) as "appointmentCount"
      FROM ${facilities} f
      JOIN ${organizationFacilities} of ON f.id = of.facility_id
      LEFT JOIN ${schedules} s ON f.id = s.facility_id
      ${whereClause}
      GROUP BY f.id, f.name, f.address1
      ORDER BY "appointmentCount" DESC
    `);

    console.log(`[Analytics] Found ${facilityStats.rows.length} facilities for tenant ${effectiveTenantId}`);
    return res.json(facilityStats.rows);
  } catch (error) {
    console.error('Error fetching facility stats:', error);
    return res.status(500).json({ error: 'Failed to fetch facility statistics' });
  }
}

/**
 * Get carrier statistics for analytics dashboard
 * Returns appointment counts by carrier
 */
export async function getCarrierStats(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    // Get the tenant ID from the authenticated user
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    // First, get all facilities for this tenant through the organization_facilities junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    const facilityIds = tenantFacilities.map(f => f.id);
    if (!facilityIds.length) {
      return res.json([]);
    }
    
    // Build WHERE clause for date filtering
    let dateWhereClause = '';
    
    // Add date range filtering
    if (startDate && endDate) {
      dateWhereClause = ` AND s.start_time >= '${startDate}' AND s.start_time <= '${endDate}'`;
    } else if (startDate) {
      dateWhereClause = ` AND s.start_time >= '${startDate}'`;
    } else if (endDate) {
      dateWhereClause = ` AND s.start_time <= '${endDate}'`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateWhereClause = ` AND s.start_time >= '${sevenDaysAgo.toISOString()}'`;
    }
    
    // Query to get appointment counts by carrier with date filtering and tenant isolation
    const carrierStats = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        COUNT(s.id) as "appointmentCount"
      FROM ${carriers} c
      LEFT JOIN ${schedules} s ON c.id = s.carrier_id
      WHERE s.facility_id IN (${sql.join(facilityIds)})
      ${sql.raw(dateWhereClause)}
      GROUP BY c.id, c.name
      ORDER BY "appointmentCount" DESC
      LIMIT 10
    `);

    return res.json(carrierStats.rows);
  } catch (error) {
    console.error('Error fetching carrier stats:', error);
    return res.status(500).json({ error: 'Failed to fetch carrier statistics' });
  }
}

/**
 * Get customer statistics for analytics dashboard
 * Returns appointment counts by customer
 */
export async function getCustomerStats(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    // Get the tenant ID from the authenticated user
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    // First, get all facilities for this tenant through the organization_facilities junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    const facilityIds = tenantFacilities.map(f => f.id);
    if (!facilityIds.length) {
      return res.json([]);
    }
    
    // Build date filter SQL fragment
    let dateFilter;
    if (startDate && endDate) {
      dateFilter = sql` AND s.start_time >= ${startDate} AND s.start_time <= ${endDate}`;
    } else if (startDate) {
      dateFilter = sql` AND s.start_time >= ${startDate}`;
    } else if (endDate) {
      dateFilter = sql` AND s.start_time <= ${endDate}`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = sql` AND s.start_time >= ${sevenDaysAgo.toISOString()}`;
    }
    
    // Query to get appointment counts by customer name with date filtering and tenant isolation
    const customerStats = await db.execute(sql`
      SELECT 
        DISTINCT s.customer_name as id,
        s.customer_name as name,
        COUNT(s.id) as "appointmentCount"
      FROM ${schedules} s
      WHERE s.customer_name IS NOT NULL
      AND s.facility_id IN (${sql.join(facilityIds)})
      ${dateFilter}
      GROUP BY s.customer_name
      ORDER BY "appointmentCount" DESC
      LIMIT 10
    `);

    return res.json(customerStats.rows);
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    return res.status(500).json({ error: 'Failed to fetch customer statistics' });
  }
}

/**
 * Get attendance statistics for analytics dashboard
 * Returns counts by attendance status
 */
export async function getAttendanceStats(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    // Get the tenant ID from the authenticated user
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    // First, get all facilities for this tenant through the organization_facilities junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    const facilityIds = tenantFacilities.map(f => f.id);
    if (!facilityIds.length) {
      return res.json([]);
    }
    
    // Build date filter SQL fragment
    let dateFilter;
    if (startDate && endDate) {
      dateFilter = sql` AND s.start_time >= ${startDate} AND s.start_time <= ${endDate}`;
    } else if (startDate) {
      dateFilter = sql` AND s.start_time >= ${startDate}`;
    } else if (endDate) {
      dateFilter = sql` AND s.start_time <= ${endDate}`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = sql` AND s.start_time >= ${sevenDaysAgo.toISOString()}`;
    }
    
    // Query to get counts by attendance status with date filtering and tenant isolation
    const attendanceStats = await db.execute(sql`
      SELECT 
        COALESCE(s.status, 'Not Reported') as "attendanceStatus",
        COUNT(*) as count
      FROM ${schedules} s
      WHERE s.facility_id IN (${sql.join(facilityIds)})
      ${dateFilter}
      GROUP BY s.status
      ORDER BY count DESC
    `);

    return res.json(attendanceStats.rows);
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
}

/**
 * Get dock utilization statistics for analytics dashboard
 * Returns utilization percentage by dock
 */
export async function getDockUtilizationStats(req: Request, res: Response) {
  try {
    const { facilityId, startDate, endDate } = req.query;
    
    // Get the tenant ID from the authenticated user
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'No tenant ID associated with user' });
    }
    
    const effectiveTenantId = tenantId;
    console.log(`[Analytics] Using tenant ID ${effectiveTenantId} for dock utilization stats`);
    
    // First, get all facilities for this tenant through the organization_facilities junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, effectiveTenantId));
    
    const facilityIds = tenantFacilities.map(f => f.id);
    if (!facilityIds.length) {
      return res.json([]);
    }
    
    // Construct date strings to simplify the query
    const startDateStr = startDate ? startDate.toString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDateStr = endDate ? endDate.toString() : new Date().toISOString();
    
    console.log(`[Analytics] Date range for dock utilization: ${startDateStr} to ${endDateStr}`);
    
    // Simplify the query to avoid parameter binding issues
    const query = `
      SELECT 
        d.id as dock_id,
        d.name as dock_name,
        f.name as facility_name,
        EXTRACT(EPOCH FROM (timestamp '${endDateStr}' - timestamp '${startDateStr}')) / 3600 as total_hours,
        COALESCE(
          (SELECT SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600)
           FROM schedules s
           WHERE s.dock_id = d.id 
           AND s.start_time >= timestamp '${startDateStr}'
           AND s.end_time <= timestamp '${endDateStr}'
          ), 0
        ) as used_hours,
        CASE 
          WHEN EXTRACT(EPOCH FROM (timestamp '${endDateStr}' - timestamp '${startDateStr}')) > 0 THEN 
            ROUND((
              COALESCE(
                (SELECT SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600)
                 FROM schedules s
                 WHERE s.dock_id = d.id 
                 AND s.start_time >= timestamp '${startDateStr}'
                 AND s.end_time <= timestamp '${endDateStr}'
                ), 0
              ) / (EXTRACT(EPOCH FROM (timestamp '${endDateStr}' - timestamp '${startDateStr}')) / 3600)
            ) * 100, 2)
          ELSE 0 
        END as utilization_percentage
      FROM docks d
      JOIN facilities f ON d.facility_id = f.id
      JOIN organization_facilities of ON f.id = of.facility_id
      WHERE of.organization_id = ${effectiveTenantId}
      ${facilityId ? `AND d.facility_id = ${facilityId}` : ''}
      ORDER BY utilization_percentage DESC
    `;
    
    console.log("[Analytics] Executing simplified dock utilization query");
    
    // Execute the raw SQL query
    const dockUtilizationStats = await db.execute(sql.raw(query));
    
    console.log(`[Analytics] Found ${dockUtilizationStats.rows.length} dock utilization records`);
    return res.json(dockUtilizationStats.rows);
  } catch (error) {
    console.error('Error fetching dock utilization stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dock utilization statistics' });
  }
}