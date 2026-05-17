import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link as LinkIcon,
  Megaphone,
  Plus,
  Save,
  Tag,
  Ticket,
  UserCog,
  X
} from "lucide-react";
import type { ApiListResponse, ApiMutationResponse, ApiRecord } from "../../shared/types";
import { fetchJson, formatMoney, getErrorMessage, getLookupLabel } from "../../shared/utils";

type Step = 1 | 2 | 3 | 4
type CouponMode = 'none' | 'existing' | 'create'
type CouponType = 'organizer' | 'waahcoupon'
type DiscountType = 'percentage' | 'fixed'

const STEP_LABELS = ['Agent', 'Referral Link', 'FCFS Coupon', 'Review']

function slugCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function buildDefaultCode(partner?: ApiRecord | null, event?: ApiRecord | null) {
  const partnerSeed = String(partner?.code ?? partner?.name ?? '').trim()
  const eventSeed = String(event?.slug ?? event?.name ?? '').trim()
  const base = [partnerSeed, eventSeed].filter(Boolean).join('-') || 'AGENT-LINK'
  return slugCode(base)
}

function formatCouponOption(coupon: ApiRecord) {
  const publicCode = String(coupon.public_code ?? coupon.code ?? coupon.id ?? '')
  const max = Number(coupon.max_redemptions ?? 0)
  const used = Number(coupon.redeemed_count ?? 0)
  const remaining = max > 0 ? Math.max(0, max - used) : null
  const discountType = String(coupon.discount_type ?? '')
  const discount =
    discountType === 'percentage'
      ? `${coupon.discount_percentage ?? '?'}%`
      : formatMoney(Number(coupon.discount_amount_paisa ?? 0))
  return `${publicCode} - ${discount} off${remaining === null ? '' : ` - ${remaining} left`}`
}

