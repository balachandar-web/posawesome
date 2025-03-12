
import mitt from 'mitt';

// Create a global event bus that can be accessed outside of Vue components
const globalEventBus = mitt();

// Make it available globally for non-Vue code
window.eventBus = globalEventBus;

export default {
    install: (app, options) => {
        app.config.globalProperties.__ = window.__;
        app.config.globalProperties.frappe = window.frappe;
        // Use the same event bus instance for Vue components
        app.config.globalProperties.eventBus = globalEventBus;
        
        console.log('EventBus initialized and attached to Vue app');
    }
}

// Also export the eventBus directly for imports
export const eventBus = globalEventBus;

