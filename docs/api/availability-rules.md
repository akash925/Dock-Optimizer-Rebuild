# Availability Rules API

This document provides reference documentation for the Appointment Master Availability Rules API endpoints.

## GET /api/appointment-master/availability-rules

Retrieves availability rules for a specific appointment type at a specific facility.

### Request

#### HTTP Method
`GET`

#### URL
`/api/appointment-master/availability-rules`

#### Query Parameters

| Parameter       | Type   | Required | Description                                  |
|-----------------|--------|----------|----------------------------------------------|
| facilityId      | number | Yes      | The ID of the facility to get rules for      |
| typeId          | number | Yes      | The ID of the appointment type to get rules for |

### Response

#### Success (200 OK)
Returns an array of availability rule objects.

##### Response Schema
```json
[
  {
    "id": number,
    "appointmentTypeId": number,
    "facilityId": number,
    "dayOfWeek": number | null,
    "startDate": string | null,
    "endDate": string | null,
    "startTime": string,
    "endTime": string,
    "isActive": boolean,
    "maxConcurrent": number,
    "maxAppointmentsPerDay": number | null,
    "bufferTime": number | null,
    "gracePeriod": number | null,
    "showRemainingSlots": boolean
  }
]
```

##### Field Descriptions

| Field                | Type            | Description                                                                                 |
|----------------------|-----------------|---------------------------------------------------------------------------------------------|
| id                   | number          | Unique identifier for the rule                                                              |
| appointmentTypeId    | number          | ID of the appointment type this rule applies to                                             |
| facilityId           | number          | ID of the facility this rule applies to                                                     |
| dayOfWeek            | number or null  | Day of week (0-6, where 0 is Sunday) this rule applies to, or null for any day              |
| startDate            | string or null  | Start date for this rule (ISO format) for date-specific rules, or null for recurring rules  |
| endDate              | string or null  | End date for this rule (ISO format) for date-specific rules, or null for recurring rules    |
| startTime            | string          | Start time in "HH:MM" 24-hour format                                                        |
| endTime              | string          | End time in "HH:MM" 24-hour format                                                          |
| isActive             | boolean         | Whether this rule is currently active                                                       |
| maxConcurrent        | number          | Maximum number of concurrent appointments allowed in this time slot                         |
| maxAppointmentsPerDay| number or null  | Maximum total appointments per day, or null for unlimited                                   |
| bufferTime           | number or null  | Buffer time in minutes required between appointments, or null for no buffer                 |
| gracePeriod          | number or null  | Grace period in minutes allowed for appointments, or null for no grace period               |
| showRemainingSlots   | boolean         | Whether to show remaining slot counts in the booking UI                                     |

#### Error Responses

##### Bad Request (400)
Returned when required parameters are missing or invalid.

```json
{
  "error": "Missing required parameter: facilityId"
}
```

```json
{
  "error": "Missing required parameter: typeId"
}
```

##### Not Found (404)
Returned when no rules are found for the provided facilityId and typeId.

```json
{
  "error": "No availability rules found for the specified facility and appointment type"
}
```

##### Server Error (500)
Returned when an unexpected server error occurs.

```json
{
  "error": "An unexpected error occurred while fetching availability rules"
}
```

### Example Usage

#### Request
```
GET /api/appointment-master/availability-rules?facilityId=1&typeId=2
```

#### Response
```json
[
  {
    "id": 101,
    "appointmentTypeId": 2,
    "facilityId": 1,
    "dayOfWeek": 1,
    "startDate": null,
    "endDate": null,
    "startTime": "09:00",
    "endTime": "17:00",
    "isActive": true,
    "maxConcurrent": 3,
    "maxAppointmentsPerDay": 20,
    "bufferTime": 15,
    "gracePeriod": 5,
    "showRemainingSlots": true
  },
  {
    "id": 102,
    "appointmentTypeId": 2,
    "facilityId": 1,
    "dayOfWeek": 2,
    "startDate": null,
    "endDate": null,
    "startTime": "09:00",
    "endTime": "17:00",
    "isActive": true,
    "maxConcurrent": 3,
    "maxAppointmentsPerDay": 20,
    "bufferTime": 15,
    "gracePeriod": 5,
    "showRemainingSlots": true
  }
]
```

## Notes

- Availability rules are used to determine when appointments can be booked for specific appointment types at specific facilities.
- Rules can be recurring (specified by `dayOfWeek`) or date-specific (specified by `startDate` and `endDate`).
- Time values are in 24-hour format (e.g., "13:30" for 1:30 PM).
- All times are in the facility's local time zone.
- The `maxConcurrent` field determines how many appointments can be scheduled for the same time slot.
- The `maxAppointmentsPerDay` field limits the total number of appointments that can be scheduled on a single day.
- The `bufferTime` field specifies how much time (in minutes) is required between appointments.
- The `gracePeriod` field specifies how much time (in minutes) is allowed for late arrivals.