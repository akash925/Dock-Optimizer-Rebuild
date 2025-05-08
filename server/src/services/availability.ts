import { and, eq, gt, lt, ne, notInArray, or } from 'drizzle-orm';
import { toZonedTime, format as tzFormat } from 'date-fns-tz';
import { getDay, parseISO, addDays, format, addMinutes } from 'date-fns';
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IStorage } from '../../storage';
import { schedules, docks, appointmentTypes, organizationFacilities } from '@shared/schema';

type DrizzleDBInstance = PostgresJsDatabase<typeof import("@shared/schema")>;

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  remainingCapacity: number;
  remaining: number;
  reason: string;
}

export interface AvailabilityOptions {
  testAppointments?: { id: number; startTime: Date; endTime: Date; }[];
}

export async function fetchRelevantAppointmentsForDay(
  db: DrizzleDBInstance,
  facilityId: number,
  dayStart: Date,
  dayEnd: Date,
  effectiveTenantId: number
): Promise<{ id: number; startTime: Date; endTime: Date; }[]> {

  const query = db
    .select({ id: schedules.id, startTime: schedules.startTime, endTime: schedules.endTime })
    .from(schedules)
    .leftJoin(docks, eq(schedules.dockId, docks.id))
    .leftJoin(appointmentTypes, eq(schedules.appointmentTypeId, appointmentTypes.id))
    .leftJoin(organizationFacilities, eq(docks.facilityId, organizationFacilities.facilityId))
    .where(
      and(
        ne(schedules.dockId, null),
        eq(docks.facilityId, facilityId),
        lt(schedules.startTime, dayEnd),
        gt(schedules.endTime, dayStart),
        notInArray(schedules.status, ['cancelled', 'rejected']),
        or(
          eq(organizationFacilities.organizationId, effectiveTenantId),
          eq(appointmentTypes.tenantId, effectiveTenantId)
        )
      )
    );

  return await query;
}

export async function calculateAvailabilitySlots(
  db: DrizzleDBInstance,
  storage: IStorage,
  date: string,
  facilityId: number,
  appointmentTypeId: number,
  effectiveTenantId: number,
  options?: AvailabilityOptions
): Promise<AvailabilitySlot[]> {

  const facility = await storage.getFacility(facilityId, effectiveTenantId);
  if (!facility) {
    throw new Error('Facility not found or access denied.');
  }

  const appointmentType = await storage.getAppointmentType(appointmentTypeId);
  if (!appointmentType || (appointmentType.tenantId && appointmentType.tenantId !== effectiveTenantId)) {
    throw new Error('Appointment type not found or access denied.');
  }

  const facilityTimezone = facility.timezone || 'America/New_York';
  const zonedDate = toZonedTime(parseISO(`${date}T00:00:00`), facilityTimezone);
  const dayOfWeek = getDay(zonedDate);

  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayKeys[dayOfWeek];
  const isOpen = facility[`${dayKey}Open`];

  if (!isOpen) {
    return [];
  }

  const operatingStartTimeStr = facility[`${dayKey}Start`] || "09:00";
  const operatingEndTimeStr = facility[`${dayKey}End`] || "17:00";
  const breakStartTimeStr = facility[`${dayKey}BreakStart`];
  const breakEndTimeStr = facility[`${dayKey}BreakEnd`];

  const dayStart = toZonedTime(parseISO(`${date}T00:00:00`), facilityTimezone);
  const nextDateStr = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
  const dayEnd = toZonedTime(parseISO(`${nextDateStr}T00:00:00`), facilityTimezone);

  const existingAppointments = options?.testAppointments ?? await fetchRelevantAppointmentsForDay(db, facilityId, dayStart, dayEnd, effectiveTenantId);

  const slots: AvailabilitySlot[] = [];
  const slotInterval = Math.max(appointmentType.bufferTime || appointmentType.duration, 15);

  let slotTime = toZonedTime(parseISO(`${date}T${operatingStartTimeStr}`), facilityTimezone);
  const endTime = toZonedTime(parseISO(`${date}T${operatingEndTimeStr}`), facilityTimezone);

  const breakStart = breakStartTimeStr ? toZonedTime(parseISO(`${date}T${breakStartTimeStr}`), facilityTimezone) : null;
  const breakEnd = breakEndTimeStr ? toZonedTime(parseISO(`${date}T${breakEndTimeStr}`), facilityTimezone) : null;

  while (slotTime < endTime) {
    const slotEnd = addMinutes(slotTime, appointmentType.duration);
    if (slotEnd > endTime) break;

    let reason = "";
    let available = true;

    const conflicts = existingAppointments.filter(a => a.startTime < slotEnd && a.endTime > slotTime);
    if (conflicts.length >= appointmentType.maxConcurrent) {
      available = false;
      reason = "Capacity full";
    }

    if (available && breakStart && breakEnd && slotTime < breakEnd && slotEnd > breakStart && !appointmentType.allowAppointmentsThroughBreaks) {
      available = false;
      reason = "Break Time";
    }

    slots.push({
      time: tzFormat(slotTime, 'HH:mm', { timeZone: facilityTimezone }),
      available,
      remainingCapacity: available ? appointmentType.maxConcurrent - conflicts.length : 0,
      remaining: available ? appointmentType.maxConcurrent - conflicts.length : 0,
      reason
    });

    slotTime = addMinutes(slotTime, slotInterval);
  }

  return slots;
}