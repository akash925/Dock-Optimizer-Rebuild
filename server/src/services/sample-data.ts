import { IStorage } from '../../storage';
import { AppointmentStatus, AppointmentType, SAMPLE_DATA_CONFIG } from '../constants/enums';

export interface SampleDataOptions {
  appointmentCount?: number;
  dayRange?: number;
  appointmentDurationHours?: number;
  startHour?: number;
  hourVariation?: number;
}

export class SampleDataService {
  constructor(private storage: IStorage) {}

  async createSampleAppointments(
    tenantId: number,
    options: SampleDataOptions = {}
  ): Promise<any[]> {
    const config = {
      appointmentCount: options.appointmentCount || SAMPLE_DATA_CONFIG.APPOINTMENT_COUNT,
      dayRange: options.dayRange || SAMPLE_DATA_CONFIG.APPOINTMENT_COUNT,
      appointmentDurationHours: options.appointmentDurationHours || SAMPLE_DATA_CONFIG.DEFAULT_APPOINTMENT_DURATION_HOURS,
      startHour: options.startHour || SAMPLE_DATA_CONFIG.START_HOUR,
      hourVariation: options.hourVariation || SAMPLE_DATA_CONFIG.HOUR_VARIATION
    };

    // Get tenant resources
    const facilities = await this.getTenantFacilities(tenantId);
    const appointmentTypes = await this.getTenantAppointmentTypes(tenantId);

    if (facilities.length === 0) {
      throw new Error('No facilities found for tenant');
    }

    if (appointmentTypes.length === 0) {
      throw new Error('No appointment types found for tenant');
    }

    const sampleAppointments = [];
    const now = new Date();

    for (let i = 0; i < config.appointmentCount; i++) {
      const appointment = this.generateAppointment(
        i,
        now,
        facilities,
        appointmentTypes,
        config
      );

      try {
        const createdAppointment = await this.storage.createSchedule(appointment);
        sampleAppointments.push(createdAppointment);
      } catch (error) {
        console.error(`Error creating sample appointment ${i + 1}:`, error);
      }
    }

    return sampleAppointments;
  }

  private async getTenantFacilities(tenantId: number) {
    const allFacilities = await this.storage.getFacilities();
    return allFacilities.filter(facility => facility.tenantId === tenantId);
  }

  private async getTenantAppointmentTypes(tenantId: number) {
    const allAppointmentTypes = await this.storage.getAppointmentTypes();
    return allAppointmentTypes.filter(type => type.tenantId === tenantId);
  }

  private generateAppointment(
    index: number,
    baseDate: Date,
    facilities: any[],
    appointmentTypes: any[],
    config: any
  ) {
    const appointmentDate = new Date(baseDate);
    appointmentDate.setDate(appointmentDate.getDate() - index);
    appointmentDate.setHours(
      config.startHour + (index % config.hourVariation),
      0,
      0,
      0
    );

    const facility = facilities[index % facilities.length];
    const appointmentType = appointmentTypes[index % appointmentTypes.length];

    const endTime = new Date(appointmentDate);
    endTime.setHours(endTime.getHours() + config.appointmentDurationHours);

    return {
      type: SAMPLE_DATA_CONFIG.TYPES[index % SAMPLE_DATA_CONFIG.TYPES.length],
      status: SAMPLE_DATA_CONFIG.STATUSES[index % SAMPLE_DATA_CONFIG.STATUSES.length],
      startTime: appointmentDate,
      endTime: endTime,
      appointmentTypeId: appointmentType.id,
      customFormData: this.generateCustomFormData(facility, index)
    };
  }

  private generateCustomFormData(facility: any, index: number) {
    return {
      facilityInfo: {
        id: facility.id,
        name: facility.name
      },
      customerInfo: {
        name: `Sample Customer ${index + 1}`,
        email: `customer${index + 1}@example.com`
      },
      carrierInfo: {
        name: `Sample Carrier ${index + 1}`,
        contact: `carrier${index + 1}@example.com`
      }
    };
  }

  async createSampleFacilities(tenantId: number, count: number = 3) {
    const sampleFacilities = [];

    for (let i = 0; i < count; i++) {
      const facility = {
        name: `Sample Facility ${i + 1}`,
        address1: `${100 + i * 50} Main Street`,
        city: 'Sample City',
        state: 'SC',
        pincode: `29${String(i).padStart(3, '0')}`,
        country: 'USA',
        timezone: 'America/New_York',
        tenantId: tenantId,
        isActive: true
      };

      try {
        const created = await this.storage.createFacility(facility);
        sampleFacilities.push(created);
      } catch (error) {
        console.error(`Error creating sample facility ${i + 1}:`, error);
      }
    }

    return sampleFacilities;
  }

  async createSampleAppointmentTypes(tenantId: number, facilityId: number, count: number = 3) {
    const sampleTypes = [];
    const typeNames = ['Loading', 'Unloading', 'Inspection'];

    for (let i = 0; i < Math.min(count, typeNames.length); i++) {
      const appointmentType = {
        name: typeNames[i],
        duration: 60 + (i * 30), // 60, 90, 120 minutes
        bufferTime: 15,
        maxConcurrent: 2 + i,
        type: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND', // Replace type references with string literals
        facilityId: facilityId,
        tenantId: tenantId,
        isActive: true
      };

      try {
        const created = await this.storage.createAppointmentType(appointmentType);
        sampleTypes.push(created);
      } catch (error) {
        console.error(`Error creating sample appointment type ${i + 1}:`, error);
      }
    }

    return sampleTypes;
  }
} 