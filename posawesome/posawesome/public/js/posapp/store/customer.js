import { createStore } from 'vuex';
import { eventBus } from '../bus';

// Fall back to global or create a dummy if not available
const safeEventBus = eventBus || window.eventBus || {
  emit: (event, ...args) => {
    console.warn('EventBus not initialized, event not emitted:', event);
  },
  on: (event, callback) => {
    console.warn('EventBus not initialized, event not registered:', event);
    return () => {};
  },
  off: (event, callback) => {
    console.warn('EventBus not initialized, event not removed:', event);
  }
};

// Log confirmation of event bus
console.log('Customer store using eventBus:', !!eventBus);

const store = createStore({
  state: {
    customers: [],
    selectedCustomer: null,
    customerDetails: null,
    posProfile: null,
    isLoading: false,
    initialized: false,
    retryCount: 0
  },
  mutations: {
    SET_INITIALIZED(state, status) {
      state.initialized = status;
    },
    SET_CUSTOMERS(state, customers) {
      state.customers = customers;
    },
    SET_SELECTED_CUSTOMER(state, customer) {
      state.selectedCustomer = customer;
    },
    SET_CUSTOMER_DETAILS(state, customerDetails) {
      state.customerDetails = customerDetails;
    },
    SET_POS_PROFILE(state, profile) {
      state.posProfile = profile;
      // Mark as initialized when profile is set
      state.initialized = true;
    },
    SET_LOADING(state, status) {
      state.isLoading = status;
    },
    INCREMENT_RETRY_COUNT(state) {
      state.retryCount++;
    },
    RESET_RETRY_COUNT(state) {
      state.retryCount = 0;
    }
  },
  // Track if we're currently processing a customer selection to prevent circular updates
  _isProcessingCustomerSelection: false,
  
  actions: {
    registerPosProfile({ commit }, profile) {
      commit('SET_POS_PROFILE', profile);
      // Reset retry count when a new profile is registered
      commit('RESET_RETRY_COUNT');
    },
    
    selectCustomer({ commit, dispatch, state }, customer) {
      // Skip if we're already processing a customer selection
      if (store._isProcessingCustomerSelection) {
        console.log('Customer store: Already processing customer selection, skipping');
        return;
      }
      
      // Set flag to prevent recursive calls
      store._isProcessingCustomerSelection = true;
      
      try {
        if (!customer) {
          commit('SET_SELECTED_CUSTOMER', null);
          commit('SET_CUSTOMER_DETAILS', null);
          
          // Emit event to ensure other components are aware - but not back to ourselves
          // Use our safe eventBus reference
          safeEventBus.emit('set_customer_info_to_edit', null);
          return;
        }
        
        // If customer is a string (just the ID), find the full customer object
        if (typeof customer === 'string') {
          const customerObj = state.customers.find(c => c.name === customer);
          if (customerObj) {
            commit('SET_SELECTED_CUSTOMER', customerObj.name);
            commit('SET_CUSTOMER_DETAILS', customerObj);
            
            // Emit events to ensure other components are aware - but not back to ourselves
            safeEventBus.emit('set_customer_info_to_edit', customerObj);
          } else {
            console.warn('Customer not found in store:', customer);
            commit('SET_SELECTED_CUSTOMER', customer);
            
            // Try to find this customer from server
            dispatch('fetchCustomerDetails', customer);
          }
        } else {
          // Customer is an object
          commit('SET_SELECTED_CUSTOMER', customer.name);
          commit('SET_CUSTOMER_DETAILS', customer);
          
          // Emit events to ensure other components are aware - but not back to ourselves
          safeEventBus.emit('set_customer_info_to_edit', customer);
        }
      } finally {
        // Reset flag regardless of success or failure
        store._isProcessingCustomerSelection = false;
      }
    },
    
    async fetchCustomerDetails({ commit }, customerId) {
      try {
        const result = await frappe.call({
          method: 'posawesome.posawesome.api.posapp.get_customer_details',
          args: {
            customer: customerId,
          },
        });
        
        if (result.message) {
          commit('SET_CUSTOMER_DETAILS', result.message);
          safeEventBus.emit('set_customer_info_to_edit', result.message);
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
      }
    },
    
    async fetchCustomers({ commit, state, dispatch }) {
      console.log('Starting fetchCustomers... Current state:', {
        hasProfile: !!state.posProfile,
        profileId: state.posProfile?.pos_profile,
        customersCount: state.customers?.length,
        isLoading: state.isLoading,
        retryCount: state.retryCount
      });
      
      // Wait for POS profile with backoff retry strategy
      if (!state.posProfile?.pos_profile) {
        if (state.retryCount >= 5) {
          console.error('POS profile not available after multiple retries');
          frappe.show_alert({
            message: __('Failed to initialize POS profile. Please refresh the page.'),
            indicator: 'red'
          });
          commit('RESET_RETRY_COUNT');
          return;
        }
        
        console.info('Waiting for POS profile... Attempt', state.retryCount + 1);
        commit('INCREMENT_RETRY_COUNT');
        
        // Exponential backoff delay (1s, 2s, 4s, 8s, 16s)
        const delay = Math.min(1000 * Math.pow(2, state.retryCount), 16000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try again after waiting
        dispatch('fetchCustomers');
        return;
      }
      
      // Reset retry count since we have the profile
      commit('RESET_RETRY_COUNT');
      commit('SET_LOADING', true);
      
      try {
        // Check if we have customers in local storage and using it is enabled
        if (state.posProfile?.posa_local_storage && localStorage.getItem('customer_storage')) {
          try {
            const storedCustomers = JSON.parse(localStorage.getItem('customer_storage'));
            if (Array.isArray(storedCustomers) && storedCustomers.length > 0) {
              console.log('Using cached customers from storage:', storedCustomers.length);
              commit('SET_CUSTOMERS', storedCustomers);
              
              // Notify components immediately about loaded customers from storage
              safeEventBus.emit('customers_loaded', storedCustomers);
              
              // If we have a selected customer, ensure its details are set
              if (state.selectedCustomer) {
                const selectedCustomerObj = storedCustomers.find(c => c.name === state.selectedCustomer);
                if (selectedCustomerObj) {
                  commit('SET_CUSTOMER_DETAILS', selectedCustomerObj);
                  safeEventBus.emit('set_customer_info_to_edit', selectedCustomerObj);
                }
              }
            }
          } catch (e) {
            console.warn('Error parsing customer storage, will fetch from server:', e);
          }
        }
        
        // Log the POS profile details to help diagnose any issues
        console.info('Fetching customers with POS profile:', {
          posProfile: state.posProfile.pos_profile,
          type: typeof state.posProfile.pos_profile
        });
        
        // Fetch fresh data from server
        const result = await frappe.call({
          method: 'posawesome.posawesome.api.posapp.get_customer_names',
          args: {
            pos_profile: state.posProfile.pos_profile,
          },
        });

        if (result.message) {
          console.log('Customers loaded from server:', result.message.length);
          
          // Ensure result.message is an array before proceeding
          if (!Array.isArray(result.message)) {
            console.error('Invalid customer data format - expected array:', result.message);
            frappe.show_alert({
              message: __('Invalid customer data format received'),
              indicator: 'red'
            });
            return;
          }
          
          // Check if we received any customers
          if (result.message.length === 0) {
            console.warn('Server returned empty customers list');
          }
          
          commit('SET_CUSTOMERS', result.message);
          
          // Update local storage if enabled
          if (state.posProfile?.posa_local_storage) {
            try {
              localStorage.setItem('customer_storage', JSON.stringify(result.message));
              console.log('Saved', result.message.length, 'customers to local storage');
            } catch (e) {
              console.error('Error saving to customer storage:', e);
            }
          }
          
          // If there's a selected customer, update its details
          if (state.selectedCustomer) {
            const selectedCustomerObj = result.message.find(c => c.name === state.selectedCustomer);
            if (selectedCustomerObj) {
              commit('SET_CUSTOMER_DETAILS', selectedCustomerObj);
              safeEventBus.emit('set_customer_info_to_edit', selectedCustomerObj);
            }
          }
          
          // Notify other components that customers are loaded
          safeEventBus.emit('customers_loaded', result.message);
        } else {
          console.warn('API returned no customer data (result.message is empty)');
          frappe.show_alert({
            message: __('No customers received from server'),
            indicator: 'orange'
          });
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
        
        // Try to use existing customers if we have any
        if (state.customers && state.customers.length > 0) {
          console.log('Using existing', state.customers.length, 'customers after error');
          // Notify about existing customers despite the error
          safeEventBus.emit('customers_loaded', state.customers);
        } else {
          // Try to load from local storage as a fallback, even if local storage wasn't enabled
          try {
            const storedCustomers = JSON.parse(localStorage.getItem('customer_storage'));
            if (storedCustomers && Array.isArray(storedCustomers) && storedCustomers.length > 0) {
              console.log('Falling back to local storage after error, found', storedCustomers.length, 'customers');
              commit('SET_CUSTOMERS', storedCustomers);
              safeEventBus.emit('customers_loaded', storedCustomers);
            }
          } catch (e) {
            console.warn('Error accessing local storage fallback:', e);
          }
        }
        
        frappe.show_alert({
          message: __('Failed to load customers. Using cached data if available.'),
          indicator: 'red'
        });
      } finally {
        commit('SET_LOADING', false);
      }
    },
    
    updateCustomerInList({ commit, state }, customer) {
      if (!customer || !customer.name) return;
      
      // Update customer in the list
      const index = state.customers.findIndex(c => c.name === customer.name);
      if (index !== -1) {
        // Create a new array to trigger reactivity
        const updatedCustomers = [...state.customers];
        updatedCustomers[index] = customer;
        commit('SET_CUSTOMERS', updatedCustomers);
      } else {
        // Add new customer to list
        commit('SET_CUSTOMERS', [...state.customers, customer]);
      }
      
      // Update local storage if enabled
      if (state.posProfile?.posa_local_storage) {
        try {
          localStorage.setItem('customer_storage', JSON.stringify(state.customers));
        } catch (e) {
          console.error('Error updating customer storage:', e);
        }
      }
      
      // If this is the selected customer, update its details
      if (state.selectedCustomer === customer.name) {
        commit('SET_CUSTOMER_DETAILS', customer);
        safeEventBus.emit('set_customer_info_to_edit', customer);
      }
    }
  },
  getters: {
    getCustomers: state => state.customers,
    getSelectedCustomer: state => state.selectedCustomer,
    getCustomerDetails: state => state.customerDetails,
    getPosProfile: state => state.posProfile,
    isLoading: state => state.isLoading,
    isInitialized: state => state.initialized
  }
});

// Initialize store with data after the Vue app is created
const initStore = () => {
  console.log('Initializing customer store event listeners');
  
  // Set up event listeners using our safe eventBus reference
  safeEventBus.on('register_pos_profile', (posProfile) => {
    console.log('Customer store received register_pos_profile event');
    store.dispatch('registerPosProfile', posProfile);
    store.dispatch('fetchCustomers');
  });
  
  // Track last received customer to prevent circular updates
  let lastReceivedCustomer = null;
  
  safeEventBus.on('update_customer', (customer) => {
    // Convert to string for consistent comparison
    const customerStr = customer ? String(customer) : null;
    
    // Skip if this is the same customer we just processed
    if (customerStr === lastReceivedCustomer) {
      console.log('Customer store: Skipping duplicate update_customer event for:', customerStr);
      return;
    }
    
    // Update our tracking variable
    lastReceivedCustomer = customerStr;
    console.log('Customer store received update_customer event:', customer);
    
    // Process the customer update
    store.dispatch('selectCustomer', customer);
  });
  
  safeEventBus.on('add_customer_to_list', (customer) => {
    console.log('Customer store received add_customer_to_list event');
    store.dispatch('updateCustomerInList', customer);
  });
  
  safeEventBus.on('fetch_customer_details', () => {
    console.log('Customer store received fetch_customer_details event');
    store.dispatch('fetchCustomers');
  });
};

// Initialize right away using our safe reference
initStore();

// Also set up a DOMContentLoaded listener as a backup
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded: Re-checking eventBus availability');
  // Just call init again - it's safe to do multiple times
  initStore();
});

// Expose initStore for explicit initialization
store.initStore = initStore;

export default store;
