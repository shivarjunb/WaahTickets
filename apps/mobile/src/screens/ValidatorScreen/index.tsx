import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Camera, useCameraPermissions } from 'expo-camera'
import type { createApiClient } from '@waahtickets/api-client'
import type { ValidationState, ValidationTone } from '../../types'
import { buildApiErrorMessage, formatValidationTone } from '../../utils/format'
import { resolveQrCodeValueFromPayload } from '../../utils/qr'
import { AppIcon } from '../../components/AppIcon'
import { ScanOverlay } from './ScanOverlay'
import { TicketResultSheet } from './TicketResultSheet'

let imagePickerModule: {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>
  launchImageLibraryAsync: (options: { mediaTypes: string[]; quality?: number; allowsEditing?: boolean }) => Promise<{ canceled: boolean; assets?: Array<{ uri?: string }> }>
} | null = null

try {
  imagePickerModule = require('expo-image-picker')
} catch {
  imagePickerModule = null
}

const initialState: ValidationState = {
  qrInput: '',
  status: 'Ready to scan tickets.',
  tone: 'neutral',
  ticket: null,
  pendingQrValue: '',
  pendingStatus: null,
  scanning: false,
  busy: false
}

export function ValidatorScreen({
  validatorAllowed,
  api,
  resolvedApiBaseUrl,
  onBack,
  onGoToAccount
}: {
  validatorAllowed: boolean
  api: ReturnType<typeof createApiClient>
  resolvedApiBaseUrl: string
  onBack: () => void
  onGoToAccount: () => void
}) {
  const [state, setState] = useState<ValidationState>(initialState)
  const busyRef = useRef(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [overlayVisible, setOverlayVisible] = useState(false)

  useEffect(() => {
    if (!validatorAllowed) return
    void toggleScanner()
  }, [validatorAllowed])

  function reset() {
    setState(initialState)
    busyRef.current = false
  }

  async function toggleScanner() {
    if (!validatorAllowed) {
      onGoToAccount()
      return
    }
    if (state.scanning) {
      setState((s) => ({ ...s, scanning: false }))
      return
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission()
      if (!result.granted) {
        setState((s) => ({ ...s, status: 'Camera permission is required to scan QR codes.', tone: 'error' }))
        return
      }
    }
    busyRef.current = false
    setState((s) => ({ ...s, scanning: true, status: 'Camera ready. Point it at a ticket QR code.', tone: 'neutral', ticket: null, pendingQrValue: '', pendingStatus: null }))
  }

  async function inspectTicketByQr(value: string, source: 'camera' | 'manual') {
    const qrCodeValue = resolveQrCodeValueFromPayload(value)
    if (!qrCodeValue || state.busy || busyRef.current) return

    busyRef.current = true
    setOverlayVisible(true)
    setState((s) => ({
      ...s,
      qrInput: qrCodeValue,
      status: source === 'camera' ? 'Checking scanned QR code...' : 'Checking QR code...',
      tone: 'neutral',
      ticket: null,
      pendingQrValue: '',
      pendingStatus: null,
      scanning: source === 'camera' ? false : s.scanning,
      busy: true
    }))

    try {
      const response = await api.inspectTicket({ qr_code_value: qrCodeValue })
      const result = response.data
      const ticket = result?.ticket ?? null
      const resolvedQr = ticket?.qr_code_value?.trim() || qrCodeValue

      if (result?.status === 'unredeemed' && ticket) {
        setState((s) => ({
          ...s, qrInput: resolvedQr,
          status: result.message || 'Ticket is valid. Confirm redemption.',
          tone: 'neutral', ticket, pendingQrValue: resolvedQr, pendingStatus: 'unredeemed',
          busy: false, scanning: false
        }))
        return
      }

      if ((result?.status === 'already_redeemed' || result?.status === 'expired') && ticket) {
        setState((s) => ({
          ...s, qrInput: resolvedQr,
          status: result.message || (result.status === 'expired' ? 'Ticket is expired.' : 'Already redeemed.'),
          tone: 'warning', ticket, pendingQrValue: resolvedQr, pendingStatus: result.status,
          scanning: false, busy: false
        }))
        return
      }

      setState((s) => ({
        ...s, status: result?.message || 'No matching ticket found for this QR code.',
        tone: 'error', ticket: null, pendingQrValue: '', pendingStatus: null,
        scanning: false, busy: false
      }))
    } catch (error) {
      setState((s) => ({
        ...s, status: buildApiErrorMessage(error, resolvedApiBaseUrl),
        tone: 'error', ticket: null, pendingQrValue: '', pendingStatus: null,
        scanning: false, busy: false
      }))
    } finally {
      busyRef.current = false
    }
  }

  async function inspectFromGallery() {
    if (state.busy || busyRef.current) return
    if (!imagePickerModule) {
      setState((s) => ({ ...s, status: 'Gallery picker is unavailable in this app build. Please reopen in Expo Go or rebuild dev client.' , tone: 'error' }))
      setOverlayVisible(true)
      return
    }

    const permission = await imagePickerModule.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setState((s) => ({ ...s, status: 'Gallery permission is required to import QR images.', tone: 'error' }))
      setOverlayVisible(true)
      return
    }

    const picked = await imagePickerModule.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false
    })
    if (picked.canceled || !picked.assets?.[0]?.uri) return

    try {
      const scanned = await Camera.scanFromURLAsync(picked.assets[0].uri, ['qr'])
      const value = scanned?.[0]?.data?.trim() ?? ''
      if (!value) {
        setState((s) => ({ ...s, status: 'No QR code found in selected image.', tone: 'warning' }))
        setOverlayVisible(true)
        return
      }
      await inspectTicketByQr(value, 'manual')
    } catch {
      setState((s) => ({ ...s, status: 'Unable to read QR from selected image.', tone: 'error' }))
      setOverlayVisible(true)
    }
  }

  async function confirmRedeem() {
    if (!state.pendingQrValue || state.pendingStatus !== 'unredeemed' || state.busy) return
    setState((s) => ({ ...s, status: 'Redeeming ticket...', tone: 'neutral', busy: true }))
    try {
      const response = await api.redeemTicket({ qr_code_value: state.pendingQrValue })
      const result = response.data
      const ticket = result?.ticket ?? state.ticket
      setState((s) => ({
        ...s,
        status: result?.message || (result?.status === 'redeemed' ? 'Ticket redeemed successfully.' : 'Unable to redeem ticket.'),
        tone: result?.status === 'redeemed' ? 'success' : result?.status === 'already_redeemed' || result?.status === 'expired' ? 'warning' : 'error',
        ticket,
        pendingStatus: result?.status === 'redeemed' || result?.status === 'already_redeemed'
          ? 'already_redeemed'
          : result?.status === 'expired' ? 'expired' : null,
        busy: false
      }))
    } catch (error) {
      setState((s) => ({
        ...s, status: buildApiErrorMessage(error, resolvedApiBaseUrl),
        tone: 'error', busy: false
      }))
    }
  }

  if (!validatorAllowed) {
    return (
      <View style={styles.unauthorised}>
        <View style={styles.unauthorisedInner}>
          <View style={styles.unauthorisedIcon}>
            <AppIcon name="scan" color="#f4317f" size={36} />
          </View>
          <Text style={styles.unauthorisedTitle}>Staff access required</Text>
          <Text style={styles.unauthorisedBody}>
            Sign in with an admin, organiser, or ticket validator account to use the scanner.
          </Text>
          <Pressable onPress={onGoToAccount} style={styles.signInBtn}>
            <Text style={styles.signInLabel}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      {/* Camera / scan zone */}
      <ScanOverlay
        scanning={state.scanning}
        onBarcodeScanned={(data) => { void inspectTicketByQr(data, 'camera') }}
        onBack={onBack}
      />

      {/* Ticket result sheet */}
      {state.ticket ? (
        <TicketResultSheet
          tone={state.tone}
          ticket={state.ticket}
          pendingStatus={state.pendingStatus}
          busy={state.busy}
          onCancel={reset}
          onValidate={() => { void confirmRedeem() }}
        />
      ) : state.status !== initialState.status ? (
        /* status message when no ticket but something happened */
        <View style={[styles.statusBanner, statusBannerStyle(state.tone)]}>
          <Text style={styles.statusText}>{state.status}</Text>
        </View>
      ) : null}

      {/* Manual input (hidden while scanning, shown in idle) */}
      {!state.scanning && !state.ticket ? (
        <View style={styles.manualRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!state.busy}
            value={state.qrInput}
            onChangeText={(v) => setState((s) => ({ ...s, qrInput: v }))}
            style={styles.manualInput}
            placeholder="Paste QR payload manually"
            placeholderTextColor="#475569"
            returnKeyType="go"
            onSubmitEditing={() => { void inspectTicketByQr(state.qrInput, 'manual') }}
          />
        </View>
      ) : null}

      {overlayVisible ? (
        <View style={styles.glassOverlay}>
          <View style={styles.glassCard}>
            <Image source={require('../../../assets/icon.png')} style={styles.waahLogo} />
            {state.busy ? <ActivityIndicator size="large" color="#f4317f" /> : <AppIcon name="check" color="#f4317f" size={28} />}
            <Text style={styles.glassTitle}>{state.busy ? 'Validating ticket...' : formatValidationTone(state.tone)}</Text>
            <Text style={styles.glassMessage}>{state.status}</Text>
            <Pressable
              style={styles.scanAgainBtn}
              onPress={() => {
                setOverlayVisible(false)
                reset()
                void toggleScanner()
              }}
            >
              <AppIcon name="scan" color="#fff" size={18} />
              <Text style={styles.scanAgainLabel}>Scan</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Control buttons row */}
      <View style={styles.controls}>
        <Pressable onPress={() => { void inspectFromGallery() }} style={styles.controlBtn}>
          <View style={styles.controlCircle}>
            <AppIcon name="gallery" color="#ffffff" size={20} />
          </View>
          <Text style={styles.controlLabel}>Gallery</Text>
        </Pressable>

        {overlayVisible ? (
          <Pressable onPress={() => {
            setOverlayVisible(false)
            reset()
            void toggleScanner()
          }} style={styles.controlBtn}>
            <View style={[styles.controlCircle, styles.controlCircleValidate]}>
              <AppIcon name="scan" color="#ffffff" size={22} />
            </View>
            <Text style={styles.controlLabel}>Scan</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => { void toggleScanner() }} style={styles.controlBtn}>
          <View style={[styles.controlCircle, state.scanning && styles.controlCircleStop]}>
            <AppIcon name={state.scanning ? 'close' : 'scan'} color="#ffffff" size={22} />
          </View>
          <Text style={styles.controlLabel}>{state.scanning ? 'Stop' : 'Start'}</Text>
        </Pressable>

        <Pressable
          onPress={() => { void confirmRedeem() }}
          disabled={state.pendingStatus !== 'unredeemed' || state.busy}
          style={styles.controlBtn}
        >
          <View style={[
            styles.controlCircle,
            styles.controlCircleValidate,
            (state.pendingStatus !== 'unredeemed' || state.busy) && styles.controlCircleDim
          ]}>
            <AppIcon name="check" color="#ffffff" size={22} />
          </View>
          <Text style={styles.controlLabel}>Validate</Text>
        </Pressable>
      </View>
    </View>
  )
}

function statusBannerStyle(tone: ValidationTone) {
  if (tone === 'success') return { backgroundColor: '#052e16', borderColor: '#16a34a' }
  if (tone === 'warning') return { backgroundColor: '#2d1b00', borderColor: '#d97706' }
  if (tone === 'error')   return { backgroundColor: '#1f0707', borderColor: '#dc2626' }
  return { backgroundColor: '#0c1a2e', borderColor: '#334155' }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1220' },

  // unauthorised
  unauthorised: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1220', padding: 24 },
  unauthorisedInner: { alignItems: 'center', gap: 14, maxWidth: 300 },
  unauthorisedIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(244,49,127,0.12)',
    alignItems: 'center', justifyContent: 'center'
  },
  unauthorisedTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  unauthorisedBody: { color: '#94a3b8', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  signInBtn: {
    marginTop: 4,
    minHeight: 48, borderRadius: 999, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f4317f'
  },
  signInLabel: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // status banner (no ticket result)
  statusBanner: {
    margin: 16, borderRadius: 14, padding: 14, borderWidth: 1,
  },
  statusText: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', lineHeight: 20 },

  // manual input
  manualRow: { paddingHorizontal: 16, paddingTop: 4 },
  manualInput: {
    minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b',
    paddingHorizontal: 14, color: '#f8fafc', backgroundColor: '#131c2e', fontSize: 14
  },

  // control buttons
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#0b1220',
  },
  controlBtn: { alignItems: 'center', gap: 6 },
  controlCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4
  },
  controlCircleStop: { backgroundColor: '#7f1d1d' },
  controlCircleValidate: { backgroundColor: '#f4317f' },
  controlCircleDim: { opacity: 0.4 },
  controlLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,20,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30
  },
  glassCard: {
    width: '86%',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(12,20,36,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    gap: 10
  },
  waahLogo: { width: 42, height: 42, borderRadius: 10, marginBottom: 4 },
  glassTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  glassMessage: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  scanAgainBtn: {
    marginTop: 4,
    backgroundColor: '#f4317f',
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  scanAgainLabel: { color: '#fff', fontWeight: '800', fontSize: 14 }
})
