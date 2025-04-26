import { Request, Response } from 'express';
import { db } from '../../db';
import { 
  facilities, 
  carriers, 
  schedules
} from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Get heatmap data for analytics dashboard
 * This endpoint aggregates appointment data by day and hour
 */
export async function getHeatmapData(req: Request, res: Response) {
  try {
    // Query to get appointment counts by day and hour
    const heatmapData = await db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM "start_time") as day_of_week,
        EXTRACT(HOUR FROM "start_time") as hour_of_day,
        COUNT(*) as count
      FROM ${schedules}
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week, hour_of_day
    `);

    return res.json(heatmapData);
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
    // Query to get appointment counts by facility
    const facilityStats = await db.execute(sql`
      SELECT 
        f.id,
        f.name,
        f.address1 as address,
        COUNT(s.id) as "appointmentCount"
      FROM ${facilities} f
      LEFT JOIN ${schedules} s ON f.id = s."facility_id"
      GROUP BY f.id, f.name, f.address1
      ORDER BY "appointmentCount" DESC
    `);

    return res.json(facilityStats);
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
    // Query to get appointment counts by carrier
    const carrierStats = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        COUNT(s.id) as "appointmentCount"
      FROM ${carriers} c
      LEFT JOIN ${schedules} s ON c.id = s."carrier_id"
      GROUP BY c.id, c.name
      ORDER BY "appointmentCount" DESC
      LIMIT 10
    `);

    return res.json(carrierStats);
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
    // Query to get appointment counts by customer company name
    const customerStats = await db.execute(sql`
      SELECT 
        DISTINCT s."company_name" as id,
        s."company_name" as name,
        COUNT(s.id) as "appointmentCount"
      FROM ${schedules} s
      WHERE s."company_name" IS NOT NULL
      GROUP BY s."company_name"
      ORDER BY "appointmentCount" DESC
      LIMIT 10
    `);

    return res.json(customerStats);
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
    // Query to get counts by attendance status
    const attendanceStats = await db.execute(sql`
      SELECT 
        COALESCE(s."attendance_status", 'Not Reported') as "attendanceStatus",
        COUNT(*) as count
      FROM ${schedules} s
      GROUP BY s."attendance_status"
      ORDER BY count DESC
    `);

    return res.json(attendanceStats);
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
}