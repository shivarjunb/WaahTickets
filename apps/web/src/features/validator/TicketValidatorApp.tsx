import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronLeft, RefreshCw, ScanLine, Ticket, X, AlertTriangle } from "lucide-react";
import { jsQR } from "jsqr";
import type { ButtonColorPreset, ButtonColorTheme, ApiRecord, PublicEvent, TicketType, CartItem, PersistedCartItem, UserCartSnapshot, KhaltiCheckoutOrderGroup, CheckoutSubmissionSnapshot, GuestCheckoutContact, GuestCheckoutIdentity, OrderCustomerOption, WebRoleName, SortDirection, ResourceSort, PaginationMetadata, ResourceUiConfig, ApiListResponse, ApiMutationResponse, CouponValidationResponse, TicketRedeemResponse, R2SettingsData, RailConfigItem, PublicRailsSettingsData, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, GoogleAuthConfig, AuthUser, DetectedBarcodeValue, BarcodeDetectorInstance, BarcodeDetectorConstructor, AdminDashboardMetrics, EventLocationDraft, FetchJsonOptions } from "../../shared/types";
import { adminResourceGroups, groupedAdminResources, DASHBOARD_VIEW, SETTINGS_VIEW, ADS_VIEW, featuredSlideImages, buttonColorPresets, defaultButtonPreset, defaultButtonColorTheme, defaultRailsSettingsData, defaultPublicPaymentSettings, defaultAdminPaymentSettings, defaultCartSettingsData, defaultAdSettingsData, eventImagePlaceholder, samplePayloads, resourceUiConfig, roleAccess, lookupResourceByField, fieldSelectOptions, requiredFieldsByResource, emptyEventLocationDraft, hiddenTableColumns, defaultSubgridRowsPerPage, minSubgridRowsPerPage, maxSubgridRowsPerPage, adminGridRowsStorageKey, adminSidebarCollapsedStorageKey, khaltiCheckoutDraftStorageKey, esewaCheckoutDraftStorageKey, guestCheckoutContactStorageKey, cartStorageKey, cartHoldStorageKey, cartHoldDurationMs, emptyColumnFilterState, defaultMonthlyTicketSales, defaultAdminDashboardMetrics } from "../../shared/constants";
import { readPersistedCartItems, loadAdminSubgridRowsPerPage, loadAdminSidebarCollapsed, loadButtonColorTheme, applyButtonThemeToDocument, normalizeHexColor, hexToRgba, getFieldSelectOptions, getQrImageUrl, toFormValues, fromFormValues, eventLocationDraftToPayload, coerceValue, coerceFieldValue, normalizePagination, formatPaginationSummary, getTableColumns, getAvailableColumns, parseTimeValue, getRecordTimestamp, normalizeStatusLabel, isSuccessfulPaymentStatus, isFailureQueueStatus, getStatusBreakdown, getRecentRecordTrend, normalizeRailId, normalizePublicRailsSettings, normalizeAdminRailsSettings, normalizeAdminPaymentSettings, normalizeCartSettings, buildConfiguredRails, buildDefaultEventRails, groupCartItemsByEvent, cartHasDifferentEvent, isCartItemLike, isPersistedCartItemLike, allocateOrderDiscountShare, getFileDownloadUrl, getTicketPdfDownloadUrl, formatCellValue, isHiddenListColumn, isIdentifierLikeColumn, getLookupLabel, isBooleanField, isDateTimeField, isPaisaField, isValidMoneyInput, formatDateTimeForTable, toDateTimeLocalValue, toIsoDateTimeValue, isTruthyValue, isAlwaysHiddenFormField, isFieldReadOnly, canEditFieldForRole, canCustomerEditCustomerField, getInitials, getAdminResourceIcon, formatResourceName, formatAdminLabel, isRequiredField, ensureFormHasRequiredFields, getOrderedFormFields, validateForm, isValidHttpUrl, readQrValueFromToken, resolveQrCodeValueFromPayload, readQrValueFromUrlPayload, readQrValueFromUrlSearchParams, getEventImageUrl, isEventWithinRange, formatEventDate, formatEventTime, formatEventRailLabel, hasAdminConsoleAccess, hasTicketValidationAccess, resolveReportsPathForUser, getDefaultWebRoleView, hasCustomerTicketsAccess, formatMoney, formatCountdown, getBarcodeDetectorConstructor, fetchJson, getErrorMessage, sanitizeClientErrorMessage, isErrorStatusMessage } from "../../shared/utils";

