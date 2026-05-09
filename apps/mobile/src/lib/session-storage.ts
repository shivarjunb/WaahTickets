import * as SecureStore from 'expo-secure-store'
import type { MobileSessionState, StorefrontOrderGroup } from '@waahtickets/shared-types'

const mobileTokenStorageKey = 'waahtickets.mobile.session'
const pendingKhaltiPaymentStorageKey = 'waahtickets.mobile.pending-khalti-payment'

export type StoredPendingKhaltiPayment = {
  pidx: string
  paymentUrl: string
  orderGroups: StorefrontOrderGroup[]
}

export async function readStoredMobileSession() {
  const raw = await SecureStore.getItemAsync(mobileTokenStorageKey)
  if (!raw) return null
  return JSON.parse(raw) as MobileSessionState
}

export async function writeStoredMobileSession(session: MobileSessionState) {
  if (!session.tokens) {
    await SecureStore.deleteItemAsync(mobileTokenStorageKey)
    return
  }

  await SecureStore.setItemAsync(mobileTokenStorageKey, JSON.stringify(session))
}

export async function readStoredPendingKhaltiPayment() {
  const raw = await SecureStore.getItemAsync(pendingKhaltiPaymentStorageKey)
  if (!raw) return null
  return JSON.parse(raw) as StoredPendingKhaltiPayment
}

export async function writeStoredPendingKhaltiPayment(payment: StoredPendingKhaltiPayment | null) {
  if (!payment) {
    await SecureStore.deleteItemAsync(pendingKhaltiPaymentStorageKey)
    return
  }

  await SecureStore.setItemAsync(pendingKhaltiPaymentStorageKey, JSON.stringify(payment))
}
