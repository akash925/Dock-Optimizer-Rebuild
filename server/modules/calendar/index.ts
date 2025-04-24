import { Request, Response } from 'express';
import { storage } from '../../storage';
import { format, addDays } from 'date-fns';
import express from 'express';
import routes, { calendarRouter } from './routes';

// Get all schedules with timezone support
export async function getSchedules(req: Request, res: Response) {
  try {
    const schedules = await storage.getAllSchedules();
    
    // Return schedules data
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
}

// Get schedule by ID
export async function getScheduleById(req: Request, res: Response) {
  try {
    const scheduleId = parseInt(req.params.id);
    
    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }
    
    const schedule = await storage.getScheduleById(scheduleId);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
}

// Initialize the calendar module
export function initializeCalendarModule(app: express.Express): void {
  // Register legacy routes at /api
  app.use('/api', routes);

  // Mount the new calendar routes at /api/calendar
  app.use('/api/calendar', calendarRouter);

  console.log('Calendar module loaded successfully');
}

export default {
  name: 'calendar',
  initialize: initializeCalendarModule
};