export default function TicketValidatorApp({
  initialQrToken,
  user,
  onLogout,
  theme,
  onToggleTheme
}: {
  initialQrToken: string | null
  user: AuthUser
  onLogout: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const [qrInput, setQrInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('Ready to scan tickets.')
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'warning' | 'error'>('neutral')
  const [isInspecting, setIsInspecting] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [scanResult, setScanResult] = useState<ApiRecord | null>(null)
  const [pendingTicket, setPendingTicket] = useState<ApiRecord | null>(null)
  const [pendingStatus, setPendingStatus] = useState<'unredeemed' | 'already_redeemed' | null>(null)
  const [pendingQrValue, setPendingQrValue] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fallbackContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const isBusyRef = useRef(false)
  const initialTokenHandledRef = useRef('')
  const lastDetectedRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })

  useEffect(() => {
    isBusyRef.current = isInspecting || isRedeeming
  }, [isInspecting, isRedeeming])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  useEffect(() => {
    const token = initialQrToken?.trim() ?? ''
    if (!token || initialTokenHandledRef.current === token) return
    const qrValue = readQrValueFromToken(token)
    if (!qrValue) {
      setStatusTone('error')
      setStatusMessage('Invalid ticket token in QR link.')
      initialTokenHandledRef.current = token
      return
    }

    initialTokenHandledRef.current = token
    setQrInput(qrValue)
    void inspectTicketByQr(qrValue, 'link')
  }, [initialQrToken])

  useEffect(() => {
    if (!isCameraActive) {
      stopCamera()
      return
    }

    let cancelled = false
    let intervalId: number | null = null

    async function startCamera() {
      setCameraError('')
      const detectorCtor = getBarcodeDetectorConstructor()
      let canUseNativeDetector = false

      if (detectorCtor) {
        canUseNativeDetector = true
        if (typeof detectorCtor.getSupportedFormats === 'function') {
          try {
            const supported = await detectorCtor.getSupportedFormats()
            canUseNativeDetector = supported.includes('qr_code')
          } catch {
            // Continue with detector creation.
          }
        }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Unable to access camera. Check permissions and try again.')
        setIsCameraActive(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        setCameraError('Unable to access camera. Check permissions and try again.')
        setIsCameraActive(false)
        return
      }

      detectorRef.current = canUseNativeDetector && detectorCtor ? new detectorCtor({ formats: ['qr_code'] }) : null
      intervalId = window.setInterval(() => {
        if (!isCameraActive || isBusyRef.current || !videoRef.current) return
        if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

        if (detectorRef.current) {
          void detectorRef.current
            .detect(videoRef.current)
            .then((codes) => {
              const nextValue = typeof codes[0]?.rawValue === 'string' ? codes[0].rawValue.trim() : ''
              if (!nextValue) return
              const now = Date.now()
              if (lastDetectedRef.current.value === nextValue && now - lastDetectedRef.current.at < 4000) {
                return
              }
              lastDetectedRef.current = { value: nextValue, at: now }
              void inspectTicketByQr(nextValue, 'camera')
            })
            .catch(() => {
              // Ignore detection errors and continue scanning.
            })
          return
        }

        const sourceWidth = videoRef.current.videoWidth
        const sourceHeight = videoRef.current.videoHeight
        if (!sourceWidth || !sourceHeight) return

        const maxDimension = 960
        const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

        if (!fallbackCanvasRef.current) {
          fallbackCanvasRef.current = document.createElement('canvas')
        }
        const canvas = fallbackCanvasRef.current
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth
          canvas.height = targetHeight
          fallbackContextRef.current = canvas.getContext('2d', { willReadFrequently: true })
        }

        const context =
          fallbackContextRef.current ?? canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return
        fallbackContextRef.current = context

        context.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight)
        const imageData = context.getImageData(0, 0, targetWidth, targetHeight)
        const code = jsQR(imageData.data, targetWidth, targetHeight, { inversionAttempts: 'attemptBoth' })
        const nextValue = code?.data?.trim() ?? ''
        if (!nextValue) return
        const now = Date.now()
        if (lastDetectedRef.current.value === nextValue && now - lastDetectedRef.current.at < 4000) {
          return
        }
        lastDetectedRef.current = { value: nextValue, at: now }
        void inspectTicketByQr(nextValue, 'camera')
      }, 850)
    }

    void startCamera()

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
      stopCamera()
    }
  }, [isCameraActive])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    detectorRef.current = null
    fallbackCanvasRef.current = null
    fallbackContextRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function inspectTicketByQr(value: string, source: 'camera' | 'manual' | 'link') {
    const qrCodeValue = resolveQrCodeValueFromPayload(value)
    if (!qrCodeValue || isBusyRef.current) return

    setQrInput(qrCodeValue)
    setIsInspecting(true)
    setScanResult(null)
    setPendingTicket(null)
    setPendingStatus(null)
    setPendingQrValue('')
    setStatusTone('neutral')
    setStatusMessage(
      source === 'camera'
        ? 'Checking scanned QR code...'
        : source === 'link'
          ? 'Checking ticket from QR link...'
          : 'Checking QR code...'
    )

    try {
      const { data } = await fetchJson<TicketRedeemResponse>('/api/tickets/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_value: qrCodeValue })
      })
      const result = data.data
      const ticket = (result?.ticket ?? null) as ApiRecord | null

      if (result?.status === 'already_redeemed' && ticket) {
        const resolvedQrCodeValue = typeof ticket.qr_code_value === 'string' ? ticket.qr_code_value.trim() : qrCodeValue
        setScanResult(ticket)
        setPendingTicket(ticket)
        setPendingStatus('already_redeemed')
        setPendingQrValue(resolvedQrCodeValue)
        setQrInput(resolvedQrCodeValue)
        setStatusTone('warning')
        setStatusMessage(result.message ?? 'Ticket has already been redeemed.')
      } else if (result?.status === 'unredeemed' && ticket) {
        const resolvedQrCodeValue = typeof ticket.qr_code_value === 'string' ? ticket.qr_code_value.trim() : qrCodeValue
        setScanResult(ticket)
        setPendingTicket(ticket)
        setPendingStatus('unredeemed')
        setPendingQrValue(resolvedQrCodeValue)
        setQrInput(resolvedQrCodeValue)
        setStatusTone('neutral')
        setStatusMessage(result.message ?? 'Ticket is valid. Confirm redemption.')
      } else {
        setStatusTone('error')
        setStatusMessage(result?.message ?? 'No matching ticket was found for this QR code.')
      }
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(getErrorMessage(error))
      setScanResult(null)
    } finally {
      setIsInspecting(false)
    }
  }

  async function confirmRedeem() {
    if (!pendingTicket || pendingStatus !== 'unredeemed' || !pendingQrValue.trim() || isBusyRef.current) return

    setIsRedeeming(true)
    setStatusTone('neutral')
    setStatusMessage('Redeeming ticket...')

    try {
      const { data } = await fetchJson<TicketRedeemResponse>('/api/tickets/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_value: pendingQrValue.trim() })
      })
      const result = data.data
      const ticket = (result?.ticket ?? null) as ApiRecord | null
      if (ticket) {
        setScanResult(ticket)
      }

      if (result?.status === 'redeemed') {
        setStatusTone('success')
        setStatusMessage(result.message ?? 'Ticket redeemed successfully.')
        setPendingTicket(ticket)
        setPendingStatus(ticket ? 'already_redeemed' : null)
      } else if (result?.status === 'already_redeemed') {
        setStatusTone('warning')
        setStatusMessage(result.message ?? 'Ticket has already been redeemed.')
        setPendingTicket(ticket)
        setPendingStatus(ticket ? 'already_redeemed' : null)
      } else {
        setPendingTicket(null)
        setPendingStatus(null)
        setStatusTone('error')
        setStatusMessage(result?.message ?? 'Unable to redeem ticket.')
      }
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(getErrorMessage(error))
    } finally {
      setIsRedeeming(false)
    }
  }

  function redeemAnotherTicket() {
    if (isBusyRef.current) return
    setQrInput('')
    setScanResult(null)
    setPendingTicket(null)
    setPendingStatus(null)
    setPendingQrValue('')
    setStatusTone('neutral')
    setStatusMessage('Ready to scan tickets.')
  }

  const scanStateLabel = isCameraActive ? 'Camera live' : 'Camera idle'
  const lastCheckLabel =
    statusTone === 'success'
      ? 'Redeemed'
      : statusTone === 'warning'
        ? 'Already redeemed'
        : statusTone === 'error'
          ? 'Check failed'
          : 'Awaiting scan'
  const queueStateLabel =
    pendingStatus === 'unredeemed'
      ? 'Needs confirmation'
      : pendingStatus === 'already_redeemed'
        ? 'Already redeemed'
        : 'No pending ticket'

  return (
    <main className="validator-page">
      <header className="validator-header">
        <div>
          <p className="admin-breadcrumb">Home / Ticket validation</p>
          <h1>Ticket Validator</h1>
          <p className="validator-subtitle">{user?.email ?? 'Signed in validator'} · scan and redeem tickets at entry.</p>
          <div className="validator-status-strip">
            <span>{scanStateLabel}</span>
            <span>{lastCheckLabel}</span>
            <span>{queueStateLabel}</span>
          </div>
        </div>
        <div className="admin-header-actions">
          <button type="button" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <a className="admin-link-button" href="/">
            <Home size={17} />
            Public site
          </a>
          <button type="button" onClick={() => void onLogout()}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <section className="validator-grid">
        <article className="validator-card">
          <header>
            <h2>
              <Camera size={18} />
              Camera scan
            </h2>
            <p>Use the device camera to scan ticket QR codes in real time.</p>
          </header>
          <div className="validator-camera-shell">
            <video ref={videoRef} muted playsInline />
          </div>
          <div className="validator-actions">
            <button className="primary-admin-button" type="button" onClick={() => setIsCameraActive((current) => !current)}>
              <ScanLine size={17} />
              {isCameraActive ? 'Stop camera' : 'Start camera'}
            </button>
            {cameraError ? <p className="validator-error">{cameraError}</p> : null}
          </div>
        </article>

        <article className="validator-card">
          <header>
            <h2>
              <Ticket size={18} />
              Redeem by QR value
            </h2>
            <p>Use this for handheld scanners or manual fallback entry.</p>
          </header>
          <form
            className="validator-manual-form"
            onSubmit={(event) => {
              event.preventDefault()
              void inspectTicketByQr(qrInput, 'manual')
            }}
          >
            <label>
              <span>QR code value</span>
              <input
                autoComplete="off"
                disabled={isInspecting || isRedeeming}
                placeholder="Scan or paste the QR payload"
                type="text"
                value={qrInput}
                onChange={(event) => setQrInput(event.target.value)}
              />
            </label>
            <button className="primary-admin-button" disabled={isInspecting || isRedeeming || !qrInput.trim()} type="submit">
              {isInspecting ? <span aria-hidden="true" className="button-spinner" /> : <ScanLine size={17} />}
              {isInspecting ? 'Checking...' : 'Check ticket'}
            </button>
          </form>

          <div className={`validator-result validator-result-${statusTone}`}>
            {statusTone === 'success' ? <CheckCircle2 size={17} /> : null}
            {statusTone === 'warning' ? <AlertTriangle size={17} /> : null}
            {statusTone === 'error' ? <AlertTriangle size={17} /> : null}
            <span>{statusMessage}</span>
          </div>

          {scanResult ? (
            <>
              <div className="validator-ticket-meta">
                <p><strong>Ticket</strong> {String(scanResult.ticket_number ?? '-')}</p>
                <p><strong>Event</strong> {String(scanResult.event_name ?? '-')}</p>
                <p><strong>Location</strong> {String(scanResult.event_location_name ?? '-')}</p>
                <p><strong>Type</strong> {String(scanResult.ticket_type_name ?? '-')}</p>
                <p><strong>Customer</strong> {String(scanResult.customer_name ?? scanResult.customer_email ?? '-')}</p>
                <p><strong>Redeemed at</strong> {String(scanResult.redeemed_at ?? '-')}</p>
                <p><strong>Redeemed by</strong> {String(scanResult.redeemed_by_name ?? '-')}</p>
              </div>
              <div className="validator-actions">
                <button className="primary-admin-button" disabled={isInspecting || isRedeeming} type="button" onClick={redeemAnotherTicket}>
                  Redeem another ticket
                </button>
              </div>
            </>
          ) : null}
        </article>
      </section>
      {pendingTicket && pendingStatus ? (
        <TicketValidationModal
          busy={isInspecting || isRedeeming}
          status={pendingStatus}
          ticket={pendingTicket}
          onClose={() => {
            setPendingTicket(null)
            setPendingStatus(null)
            setPendingQrValue('')
          }}
          onConfirmRedeem={() => void confirmRedeem()}
        />
      ) : null}
    </main>
  )
}


