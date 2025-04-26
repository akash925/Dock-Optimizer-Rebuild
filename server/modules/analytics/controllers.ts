import { Request, Response } from 'express';
import { getStorage } from '../../storage';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

// Get heatmap data for appointments by day and hour
export async function getHeatmapData(req: Request, res: Response) {
  try {
    let { facilityId, appointmentTypeId, customerId, carrierId, startDate, endDate } = req.query;
    
    // Set default date range if not provided (last 30 days)
    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }
    if (!endDate) {
      endDate = new Date().toISOString();
    }
    
    // Build query conditions
    const conditions: any[] = [
      sql`s.startTime >= ${startDate}`,
      sql`s.startTime <= ${endDate}`,
      sql`s.status != 'cancelled'`
    ];
    
    if (facilityId) {
      conditions.push(sql`s.facilityId = ${Number(facilityId)}`);
    }
    if (appointmentTypeId) {
      conditions.push(sql`s.appointmentTypeId = ${Number(appointmentTypeId)}`);
    }
    if (customerId) {
      conditions.push(sql`s.customerId = ${Number(customerId)}`);
    }
    if (carrierId) {
      conditions.push(sql`s.carrierId = ${Number(carrierId)}`);
    }
    
    // Build the WHERE clause by joining all conditions with AND
    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;
    
    // Query appointments grouped by day and hour
    const result = await db.execute(sql`
      SELECT 
        s.startTime,
        COUNT(*) as count,
        ROUND(
          SUM(CASE WHEN s.actualArrivalTime IS NOT NULL AND s.scheduledArrivalTime IS NOT NULL AND 
                    s.actualArrivalTime <= s.scheduledArrivalTime + INTERVAL '15 minutes' 
               THEN 1 
               ELSE 0 
               END
          ) * 100.0 / COUNT(*), 
          0
        ) as onTimePercentage
      FROM schedules s
      ${whereClause}
      GROUP BY DATE_TRUNC('hour', s.startTime AT TIME ZONE 'UTC')
      ORDER BY s.startTime
    `);
    
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return res.status(500).json({ error: "Failed to fetch heatmap data" });
  }
}

// Get appointment counts by facility for Location Report
export async function getFacilityStats(req: Request, res: Response) {
  try {
    let { startDate, endDate } = req.query;
    
    // Set default date range if not provided (last 30 days)
    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }
    if (!endDate) {
      endDate = new Date().toISOString();
    }
    
    const result = await db.execute(sql`
      SELECT 
        f.id,
        f.name,
        f.address,
        COUNT(s.id) as appointmentCount
      FROM facilities f
      LEFT JOIN schedules s ON f.id = s.facilityId 
        AND s.startTime >= ${startDate}
        AND s.startTime <= ${endDate}
        AND s.status != 'cancelled'
      GROUP BY f.id, f.name, f.address
      ORDER BY appointmentCount DESC
    `);
    
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching facility stats:", error);
    return res.status(500).json({ error: "Failed to fetch facility statistics" });
  }
}

// Get appointment counts by carrier for Carrier Name report
export async function getCarrierStats(req: Request, res: Response) {
  try {
    let { startDate, endDate } = req.query;
    
    // Set default date range if not provided (last 30 days)
    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }
    if (!endDate) {
      endDate = new Date().toISOString();
    }
    
    const result = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        COUNT(s.id) as appointmentCount
      FROM carriers c
      LEFT JOIN schedules s ON c.id = s.carrierId
        AND s.startTime >= ${startDate}
        AND s.startTime <= ${endDate}
        AND s.status != 'cancelled'
      GROUP BY c.id, c.name
      ORDER BY appointmentCount DESC
      LIMIT 20
    `);
    
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching carrier stats:", error);
    return res.status(500).json({ error: "Failed to fetch carrier statistics" });
  }
}

// Get appointment counts by customer for Customer report
export async function getCustomerStats(req: Request, res: Response) {
  try {
    let { startDate, endDate } = req.query;
    
    // Set default date range if not provided (last 30 days)
    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }
    if (!endDate) {
      endDate = new Date().toISOString();
    }
    
    const result = await db.execute(sql`
      SELECT 
        comp.id,
        comp.name,
        COUNT(s.id) as appointmentCount
      FROM companies comp
      LEFT JOIN schedules s ON comp.id = s.customerId
        AND s.startTime >= ${startDate}
        AND s.startTime <= ${endDate}
        AND s.status != 'cancelled'
      GROUP BY comp.id, comp.name
      ORDER BY appointmentCount DESC
      LIMIT 20
    `);
    
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    return res.status(500).json({ error: "Failed to fetch customer statistics" });
  }
}

// Get appointment attendance statistics
export async function getAttendanceStats(req: Request, res: Response) {
  try {
    let { startDate, endDate } = req.query;
    
    // Set default date range if not provided (last 30 days)
    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }
    if (!endDate) {
      endDate = new Date().toISOString();
    }
    
    const result = await db.execute(sql`
      SELECT 
        CASE
          WHEN s.status = 'cancelled' AND s.cancelledByCustomer = true THEN 'Cancelled Event By User'
          WHEN s.status = 'cancelled' AND s.cancelledByCustomer = false THEN 'Cancelled Event By Host'
          WHEN s.actualArrivalTime IS NULL THEN 'Attendance Not Reported'
          WHEN s.actualArrivalTime > s.scheduledArrivalTime + INTERVAL '15 minutes' THEN 'Coming Late'
          ELSE 'Coming On Time'
        END as attendanceStatus,
        COUNT(*) as count
      FROM schedules s
      WHERE 
        s.startTime >= ${startDate} AND
        s.startTime <= ${endDate}
      GROUP BY attendanceStatus
      ORDER BY count DESC
    `);
    
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    return res.status(500).json({ error: "Failed to fetch attendance statistics" });
  }
}