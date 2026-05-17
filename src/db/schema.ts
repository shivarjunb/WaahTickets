export type TableName =
  | 'users'
  | 'customers'
  | 'web_roles'
  | 'user_web_roles'
  | 'web_role_menu_items'
  | 'organizations'
  | 'organization_users'
  | 'files'
  | 'events'
  | 'event_locations'
  | 'ticket_types'
  | 'orders'
  | 'order_items'
  | 'payments'
  | 'tickets'
  | 'messages'
  | 'notification_queue'
  | 'ticket_scans'
  | 'coupons'
  | 'coupon_redemptions'
  | 'partners'
  | 'partner_users'
  | 'referral_codes'
  | 'commission_rules'
  | 'commission_ledger'
  | 'refunds'
  | 'payout_batches'
  | 'payout_items'
  | 'partner_reporting_permissions'
  | 'report_exports'

export type TableConfig = {
  table: TableName
  columns: readonly string[]
  defaultOrderBy?: string
}

export const tableConfigs: Record<TableName, TableConfig> = {
  users: {
    table: 'users',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'phone_number',
      'password_hash',
      'is_active',
      'is_email_verified',
      'is_phone_verified',
      'webrole',
      'auth_provider',
      'google_sub',
      'avatar_url',
      'last_login_at',
      'created_at',
      'updated_at'
    ]
  },
  customers: {
    table: 'customers',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'user_id',
      'display_name',
      'email',
      'phone_number',
      'billing_address',
      'notes',
      'is_active',
      'created_at',
      'updated_at'
    ]
  },
  web_roles: {
    table: 'web_roles',
    defaultOrderBy: 'created_at',
    columns: ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
  },
  user_web_roles: {
    table: 'user_web_roles',
    defaultOrderBy: 'created_at',
    columns: ['id', 'user_id', 'web_role_id', 'created_at']
  },
  web_role_menu_items: {
    table: 'web_role_menu_items',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'web_role_id',
      'resource_name',
      'can_view',
      'can_create',
      'can_edit',
      'can_delete',
      'created_at',
      'updated_at'
    ]
  },
  organizations: {
    table: 'organizations',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'name',
      'legal_name',
      'contact_email',
      'contact_phone',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  organization_users: {
    table: 'organization_users',
    defaultOrderBy: 'created_at',
    columns: ['id', 'organization_id', 'user_id', 'role', 'created_at']
  },
  files: {
    table: 'files',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'file_type',
      'file_name',
      'mime_type',
      'storage_provider',
      'bucket_name',
      'storage_key',
      'public_url',
      'size_bytes',
      'expires_at',
      'created_by',
      'created_at'
    ]
  },
  events: {
    table: 'events',
    defaultOrderBy: 'start_datetime',
    columns: [
      'id',
      'organization_id',
      'name',
      'slug',
      'description',
      'event_type',
      'start_datetime',
      'end_datetime',
      'status',
      'is_featured',
      'banner_file_id',
      'location_lat',
      'location_lng',
      'map_pin_icon',
      'map_popup_config',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  event_locations: {
    table: 'event_locations',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'event_id',
      'name',
      'address',
      'latitude',
      'longitude',
      'total_capacity',
      'is_active',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  ticket_types: {
    table: 'ticket_types',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'event_id',
      'event_location_id',
      'name',
      'description',
      'price_paisa',
      'currency',
      'quantity_available',
      'quantity_sold',
      'sale_start_datetime',
      'sale_end_datetime',
      'min_per_order',
      'max_per_order',
      'is_active',
      'created_at',
      'updated_at'
    ]
  },
  orders: {
    table: 'orders',
    defaultOrderBy: 'order_datetime',
    columns: [
      'id',
      'order_number',
      'customer_id',
      'event_id',
      'event_location_id',
      'status',
      'subtotal_amount_paisa',
      'discount_amount_paisa',
      'tax_amount_paisa',
      'total_amount_paisa',
      'currency',
      'order_datetime',
      'expires_at',
      'partner_id',
      'referral_code_id',
      'attribution_source',
      'created_at',
      'updated_at'
    ]
  },
  order_items: {
    table: 'order_items',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'order_id',
      'ticket_type_id',
      'quantity',
      'unit_price_paisa',
      'subtotal_amount_paisa',
      'discount_amount_paisa',
      'total_amount_paisa',
      'description',
      'created_at'
    ]
  },
  payments: {
    table: 'payments',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'order_id',
      'customer_id',
      'payment_provider',
      'khalti_pidx',
      'khalti_transaction_id',
      'khalti_purchase_order_id',
      'amount_paisa',
      'currency',
      'status',
      'payment_datetime',
      'verified_datetime',
      'raw_request',
      'raw_response',
      'created_at',
      'updated_at'
    ]
  },
  tickets: {
    table: 'tickets',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'ticket_number',
      'order_id',
      'order_item_id',
      'event_id',
      'event_location_id',
      'ticket_type_id',
      'customer_id',
      'qr_code_value',
      'barcode_value',
      'status',
      'is_paid',
      'redeemed_at',
      'redeemed_by',
      'pdf_file_id',
      'created_at',
      'updated_at'
    ]
  },
  messages: {
    table: 'messages',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'message_type',
      'subject',
      'content',
      'recipient_email',
      'recipient_phone',
      'regarding_entity_type',
      'regarding_entity_id',
      'status',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  notification_queue: {
    table: 'notification_queue',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'message_id',
      'channel',
      'status',
      'queued_at',
      'sent_at',
      'retry_count',
      'last_error',
      'provider',
      'provider_message_id',
      'created_at',
      'updated_at'
    ]
  },
  ticket_scans: {
    table: 'ticket_scans',
    defaultOrderBy: 'scanned_at',
    columns: [
      'id',
      'ticket_id',
      'scanned_by',
      'event_id',
      'event_location_id',
      'scan_result',
      'scan_message',
      'scanned_at',
      'device_info',
      'ip_address'
    ]
  },
  coupons: {
    table: 'coupons',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'coupon_type',
      'redemption_type',
      'public_code',
      'qr_payload',
      'event_id',
      'organization_id',
      'code',
      'description',
      'discount_type',
      'discount_amount_paisa',
      'discount_percentage',
      'max_redemptions',
      'redeemed_count',
      'min_order_amount_paisa',
      'start_datetime',
      'end_datetime',
      'expires_at',
      'issued_by_user_id',
      'issued_at',
      'is_active',
      'created_at',
      'updated_at'
    ]
  },
  coupon_redemptions: {
    table: 'coupon_redemptions',
    defaultOrderBy: 'redeemed_at',
    columns: [
      'id',
      'coupon_id',
      'order_id',
      'customer_id',
      'discount_amount_paisa',
      'redeemed_at'
    ]
  },
  partners: {
    table: 'partners',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'organization_id',
      'name',
      'code',
      'partner_type',
      'parent_partner_id',
      'is_active',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  partner_users: {
    table: 'partner_users',
    defaultOrderBy: 'created_at',
    columns: ['id', 'partner_id', 'user_id', 'role', 'created_at', 'updated_at']
  },
  referral_codes: {
    table: 'referral_codes',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'code',
      'partner_id',
      'event_id',
      'linked_coupon_id',
      'description',
      'is_active',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  commission_rules: {
    table: 'commission_rules',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'name',
      'event_id',
      'partner_id',
      'referral_code_id',
      'applies_to',
      'commission_type',
      'stacking_group',
      'stacking_behavior',
      'priority',
      'commission_source',
      'rate_value',
      'flat_amount_paisa',
      'max_commission_amount_paisa',
      'max_total_commission_percent_bps',
      'tier_config_json',
      'is_active',
      'start_datetime',
      'end_datetime',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  commission_ledger: {
    table: 'commission_ledger',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'order_id',
      'event_id',
      'beneficiary_type',
      'beneficiary_id',
      'partner_id',
      'referral_code_id',
      'commission_rule_id',
      'commission_type',
      'base_amount_paisa',
      'commission_rate_bps',
      'commission_amount_paisa',
      'commission_source',
      'stacking_group',
      'status',
      'entry_type',
      'reverses_ledger_id',
      'refund_id',
      'notes',
      'created_at',
      'updated_at'
    ]
  },
  refunds: {
    table: 'refunds',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'order_id',
      'payment_id',
      'refund_reference',
      'status',
      'reason',
      'refund_amount_paisa',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  payout_batches: {
    table: 'payout_batches',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'batch_type',
      'organization_id',
      'partner_id',
      'status',
      'currency',
      'total_amount_paisa',
      'paid_at',
      'created_by',
      'created_at',
      'updated_at'
    ]
  },
  payout_items: {
    table: 'payout_items',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'payout_batch_id',
      'beneficiary_type',
      'beneficiary_id',
      'order_id',
      'event_id',
      'commission_ledger_id',
      'amount_paisa',
      'status',
      'paid_at',
      'created_at',
      'updated_at'
    ]
  },
  partner_reporting_permissions: {
    table: 'partner_reporting_permissions',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'grantee_partner_id',
      'subject_partner_id',
      'permission_type',
      'expires_at',
      'created_by',
      'created_at'
    ]
  },
  report_exports: {
    table: 'report_exports',
    defaultOrderBy: 'created_at',
    columns: [
      'id',
      'report_type',
      'requested_by_user_id',
      'role',
      'filters_json',
      'status',
      'storage_key',
      'file_url',
      'generated_at',
      'error_message',
      'created_at',
      'updated_at'
    ]
  }
}

