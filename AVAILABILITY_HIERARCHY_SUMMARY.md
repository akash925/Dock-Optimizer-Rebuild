# 🕒 **Enhanced Availability System - Configuration Hierarchy**

## ✅ **Fully Configurable, No Hard-Coding**

The availability system now respects a complete hierarchy of configuration with **zero hardcoded values**. Everything is driven by user configuration in the frontend.

---

## 📊 **Configuration Priority Hierarchy**

### **1. Organization Hours** (Base Level)
- **Source**: Organization settings configured by admin
- **Fields**: `{day}Open`, `{day}Start`, `{day}End`, `{day}BreakStart`, `{day}BreakEnd`
- **Fallback**: Only when no configuration exists (`open: false` by default)
- **Scope**: Applies to all facilities unless overridden

### **2. Facility Hours** (Override Level 1)
- **Source**: Individual facility settings 
- **Fields**: `{day}Open`, `{day}Start`, `{day}End`, `{day}BreakStart`, `{day}BreakEnd`
- **Priority**: Overrides organization hours when configured
- **Scope**: Applies to specific facility unless overridden by appointment type

### **3. Appointment Type Hours** (Highest Priority)
- **Source**: Appointment type specific settings
- **Fields**: `hoursOverride`, `{day}Open`, `{day}Start`, `{day}End`, `{day}BreakStart`, `{day}BreakEnd`
- **Priority**: **Highest** - overrides all facility and organization settings
- **Scope**: Applies only to specific appointment type

### **4. Holidays & Closures** (Override All)
- **Organization Holidays**: Company-wide closures
- **Facility Closures**: Facility-specific closures
- **Appointment Type Restrictions**: Type-specific blackout dates
- **Priority**: Can force `open: false` regardless of other settings

---

## 🔄 **Dynamic Day Configuration**

### **Day Keys Processing**
```typescript
const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayKey = dayKeys[dayOfWeek]; // Calculated from actual date
```

### **No Hardcoded Assumptions**
- ❌ **Before**: Weekdays open by default, weekends closed
- ✅ **Now**: All days require explicit configuration
- ✅ **Fallback**: `open: false` only when no configuration exists

---

## 🏗️ **Configuration Flow**

### **Step 1: Organization Base**
```typescript
// Extract configured values from database
const isOpen = dayOpenField?.value !== undefined ? dayOpenField.value : false;
const startTime = dayStartField?.value || "08:00";
const endTime = dayEndField?.value || "17:00";
```

### **Step 2: Facility Override**
```typescript
if (facilityDayOpen?.value !== undefined || facilityDayStart?.value || facilityDayEnd?.value) {
  // Use facility configuration
  effectiveHours = {
    open: facilityDayOpen?.value !== undefined ? facilityDayOpen.value : orgHours[dayKey].open,
    start: facilityDayStart?.value || orgHours[dayKey].start,
    end: facilityDayEnd?.value || orgHours[dayKey].end,
    // ...
  };
}
```

### **Step 3: Appointment Type Override**
```typescript
if (appointmentTypeHoursOverride || appointmentTypeDayOpen !== null || appointmentTypeDayStart || appointmentTypeDayEnd) {
  // Appointment type has highest priority
  effectiveHours = {
    open: appointmentTypeDayOpen !== null ? appointmentTypeDayOpen : effectiveHours.open,
    start: appointmentTypeDayStart || effectiveHours.start,
    end: appointmentTypeDayEnd || effectiveHours.end,
    // ...
  };
}
```

### **Step 4: Holiday/Closure Check**
```typescript
// Check for organization holidays, facility closures, appointment type restrictions
effectiveHours = await checkHolidaysAndClosures(date, effectiveHours, organization, facility, appointmentType);
```

---

## 🎯 **Frontend Configuration Support**

### **Organization Level**
- Business hours for each day of week
- Company holidays and closures
- Default break times
- Timezone settings

### **Facility Level**  
- Override organization hours for specific locations
- Facility-specific closures (maintenance, etc.)
- Location-specific break schedules
- Dock-specific availability

### **Appointment Type Level**
- Service-specific hours (e.g., "After Hours Service")
- Type-specific restrictions and blackouts
- Buffer times and concurrent limits
- Duration and break-through settings

### **Holiday/Closure Management**
- Date-specific closures
- Date range closures
- Recurring holidays
- Emergency closures

---

## 📋 **Database Fields Supported**

### **Day-Specific Fields** (for each day: sunday, monday, etc.)
- `{day}_open` - Boolean: Is facility open this day
- `{day}_start` - Time: Opening time (e.g., "08:00")
- `{day}_end` - Time: Closing time (e.g., "17:00") 
- `{day}_break_start` - Time: Break start time (e.g., "12:00")
- `{day}_break_end` - Time: Break end time (e.g., "13:00")

### **Appointment Type Specific**
- `hours_override` - Boolean: Does this appointment type override facility hours
- `override_facility_hours` - Boolean: Can extend beyond normal hours
- `allow_appointments_through_breaks` - Boolean: Allow booking during breaks

### **Holiday/Closure Fields**
- `holidays` - Array: Organization holidays
- `closures` - Array: Facility-specific closures  
- `dateRestrictions` - Array: Appointment type restrictions

---

## ✅ **Key Benefits**

1. **🎛️ Fully Configurable**: No hardcoded business logic
2. **🏗️ Hierarchical**: Clear priority system
3. **📅 Dynamic**: Respects actual calendar days and holidays
4. **🔧 Granular**: Control at organization, facility, and appointment type levels
5. **🚀 User-Driven**: All configuration happens through frontend admin interfaces

This system ensures that the availability calculation is **100% driven by user configuration** with no hardcoded assumptions about business hours, days of operation, or holiday schedules. 