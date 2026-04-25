export type TableName =
  | 'users'
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
      'banner_file_id',
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
      'event_id',
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
  }
}

const tableAliases: Record<string, TableName> = {
  customers: 'users',
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
  'coupon-redemptions': 'coupon_redemptions'
}

export function resolveTable(resource: string) {
  const normalized = resource.trim().toLowerCase()
  const tableName = tableAliases[normalized] ?? (normalized as TableName)

  return tableConfigs[tableName]
}

export function listResources() {
  return Object.keys(tableConfigs)
}