export function ReferralLinkWizard({
  webRole,
  selectedOrgId,
  userOrganizations,
  onClose,
  onSaved
}: {
  webRole?: string
  selectedOrgId?: string
  userOrganizations?: ApiRecord[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isOrgRole = webRole === 'Organizations'
  const [step, setStep] = useState<Step>(1)
  const [partners, setPartners] = useState<ApiRecord[]>([])
  const [events, setEvents] = useState<ApiRecord[]>([])
  const [organizations, setOrganizations] = useState<ApiRecord[]>(userOrganizations ?? [])
  const [coupons, setCoupons] = useState<ApiRecord[]>([])
  const [partnerId, setPartnerId] = useState('')
  const [eventId, setEventId] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [couponMode, setCouponMode] = useState<CouponMode>('none')
  const [existingCouponId, setExistingCouponId] = useState('')
  const [couponType, setCouponType] = useState<CouponType>(isOrgRole ? 'organizer' : 'waahcoupon')
  const [couponOrgId, setCouponOrgId] = useState(selectedOrgId || String(userOrganizations?.[0]?.id ?? ''))
  const [couponCode, setCouponCode] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountPercentage, setDiscountPercentage] = useState('10')
  const [discountAmountNpr, setDiscountAmountNpr] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('10')
  const [couponDescription, setCouponDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedLink, setSavedLink] = useState('')

  useEffect(() => {
    async function loadLookups() {
      setIsLoading(true)
      try {
        const [partnersRes, eventsRes, couponsRes, orgsRes] = await Promise.all([
          fetchJson<ApiListResponse>('/api/partners?limit=100'),
          fetchJson<ApiListResponse>('/api/events?limit=100'),
          fetchJson<ApiListResponse>('/api/coupons?limit=100'),
          isOrgRole ? Promise.resolve({ data: { data: userOrganizations ?? [] } }) : fetchJson<ApiListResponse>('/api/organizations?limit=100')
        ])
        const loadedPartners = partnersRes.data.data ?? []
        const salesAgents = loadedPartners.filter((partner) => String(partner.partner_type ?? '') === 'sales_agent')
        setPartners(salesAgents.length ? salesAgents : loadedPartners)
        setEvents(eventsRes.data.data ?? [])
        setOrganizations(orgsRes.data.data ?? [])
        setCoupons(
          (couponsRes.data.data ?? []).filter((coupon) => {
            if (String(coupon.redemption_type ?? '') !== 'first_come_first_serve') return false
            if (Number(coupon.is_active ?? 1) === 0) return false
            const max = Number(coupon.max_redemptions ?? 0)
            const used = Number(coupon.redeemed_count ?? 0)
            return !max || used < max
          })
        )
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    void loadLookups()
  }, [isOrgRole, userOrganizations])

  const selectedPartner = useMemo(
    () => partners.find((partner) => String(partner.id ?? '') === partnerId) ?? null,
    [partnerId, partners]
  )
  const selectedEvent = useMemo(
    () => events.find((event) => String(event.id ?? '') === eventId) ?? null,
    [eventId, events]
  )
  const selectedCoupon = useMemo(
    () => coupons.find((coupon) => String(coupon.id ?? '') === existingCouponId) ?? null,
    [coupons, existingCouponId]
  )
  const availableCoupons = useMemo(
    () =>
      coupons.filter((coupon) => {
        const couponEventId = String(coupon.event_id ?? '')
        if (eventId) return !couponEventId || couponEventId === eventId
        return !couponEventId
      }),
    [coupons, eventId]
  )
  const referralPath = code ? `/r/${encodeURIComponent(code)}` : '/r/YOUR-CODE'
  const referralLink = typeof window === 'undefined' ? referralPath : `${window.location.origin}${referralPath}`
  const selectedEventOrganizationId = String(selectedEvent?.organization_id ?? '')
  const effectiveCouponOrgId = couponType === 'organizer' ? couponOrgId || selectedEventOrganizationId : ''

  function validateStep(nextStep = step) {
    if (nextStep >= 1 && !partnerId) return 'Select the sales agent who should receive attribution.'
    if (nextStep >= 2) {
      if (!code.trim()) return 'Referral code is required.'
      if (!/^[A-Z0-9-]{3,40}$/.test(code.trim())) return 'Referral code must be 3-40 characters using letters, numbers, and hyphens only.'
    }
    if (nextStep >= 3 && couponMode === 'existing') {
      if (!existingCouponId) return 'Select an existing first-come-first-serve coupon.'
      if (!availableCoupons.some((coupon) => String(coupon.id ?? '') === existingCouponId)) {
        return 'Selected coupon does not match this referral link event scope.'
      }
    }
    if (nextStep >= 3 && couponMode === 'create') {
      if (!couponCode.trim()) return 'Coupon code is required.'
      if (couponType === 'organizer' && !effectiveCouponOrgId) return 'Organization is required for organizer coupons.'
      if (discountType === 'percentage') {
        const value = Number(discountPercentage)
        if (!Number.isFinite(value) || value <= 0 || value > 100) return 'Discount percentage must be greater than 0 and no more than 100.'
      } else {
        const value = Number(discountAmountNpr)
        if (!Number.isFinite(value) || value <= 0) return 'Discount amount must be greater than 0.'
      }
      const redemptions = Number(maxRedemptions)
      if (!Number.isInteger(redemptions) || redemptions <= 0) return 'Allowed redemptions must be a whole number greater than 0.'
    }
    return ''
  }

  function handleNext() {
    const err = validateStep(step)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setStep((current) => Math.min(4, current + 1) as Step)
  }

  function handleBack() {
    setError('')
    setStep((current) => Math.max(1, current - 1) as Step)
  }

  async function handleSave() {
    const err = validateStep(4)
    if (err) {
      setError(err)
      return
    }

    setIsSaving(true)
    setError('')
    try {
      let linkedCouponId = couponMode === 'existing' ? existingCouponId : ''

      if (couponMode === 'create') {
        const couponBody: Record<string, unknown> = {
          coupon_type: couponType,
          redemption_type: 'first_come_first_serve',
          code: couponCode.trim().toUpperCase(),
          discount_type: discountType,
          max_redemptions: Number(maxRedemptions),
          is_active: 1
        }
        if (eventId) couponBody.event_id = eventId
        if (couponType === 'organizer') couponBody.organization_id = effectiveCouponOrgId
        if (discountType === 'percentage') couponBody.discount_percentage = Number(discountPercentage)
        if (discountType === 'fixed') couponBody.discount_amount_paisa = Math.round(Number(discountAmountNpr) * 100)
        if (couponDescription.trim()) couponBody.description = couponDescription.trim()

        const { data } = await fetchJson<ApiMutationResponse>('/api/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(couponBody)
        })
        linkedCouponId = String(data.data?.id ?? '')
        if (!linkedCouponId) throw new Error('Coupon was created, but no coupon ID was returned.')
      }

      const referralBody: Record<string, unknown> = {
        partner_id: partnerId,
        code: code.trim().toUpperCase(),
        is_active: isActive ? 1 : 0
      }
      if (eventId) referralBody.event_id = eventId
      if (linkedCouponId) referralBody.linked_coupon_id = linkedCouponId
      if (description.trim()) referralBody.description = description.trim()

      await fetchJson<ApiMutationResponse>('/api/referral_codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(referralBody)
      })

      setSavedLink(referralLink)
      await onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  function selectPartner(nextPartnerId: string) {
    setPartnerId(nextPartnerId)
    const partner = partners.find((item) => String(item.id ?? '') === nextPartnerId) ?? null
    if (!code.trim()) {
      setCode(buildDefaultCode(partner, selectedEvent))
    }
  }

  function selectEvent(nextEventId: string) {
    setEventId(nextEventId)
    const event = events.find((item) => String(item.id ?? '') === nextEventId) ?? null
    if (!code.trim() || code === buildDefaultCode(selectedPartner, selectedEvent)) {
      setCode(buildDefaultCode(selectedPartner, event))
    }
    const orgId = String(event?.organization_id ?? '')
    if (orgId && !couponOrgId) setCouponOrgId(orgId)
    if (existingCouponId) {
      const stillCompatible = coupons.some((coupon) => {
        if (String(coupon.id ?? '') !== existingCouponId) return false
        const couponEventId = String(coupon.event_id ?? '')
        return nextEventId ? !couponEventId || couponEventId === nextEventId : !couponEventId
      })
      if (!stillCompatible) setExistingCouponId('')
    }
  }

  function useSuggestedCouponCode() {
    const base = code.trim() ? `${code}-DEAL` : buildDefaultCode(selectedPartner, selectedEvent)
    setCouponCode(slugCode(base))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal event-wizard-modal referral-wizard-modal" role="dialog" aria-modal="true" aria-labelledby="referral-wizard-title">
        <header className="record-modal-header wizard-header">
          <div>
            <p className="admin-breadcrumb">Referral Codes</p>
            <h2 id="referral-wizard-title">Create Referral Link</h2>
          </div>
          <div className="wizard-step-indicators">
            {([1, 2, 3, 4] as const).map((item) => (
              <div key={item} className={`wizard-step-dot ${step === item ? 'active' : ''} ${step > item ? 'done' : ''}`}>
                {step > item ? <Check size={11} /> : item}
              </div>
            ))}
          </div>
          <button aria-label="Close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="wizard-step-bar">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className={`wizard-step-item ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'done' : ''}`}>
              <span className="wizard-step-number">{index + 1}</span>
              <span className="wizard-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="record-modal-body wizard-body">
          {isLoading ? (
            <div className="wizard-step3-layout">
              <p className="wizard-coupons-empty">Loading sales agents, events, and coupons...</p>
            </div>
          ) : null}

          {!isLoading && step === 1 ? (
            <div className="wizard-step1-layout referral-wizard-layout">
              <div className="wizard-step1-form">
                <div className="wizard-coupons-intro">
                  <UserCog size={20} />
                  <div>
                    <h3>Choose Sales Agent</h3>
                    <p>The link will attribute paid orders to this agent for commission reporting.</p>
                  </div>
                </div>
                <label className="wizard-label wizard-full-width">
                  <span>Sales Agent <em className="required-indicator">*</em></span>
                  <select className="wizard-input" value={partnerId} onChange={(event) => selectPartner(event.target.value)}>
                    <option value="">Select sales agent</option>
                    {partners.map((partner) => (
                      <option key={String(partner.id ?? '')} value={String(partner.id ?? '')}>
                        {getLookupLabel(partner)}
                      </option>
                    ))}
                  </select>
                </label>
                {partners.length === 0 ? (
                  <p className="record-modal-error">No sales agents found. Create a partner with Partner type “Sales agent” first.</p>
                ) : null}
                <label className="wizard-label wizard-full-width">
                  <span>Campaign Notes</span>
                  <textarea
                    className="wizard-input wizard-textarea"
                    placeholder="Optional internal note for this referral link"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
              </div>
              <ReferralPreview partner={selectedPartner} event={selectedEvent} code={code} link={referralLink} couponLabel="" />
            </div>
          ) : null}

          {!isLoading && step === 2 ? (
            <div className="wizard-step1-layout referral-wizard-layout">
              <div className="wizard-step1-form">
                <div className="wizard-coupons-intro">
                  <LinkIcon size={20} />
                  <div>
                    <h3>Configure Link</h3>
                    <p>Use a clean code for printed QR materials, WhatsApp sharing, and agent tracking.</p>
                  </div>
                </div>
                <div className="wizard-field-row">
                  <label className="wizard-label">
                    <span>Referral Code <em className="required-indicator">*</em></span>
                    <input
                      className="wizard-input wizard-input-mono"
                      placeholder="AGENT-EVENT"
                      type="text"
                      value={code}
                      onChange={(event) => setCode(slugCode(event.target.value))}
                    />
                  </label>
                  <label className="wizard-label">
                    <span>Status</span>
                    <button className={isActive ? 'boolean-toggle active' : 'boolean-toggle'} type="button" onClick={() => setIsActive((value) => !value)}>
                      {isActive ? 'Active' : 'Inactive'}
                    </button>
                  </label>
                </div>
                <label className="wizard-label wizard-full-width">
                  <span>Event Scope</span>
                  <select className="wizard-input" value={eventId} onChange={(event) => selectEvent(event.target.value)}>
                    <option value="">All events</option>
                    {events.map((event) => (
                      <option key={String(event.id ?? '')} value={String(event.id ?? '')}>
                        {String(event.name ?? event.slug ?? event.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="referral-link-box">
                  <LinkIcon size={16} />
                  <span>{referralLink}</span>
                  <button type="button" title="Copy link" onClick={() => void navigator.clipboard?.writeText(referralLink)}>
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <ReferralPreview partner={selectedPartner} event={selectedEvent} code={code} link={referralLink} couponLabel="" />
            </div>
          ) : null}

          {!isLoading && step === 3 ? (
            <div className="wizard-step3-layout">
              <div className="wizard-coupons-intro">
                <Tag size={20} />
                <div>
                  <h3>Attach FCFS Coupon</h3>
                  <p>Optionally attach a first-come-first-serve discount. Customers opening the agent link will receive the coupon automatically at checkout.</p>
                </div>
              </div>

              <div className="referral-coupon-mode-grid">
                {([
                  ['none', 'No coupon', 'Track sales only.'],
                  ['existing', 'Use existing', `${availableCoupons.length} matching FCFS coupon${availableCoupons.length === 1 ? '' : 's'}.`],
                  ['create', 'Create coupon', 'Create and attach a new FCFS coupon.']
                ] as const).map(([mode, title, subtitle]) => (
                  <button
                    key={mode}
                    className={`referral-option-card ${couponMode === mode ? 'active' : ''}`}
                    type="button"
                    onClick={() => setCouponMode(mode)}
                  >
                    <span>{title}</span>
                    <small>{subtitle}</small>
                  </button>
                ))}
              </div>

              {couponMode === 'existing' ? (
                <div className="wizard-coupon-form">
                  <label className="wizard-label wizard-full-width">
                    <span>FCFS Coupon <em className="required-indicator">*</em></span>
                    <select className="wizard-input" value={existingCouponId} onChange={(event) => setExistingCouponId(event.target.value)}>
                      <option value="">Select coupon</option>
                      {availableCoupons.map((coupon) => (
                        <option key={String(coupon.id ?? '')} value={String(coupon.id ?? '')}>
                          {formatCouponOption(coupon)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {couponMode === 'create' ? (
                <div className="wizard-coupon-form">
                  <div className="wizard-field-row">
                    <label className="wizard-label">
                      <span>Coupon Type</span>
                      <select
                        className="wizard-input"
                        disabled={isOrgRole}
                        value={couponType}
                        onChange={(event) => setCouponType(event.target.value as CouponType)}
                      >
                        <option value="waahcoupon">Waah Coupon</option>
                        <option value="organizer">Organizer Coupon</option>
                      </select>
                    </label>
                    <label className="wizard-label">
                      <span>Coupon Code <em className="required-indicator">*</em></span>
                      <div className="referral-inline-input">
                        <input
                          className="wizard-input wizard-input-mono"
                          placeholder="AGENT-DEAL"
                          type="text"
                          value={couponCode}
                          onChange={(event) => setCouponCode(slugCode(event.target.value))}
                        />
                        <button type="button" title="Use suggested code" onClick={useSuggestedCouponCode}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </label>
                  </div>

                  {couponType === 'organizer' ? (
                    <label className="wizard-label wizard-full-width">
                      <span>Organization <em className="required-indicator">*</em></span>
                      <select className="wizard-input" value={effectiveCouponOrgId} onChange={(event) => setCouponOrgId(event.target.value)}>
                        <option value="">Select organization</option>
                        {organizations.map((org) => (
                          <option key={String(org.id ?? '')} value={String(org.id ?? '')}>
                            {String(org.name ?? org.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <div className="wizard-field-row">
                    <label className="wizard-label">
                      <span>Discount Type</span>
                      <select className="wizard-input" value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)}>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (NPR)</option>
                      </select>
                    </label>
                    {discountType === 'percentage' ? (
                      <label className="wizard-label">
                        <span>Discount % <em className="required-indicator">*</em></span>
                        <input className="wizard-input" inputMode="decimal" max={100} min={1} type="number" value={discountPercentage} onChange={(event) => setDiscountPercentage(event.target.value)} />
                      </label>
                    ) : (
                      <label className="wizard-label">
                        <span>Discount Amount (NPR) <em className="required-indicator">*</em></span>
                        <input className="wizard-input" inputMode="decimal" min={1} type="number" value={discountAmountNpr} onChange={(event) => setDiscountAmountNpr(event.target.value)} />
                      </label>
                    )}
                  </div>

                  <div className="wizard-field-row">
                    <label className="wizard-label">
                      <span>Allowed Redemptions <em className="required-indicator">*</em></span>
                      <input className="wizard-input" inputMode="numeric" min={1} type="number" value={maxRedemptions} onChange={(event) => setMaxRedemptions(event.target.value)} />
                    </label>
                    <label className="wizard-label">
                      <span>Coupon Event Scope</span>
                      <input className="wizard-input" disabled type="text" value={selectedEvent ? String(selectedEvent.name ?? selectedEvent.id) : 'All eligible events'} />
                    </label>
                  </div>

                  <label className="wizard-label wizard-full-width">
                    <span>Description</span>
                    <input className="wizard-input" placeholder="Optional coupon note" type="text" value={couponDescription} onChange={(event) => setCouponDescription(event.target.value)} />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isLoading && step === 4 ? (
            <div className="wizard-step1-layout referral-wizard-layout">
              <div className="wizard-step1-form">
                <div className="wizard-coupons-intro">
                  <Ticket size={20} />
                  <div>
                    <h3>Review</h3>
                    <p>Confirm the agent, link, and optional discount before creating the referral code.</p>
                  </div>
                </div>
                <ul className="referral-review-list">
                  <li><span>Sales agent</span><strong>{selectedPartner ? getLookupLabel(selectedPartner) : 'Not selected'}</strong></li>
                  <li><span>Referral code</span><strong>{code || 'Not set'}</strong></li>
                  <li><span>Event scope</span><strong>{selectedEvent ? String(selectedEvent.name ?? selectedEvent.id) : 'All events'}</strong></li>
                  <li>
                    <span>Coupon</span>
                    <strong>
                      {couponMode === 'none'
                        ? 'No coupon'
                        : couponMode === 'existing'
                          ? selectedCoupon ? formatCouponOption(selectedCoupon) : 'Existing coupon'
                          : `${couponCode || 'New coupon'} - ${maxRedemptions || '?'} FCFS redemption${maxRedemptions === '1' ? '' : 's'}`}
                    </strong>
                  </li>
                </ul>
                {savedLink ? <p className="wizard-coupons-empty">Created: {savedLink}</p> : null}
              </div>
              <ReferralPreview
                partner={selectedPartner}
                event={selectedEvent}
                code={code}
                link={referralLink}
                couponLabel={
                  couponMode === 'none'
                    ? ''
                    : couponMode === 'existing'
                      ? String(selectedCoupon?.public_code ?? selectedCoupon?.code ?? '')
                      : couponCode
                }
              />
            </div>
          ) : null}

          {error ? <p className="record-modal-error wizard-error">{error}</p> : null}
        </div>

        <footer className="record-modal-actions wizard-footer">
          <button disabled={isSaving} type="button" onClick={step === 1 ? onClose : handleBack}>
            {step === 1 ? 'Cancel' : <><ChevronLeft size={15} /> Back</>}
          </button>
          <div className="wizard-footer-right">
            {step < 4 ? (
              <button className="primary-admin-button" disabled={isSaving || isLoading} type="button" onClick={handleNext}>
                Next
                <ChevronRight size={15} />
              </button>
            ) : (
              <button className="primary-admin-button" disabled={isSaving || isLoading} type="button" onClick={() => void handleSave()}>
                {isSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={16} />}
                {isSaving ? 'Creating...' : 'Create Referral Link'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  )
}

function ReferralPreview({
  partner,
  event,
  code,
  link,
  couponLabel
}: {
  partner: ApiRecord | null
  event: ApiRecord | null
  code: string
  link: string
  couponLabel: string
}) {
  return (
    <div className="wizard-preview-panel referral-preview-panel">
      <p className="wizard-preview-label">Preview</p>
      <article className="referral-preview-card">
        <div className="referral-preview-icon">
          <Megaphone size={26} />
        </div>
        <p className="referral-preview-kicker">Sales Agent Link</p>
        <h3>{code || 'AGENT-CODE'}</h3>
        <p className="referral-preview-agent">{partner ? getLookupLabel(partner) : 'Select a sales agent'}</p>
        <div className="referral-preview-meta">
          <span>{event ? String(event.name ?? event.id) : 'All events'}</span>
          <span>{couponLabel ? `Coupon ${couponLabel}` : 'No automatic coupon'}</span>
        </div>
        <div className="referral-preview-url">
          <LinkIcon size={14} />
          <span>{link}</span>
        </div>
      </article>
    </div>
  )
}
