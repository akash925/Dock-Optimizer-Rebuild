import { Request, Response } from 'express';
import { db } from '../../db';
import { 
  facilities, 
  carriers, 
  schedules,
  docks
} from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Get heatmap data for analytics dashboard
 * This endpoint aggregates appointment data by day and hour
 */
export async function getHeatmapData(req: Request, res: Response) {
  try {
    const { facilityId, appointmentTypeId, customerId, carrierId, startDate, endDate } = req.query;
    
    // Build dynamic WHERE clause based on filter params
    let whereClause = sql`WHERE 1=1`;
    
    if (facilityId) {
      whereClause = sql`${whereClause} AND dock_id = ${facilityId}`;
    }
    
    if (appointmentTypeId) {
      whereClause = sql`${whereClause} AND appointment_type_id = ${appointmentTypeId}`;
    }
    
    if (customerId) {
      whereClause = sql`${whereClause} AND customer_name = ${customerId}`;
    }
    
    if (carrierId) {
      whereClause = sql`${whereClause} AND carrier_id = ${carrierId}`;
    }
    
    // Add date range filtering
    if (startDate && endDate) {
      whereClause = sql`${whereClause} AND start_time >= ${startDate} AND start_time <= ${endDate}`;
    } else if (startDate) {
      whereClause = sql`${whereClause} AND start_time >= ${startDate}`;
    } else if (endDate) {
      whereClause = sql`${whereClause} AND start_time <= ${endDate}`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      whereClause = sql`${whereClause} AND start_time >= ${sevenDaysAgo.toISOString()}`;
    }
    
    // Query to aggregate appointments by day and hour
    const heatmapData = await db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM start_time) as day_of_week,
        EXTRACT(HOUR FROM start_time) as hour_of_day,
        COUNT(*) as count
      FROM ${schedules}
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
    
    // Build WHERE clause for date filtering
    let whereClause = sql`WHERE 1=1`;
    
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
    
    // Query to get appointment counts by facility location with date filtering
    const facilityStats = await db.execute(sql`
      SELECT 
        f.id,
        f.name,
        f.address1 as address,
        COUNT(s.id) as "appointmentCount"
      FROM ${facilities} f
      LEFT JOIN ${schedules} s ON f.id = s.dock_id
      ${whereClause}
      GROUP BY f.id, f.name, f.address1
      ORDER BY "appointmentCount" DESC
    `);

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
    
    // Build WHERE clause for date filtering
    let whereClause = sql`WHERE 1=1`;
    
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
    
    // Query to get appointment counts by carrier with date filtering
    const carrierStats = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        COUNT(s.id) as "appointmentCount"
      FROM ${carriers} c
      LEFT JOIN ${schedules} s ON c.id = s.carrier_id
      ${whereClause}
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
    
    // Build WHERE clause for date filtering
    let whereClause = sql`WHERE s.customer_name IS NOT NULL`;
    
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
    
    // Query to get appointment counts by customer name with date filtering
    const customerStats = await db.execute(sql`
      SELECT 
        DISTINCT s.customer_name as id,
        s.customer_name as name,
        COUNT(s.id) as "appointmentCount"
      FROM ${schedules} s
      ${whereClause}
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
    
    // Build WHERE clause for date filtering
    let whereClause = sql`WHERE 1=1`;
    
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
    
    // Query to get counts by attendance status with date filtering
    const attendanceStats = await db.execute(sql`
      SELECT 
        COALESCE(s.status, 'Not Reported') as "attendanceStatus",
        COUNT(*) as count
      FROM ${schedules} s
      ${whereClause}
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
    
    // Build WHERE clause for date filtering
    let whereClause = sql`WHERE 1=1`;
    let dockWhereClause = sql`WHERE 1=1`;
    
    if (facilityId) {
      whereClause = sql`${whereClause} AND d.facility_id = ${facilityId}`;
      dockWhereClause = sql`${dockWhereClause} AND facility_id = ${facilityId}`;
    }
    
    // Add date range filtering
    let dateFilter = '';
    if (startDate && endDate) {
      whereClause = sql`${whereClause} AND s.start_time >= ${startDate} AND s.start_time <= ${endDate}`;
      dateFilter = `AND start_time >= '${startDate}' AND end_time <= '${endDate}'`;
    } else if (startDate) {
      whereClause = sql`${whereClause} AND s.start_time >= ${startDate}`;
      dateFilter = `AND start_time >= '${startDate}'`;
    } else if (endDate) {
      whereClause = sql`${whereClause} AND s.end_time <= ${endDate}`;
      dateFilter = `AND end_time <= '${endDate}'`;
    } else {
      // Default to last 7 days if no date range specified
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      whereClause = sql`${whereClause} AND s.start_time >= ${sevenDaysAgo.toISOString()}`;
      dateFilter = `AND start_time >= '${sevenDaysAgo.toISOString()}'`;
    }
    
    // Query to get utilization by dock
    const dockUtilizationStats = await db.execute(sql`
      WITH total_time AS (
        SELECT 
          d.id as dock_id,
          d.name as dock_name,
          f.name as facility_name,
          EXTRACT(EPOCH FROM (CASE 
            WHEN ${endDate}::timestamp IS NOT NULL THEN LEAST(${endDate}::timestamp, NOW()) 
            ELSE NOW() 
          END) - (CASE 
            WHEN ${startDate}::timestamp IS NOT NULL THEN ${startDate}::timestamp
            ELSE (NOW() - INTERVAL '7 days')
          END)) / 3600 as total_hours
        FROM ${docks} d
        JOIN ${facilities} f ON d.facility_id = f.id
        ${dockWhereClause}
      ),
      used_time AS (
        SELECT 
          d.id as dock_id,
          SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600) as used_hours
        FROM ${docks} d
        LEFT JOIN ${schedules} s ON d.id = s.dock_id
        ${whereClause}
        GROUP BY d.id
      )
      SELECT 
        t.dock_id,
        t.dock_name,
        t.facility_name,
        COALESCE(u.used_hours, 0) as used_hours,
        t.total_hours,
        CASE 
          WHEN t.total_hours > 0 THEN 
            ROUND((COALESCE(u.used_hours, 0) / t.total_hours) * 100, 2)
          ELSE 0 
        END as utilization_percentage
      FROM total_time t
      LEFT JOIN used_time u ON t.dock_id = u.dock_id
      ORDER BY utilization_percentage DESC
    `);

    return res.json(dockUtilizationStats.rows);
  } catch (error) {
    console.error('Error fetching dock utilization stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dock utilization statistics' });
  }
}