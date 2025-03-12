<template>
  <div fluid>
    <v-row v-show="!dialog">
      <v-col md="8" cols="12" class="pb-2 pr-0">
        <v-card class="main mx-auto bg-grey-lighten-5 mt-3 p-3 pb-16 overflow-y-auto"
          style="max-height: 94vh; height: 94vh">
          <Customer></Customer>
          <v-divider></v-divider>
          <div>
            <v-row>
              <v-col md="7" cols="12">
                <p>
                  <strong>{{ __("Invoices") }}</strong>
                  <span v-if="total_outstanding_amount" class="text-primary">{{ __("- Total Outstanding") }} :
                    {{ currencySymbol(pos_profile.currency) }}
                    {{ formatCurrency(total_outstanding_amount) }}</span>
                </p>
              </v-col>
              <v-col md="5" cols="12">
                <p v-if="total_selected_invoices" class="golden--text text-end">
                  <span>{{ __("Total Selected :") }}</span>
                  <span>
                    {{ currencySymbol(pos_profile.currency) }}
                    {{ formatCurrency(total_selected_invoices) }}
                  </span>
                </p>
              </v-col>
            </v-row>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import format from "../../format";
import Customer from "../pos/Customer.vue";
import UpdateCustomer from "../pos/UpdateCustomer.vue";
import { eventBus } from "../../bus";
import customerStore from "../../store/customer";

