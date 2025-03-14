<template>
  <v-row justify="center">
    <v-dialog v-model="invoicesDialog" max-width="800px" min-width="800px">
      <v-card>
        <v-card-title>
          <span class="text-h5 text-primary">{{
            __('Select Return Invoice')
          }}</span>
        </v-card-title>
        <v-container>
          <v-row class="mb-4">
            <v-text-field color="primary" :label="frappe._('Invoice ID')" bg-color="white" hide-details
              v-model="invoice_name" density="compact" clearable class="mx-4"></v-text-field>
            <v-btn variant="text" class="ml-2" color="primary" theme="dark" @click="search_invoices">{{ __('Search')
              }}</v-btn>
          </v-row>
          <v-row>
            <v-col cols="12" class="pa-1" v-if="dialog_data">
              <v-data-table :headers="headers" :items="dialog_data" item-key="name" class="elevation-1" show-select
                v-model="selected" select-strategy="single" return-object>
                <template v-slot:item.grand_total="{ item }">
                  {{ currencySymbol(item.currency) }}
                  {{ formatCurrency(item.grand_total) }}</template>
              </v-data-table>
            </v-col>
          </v-row>
        </v-container>
        <v-card-actions class="mt-4">
          <v-spacer></v-spacer>
          <v-btn color="error mx-2" theme="dark" @click="close_dialog">Close</v-btn>
          <v-btn v-if="selected.length" color="success" theme="dark" @click="submit_dialog">{{ __('Select') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>

import format from '../../format';
export default {
  mixins: [format],
  data: () => ({
    invoicesDialog: false,
    singleSelect: true,
    selected: [],
    dialog_data: '',
    company: '',
    invoice_name: '',
    headers: [
      {
        title: __('Customer'),
        value: 'customer',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Date'),
        align: 'start',
        sortable: true,
        value: 'posting_date',
      },
      {
        title: __('Invoice'),
        value: 'name',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Amount'),
        value: 'grand_total',
        align: 'end',
        sortable: false,
      },
    ],
  }),
  watch: {},
  methods: {
    close_dialog() {
      this.invoicesDialog = false;
    },
    search_invoices_by_enter(e) {
      if (e.keyCode === 13) {
        this.search_invoices();
      }
    },
    search_invoices() {
      const vm = this;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.search_invoices_for_return',
        args: {
          invoice_name: vm.invoice_name,
          company: vm.company,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            vm.dialog_data = r.message;
          }
        },
      });
    },
    submit_dialog() {
      if (this.selected.length > 0) {
        const return_doc = this.selected[0];
        const invoice_doc = {};
        const items = [];
        return_doc.items.forEach((item) => {
          const new_item = { ...item };
          new_item.qty = item.qty * -1;
          new_item.stock_qty = item.stock_qty * -1;
          new_item.amount = item.amount * -1;
          items.push(new_item);
        });
        invoice_doc.items = items;
        invoice_doc.is_return = 1;
        invoice_doc.return_against = return_doc.name;
        invoice_doc.customer = return_doc.customer;
        const data = { invoice_doc, return_doc };
        this.eventBus.emit('load_return_invoice', data);
        this.invoicesDialog = false;
      }
    },
  },
  created: function () {
    this.eventBus.on('open_returns', (data) => {
      this.invoicesDialog = true;
      this.company = data;
      this.invoice_name = '';
      this.dialog_data = '';
      this.selected = [];
    });
  },
};
</script>
