/**
 * Calendar direct DOM fix script
 * This script directly manipulates the DOM to fix calendar view issues
 */

// Wait for document to be fully loaded
document.addEventListener('DOMContentLoaded', fixCalendar);

// Fix calendar after calendar component mounts
function fixCalendar() {
  // Set up a periodic check for the calendar
  const checkInterval = setInterval(() => {
    const calendar = document.querySelector('.fc');
    if (calendar) {
      console.log('Calendar found, applying direct fixes');
      applyCalendarFixes();
      clearInterval(checkInterval);
      
      // Set up a mutation observer to detect view changes
      setupViewChangeObserver();
    }
  }, 500);
}

// Apply all fixes directly to the DOM
function applyCalendarFixes() {
  // Fix buttons visibility
  fixButtonsVisibility();
  
  // Fix event stacking
  fixEventStacking();
  
  // Fix container constraints
  fixContainerConstraints();
  
  // Listen for view changes
  trackViewChanges();
}

// Fix buttons visibility issue
function fixButtonsVisibility() {
  // Find all calendar view buttons
  const buttons = document.querySelectorAll('.calendar-view-button');
  buttons.forEach(button => {
    // Force visibility
    (button as HTMLElement).style.display = 'inline-flex';
    (button as HTMLElement).style.visibility = 'visible';
    (button as HTMLElement).style.opacity = '1';
    (button as HTMLElement).style.pointerEvents = 'auto';
  });
  
  // Make buttons container sticky
  const buttonsContainer = document.querySelector('.view-buttons-container');
  if (buttonsContainer) {
    (buttonsContainer as HTMLElement).style.position = 'sticky';
    (buttonsContainer as HTMLElement).style.top = '0';
    (buttonsContainer as HTMLElement).style.zIndex = '9999';
    (buttonsContainer as HTMLElement).style.backgroundColor = 'white';
    (buttonsContainer as HTMLElement).style.padding = '12px 0';
    (buttonsContainer as HTMLElement).style.borderBottom = '1px solid #e5e7eb';
    (buttonsContainer as HTMLElement).style.marginBottom = '15px';
    (buttonsContainer as HTMLElement).style.width = '100%';
  }
}

// Fix event stacking issues
function fixEventStacking() {
  // Find all timegrid events
  const events = document.querySelectorAll('.fc-timegrid-event');
  events.forEach(event => {
    // Get data-time attribute
    const timeAttr = event.getAttribute('data-time');
    if (!timeAttr) return;
    
    // Set z-index based on time (earlier events on top)
    if (timeAttr === '06:00') (event as HTMLElement).style.zIndex = '2400';
    else if (timeAttr === '07:00') (event as HTMLElement).style.zIndex = '2300';
    else if (timeAttr === '08:00') (event as HTMLElement).style.zIndex = '2200';
    else if (timeAttr === '09:00') (event as HTMLElement).style.zIndex = '2100';
    else if (timeAttr === '10:00') (event as HTMLElement).style.zIndex = '2000';
    else if (timeAttr === '11:00') (event as HTMLElement).style.zIndex = '1900';
    else if (timeAttr === '12:00') (event as HTMLElement).style.zIndex = '1800';
    else if (timeAttr === '13:00') (event as HTMLElement).style.zIndex = '1700';
    else if (timeAttr === '14:00') (event as HTMLElement).style.zIndex = '1600';
    else if (timeAttr === '15:00') (event as HTMLElement).style.zIndex = '1500';
    else if (timeAttr === '16:00') (event as HTMLElement).style.zIndex = '1400';
    else if (timeAttr === '17:00') (event as HTMLElement).style.zIndex = '1300';
    else if (timeAttr === '18:00') (event as HTMLElement).style.zIndex = '1200';
    else if (timeAttr === '19:00') (event as HTMLElement).style.zIndex = '1100';
    else if (timeAttr === '20:00') (event as HTMLElement).style.zIndex = '1000';
    
    // Add a border
    (event as HTMLElement).style.border = '1px solid rgba(255,255,255,0.5)';
  });
}

// Fix container constraints for proper viewport
function fixContainerConstraints() {
  // Find the calendar container
  const container = document.querySelector('.calendar-container');
  if (container) {
    container.style.height = '70vh';
    container.style.width = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'auto';
    container.style.zIndex = '1';
  }
  
  // Find view harness
  const viewHarness = document.querySelector('.fc-view-harness');
  if (viewHarness) {
    viewHarness.style.width = '100%';
    viewHarness.style.minHeight = '500px';
  }
  
  // Handle responsive view
  const scrollgridTable = document.querySelector('.fc-scrollgrid-sync-table');
  if (scrollgridTable) {
    scrollgridTable.style.width = '100%';
  }
}

// Track view changes to reapply fixes
function trackViewChanges() {
  // Find all view buttons
  const viewButtons = [
    document.querySelector('button[title="month view"]'),
    document.querySelector('button[title="week view"]'),
    document.querySelector('button[title="day view"]'),
    document.querySelector('button[title="list view"]')
  ];
  
  // Add click listeners to reapply fixes
  viewButtons.forEach(button => {
    if (button) {
      button.addEventListener('click', () => {
        // Wait for view to change
        setTimeout(() => {
          fixEventStacking();
          fixContainerConstraints();
        }, 100);
      });
    }
  });
}

// Set up mutation observer to detect DOM changes in the calendar
function setupViewChangeObserver() {
  const calendar = document.querySelector('.fc');
  if (!calendar) return;
  
  const observer = new MutationObserver((mutations) => {
    // Check if view has changed
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Reapply fixes after DOM changes
        setTimeout(() => {
          fixEventStacking();
          fixContainerConstraints();
          fixButtonsVisibility();
        }, 100);
      }
    });
  });
  
  // Start observing
  observer.observe(calendar, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

// Execute the fix immediately as well
setTimeout(fixCalendar, 500);