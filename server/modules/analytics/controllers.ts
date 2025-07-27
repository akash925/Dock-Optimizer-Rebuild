import { Request, Response } from 'express';
import { db } from '../../db.js';
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
    const { appointmentTypeId, customerId, carrierId, startDate, endDate } = req.query;
    
    // Get the organization ID (tenant ID) from the authenticated user
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    console.log(`[Analytics] getHeatmapData: Using tenant ID ${tenantId}`);
    
    // Build the WHERE clause based on tenant isolation through dock -> facility -> organization
    let whereClause = sql`WHERE EXISTS (
      SELECT 1 FROM ${docks} d
      JOIN ${facilities} f ON d.facility_id = f.id
      JOIN ${organizationFacilities} of ON f.id = of.facility_id
      WHERE d.id = s.dock_id AND of.organization_id = ${tenantId}
    )`;
    
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
    
    console.log('[Analytics] getHeatmapData: Using dock-facility-organization relationship for tenant isolation');
    
    // Query to aggregate appointments by day and hour with tenant isolation
    const heatmapData = await db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM s.start_time) as day_of_week,
        EXTRACT(HOUR FROM s.start_time) as hour_of_day,
        COUNT(*) as count
      FROM ${schedules} s
      ${whereClause}
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
    
    console.log(`[Analytics] Using tenant ID ${tenantId} for facility stats`);
    
    // First, directly check if there are any facilities for this tenant
    const tenantFacilities = await db.select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    console.log(`[Analytics] Initial check found ${tenantFacilities.length} facilities for tenant ${tenantId}`);
    
    if (!tenantFacilities.length) {
      console.log(`[Analytics] No facilities found for tenant ${tenantId}, returning empty array`);
      return res.json([]);
    }
    
    // Build date filter SQL fragment
    let dateFilter = '';
    
    if (startDate && endDate) {
      dateFilter = ` AND s.start_time >= '${startDate}' AND s.start_time <= '${endDate}'`;
    } else if (startDate) {
      dateFilter = ` AND s.start_time >= '${startDate}'`;
    } else if (endDate) {
      dateFilter = ` AND s.start_time <= '${endDate}'`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = ` AND (s.start_time IS NULL OR s.start_time >= '${sevenDaysAgo.toISOString()}')`;
    }
    
    console.log('[Analytics] Executing facility stats query using dock-facility-organization relationship');
    
    // Using a simpler approach with raw SQL to avoid drizzle-orm SQL composition complexity
    const query = `
      SELECT
        f.id,
        f.name,
        f.address1 as address,
        COUNT(s.id) as "appointmentCount"
      FROM
        facilities f
      JOIN
        organization_facilities of ON f.id = of.facility_id
      LEFT JOIN
        docks d ON d.facility_id = f.id
      LEFT JOIN
        schedules s ON s.dock_id = d.id ${dateFilter}
      WHERE
        of.organization_id = ${tenantId}
      GROUP BY
        f.id, f.name, f.address1
      ORDER BY
        "appointmentCount" DESC
    `;
    
    const facilityStats = await db.execute(query);

    console.log(`[Analytics] Found ${facilityStats.rows.length} facilities for tenant ${tenantId}`);
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
      console.error('[Analytics] No tenant ID associated with user in getCarrierStats');
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    console.log(`[Analytics] getCarrierStats: Using tenant ID ${tenantId}`);
    
    // First, get all facilities for this tenant through the organization_facilities junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    console.log(`[Analytics] getCarrierStats: Found ${tenantFacilities.length} facilities for tenant ${tenantId}`);
    
    const facilityIds = tenantFacilities.map((f: any) => f.id);
    if (!facilityIds.length) {
      console.log(`[Analytics] getCarrierStats: No facilities found for tenant ${tenantId}, returning empty array`);
      return res.json([]);
    }
    
    // Build date filter for query
    let dateFilter = '';
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (startDate && endDate) {
      dateFilter = ` AND s.start_time >= '${startDate}' AND s.start_time <= '${endDate}'`;
    } else if (startDate) {
      dateFilter = ` AND s.start_time >= '${startDate}'`;
    } else if (endDate) {
      dateFilter = ` AND s.start_time <= '${endDate}'`;
    } else {
      // Default to last 7 days if no date range specified
      dateFilter = ` AND s.start_time >= '${sevenDaysAgo.toISOString()}'`;
    }
    
    // Using raw SQL for better control over the query
    const query = `
      SELECT 
        c.id,
        c.name,
        COUNT(s.id) as "appointmentCount"
      FROM carriers c
      LEFT JOIN schedules s ON c.id = s.carrier_id
      LEFT JOIN docks d ON s.dock_id = d.id
      LEFT JOIN facilities f ON d.facility_id = f.id
      LEFT JOIN organization_facilities of ON f.id = of.facility_id
      WHERE 
        (s.id IS NULL OR of.organization_id = ${tenantId}) ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY "appointmentCount" DESC
      LIMIT 10
    `;

    console.log('[Analytics] getCarrierStats: Using dock-facility-organization relationship');
    
    try {
      const carrierStats = await db.execute(query);

      console.log(`[Analytics] getCarrierStats: Successfully retrieved ${carrierStats.rows.length} carriers`);
      return res.json(carrierStats.rows);
    } catch (queryError) {
      console.error('[Analytics] Error executing carrier stats query:', queryError);
      // Return empty data instead of error to prevent UI from showing error state
      return res.json([]);
    }
  } catch (error) {
    console.error('[Analytics] Error in getCarrierStats:', error);
    // Return empty data instead of error to prevent UI from showing error state
    return res.json([]);
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
      console.error('[Analytics] No tenant ID associated with user in getCustomerStats');
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    console.log(`[Analytics] getCustomerStats: Using tenant ID ${tenantId}`);
    
    // Build date filter for query
    let dateFilter = '';
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (startDate && endDate) {
      dateFilter = ` AND s.start_time >= '${startDate}' AND s.start_time <= '${endDate}'`;
    } else if (startDate) {
      dateFilter = ` AND s.start_time >= '${startDate}'`;
    } else if (endDate) {
      dateFilter = ` AND s.start_time <= '${endDate}'`;
    } else {
      // Default to last 7 days if no date range specified
      dateFilter = ` AND s.start_time >= '${sevenDaysAgo.toISOString()}'`;
    }
    
    // Using raw SQL for better control over the query
    const query = `
      SELECT 
        COALESCE(s.customer_name, 'Unknown') as id,
        COALESCE(s.customer_name, 'Unknown') as name,
        COUNT(s.id) as "appointmentCount"
      FROM 
        schedules s
      JOIN 
        docks d ON s.dock_id = d.id
      JOIN 
        facilities f ON d.facility_id = f.id
      JOIN 
        organization_facilities of ON f.id = of.facility_id
      WHERE 
        of.organization_id = ${tenantId} ${dateFilter}
      GROUP BY 
        s.customer_name
      ORDER BY 
        "appointmentCount" DESC
      LIMIT 10
    `;
    
    console.log('[Analytics] getCustomerStats: Using dock-facility-organization relationship');
    
    try {
      const customerStats = await db.execute(query);

      console.log(`[Analytics] getCustomerStats: Successfully retrieved ${customerStats.rows.length} customers`);
      return res.json(customerStats.rows);
    } catch (queryError) {
      console.error('[Analytics] Error executing customer stats query:', queryError);
      // Return empty data instead of error to prevent UI from showing error state
      return res.json([]);
    }
  } catch (error) {
    console.error('[Analytics] Error in getCustomerStats:', error);
    // Return empty data instead of error to prevent UI from showing error state
    return res.json([]);
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
      console.error('[Analytics] No tenant ID associated with user in getAttendanceStats');
      return res.status(401).json({ error: 'Unauthorized: No tenant context found' });
    }
    
    console.log(`[Analytics] getAttendanceStats: Using tenant ID ${tenantId}`);
    
    // Build date filter for query
    let dateFilter = '';
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (startDate && endDate) {
      dateFilter = ` AND s.start_time >= '${startDate}' AND s.start_time <= '${endDate}'`;
    } else if (startDate) {
      dateFilter = ` AND s.start_time >= '${startDate}'`;
    } else if (endDate) {
      dateFilter = ` AND s.start_time <= '${endDate}'`;
    } else {
      // Default to last 7 days if no date range specified
      dateFilter = ` AND s.start_time >= '${sevenDaysAgo.toISOString()}'`;
    }
    
    // Using raw SQL for better control over the query
    const query = `
      SELECT 
        COALESCE(s.status, 'Not Reported') as "attendanceStatus",
        COUNT(*) as count
      FROM 
        schedules s
      JOIN 
        docks d ON s.dock_id = d.id
      JOIN 
        facilities f ON d.facility_id = f.id
      JOIN 
        organization_facilities of ON f.id = of.facility_id
      WHERE 
        of.organization_id = ${tenantId} ${dateFilter}
      GROUP BY 
        s.status
      ORDER BY 
        count DESC
    `;
    
    console.log('[Analytics] getAttendanceStats: Using dock-facility-organization relationship');
    
    try {
      const attendanceStats = await db.execute(query);

      console.log(`[Analytics] getAttendanceStats: Successfully retrieved ${attendanceStats.rows.length} attendance status records`);
      return res.json(attendanceStats.rows);
    } catch (queryError) {
      console.error('[Analytics] Error executing attendance stats query:', queryError);
      // Return empty data instead of error to prevent UI from showing error state
      return res.json([]);
    }
  } catch (error) {
    console.error('[Analytics] Error in getAttendanceStats:', error);
    // Return empty data instead of error to prevent UI from showing error state
    return res.json([]);
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
      console.error('[Analytics] No tenant ID associated with user in getDockUtilizationStats');
      return res.status(400).json({ error: 'No tenant ID associated with user' });
    }
    
    console.log(`[Analytics] getDockUtilizationStats: Using tenant ID ${tenantId}`);
    
    // First, get all facilities for this tenant through the organization_facilities junction table
    const tenantFacilities = await db.select({ id: facilities.id })
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, tenantId));
    
    console.log(`[Analytics] getDockUtilizationStats: Found ${tenantFacilities.length} facilities for tenant ${tenantId}`);
    
    const facilityIds = tenantFacilities.map((f: any) => f.id);
    if (!facilityIds.length) {
      console.log(`[Analytics] getDockUtilizationStats: No facilities found for tenant ${tenantId}, returning empty array`);
      return res.json([]);
    }
    
    try {
      // Construct date strings for the query
      const startDateStr = startDate ? startDate.toString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDateStr = endDate ? endDate.toString() : new Date().toISOString();
      
      console.log(`[Analytics] getDockUtilizationStats: Date range ${startDateStr} to ${endDateStr}`);
      
      // Build a simpler query with proper parameters
      const query = `
        WITH dock_data AS (
          SELECT 
            d.id as dock_id,
            d.name as dock_name,
            f.name as facility_name,
            EXTRACT(EPOCH FROM (timestamp '${endDateStr}' - timestamp '${startDateStr}')) / 3600 as total_hours
          FROM docks d
          JOIN facilities f ON d.facility_id = f.id
          JOIN organization_facilities of ON f.id = of.facility_id
          WHERE of.organization_id = ${tenantId}
          ${facilityId ? `AND d.facility_id = ${facilityId}` : ''}
        ),
        usage_data AS (
          SELECT 
            s.dock_id,
            COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0) as used_hours
          FROM schedules s
          JOIN dock_data dd ON s.dock_id = dd.dock_id
          WHERE s.start_time >= timestamp '${startDateStr}' AND s.end_time <= timestamp '${endDateStr}'
          GROUP BY s.dock_id
        )
        SELECT
          dd.dock_id,
          dd.dock_name,
          dd.facility_name,
          dd.total_hours,
          COALESCE(ud.used_hours, 0) as used_hours,
          CASE 
            WHEN dd.total_hours > 0 THEN 
              ROUND((COALESCE(ud.used_hours, 0) / dd.total_hours) * 100, 2)
            ELSE 0 
          END as utilization_percentage
        FROM dock_data dd
        LEFT JOIN usage_data ud ON dd.dock_id = ud.dock_id
        ORDER BY utilization_percentage DESC
      `;
      
      console.log("[Analytics] getDockUtilizationStats: Executing query");
      
      // Execute the raw SQL query
      const dockUtilizationStats = await db.execute(sql.raw(query));
      
      console.log(`[Analytics] getDockUtilizationStats: Retrieved ${dockUtilizationStats.rows.length} dock utilization records`);
      return res.json(dockUtilizationStats.rows);
    } catch (queryError) {
      console.error('[Analytics] Error executing dock utilization query:', queryError);
      // Return empty data instead of error to prevent UI from showing error state
      return res.json([]);
    }
  } catch (error) {
    console.error('[Analytics] Error in getDockUtilizationStats:', error);
    // Return empty data instead of error to prevent UI from showing error state
    return res.json([]);
  }
}