export function TicketValidationModal({
  busy,
  status,
  ticket,
  onClose,
  onConfirmRedeem
}: {
  busy: boolean
  status: 'unredeemed' | 'already_redeemed'
  ticket: ApiRecord
  onClose: () => void
  onConfirmRedeem: () => void
}) {
  const title = status === 'unredeemed' ? 'Confirm ticket redemption' : 'Ticket already redeemed'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Ticket validation</p>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close modal" disabled={busy} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="validator-ticket-meta">
          <p><strong>Ticket</strong> {String(ticket.ticket_number ?? '-')}</p>
          <p><strong>Event</strong> {String(ticket.event_name ?? '-')}</p>
          <p><strong>Location</strong> {String(ticket.event_location_name ?? '-')}</p>
          <p><strong>Type</strong> {String(ticket.ticket_type_name ?? '-')}</p>
          <p><strong>Customer</strong> {String(ticket.customer_name ?? ticket.customer_email ?? '-')}</p>
          <p><strong>Redeemed at</strong> {String(ticket.redeemed_at ?? '-')}</p>
          <p><strong>Redeemed by</strong> {String(ticket.redeemed_by_name ?? '-')}</p>
        </div>
        <footer className="record-modal-actions">
          <button disabled={busy} type="button" onClick={onClose}>
            Close
          </button>
          {status === 'unredeemed' ? (
            <button className="primary-admin-button" disabled={busy} type="button" onClick={onConfirmRedeem}>
              {busy ? <span aria-hidden="true" className="button-spinner" /> : <CheckCircle2 size={17} />}
              {busy ? 'Redeeming...' : 'Confirm redeem'}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}


export function CustomerTicketModal({
  isLoading,
  status,
  message,
  ticket,
  onClose
}: {
  isLoading: boolean
  status: 'already_redeemed' | 'unredeemed' | 'not_found' | null
  message: string
  ticket: ApiRecord
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">My ticket</p>
            <h2>{String(ticket.ticket_number ?? 'Ticket')}</h2>
          </div>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={`validator-result validator-result-${status === 'already_redeemed' ? 'warning' : 'neutral'}`}>
          <span>{isLoading ? 'Loading ticket...' : message || 'Ticket loaded.'}</span>
        </div>
        <div className="validator-ticket-meta">
          <p><strong>Status</strong> {status === 'already_redeemed' ? 'Redeemed' : 'Valid'}</p>
          <p><strong>Event</strong> {String(ticket.event_name ?? '-')}</p>
          <p><strong>Location</strong> {String(ticket.event_location_name ?? '-')}</p>
          <p><strong>Type</strong> {String(ticket.ticket_type_name ?? '-')}</p>
          <p><strong>Redeemed at</strong> {String(ticket.redeemed_at ?? '-')}</p>
          <p><strong>Redeemed by</strong> {String(ticket.redeemed_by_name ?? '-')}</p>
        </div>
        <footer className="record-modal-actions">
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  )
}