export default {
  mixins: [format],
  components: {
    Customer,
    UpdateCustomer,
  },
  data: function () {
    return {
      dialog: false,
      pos_profile: "",
      pos_opening_shift: "",
      customer_name: "",
      customer_info: "",
      company: "",
      singleSelect: false,
      invoices_loading: false,
      unallocated_payments_loading: false,
      mpesa_payments_loading: false,
      payment_methods: [],
      outstanding_invoices: [],
      unallocated_payments: [],
      mpesa_payments: [],
      selected_invoices: [],
      selected_payments: [],
      selected_mpesa_payments: [],
      mpesa_searchtype: "name",
      payment_methods_list: [],
      mpesa_searchname: "",
      mpesa_search_mobile: "",
      invoices_headers: [],
      pos_profiles_list: [],
      pos_profile_search: "",
      eventBus: eventBus,
    };
  },
  methods: {
    check_opening_entry() {
      var vm = this;
      return frappe
        .call("posawesome.posawesome.api.posapp.check_opening_shift", {
          user: frappe.session.user,
        })
        .then((r) => {
          if (r.message) {
            vm.pos_opening_shift = r.message.pos_opening_shift;
            vm.company = r.message.company;
            vm.pos_profile = r.message.pos_profile;
            vm.eventBus.emit("payments_register_pos_profile", r.message);
            vm.eventBus.emit("set_company", r.message.company);
            this.set_payment_methods();
            this.pos_profile_search = r.message.pos_profile.name;
            this.pos_profiles_list.push(this.pos_profile_search);
            this.payment_methods_list = [];
            this.pos_profile.payments.forEach((element) => {
              this.payment_methods_list.push(element.mode_of_payment);
            });
            this.get_available_pos_profiles();
            this.get_outstanding_invoices();
            this.get_draft_mpesa_payments_register();
          } else {
            this.create_opening_voucher();
          }
        });
    },
    get_outstanding_invoices() {
      var vm = this;
      if (!this.customer_name) return;
      this.invoices_loading = true;
      
      // Get currency from pos_profile since we don't have direct access to invoice_doc
      let currency = 'INR'; // Default fallback
      
      // Try to get currency from pos_profile
      if (vm.pos_profile && vm.pos_profile.currency) {
        currency = vm.pos_profile.currency;
      }
      
      console.log('Pay.vue: Getting outstanding invoices with currency:', currency);
      
      frappe
        .call({
          method: "posawesome.posawesome.api.payment_entry.get_outstanding_invoices",
          args: {
            customer: vm.customer_name,
            company: vm.company,
            currency: currency, // Add the required currency parameter
          },
        })
        .then((r) => {
          if (r.message) {
            vm.outstanding_invoices = r.message;
          } else {
            vm.outstanding_invoices = [];
          }
          vm.invoices_loading = false;
        });
    },
    get_unallocated_payments() {
      var vm = this;
      if (!this.customer_name) return;
      this.unallocated_payments_loading = true;
      
      // Get currency from pos_profile since we don't have direct access to invoice_doc
      let currency = 'INR'; // Default fallback
      
      // Try to get currency from pos_profile
      if (vm.pos_profile && vm.pos_profile.currency) {
        currency = vm.pos_profile.currency;
      }
      
      console.log('Pay.vue: Getting unallocated payments with currency:', currency);
      
      frappe
        .call({
          method:
            "posawesome.posawesome.api.payment_entry.get_unallocated_payments",
          args: {
            customer: vm.customer_name,
            company: vm.company,
            currency: currency, // Add the required currency parameter
          },
        })
        .then((r) => {
          if (r.message) {
            vm.unallocated_payments = r.message;
          } else {
            vm.unallocated_payments = [];
          }
          vm.unallocated_payments_loading = false;
        });
    },
    get_draft_mpesa_payments_register() {
      var vm = this;
      if (!this.pos_profile.posa_allow_mpesa_reconcile_payments) return;
      this.mpesa_payments_loading = true;
      frappe
        .call({
          method:
            "posawesome.posawesome.api.payment_entry.get_draft_mpesa_payments_register",
          args: {
            company: vm.company,
            pos_profile: vm.pos_profile_search,
            searchtype: vm.mpesa_searchtype,
            searchvalue: vm.mpesa_searchtype == "name" ? vm.mpesa_searchname : vm.mpesa_search_mobile,
            payment_methods_list: vm.payment_methods_list,
          },
        })
        .then((r) => {
          if (r.message) {
            vm.mpesa_payments = r.message;
          } else {
            vm.mpesa_payments = [];
          }
          vm.mpesa_payments_loading = false;
        });
    },
    set_mpesa_search_params() {
      if (!this.customer_info || !this.customer_info.mobile_no) return;
      this.mpesa_searchtype = "mobile";
      this.mpesa_search_mobile = this.customer_info.mobile_no;
    },
    select_invoice(item) {
      const found = this.selected_invoices.find(
        (invoice) => invoice.name == item.name
      );
      if (found) {
        this.selected_invoices = this.selected_invoices.filter(
          (invoice) => invoice.name != item.name
        );
      } else {
        this.selected_invoices.push(item);
      }
    },
    select_payment(item) {
      const found = this.selected_payments.find(
        (payment) => payment.name == item.name
      );
      if (found) {
        this.selected_payments = this.selected_payments.filter(
          (payment) => payment.name != item.name
        );
      } else {
        this.selected_payments.push(item);
      }
    },
    select_mpesa_payment(item) {
      const found = this.selected_mpesa_payments.find(
        (payment) => payment.transaction_id == item.transaction_id
      );
      if (found) {
        this.selected_mpesa_payments = this.selected_mpesa_payments.filter(
          (payment) => payment.transaction_id != item.transaction_id
        );
      } else {
        this.selected_mpesa_payments.push(item);
      }
    },
    clear_all(clear_customer) {
      this.selected_invoices = [];
      this.selected_payments = [];
      this.selected_mpesa_payments = [];
      this.payment_methods.forEach((method) => {
        method.amount = 0;
      });
      if (clear_customer) {
        this.customer_name = "";
        this.customer_info = "";
        this.outstanding_invoices = [];
        this.unallocated_payments = [];
        this.mpesa_payments = [];
        this.mpesa_searchtype = "name";
        this.mpesa_searchname = "";
        this.mpesa_search_mobile = "";
      }
    },
    get_available_pos_profiles() {
      if (!this.pos_profile.posa_allow_mpesa_reconcile_payments) return;
      return frappe
        .call(
          "posawesome.posawesome.api.payment_entry.get_available_pos_profiles",
          {
            company: this.company,
            currency: this.pos_profile.currency,
          }
        )
        .then((r) => {
          if (r.message) {
            this.pos_profiles_list = r.message;
          }
        });
    },
    create_opening_voucher() {
      this.dialog = true;
    },
    fetch_customer_details() {
      var vm = this;
      if (this.customer_name) {
        frappe.call({
          method: "posawesome.posawesome.api.posapp.get_customer_info",
          args: {
            customer: vm.customer_name,
          },
          async: false,
          callback: (r) => {
            const message = r.message;
            if (!r.exc) {
              vm.customer_info = {
                ...message,
              };
              vm.set_mpesa_search_params();
              vm.eventBus.emit("set_customer_info_to_edit", vm.customer_info);
            }
          },
        });
      }
    },
    selectCustomer(event) {
      this.customer_name = event.item.customer;
      this.eventBus.emit("set_customer", event.item.customer);
      this.fetch_customer_details();
      this.get_outstanding_invoices();
      this.get_unallocated_payments();
      this.get_draft_mpesa_payments_register();
      this.set_payment_methods();
    },
    submit() {
      try {
        // Log that submit was called
        console.log('Pay.vue: submit method called');
        
        const customer = this.customer_name;
        const vm = this;
        
        // Debug customer selection state
        console.log('Pay.vue: Customer state:', {
          customer_name: this.customer_name,
          customer_info: this.customer_info ? 'exists' : 'missing'
        });
        
        // Ensure customer store is synced if available
        if (customerStore && typeof customerStore.dispatch === 'function' && customer) {
          try {
            console.log('Pay.vue: Syncing with customer store before payment');
            customerStore.dispatch('selectCustomer', customer);
          } catch (error) {
            console.error('Pay.vue: Error syncing with customer store:', error);
          }
        }
        if (!customer) {
          frappe.throw(__("Please select a customer"));
          return;
        }
        if (
          this.total_selected_payments == 0 &&
          this.total_selected_mpesa_payments == 0 &&
          this.total_payment_methods == 0
        ) {
          frappe.throw(__("Please make a payment or select an payment"));
          return;
        }
        if (
          this.total_selected_payments > 0 &&
          this.selected_invoices.length == 0
        ) {
          frappe.throw(__("Please select an invoice"));
          return;
        }

        this.payment_methods.forEach((payment) => {
          payment.amount = flt(payment.amount);
        });

        const payload = {};
        payload.customer = customer;
        payload.company = this.company;
        payload.currency = this.pos_profile ? this.pos_profile.currency : '';
        payload.pos_opening_shift_name = this.pos_opening_shift ? this.pos_opening_shift.name : '';
        payload.pos_profile_name = this.pos_profile ? this.pos_profile.name : '';
        payload.pos_profile = this.pos_profile;
        payload.payment_methods = this.payment_methods;
        payload.selected_invoices = this.selected_invoices;
        payload.selected_payments = this.selected_payments;
        payload.total_selected_invoices = flt(this.total_selected_invoices);
        payload.selected_mpesa_payments = this.selected_mpesa_payments;
        payload.total_selected_payments = flt(this.total_selected_payments);
        payload.total_payment_methods = flt(this.total_payment_methods);
        payload.total_selected_mpesa_payments = flt(
          this.total_selected_mpesa_payments
        );

        frappe.call({
          method: "posawesome.posawesome.api.payment_entry.process_pos_payment",
          args: { payload },
          freeze: true,
          freeze_message: __("Processing Payment"),
          callback: function (r) {
            if (r.message) {
              frappe.utils.play_sound("submit");
              vm.clear_all(false);
              vm.customer_name = customer;
              vm.get_outstanding_invoices();
              vm.get_unallocated_payments();
              vm.set_mpesa_search_params();
              vm.get_draft_mpesa_payments_register();
              
              // Notify other components that payment was successful
              try {
                const eventBus = vm.eventBus || window.eventBus;
                if (eventBus) {
                  console.log('Pay.vue: Emitting payment_processed event');
                  eventBus.emit('payment_processed', true);
                }
                
                frappe.show_alert({
                  message: __('Payment processed successfully'),
                  indicator: 'green'
                });
              } catch (error) {
                console.error('Pay.vue: Error emitting payment_processed event:', error);
              }
            } else {
              // Handle case where we got a response but no message
              console.warn('Pay.vue: Empty response from process_pos_payment');
              frappe.show_alert({
                message: __('Payment may have been processed but no confirmation received'),
                indicator: 'orange'
              });
            }
          },
          error: function(err) {
            console.error('Pay.vue: Error in process_pos_payment API call:', err);
            frappe.msgprint({
              title: __('Payment Processing Error'),
              indicator: 'red',
              message: __('Error processing payment. Please try again.')
            });
          }
        });
      } catch (error) {
        console.error('Pay.vue: Uncaught error in submit method:', error);
        frappe.msgprint({
          title: __('Error'),
          indicator: 'red',
          message: __('An unexpected error occurred. Please try again.')
        });
      }
    },
    set_payment_methods() {
      // get payment methods from pos profile
      if (!this.pos_profile.posa_allow_make_new_payments) return;
      this.payment_methods = [];
      this.pos_profile.payments.forEach((method) => {
        this.payment_methods.push({
          mode_of_payment: method.mode_of_payment,
          amount: 0,
          row_id: method.name,
        });
      });
    }
  },
  
  computed: {
    total_outstanding_amount() {
      return this.outstanding_invoices ? this.outstanding_invoices.reduce(
        (acc, cur) => acc + flt(cur?.outstanding_amount || 0),
        0
      ) : 0;
    },
    total_unallocated_amount() {
      return this.unallocated_payments ? this.unallocated_payments.reduce(
        (acc, cur) => acc + flt(cur?.unallocated_amount || 0),
        0
      ) : 0;
    },
    total_selected_invoices() {
      return this.selected_invoices ? this.selected_invoices.reduce(
        (acc, cur) => acc + flt(cur?.outstanding_amount || 0),
        0
      ) : 0;
    },
    total_selected_payments() {
      return this.selected_payments ? this.selected_payments.reduce(
        (acc, cur) => acc + flt(cur?.unallocated_amount || 0),
        0
      ) : 0;
    },
    total_selected_mpesa_payments() {
      return this.selected_mpesa_payments ? this.selected_mpesa_payments.reduce(
        (acc, cur) => acc + flt(cur?.amount || 0),
        0
      ) : 0;
    },
    total_payment_methods() {
      return this.payment_methods ? this.payment_methods.reduce(
        (acc, cur) => acc + flt(cur?.amount || 0),
        0
      ) : 0;
    },
    total_of_diff() {
      return flt(
        this.total_selected_invoices -
        this.total_selected_payments -
        this.total_selected_mpesa_payments -
        this.total_payment_methods
      );
    }
  },
  
  mounted: function () {
    var vm = this;
    vm.check_opening_entry();
    
    try {
      const eventBus = vm.eventBus || window.eventBus;
      
      if (eventBus) {
        console.log('Pay.vue: Setting up event listeners');
        
        // Set up event listeners
        eventBus.on("update_customer", (customer_name) => {
          console.log('Pay.vue: Received update_customer event with:', customer_name);
          if (customer_name != vm.customer_name) {
            vm.customer_name = customer_name;
            vm.fetch_customer_details();
            vm.get_outstanding_invoices();
            vm.get_unallocated_payments();
            vm.get_draft_mpesa_payments_register();
          } else {
            console.log('Pay.vue: Customer already set to:', customer_name);
          }
        });
        
        // Listen for show_payment event to ensure we have customer data
        eventBus.on("show_payment", (data) => {
          // Clean up data before logging to avoid strange output
          const cleanData = typeof data === 'string' ? data.trim() : data;
          console.log('Pay.vue: Received show_payment event:', cleanData, typeof cleanData);
          
          // We no longer process this event to avoid recursion
          console.log('Pay.vue: show_payment event received but not processed to avoid recursion');
        });
        
        // Listen for the new payment_screen_ready event
        eventBus.on("payment_screen_ready", (data) => {
          // Clean up data before logging to avoid strange output
          const cleanData = typeof data === 'string' ? data.trim() : data;
          console.log('Pay.vue: Received payment_screen_ready event:', cleanData);
          
          // Handle both string and boolean values for compatibility
          const showPayment = cleanData === true || cleanData === "true";
          
          if (showPayment) {
            console.log('Pay.vue: Processing payment_screen_ready=true event');
            
            // Explicitly show the payment screen
            vm.show = true;
            
            // First check if we have a customer name
            if (!vm.customer_name && customerStore && customerStore.state) {
              console.log('Pay.vue: No customer name set, attempting to get from store');
              if (customerStore.state.selectedCustomer) {
                console.log('Pay.vue: Found customer in store:', customerStore.state.selectedCustomer);
                vm.customer_name = customerStore.state.selectedCustomer;
              }
            }
            
            if (vm.customer_name) {
              console.log('Pay.vue: Processing payment for customer:', vm.customer_name);
              // Re-fetch customer details to ensure we have the latest data
              vm.fetch_customer_details();
              
              // Also make sure we have the latest invoices and payments
              vm.get_outstanding_invoices();
              vm.get_unallocated_payments();
              vm.get_draft_mpesa_payments_register();
              
              // Confirm customer is properly set in the system
              if (customerStore && typeof customerStore.dispatch === 'function') {
                try {
                  console.log('Pay.vue: Syncing with customer store after show_payment=true');
                  customerStore.dispatch('selectCustomer', vm.customer_name);
                  
                  // DO NOT emit payment_screen_ready event again to prevent recursion
                  console.log('Pay.vue: Payment screen is now ready');
                } catch (error) {
                  console.error('Pay.vue: Error dispatching to customer store:', error);
                }
              }
            } else {
              console.warn('Pay.vue: Unable to process payment - no customer selected');
              // Emit an event to notify that payment cannot proceed
              eventBus.emit("show_message", {
                title: __(`Cannot process payment: No customer selected`),
                color: "error",
              });
            }
          } else {
            console.log('Pay.vue: Received payment_screen_ready=false event');
            // Hide the payment screen
            vm.show = false;
            
            // Reset any payment-related state
            vm.payment_methods = [];
            vm.payment_methods.push({
              mode_of_payment: vm.pos_profile.payments[0].mode_of_payment,
              amount: 0,
              type: vm.pos_profile.payments[0].type,
              account: vm.pos_profile.payments[0].account,
              default: vm.pos_profile.payments[0].default,
            });
            
            console.log('Pay.vue: Payment screen hidden and state reset');
          }
        });
        
        eventBus.on("fetch_customer_details", () => {
          vm.fetch_customer_details();
        });
        
        eventBus.on("payments_register_pos_profile", (pos_profile) => {
          vm.pos_profile = pos_profile.pos_profile;
          vm.company = pos_profile.company;
        });
      }
    } catch (error) {
      console.error('Error in Pay.vue mounted:', error);
    }
  },
  
  beforeUnmount: function () {
    try {
      const eventBus = this.eventBus || window.eventBus;
      
      if (eventBus) {
        console.log('Pay.vue: Cleaning up event listeners');
        // Clean up event listeners
        eventBus.off("update_customer");
        eventBus.off("fetch_customer_details");
        eventBus.off("payments_register_pos_profile");
        eventBus.off("show_payment");
      }
    } catch (error) {
      console.error('Error in Pay.vue beforeUnmount:', error);
    }
  }
};
</script>

<style>
.main {
  height: 100%;
}

.v-card {
  border-radius: 4px;
}

.v-text-field {
  font-size: 1rem;
}

input[payments_methods] {
  text-align: right;
}

input[total_selected_payments] {
  text-align: right;
}
</style>
