import * as SecureStore from 'expo-secure-store'
import type { MobileSessionState, StorefrontOrderGroup } from '@waahtickets/shared-types'

const mobileTokenStorageKey = 'waahtickets.mobile.session'
const pendingKhaltiPaymentStorageKey = 'waahtickets.mobile.pending-khalti-payment'
const pendingEsewaPaymentStorageKey = 'waahtickets.mobile.pending-esewa-payment'
const mobileCartStorageKey = 'waahtickets.mobile.cart'
const mobileCartHoldStorageKey = 'waahtickets.mobile.cart.hold'

export type StoredCartItem = {
  eventId: string
  ticketTypeId: string
  ticketName: string
  quantity: number
  unitPrice: number
  eventTitle: string
  eventDate: string
}

export type StoredCartHold = {
  hold_token: string
  hold_expires_at: string
}

export type StoredPendingKhaltiPayment = {
  pidx: string
  paymentUrl: string
  orderGroups: StorefrontOrderGroup[]
  guestCheckoutToken?: string
}

export type StoredPendingEsewaPayment = {
  transactionUuid: string
  totalAmount: string
  productCode: string
  mode: 'test' | 'live'
  launchUrl: string
  orderGroups: StorefrontOrderGroup[]
  guestCheckoutToken?: string
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

export async function readStoredPendingEsewaPayment() {
  const raw = await SecureStore.getItemAsync(pendingEsewaPaymentStorageKey)
  if (!raw) return null
  return JSON.parse(raw) as StoredPendingEsewaPayment
}

export async function writeStoredPendingEsewaPayment(payment: StoredPendingEsewaPayment | null) {
  if (!payment) {
    await SecureStore.deleteItemAsync(pendingEsewaPaymentStorageKey)
    return
  }

  await SecureStore.setItemAsync(pendingEsewaPaymentStorageKey, JSON.stringify(payment))
}

export async function readStoredCart() {
  const raw = await SecureStore.getItemAsync(mobileCartStorageKey)
  if (!raw) return null
  return JSON.parse(raw) as StoredCartItem[]
}

export async function writeStoredCart(items: StoredCartItem[]) {
  if (items.length === 0) {
    await SecureStore.deleteItemAsync(mobileCartStorageKey)
    return
  }

  await SecureStore.setItemAsync(mobileCartStorageKey, JSON.stringify(items))
}

export async function readStoredCartHold() {
  const raw = await SecureStore.getItemAsync(mobileCartHoldStorageKey)
  if (!raw) return null
  return JSON.parse(raw) as StoredCartHold
}

export async function writeStoredCartHold(hold: StoredCartHold | null) {
  if (!hold?.hold_token || !hold.hold_expires_at) {
    await SecureStore.deleteItemAsync(mobileCartHoldStorageKey)
    return
  }

  await SecureStore.setItemAsync(mobileCartHoldStorageKey, JSON.stringify(hold))
}
