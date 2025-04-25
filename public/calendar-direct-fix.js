/**
 * Calendar direct DOM fix - stronger external fix
 * This script is loaded as a standalone file to fix the calendar issues
 */

// Execute immediately when loaded
(function() {
  console.log('Calendar external fix script loaded');
  
  // Fix any existing calendar elements
  fixCalendarNow();
  
  // Set up interval to ensure fixes are applied
  setInterval(fixCalendarNow, 500);
  
  function fixCalendarNow() {
    console.log('Checking for calendar elements to fix...');
    
    // Fix event stacking issues
    fixEventStacking();
    
    // Fix button visibility
    fixButtonVisibility();
    
    // Fix container constraints
    fixContainerConstraints();
    
    // Add viewport constraints
    fixViewportConstraints();
  }
  
  function fixEventStacking() {
    const events = document.querySelectorAll('.fc-timegrid-event');
    if (events.length > 0) {
      console.log(`Found ${events.length} events to fix stacking`);
      
      events.forEach(event => {
        if (event instanceof HTMLElement) {
          // Get data-time or look at event's text content for time
          const timeAttr = event.getAttribute('data-time');
          const timeText = event.querySelector('.fc-event-time')?.textContent || '';
          const timeMatch = timeText.match(/(\d+):(\d+)/);
          
          let hour = 12;
          
          if (timeAttr && timeAttr.includes(':')) {
            const parts = timeAttr.split(':');
            hour = parseInt(parts[0]);
          } else if (timeMatch) {
            hour = parseInt(timeMatch[1]);
          }
          
          // Calculate z-index, earlier times should have higher z-index
          const zIndex = 2400 - (hour * 100);
          
          // Set important styles directly on the element
          event.style.setProperty('z-index', zIndex.toString(), 'important');
          event.style.setProperty('border', '1px solid rgba(255,255,255,0.5)', 'important');
          event.style.setProperty('box-shadow', '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)', 'important');
        }
      });
    }
  }
  
  function fixButtonVisibility() {
    // Find all calendar view buttons
    const buttons = document.querySelectorAll('.calendar-view-button');
    if (buttons.length > 0) {
      console.log(`Found ${buttons.length} view buttons to fix visibility`);
      
      buttons.forEach(button => {
        if (button instanceof HTMLElement) {
          button.style.setProperty('display', 'inline-flex', 'important');
          button.style.setProperty('visibility', 'visible', 'important');
          button.style.setProperty('opacity', '1', 'important');
          button.style.setProperty('pointer-events', 'auto', 'important');
        }
      });
    }
    
    // Also fix the button container
    const buttonsContainer = document.querySelector('.view-buttons-container');
    if (buttonsContainer instanceof HTMLElement) {
      buttonsContainer.style.setProperty('position', 'sticky', 'important');
      buttonsContainer.style.setProperty('top', '0', 'important');
      buttonsContainer.style.setProperty('z-index', '9999', 'important');
      buttonsContainer.style.setProperty('background-color', 'white', 'important');
    }
  }
  
  function fixContainerConstraints() {
    // Find calendar container
    const container = document.querySelector('.calendar-container');
    if (container instanceof HTMLElement) {
      console.log('Found calendar container, fixing constraints');
      
      container.style.setProperty('height', '70vh', 'important');
      container.style.setProperty('width', '100%', 'important');
      container.style.setProperty('position', 'relative', 'important');
      container.style.setProperty('overflow', 'auto', 'important');
    }
  }
  
  function fixViewportConstraints() {
    // Find view harness
    const viewHarness = document.querySelector('.fc-view-harness');
    if (viewHarness instanceof HTMLElement) {
      viewHarness.style.setProperty('width', '100%', 'important');
      viewHarness.style.setProperty('min-height', '400px', 'important');
    }
    
    // Handle responsive view tables
    const tables = document.querySelectorAll('.fc-scrollgrid-sync-table');
    tables.forEach(table => {
      if (table instanceof HTMLElement) {
        table.style.setProperty('width', '100%', 'important');
      }
    });
  }
})();