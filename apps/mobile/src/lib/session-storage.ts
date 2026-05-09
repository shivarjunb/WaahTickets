import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import type { MobileSessionState, StorefrontOrderGroup } from '@waahtickets/shared-types'

const mobileTokenStorageKey = 'waahtickets.mobile.session'
const pendingKhaltiPaymentStorageKey = 'waahtickets.mobile.pending-khalti-payment'
const pendingEsewaPaymentStorageKey = 'waahtickets.mobile.pending-esewa-payment'
const mobileCartStorageKey = 'waahtickets.mobile.cart'
const mobileCartSecureStorageKey = 'waahtickets.mobile.cart.backup'

export type StoredCartItem = {
  eventId: string
  ticketTypeId: string
  ticketName: string
  quantity: number
  unitPrice: number
  eventTitle: string
  eventDate: string
}

export type StoredPendingKhaltiPayment = {
  pidx: string
  paymentUrl: string
  orderGroups: StorefrontOrderGroup[]
}

export type StoredPendingEsewaPayment = {
  transactionUuid: string
  totalAmount: string
  productCode: string
  mode: 'test' | 'live'
  launchUrl: string
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
  const raw = await AsyncStorage.getItem(mobileCartStorageKey)
  if (raw) {
    return JSON.parse(raw) as StoredCartItem[]
  }

  const backup = await SecureStore.getItemAsync(mobileCartSecureStorageKey)
  if (!backup) return null
  return JSON.parse(backup) as StoredCartItem[]
}

export async function writeStoredCart(items: StoredCartItem[]) {
  if (items.length === 0) {
    await Promise.all([
      AsyncStorage.removeItem(mobileCartStorageKey),
      SecureStore.deleteItemAsync(mobileCartSecureStorageKey)
    ])
    return
  }

  const serialized = JSON.stringify(items)
  await Promise.all([
    AsyncStorage.setItem(mobileCartStorageKey, serialized),
    SecureStore.setItemAsync(mobileCartSecureStorageKey, serialized)
  ])
}
