<template>
  <v-row justify="center">
    <v-dialog v-model="closingDialog" max-width="900px">
      <v-card>
        <v-card-title>
          <span class="text-h5 text-primary">{{
            __('Closing POS Shift')
          }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
          <v-container>
            <v-row>
              <v-col cols="12" class="pa-1">
                <v-data-table :headers="headers" :items="dialog_data.payment_reconciliation" item-key="mode_of_payment"
                  class="elevation-1" :items-per-page="itemsPerPage" hide-default-footer>
                  <template v-slot:item.closing_amount="props">
                    <v-confirm-edit v-model:return-value="props.item.closing_amount">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ formatCurrency(props.item.closing_amount) }}
                      <template v-slot:input>
                        <v-text-field v-model="props.item.closing_amount" :rules="[max25chars]"
                          :label="frappe._('Edit')" single-line counter type="number"></v-text-field>
                      </template>
                    </v-confirm-edit>
                  </template>
                  <template v-slot:item.difference="{ item }">
                    {{ currencySymbol(pos_profile.currency) }}
                    {{
                      (item.difference = formatCurrency(
                        item.expected_amount - item.closing_amount
                      ))
                    }}</template>
                  <template v-slot:item.opening_amount="{ item }">
                    {{ currencySymbol(pos_profile.currency) }}
                    {{ formatCurrency(item.opening_amount) }}</template>
                  <template v-slot:item.expected_amount="{ item }">
                    {{ currencySymbol(pos_profile.currency) }}
                    {{ formatCurrency(item.expected_amount) }}</template>
                </v-data-table>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" theme="dark" @click="close_dialog">{{
            __('Close')
          }}</v-btn>
          <v-btn color="success" theme="dark" @click="submit_dialog">{{
            __('Submit')
          }}</v-btn>
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
    closingDialog: false,
    itemsPerPage: 20,
    dialog_data: {},
    pos_profile: '',
    headers: [
      {
        title: __('Mode of Payment'),
        value: 'mode_of_payment',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Opening Amount'),
        align: 'end',
        sortable: true,
        value: 'opening_amount',
      },
      {
        title: __('Closing Amount'),
        value: 'closing_amount',
        align: 'end',
        sortable: true,
      },
    ],
    max25chars: (v) => v.length <= 20 || 'Input too long!', // TODO : should validate as number
    pagination: {},
  }),
  watch: {},

  methods: {
    close_dialog() {
      this.closingDialog = false;
    },
    submit_dialog() {
      this.eventBus.emit('submit_closing_pos', this.dialog_data);
      this.closingDialog = false;
    },
  },

  created: function () {
    this.eventBus.on('open_ClosingDialog', (data) => {
      this.closingDialog = true;
      this.dialog_data = data;
    });
    this.eventBus.on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      if (!this.pos_profile.hide_expected_amount) {
        this.headers.push({
          title: __('Expected Amount'),
          value: 'expected_amount',
          align: 'end',
          sortable: false,
        });
        this.headers.push({
          title: __('Difference'),
          value: 'difference',
          align: 'end',
          sortable: false,
        });
      }
    });
  },
};
</script>
