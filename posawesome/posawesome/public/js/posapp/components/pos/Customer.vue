<template>
  <div>
    <v-autocomplete density="compact" clearable auto-select-first variant="outlined" color="primary"
      :label="frappe._('Customer')" v-model="selectedCustomer" :items="customersList" item-title="customer_name" item-value="name"
      bg-color="white" :no-data-text="__('Customers not found')" hide-details :customFilter="customFilter"
      :loading="isLoading" :disabled="readonly" append-icon="mdi-plus" @click:append="new_customer" prepend-inner-icon="mdi-account-edit"
      @click:prepend-inner="edit_customer">
      <template v-slot:item="{ props, item }">
        <v-list-item v-bind="props">
          <v-list-item-subtitle v-if="item.raw.customer_name != item.raw.name">
            <div v-html="`ID: ${item.raw.name}`"></div>
          </v-list-item-subtitle>
          <v-list-item-subtitle v-if="item.raw.tax_id">
            <div v-html="`TAX ID: ${item.raw.tax_id}`"></div>
          </v-list-item-subtitle>
          <v-list-item-subtitle v-if="item.raw.email_id">
            <div v-html="`Email: ${item.raw.email_id}`"></div>
          </v-list-item-subtitle>
          <v-list-item-subtitle v-if="item.raw.mobile_no">
            <div v-html="`Mobile No: ${item.raw.mobile_no}`"></div>
          </v-list-item-subtitle>
          <v-list-item-subtitle v-if="item.raw.primary_address">
            <div v-html="`Primary Address: ${item.raw.primary_address}`"></div>
          </v-list-item-subtitle>
        </v-list-item>
      </template>
    </v-autocomplete>
    <div class="mb-8">
      <UpdateCustomer></UpdateCustomer>
    </div>
  </div>
</template>

<script>
import UpdateCustomer from './UpdateCustomer.vue';
import customerStore from '../../store/customer';

