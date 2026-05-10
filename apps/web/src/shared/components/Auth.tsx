import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Mail, ShieldCheck, X, Ticket } from "lucide-react";
import type { ButtonColorPreset, ButtonColorTheme, ApiRecord, PublicEvent, TicketType, CartItem, PersistedCartItem, UserCartSnapshot, KhaltiCheckoutOrderGroup, CheckoutSubmissionSnapshot, GuestCheckoutContact, GuestCheckoutIdentity, OrderCustomerOption, WebRoleName, SortDirection, ResourceSort, PaginationMetadata, ResourceUiConfig, ApiListResponse, ApiMutationResponse, CouponValidationResponse, TicketRedeemResponse, R2SettingsData, RailConfigItem, PublicRailsSettingsData, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, GoogleAuthConfig, AuthUser, DetectedBarcodeValue, BarcodeDetectorInstance, BarcodeDetectorConstructor, AdminDashboardMetrics, EventLocationDraft, FetchJsonOptions } from "../types";
import { adminResourceGroups, groupedAdminResources, DASHBOARD_VIEW, SETTINGS_VIEW, ADS_VIEW, featuredSlideImages, buttonColorPresets, defaultButtonPreset, defaultButtonColorTheme, defaultRailsSettingsData, defaultPublicPaymentSettings, defaultAdminPaymentSettings, defaultCartSettingsData, defaultAdSettingsData, eventImagePlaceholder, samplePayloads, resourceUiConfig, roleAccess, lookupResourceByField, fieldSelectOptions, requiredFieldsByResource, emptyEventLocationDraft, hiddenTableColumns, defaultSubgridRowsPerPage, minSubgridRowsPerPage, maxSubgridRowsPerPage, adminGridRowsStorageKey, adminSidebarCollapsedStorageKey, khaltiCheckoutDraftStorageKey, esewaCheckoutDraftStorageKey, guestCheckoutContactStorageKey, cartStorageKey, cartHoldStorageKey, cartHoldDurationMs, emptyColumnFilterState, defaultMonthlyTicketSales, defaultAdminDashboardMetrics } from "../constants";
import { readPersistedCartItems, loadAdminSubgridRowsPerPage, loadAdminSidebarCollapsed, loadButtonColorTheme, applyButtonThemeToDocument, normalizeHexColor, hexToRgba, getFieldSelectOptions, getQrImageUrl, toFormValues, fromFormValues, eventLocationDraftToPayload, coerceValue, coerceFieldValue, normalizePagination, formatPaginationSummary, getTableColumns, getAvailableColumns, parseTimeValue, getRecordTimestamp, normalizeStatusLabel, isSuccessfulPaymentStatus, isFailureQueueStatus, getStatusBreakdown, getRecentRecordTrend, normalizeRailId, normalizePublicRailsSettings, normalizeAdminRailsSettings, normalizeAdminPaymentSettings, normalizeCartSettings, buildConfiguredRails, buildDefaultEventRails, groupCartItemsByEvent, cartHasDifferentEvent, isCartItemLike, isPersistedCartItemLike, allocateOrderDiscountShare, getFileDownloadUrl, getTicketPdfDownloadUrl, formatCellValue, isHiddenListColumn, isIdentifierLikeColumn, getLookupLabel, isBooleanField, isDateTimeField, isPaisaField, isValidMoneyInput, formatDateTimeForTable, toDateTimeLocalValue, toIsoDateTimeValue, isTruthyValue, isAlwaysHiddenFormField, isFieldReadOnly, canEditFieldForRole, canCustomerEditCustomerField, getInitials, getAdminResourceIcon, formatResourceName, formatAdminLabel, isRequiredField, ensureFormHasRequiredFields, getOrderedFormFields, validateForm, isValidHttpUrl, readQrValueFromToken, resolveQrCodeValueFromPayload, readQrValueFromUrlPayload, readQrValueFromUrlSearchParams, getEventImageUrl, isEventWithinRange, formatEventDate, formatEventTime, formatEventRailLabel, hasAdminConsoleAccess, hasTicketValidationAccess, resolveReportsPathForUser, getDefaultWebRoleView, hasCustomerTicketsAccess, formatMoney, formatCountdown, getBarcodeDetectorConstructor, fetchJson, getErrorMessage, sanitizeClientErrorMessage, isErrorStatusMessage } from "../utils";

