<template>
  <div fluid class="mt-2">
    <ClosingDialog></ClosingDialog>
    <Drafts></Drafts>
    <SalesOrders></SalesOrders>
    <Returns></Returns>
    <NewAddress></NewAddress>
    <MpesaPayments></MpesaPayments>
    <Variants></Variants>
    <OpeningDialog v-if="dialog" :dialog="dialog"></OpeningDialog>
    <v-row v-show="!dialog">
      <!-- Debug Info - VISIBLE during development -->
      <div class="debug-info" style="position: fixed; top: 5px; right: 5px; z-index: 9999; background: rgba(0,0,0,0.7); color: white; padding: 5px; border-radius: 5px; font-size: 12px;">
        Payment: {{ payment }}, Offers: {{ offers }}, Coupons: {{ coupons }}
      </div>

      <!-- ItemsSelector -->
      <v-col v-if="!payment && !offers && !coupons" xl="5" lg="5" md="5" sm="5" cols="12" class="pos pr-0">
        <ItemsSelector></ItemsSelector>
      </v-col>
      
      <!-- PosOffers -->
      <v-col v-if="offers" xl="5" lg="5" md="5" sm="5" cols="12" class="pos pr-0">
        <PosOffers></PosOffers>
      </v-col>
      
      <!-- PosCoupons -->
      <v-col v-if="coupons" xl="5" lg="5" md="5" sm="5" cols="12" class="pos pr-0">
        <PosCoupons></PosCoupons>
      </v-col>
      
      <!-- Payments -->
      <v-col v-if="payment" xl="5" lg="5" md="5" sm="5" cols="12" class="pos pr-0">
        <Payments ref="paymentsComponent"></Payments>
      </v-col>

      <v-col xl="7" lg="7" md="7" sm="7" cols="12" class="pos">
        <Invoice></Invoice>
      </v-col>
    </v-row>
  </div>
</template>

<script>

import ItemsSelector from './ItemsSelector.vue';
import Invoice from './Invoice.vue';
import OpeningDialog from './OpeningDialog.vue';
import Payments from './Payments.vue';
import PosOffers from './PosOffers.vue';
import PosCoupons from './PosCoupons.vue';
import Drafts from './Drafts.vue';
import SalesOrders from "./SalesOrders.vue";
import ClosingDialog from './ClosingDialog.vue';
import NewAddress from './NewAddress.vue';
import Variants from './Variants.vue';
import Returns from './Returns.vue';
import MpesaPayments from './Mpesa-Payments.vue';