export default {
  data: () => ({
    readonly: false,
    pos_profile: null,
    directlyLoadedCustomers: [],
    loading: false
  }),

  components: {
    UpdateCustomer,
  },

  methods: {
    new_customer() {
      if (this.eventBus) {
        this.eventBus.emit('open_update_customer', null);
      } else if (window.eventBus) {
        window.eventBus.emit('open_update_customer', null);
      }
    },
    
    edit_customer() {
      // Get customer details from the store or fallback to what we have
      const customerToEdit = customerStore.state.customerDetails || 
                           (this.selectedCustomer ? customerStore.state.customers.find(c => c.name === this.selectedCustomer) : null);
      
      if (customerToEdit) {
        if (this.eventBus) {
          this.eventBus.emit('open_update_customer', customerToEdit);
        } else if (window.eventBus) {
          window.eventBus.emit('open_update_customer', customerToEdit);
        }
      } else {
        frappe.show_alert({
          message: __('Please select a customer first'),
          indicator: 'orange'
        });
      }
    },
    
    customFilter(itemText, queryText, itemRow) {
      const item = itemRow.raw;
      const textOne = item.customer_name ? item.customer_name.toLowerCase() : '';
      const textTwo = item.tax_id ? item.tax_id.toLowerCase() : '';
      const textThree = item.email_id ? item.email_id.toLowerCase() : '';
      const textFour = item.mobile_no ? item.mobile_no.toLowerCase() : '';
      const textFifth = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();

      return (
        textOne.indexOf(searchText) > -1 ||
        textTwo.indexOf(searchText) > -1 ||
        textThree.indexOf(searchText) > -1 ||
        textFour.indexOf(searchText) > -1 ||
        textFifth.indexOf(searchText) > -1
      );
    },
    
    // Helper method to ensure customer is properly selected when clicking pay
    ensureCustomerSelected() {
      // If a customer is selected, make sure it's properly set in the store
      if (this.selectedCustomer) {
        console.log('Customer.vue: Ensuring customer is selected:', this.selectedCustomer);
        
        // Only update the store - don't emit events to prevent circular references
        // The store will handle notifying other components
        if (customerStore && typeof customerStore.dispatch === 'function') {
          // Check if the customer is already selected in the store
          if (customerStore.state.selectedCustomer !== this.selectedCustomer) {
            console.log('Customer.vue: Updating customer in store:', this.selectedCustomer);
            customerStore.dispatch('selectCustomer', this.selectedCustomer);
          }
        }
        
        return true;
      }
      return false;
    },

    // Direct method to load customers without relying on the store
    get_customer_names() {
      if (this.customersList.length > 0 && !this.loading) {
        return; // Already have customers
      }

      // If we don't have pos_profile yet, we can't fetch customers
      if (!this.pos_profile || !this.pos_profile.pos_profile) {
        console.warn('Cannot load customers: POS profile not available');
        return;
      }

      // Set loading state
      this.loading = true;
      
      // First check local storage
      if (this.pos_profile.posa_local_storage && localStorage.customer_storage) {
        try {
          const storedCustomers = JSON.parse(localStorage.getItem('customer_storage'));
          if (Array.isArray(storedCustomers) && storedCustomers.length > 0) {
            this.directlyLoadedCustomers = storedCustomers;
            this.loading = false;
            return;
          }
        } catch (e) {
          console.warn('Error parsing customer storage:', e);
        }
      }

      // Make a direct call to the API
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_customer_names',
        args: {
          pos_profile: this.pos_profile.pos_profile,
        },
        callback: (r) => {
          this.loading = false;
          if (r.message) {
            console.log('Directly loaded customers:', r.message.length);
            this.directlyLoadedCustomers = r.message;
            
            // Also update the store
            customerStore.commit('SET_CUSTOMERS', r.message);
            
            // Save to localStorage if enabled
            if (this.pos_profile.posa_local_storage) {
              try {
                localStorage.setItem('customer_storage', JSON.stringify(r.message));
              } catch (e) {
                console.error('Error saving to customer storage:', e);
              }
            }
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Error fetching customers:', err);
          frappe.show_alert({
            message: __('Failed to load customers. Please try again.'),
            indicator: 'red'
          });
        }
      });
    }
  },

  computed: {
    customersList() {
      // First try to get customers from store
      const storeCustomers = customerStore.state.customers || [];
      
      // If we have customers in the store, use those
      if (storeCustomers && storeCustomers.length > 0) {
        return storeCustomers;
      }
      
      // Otherwise use directly loaded customers
      return this.directlyLoadedCustomers || [];
    },
    
    isLoading() {
      return customerStore.state.isLoading || this.loading;
    },
    
    selectedCustomer: {
      get() {
        return customerStore.state.selectedCustomer;
      },
      set(value) {
        // Check if the value is different from the current selection
        if (value !== customerStore.state.selectedCustomer) {
          console.log('Customer.vue: Setting selected customer to:', value);
          try {
            customerStore.dispatch('selectCustomer', value);
          } catch (error) {
            console.error('Error dispatching selectCustomer:', error);
          }
        }
      }
    }
  },

  created: function () {
    this.$nextTick(function () {
      // Use the appropriate event bus (component or global)
      this._processingShowPayment = false;
      const eventBus = this.eventBus || window.eventBus;
      
      if (eventBus) {
        // Listen for customer selection requests from Invoice.vue
        eventBus.on('request_customer_selection', (data) => {
          console.log('Customer.vue: Received request_customer_selection event');
          
          // Try to ensure a customer is selected
          const customerSelected = this.ensureCustomerSelected();
          
          if (!customerSelected && this.customers && this.customers.length > 0) {
            // Auto-select the first customer if none is selected
            console.log('Customer.vue: Auto-selecting first customer on request:', this.customers[0]);
            this.selectedCustomer = this.customers[0];
            this.ensureCustomerSelected();
          }
        });
        
        // Listen for events from Payments.vue and other components
        eventBus.on('show_payment', (data) => {
          // Clean up data before logging to avoid strange output
          const cleanData = typeof data === 'string' ? data.trim() : data;
          console.log('Customer.vue received show_payment event:', cleanData);
          
          // Handle both string and boolean values for compatibility
          const showPayment = cleanData === true || cleanData === 'true';
          
          console.log('Customer.vue: Received show_payment=' + showPayment + ' event');
          
          // Don't block the payment screen from closing
          if (!showPayment) {
            console.log('Customer.vue: Allowing payment screen to close');
            return;
          }
          
          // Handle show_payment event with recursion protection
          if (this._processingShowPayment) {
            console.log('Customer.vue: Already processing show_payment, preventing recursion');
            return;
          }

          this._processingShowPayment = true;
          
          try {
            // Check if we have a customer selected
            if (!this.selectedCustomer) {
              console.log('Customer.vue: No customer selected, requesting selection');
              if (!this.ensureCustomerSelected()) {
                console.log('Customer.vue: Customer selection failed');
                this.eventBus.emit("show_message", {
                  title: __("Please select a customer"),
                  color: "error",
                });
                return;
              }
            }
            // Don't emit show_payment again to avoid circular events
            console.log('Customer.vue: Customer verified, continuing payment process');
          } finally {
            // Always reset the processing flag
            this._processingShowPayment = false;
          }
        });
        
        // Listen for the new payment_screen_ready event
        eventBus.on('payment_screen_ready', (data) => {
          // Clean up data before logging to avoid strange output
          const cleanData = typeof data === 'string' ? data.trim() : data;
          
          // Handle both string and boolean values for compatibility
          const showPayment = cleanData === true || cleanData === 'true';
          
          // Store the last event state to prevent duplicate processing
          if (this._lastPaymentScreenState === showPayment) {
            // Skip processing if we've already handled this state
            return;
          }
          
          // Update the last state we processed
          this._lastPaymentScreenState = showPayment;
          
          // Now log after deduplication
          console.log('Customer.vue: Processing payment_screen_ready event:', showPayment);
          
          if (showPayment) {
            // Ensure the customer is properly selected before transitioning to payment
            const customerSelected = this.ensureCustomerSelected();
            
            if (!customerSelected) {
              console.warn('Customer.vue: No customer selected in ensureCustomerSelected');
              // Try to select the first customer if available
              if (this.customersList && this.customersList.length > 0) {
                console.log('Customer.vue: Auto-selecting first customer:', this.customersList[0]);
                // Set directly in the store to avoid circular references
                if (customerStore && typeof customerStore.dispatch === 'function') {
                  customerStore.dispatch('selectCustomer', this.customersList[0].name);
                  // Update local reference
                  this.selectedCustomer = this.customersList[0].name;
                }
              }
            }
            
            // Don't emit update_customer event here - the store already has the customer
            // This prevents circular references
          }
        });
        
        eventBus.on('set_customer', (customer) => {
          if (customer) {
            this.selectedCustomer = customer;
          }
        });
        
        eventBus.on('set_customer_readonly', (value) => {
          this.readonly = value;
        });
        
        // Listen for register_pos_profile to get profile data and load customers
        eventBus.on('register_pos_profile', (pos_profile) => {
          console.log('Customer.vue received pos_profile:', pos_profile);
          this.pos_profile = pos_profile;
          this.get_customer_names();
        });
        
        // Also listen for payments_register_pos_profile for pay screen
        eventBus.on('payments_register_pos_profile', (pos_profile) => {
          console.log('Customer.vue received payment pos_profile:', pos_profile);
          this.pos_profile = pos_profile;
          this.get_customer_names();
        });
        
        // Listen for fetch_customer_details to refresh customer list
        eventBus.on('fetch_customer_details', () => {
          this.get_customer_names();
        });
      }
      
      // Initialize customer store
      if (typeof customerStore.initStore === 'function') {
        customerStore.initStore();
      }
    });
  },
  
  beforeUnmount() {
    // Clean up event listeners
    const eventBus = this.eventBus || window.eventBus;
    if (eventBus) {
      eventBus.off('show_payment');
      eventBus.off('set_customer');
      eventBus.off('set_customer_readonly');
      eventBus.off('register_pos_profile');
      eventBus.off('payments_register_pos_profile');
      eventBus.off('fetch_customer_details');
    }
  }
};
</script>
