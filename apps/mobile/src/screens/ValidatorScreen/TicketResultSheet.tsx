import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TicketValidationSummary } from '@waahtickets/shared-types'
import type { ValidationTone } from '../../types'
import { formatEventDateFull } from '../../utils/format'

function StatusBadge({ tone, status }: { tone: ValidationTone; status: string }) {
  const config = toneConfig(tone)
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusCircle, { backgroundColor: config.circleBg }]}>
        <Text style={[styles.statusIcon, { color: config.iconColor }]}>{config.icon}</Text>
      </View>
      <Text style={[styles.statusLabel, { color: config.textColor }]}>{status}</Text>
    </View>
  )
}

function toneConfig(tone: ValidationTone) {
  if (tone === 'success')  return { circleBg: '#22c55e', iconColor: '#fff', textColor: '#22c55e', icon: '✓' }
  if (tone === 'warning')  return { circleBg: '#f59e0b', iconColor: '#fff', textColor: '#f59e0b', icon: '!' }
  if (tone === 'error')    return { circleBg: '#ef4444', iconColor: '#fff', textColor: '#ef4444', icon: '×' }
  return                         { circleBg: '#3b82f6', iconColor: '#fff', textColor: '#93c5fd', icon: '…' }
}

function toneStatusLabel(tone: ValidationTone, pendingStatus: string | null) {
  if (tone === 'success')  return 'Ticket Redeemed'
  if (tone === 'warning')  return pendingStatus === 'expired' ? 'Ticket Expired' : 'Already Redeemed'
  if (tone === 'error')    return 'Invalid Ticket'
  if (pendingStatus === 'unredeemed') return 'Valid Ticket'
  return 'Checking…'
}

export function TicketResultSheet({
  tone,
  ticket,
  pendingStatus,
  busy,
  onCancel,
  onValidate
}: {
  tone: ValidationTone
  ticket: TicketValidationSummary
  pendingStatus: string | null
  busy: boolean
  onCancel: () => void
  onValidate: () => void
}) {
  const displayStatus = toneStatusLabel(tone, pendingStatus)
  const canValidate   = pendingStatus === 'unredeemed' && tone === 'neutral'
  const redeemedAt    = ticket.redeemed_at ? formatEventDateFull(ticket.redeemed_at) : null

  return (
    <View style={styles.sheet}>
      <StatusBadge tone={canValidate ? 'neutral' : tone} status={displayStatus} />

      <Text style={styles.name}>{ticket.customer_name || ticket.customer_email || 'Unknown'}</Text>
      <Text style={styles.ticketType}>{ticket.ticket_type_name || 'General Admission'}</Text>

      {(ticket.event_name || ticket.event_location_name) ? (
        <View style={styles.eventRow}>
          <Text style={styles.calIcon}>◻</Text>
          <View style={styles.eventCopy}>
            {ticket.event_name ? <Text style={styles.eventName}>{ticket.event_name}</Text> : null}
            {ticket.event_location_name ? <Text style={styles.eventDate}>{ticket.event_location_name}</Text> : null}
            {redeemedAt ? <Text style={styles.eventDate}>Redeemed {redeemedAt}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.cancelBtn} disabled={busy}>
          <Text style={styles.cancelIcon}>×</Text>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={onValidate}
          style={[styles.validateBtn, (!canValidate || busy) && styles.validateBtnDim]}
          disabled={!canValidate || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.validateIcon}>✓</Text>
              <Text style={styles.validateLabel}>Validate</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#131c2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // status
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: { fontSize: 16, fontWeight: '800' },
  statusLabel: { fontSize: 18, fontWeight: '800' },

  // attendee
  name: { color: '#f8fafc', fontSize: 24, fontWeight: '800', marginTop: 2 },
  ticketType: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },

  // event
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  calIcon: { color: '#f4317f', fontSize: 18, marginTop: 2 },
  eventCopy: { flex: 1, gap: 2 },
  eventName: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  eventDate: { color: '#94a3b8', fontSize: 13 },

  // actions
  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
  },
  cancelIcon: { color: '#ef4444', fontSize: 18, fontWeight: '800' },
  cancelLabel: { color: '#ef4444', fontSize: 15, fontWeight: '800' },

  validateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#f4317f',
  },
  validateBtnDim: { opacity: 0.5 },
  validateIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
  validateLabel: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