const tableAliases: Record<string, TableName> = {
  customers: 'customers',
  web_roles: 'web_roles',
  'web-roles': 'web_roles',
  user_web_roles: 'user_web_roles',
  'user-web-roles': 'user_web_roles',
  web_role_menu_items: 'web_role_menu_items',
  'web-role-menu-items': 'web_role_menu_items',
  event_locations: 'event_locations',
  'event-locations': 'event_locations',
  organization_users: 'organization_users',
  'organization-users': 'organization_users',
  ticket_types: 'ticket_types',
  'ticket-types': 'ticket_types',
  order_items: 'order_items',
  'order-items': 'order_items',
  notification_queue: 'notification_queue',
  'notification-queue': 'notification_queue',
  ticket_scans: 'ticket_scans',
  'ticket-scans': 'ticket_scans',
  coupon_redemptions: 'coupon_redemptions',
  'coupon-redemptions': 'coupon_redemptions',
  partner_users: 'partner_users',
  'partner-users': 'partner_users',
  referral_codes: 'referral_codes',
  'referral-codes': 'referral_codes',
  commission_rules: 'commission_rules',
  'commission-rules': 'commission_rules',
  commission_ledger: 'commission_ledger',
  'commission-ledger': 'commission_ledger',
  payout_batches: 'payout_batches',
  'payout-batches': 'payout_batches',
  payout_items: 'payout_items',
  'payout-items': 'payout_items',
  partner_reporting_permissions: 'partner_reporting_permissions',
  'partner-reporting-permissions': 'partner_reporting_permissions',
  report_exports: 'report_exports',
  'report-exports': 'report_exports'
}

export function resolveTable(resource: string) {
  const normalized = resource.trim().toLowerCase()
  const tableName = tableAliases[normalized] ?? (normalized as TableName)

  return tableConfigs[tableName]
}

export function listResources() {
  return Object.keys(tableConfigs)
}