export function AuthModal({
  onAuthenticated,
  onClose
}: {
  onAuthenticated: (user: AuthUser) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [status, setStatus] = useState('Use email/password or continue with Google.')
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [googleConfig, setGoogleConfig] = useState<GoogleAuthConfig>({
    configured: false,
    redirect_uri: null
  })
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    webrole: 'Customers'
  })

  useEffect(() => {
    async function loadGoogleConfig() {
      try {
        const { data } = await fetchJson<GoogleAuthConfig>('/api/auth/google/config')
        setGoogleConfig(data)
      } catch {
        setGoogleConfig({ configured: false, redirect_uri: null })
      }
    }

    void loadGoogleConfig()
  }, [])

  async function submitAuth() {
    if (isSubmittingAuth) return

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body =
      mode === 'login'
        ? { email: form.email, password: form.password }
        : {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone_number: form.phone_number,
            password: form.password,
          }

    setIsSubmittingAuth(true)

    try {
      const { data } = await fetchJson<{ user: AuthUser }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      onAuthenticated(data.user)
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function submitForgotPassword() {
    if (isSubmittingAuth) return
    const email = String(form.email ?? '').trim().toLowerCase()
    if (!email) {
      setStatus('Enter your email first, then click Forgot password.')
      return
    }

    setIsSubmittingAuth(true)
    try {
      const { data } = await fetchJson<{ ok?: boolean; message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setStatus(
        String(
          data.message ??
            'If an account exists for this email, reset instructions will be provided. If needed, contact support.'
        )
      )
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal auth-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Account</p>
            <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
          </div>
          <button aria-label="Close modal" disabled={isSubmittingAuth} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="auth-body">
          <p className={isErrorStatusMessage(status) ? 'auth-status auth-status-error' : 'auth-status'}>{status}</p>
          {mode === 'register' ? (
            <div className="modal-form-grid auth-name-grid">
              <label>
                <span>First name</span>
                <input
                  value={form.first_name}
                  onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={form.last_name}
                  onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                />
              </label>
              <label>
                <span>Phone number</span>
                <input
                  value={form.phone_number}
                  onChange={(event) => setForm({ ...form, phone_number: event.target.value })}
                />
              </label>
            </div>
          ) : null}
          <div className="modal-form-grid auth-name-grid">
            <label>
              <span>Email</span>
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
          </div>
          {mode === 'login' ? (
            <button
              className="auth-forgot-button"
              disabled={isSubmittingAuth}
              type="button"
              onClick={() => void submitForgotPassword()}
            >
              Forgot password?
            </button>
          ) : null}
          <div className="auth-actions">
            <div className="auth-local-actions">
              <button
                className="primary-admin-button"
                disabled={isSubmittingAuth}
                type="button"
                onClick={() => void submitAuth()}
              >
                {isSubmittingAuth ? <span aria-hidden="true" className="button-spinner" /> : null}
                {isSubmittingAuth ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
              </button>
              <button
                className="auth-switch-button"
                disabled={isSubmittingAuth}
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
              </button>
            </div>
            <div className="auth-divider" role="separator" aria-label="Authentication methods">
              <span>or continue with</span>
            </div>
            <div className="auth-sso-actions">
              <button
                className="google-auth-button"
                disabled={!googleConfig.configured || isSubmittingAuth}
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/google/start'
                }}
              >
                Continue with Google
              </button>
            </div>
          </div>
          {!googleConfig.configured ? (
            <p>Google SSO needs a client ID and secret before this button can be used.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}


export function LoginRequired({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <main className="auth-gate">
      <section className="auth-gate-panel">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <p className="eyebrow">Admin access</p>
        <h1>Login required</h1>
        <p>
          The admin dashboard is protected. Sign in with an admin or organization account
          to manage records.
        </p>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onLoginClick}>
            Login
          </button>
          <a className="secondary-button" href="/">
            Back to site
          </a>
        </div>
      </section>
    </main>
  )
}


export function AccountAccessBlocked({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const isInactive = user?.is_active === false
  const heading = isInactive ? 'Account access is disabled' : 'Activate your account to continue'
  const message = isInactive
    ? 'This account is currently inactive. Please contact support or an administrator to restore access.'
    : 'Your account is still unverified. Click the activation link sent to your email address to unlock the admin dashboard.'

  return (
    <main className="auth-gate">
      <section className="auth-gate-panel">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <p className="eyebrow">{isInactive ? 'Account inactive' : 'Email verification required'}</p>
        <h1>{heading}</h1>
        <p>
          {message}
          {!isInactive && user?.email ? (
            <>
              {' '}Verification email target:
              <strong> {user.email}</strong>.
            </>
          ) : null}
        </p>
        <div className="hero-actions">
          {!isInactive ? (
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              I have activated my account
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </section>
    </main>
  )
}