export default {
  data: function () {
    return {
      dialog: false,
      pos_profile: '',
      pos_opening_shift: '',
      payment: false,
      offers: false,
      coupons: false,
    };
  },

  components: {
    ItemsSelector,
    Invoice,
    OpeningDialog,
    Payments,
    Drafts,
    ClosingDialog,

    Returns,
    PosOffers,
    PosCoupons,
    NewAddress,
    Variants,
    MpesaPayments,
    SalesOrders,
  },

  methods: {
    check_opening_entry() {
      return frappe
        .call('posawesome.posawesome.api.posapp.check_opening_shift', {
          user: frappe.session.user,
        })
        .then((r) => {
          if (r.message) {
            this.pos_profile = r.message.pos_profile;
            this.pos_opening_shift = r.message.pos_opening_shift;
            this.get_offers(this.pos_profile.name);
            this.eventBus.emit('register_pos_profile', r.message);
            this.eventBus.emit('set_company', r.message.company);
            console.info('LoadPosProfile');
          } else {
            this.create_opening_voucher();
          }
        });
    },
    create_opening_voucher() {
      this.dialog = true;
    },
    get_closing_data() {
      return frappe
        .call(
          'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.make_closing_shift_from_opening',
          {
            opening_shift: this.pos_opening_shift,
          }
        )
        .then((r) => {
          if (r.message) {
            this.eventBus.emit('open_ClosingDialog', r.message);
          } else {
            // console.log(r);
          }
        });
    },
    submit_closing_pos(data) {
      frappe
        .call(
          'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.submit_closing_shift',
          {
            closing_shift: data,
          }
        )
        .then((r) => {
          if (r.message) {
            this.eventBus.emit('show_message', {
              title: `POS Shift Closed`,
              color: 'success',
            });
            this.check_opening_entry();
          } else {
            console.log(r);
          }
        });
    },
    get_offers(pos_profile) {
      return frappe
        .call('posawesome.posawesome.api.posapp.get_offers', {
          profile: pos_profile,
        })
        .then((r) => {
          if (r.message) {
            console.info('LoadOffers');
            this.eventBus.emit('set_offers', r.message);
          }
        });
    },
    get_pos_setting() {
      frappe.db.get_doc('POS Settings', undefined).then((doc) => {
        this.eventBus.emit('set_pos_settings', doc);
      });
    },
  },

  mounted: function () {
    this.$nextTick(function () {
      this.check_opening_entry();
      this.get_pos_setting();
      this.eventBus.on('close_opening_dialog', () => {
        this.dialog = false;
      });
      this.eventBus.on('register_pos_data', (data) => {
        this.pos_profile = data.pos_profile;
        this.get_offers(this.pos_profile.name);
        this.pos_opening_shift = data.pos_opening_shift;
        this.eventBus.emit('register_pos_profile', data);
        console.info('LoadPosProfile');
      });
      // Track the last payment state to prevent loops
      this._lastPaymentState = null;
      
      // Direct method to force payment screen visibility
      this.forceShowPaymentScreen = () => {
        console.log('Pos.vue: FORCE showing payment screen');
        // Hide other screens first
        this.offers = false;
        this.coupons = false;
        
        // Set payment flag to true and force update immediately
        this.payment = true;
        document.querySelector('.pos-payment-debug').innerHTML = 'FORCING PAYMENT SCREEN: ' + new Date().toISOString();
        
        // Force update with 3 different approaches to ensure visibility
        this.$forceUpdate();
        
        // Use setTimeout to ensure DOM has time to update
        setTimeout(() => {
          // Force update again after slight delay
          this.$forceUpdate();
          
          // Make sure payment column is visible via direct DOM manipulation
          const paymentCol = document.querySelector('.pos.pr-0 .selection');
          if (paymentCol) {
            paymentCol.style.display = 'block';
            console.log('Pos.vue: Directly set payment column to visible');
          }
          
          // Emit event to prepare payment screen
          this.eventBus.emit('prepare_payment_screen', true);
        }, 50);
      };
      
      // Add a debug element to track payment state
      const debugDiv = document.createElement('div');
      debugDiv.className = 'pos-payment-debug';
      debugDiv.style.cssText = 'position:fixed;bottom:5px;right:5px;z-index:9999;padding:5px;background:rgba(0,0,0,0.7);color:white;font-size:10px;';  
      document.body.appendChild(debugDiv);
      
      this.eventBus.on('show_payment', (data) => {
        console.log('Pos.vue: show_payment event received with data:', data);
        
        // Convert various data types to boolean
        let newState = false;
        if (data === 'true' || data === true) {
          newState = true;
        } else if (data === 'false' || data === false) {
          newState = false;
        } else if (typeof data === 'object' && data !== null) {
          // Handle event objects (like PointerEvent)
          console.log('Pos.vue: Received object in show_payment, treating as true');
          newState = true;
        }
        
        console.log('Pos.vue: Interpreted payment state as:', newState);
        document.querySelector('.pos-payment-debug').innerHTML = 'Payment: ' + newState + ' - ' + new Date().toISOString();
        
        // If showing payment, use our force method
        if (newState) {
          this.forceShowPaymentScreen();
        } else {
          // Immediately hide payment screen if needed
          this.payment = newState;
          this.$forceUpdate();
          console.log('Pos.vue: Payment screen visibility set to:', this.payment);
        }
      });
      
      // Add an additional trigger that bypasses potential event bus issues
      this.eventBus.on('force_payment_screen_visibility', () => {
        console.log('Pos.vue: Received force_payment_screen_visibility event');
        this.forceShowPaymentScreen();
      });
      
      // Keep the payment_screen_ready handler for backward compatibility
      // but make it use the show_payment handler to avoid duplicating logic
      this.eventBus.on('payment_screen_ready', (data) => {
        console.log('Pos.vue: payment_screen_ready event received with data:', data);
        // Convert to string format expected by show_payment
        const stringValue = data === true ? 'true' : 'false';
        // Use the existing handler to process the event
        this.eventBus.emit('show_payment', stringValue);
      });
      this.eventBus.on('show_offers', (data) => {
        console.log('Pos.vue: show_offers event received with data:', data);
        this.offers = data === 'true';
        this.payment = false;
        this.coupons = false;
      });
      this.eventBus.on('show_coupons', (data) => {
        console.log('Pos.vue: show_coupons event received with data:', data);
        this.coupons = data === 'true';
        this.offers = false;
        this.payment = false;
      });
      this.eventBus.on('open_closing_dialog', () => {
        this.get_closing_data();
      });
      this.eventBus.on('submit_closing_pos', (data) => {
        this.submit_closing_pos(data);
      });
    });
  },
  beforeUnmount() {
    evntBus.$off('close_opening_dialog');
    evntBus.$off('register_pos_data');
    evntBus.$off('LoadPosProfile');
    evntBus.$off('show_payment');
    evntBus.$off('payment_screen_ready');
    evntBus.$off('show_offers');
    evntBus.$off('show_coupons');
    evntBus.$off('open_closing_dialog');
    evntBus.$off('submit_closing_pos');
  },
};
</script>

<style scoped></style>
