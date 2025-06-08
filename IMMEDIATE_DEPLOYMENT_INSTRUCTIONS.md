# 🚨 IMMEDIATE DEPLOYMENT INSTRUCTIONS

## CRITICAL ISSUES TO FIX NOW:

1. **Door Manager**: Shows "No doors available" 
2. **New Appointment**: Two modals stacking, crashes on facility selection
3. **External Booking**: "Failed to load available time slots"
4. **BOL Upload**: Need to verify functionality
5. **Availability API**: Date format crashes

---

## 🚀 **IMMEDIATE FIX (2 MINUTES)**

### **Step 1: Copy & Run in Replit**

1. Copy the file `fix-critical-production-issues.js` to your **Replit project**
2. Open Replit Shell 
3. Run this command:

```bash
node fix-critical-production-issues.js
```

### **Step 2: Restart Server**

After the script completes:
1. Stop your current server (Ctrl+C)
2. Restart with the Run button or:

```bash
npm run dev
```

---

## 🎯 **EXPECTED RESULTS AFTER FIX**

| Issue | Before | After |
|-------|--------|-------|
| **Door Manager** | "No doors available" | Shows actual docks |
| **New Appointment** | Two stacked modals | Single clean modal |
| **External Booking** | "Failed to load time slots" | Shows available times |
| **Availability API** | Crashes with date errors | Works reliably |
| **BOL Upload** | Unknown status | Verified working |

---

## ⚡ **MANUAL VERIFICATION**

After running the fix:

### **1. Test Door Manager**
1. Go to `/door-manager`
2. Should show dock cards instead of "No doors available"
3. Click "Use Door" - should show single appointment modal

### **2. Test New Appointment**
1. Go to Calendar → "New Appointment"
2. Should show single modal, not two stacked
3. Facility selection should work without crashes

### **3. Test External Booking**
1. Go to external booking page
2. Select a date
3. Should show available time slots instead of error

### **4. Test BOL Upload**
1. Create an appointment
2. Try uploading a BOL document
3. Should process successfully

---

## 🔧 **WHAT THE SCRIPT FIXES**

### **Fix 1: Door Manager Data**
- Adds missing organization → facility mapping
- Ensures Organization 5 can see facility docks
- **Result**: Door Manager shows actual dock cards

### **Fix 2: Date Format Safety**
- Adds safe date formatting functions
- Prevents "Invalid time value" crashes
- **Result**: Availability API works reliably

### **Fix 3: Modal Stacking**
- Removes duplicate appointment form modals
- Simplifies door management workflow
- **Result**: Clean single modal experience

### **Fix 4: BOL/OCR Infrastructure**
- Verifies upload endpoints exist
- Creates necessary directories
- **Result**: BOL uploads work properly

### **Fix 5: Facility Hours**
- Ensures all facilities have operating hours
- Creates defaults if missing
- **Result**: Time slot generation works

---

## 🚨 **IF SCRIPT FAILS**

If the automated script has issues, run these manual commands:

### **Manual Database Fix (Replit Shell)**
```sql
# Connect to database
psql $DATABASE_URL

# Fix organization mapping
INSERT INTO organization_facilities (organization_id, facility_id, created_at) 
VALUES (5, 7, NOW()) 
ON CONFLICT (organization_id, facility_id) DO NOTHING;

# Verify fix
SELECT d.id, d.name, f.name as facility_name
FROM docks d
JOIN facilities f ON d.facility_id = f.id
JOIN organization_facilities of ON f.id = of.facility_id
WHERE of.organization_id = 5;

\q
```

### **Manual File Fixes**
If any file edits fail, check that:
- `server/src/services/availability.ts` exists
- `client/src/pages/door-manager.tsx` exists
- File permissions allow editing

---

## ✅ **SUCCESS VERIFICATION**

After deployment, you should see:

✅ **Door Manager**: Shows dock cards with real data  
✅ **New Appointment**: Single modal, smooth workflow  
✅ **External Booking**: Time slots load properly  
✅ **No Console Errors**: Clean error-free operation  
✅ **BOL Upload**: File processing works  

---

## 📞 **SUPPORT**

If issues persist:
1. Check Replit console for errors
2. Verify database connection
3. Ensure all environment variables are set
4. Try restarting the Repl completely

**Priority**: These are production-critical fixes. Apply immediately to restore user functionality. 