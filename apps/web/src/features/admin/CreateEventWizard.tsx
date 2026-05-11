import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, RotateCcw,
  CalendarDays, Building2, MapPin, Clock, ChevronLeft, ChevronRight,
  Upload, X, Plus, Trash2, Save, Image, Check, Tag, Ticket
} from "lucide-react";
import type { ApiRecord, ApiListResponse, ApiMutationResponse, EventLocationDraft } from "../../shared/types";
import {
  fetchJson, getErrorMessage, formatEventDate, formatEventTime,
  toIsoDateTimeValue, toDateTimeLocalValue, isTruthyValue, eventLocationDraftToPayload
} from "../../shared/utils";
import { emptyEventLocationDraft, eventTypeLabels } from "../../shared/constants";
import { EventLocationPopup, ConfirmDialog } from "./AdminApp";

interface CouponDraft {
  localId: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_percentage: string
  discount_amount_npr: string
  max_redemptions: string
  description: string
}

function emptyDraft(): CouponDraft {
  return {
    localId: '',
    code: '',
    discount_type: 'percentage',
    discount_percentage: '',
    discount_amount_npr: '',
    max_redemptions: '',
    description: ''
  }
}

interface TicketTypeDraft {
  localId: string
  id: string
  name: string
  price_npr: string
  quantity_available: string
  max_per_order: string
  description: string
  deleted: boolean
}

function emptyTicketTypeDraft(): TicketTypeDraft {
  return {
    localId: Date.now().toString() + Math.random().toString(36).slice(2),
    id: '',
    name: '',
    price_npr: '',
    quantity_available: '',
    max_per_order: '',
    description: '',
    deleted: false
  }
}

const EVENT_TYPES = ['concert', 'theatre', 'sports', 'comedy', 'festival', 'food', 'conference', 'workshop', 'other']
const STATUSES = ['draft', 'published', 'cancelled', 'archived']

function slugify(value: string) {
  return value.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateEventWizard({
  userId,
  webRole,
  initialEvent,
  onClose,
  onSaved
}: {
  userId?: string
  webRole?: string
  initialEvent?: ApiRecord | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isOrgRole = webRole === 'Organizations'
  const isEditing = Boolean(initialEvent?.id)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1 fields
  const [name, setName] = useState(String(initialEvent?.name ?? ''))
  const [shortDesc, setShortDesc] = useState(String(initialEvent?.description ?? ''))
  const [eventType, setEventType] = useState(String(initialEvent?.event_type ?? ''))

  // Step 2 fields
  const [orgId, setOrgId] = useState(String(initialEvent?.organization_id ?? ''))
  const [slug, setSlug] = useState(String(initialEvent?.slug ?? ''))
  const [startDatetime, setStartDatetime] = useState(
    initialEvent?.start_datetime ? toDateTimeLocalValue(String(initialEvent.start_datetime)) : ''
  )
  const [endDatetime, setEndDatetime] = useState(
    initialEvent?.end_datetime ? toDateTimeLocalValue(String(initialEvent.end_datetime)) : ''
  )
  const [status, setStatus] = useState(String(initialEvent?.status ?? 'draft'))
  const [isFeatured, setIsFeatured] = useState(isTruthyValue(initialEvent?.is_featured ?? false))
  const [locationId, setLocationId] = useState('')

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [bannerId, setBannerId] = useState(String(initialEvent?.banner_file_id ?? ''))
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Rich description editor
  const editorRef = useRef<HTMLDivElement>(null)

  // Lookup data
  const [organizations, setOrganizations] = useState<ApiRecord[]>([])
  const [locations, setLocations] = useState<ApiRecord[]>([])

  // Event location popup
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState<EventLocationDraft>(emptyEventLocationDraft)
  const [pendingLocation, setPendingLocation] = useState<EventLocationDraft | null>(null)
  const [locationError, setLocationError] = useState('')
  const [isSavingLocation, setIsSavingLocation] = useState(false)

  // Ticket types
  const [ticketTypeDrafts, setTicketTypeDrafts] = useState<TicketTypeDraft[]>([emptyTicketTypeDraft()])
  const [ticketTypeError, setTicketTypeError] = useState('')
  const [confirmDeleteTT, setConfirmDeleteTT] = useState<TicketTypeDraft | null>(null)

  // Coupons
  const [coupons, setCoupons] = useState<CouponDraft[]>([])
  const [couponDraft, setCouponDraft] = useState<CouponDraft>(emptyDraft())
  const [couponError, setCouponError] = useState('')

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const slugManuallyEdited = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadLookups() {
      try {
        const [orgsRes, locsRes] = await Promise.all([
          fetchJson<ApiListResponse>('/api/organizations?limit=100'),
          fetchJson<ApiListResponse>('/api/event_locations?limit=100')
        ])
        const loadedOrgs: ApiRecord[] = orgsRes.data.data ?? []
        setOrganizations(loadedOrgs)
        setLocations(locsRes.data.data ?? [])

        // For org-role users: auto-select their organization
        if (!isEditing && isOrgRole && loadedOrgs.length > 0) {
          setOrgId(String(loadedOrgs[0].id ?? ''))
        }

        // When editing: load the event's linked location and existing ticket types
        if (isEditing && initialEvent?.id) {
          const eventId = encodeURIComponent(String(initialEvent.id))
          try {
            const [locRes, ttRes] = await Promise.all([
              fetchJson<ApiListResponse>(`/api/event_locations?event_id=${eventId}&limit=1`),
              fetchJson<ApiListResponse>(`/api/ticket_types?event_id=${eventId}&limit=100`)
            ])
            const linked = locRes.data.data?.[0]
            if (linked?.id) setLocationId(String(linked.id))
            const existingTTs: TicketTypeDraft[] = (ttRes.data.data ?? []).map((tt: ApiRecord) => ({
              localId: String(tt.id ?? ''),
              id: String(tt.id ?? ''),
              name: String(tt.name ?? ''),
              price_npr: tt.price_paisa != null ? String(Number(tt.price_paisa) / 100) : '',
              quantity_available: tt.quantity_available != null ? String(tt.quantity_available) : '',
              max_per_order: tt.max_per_order != null ? String(tt.max_per_order) : '',
              description: String(tt.description ?? ''),
              deleted: false
            }))
            if (existingTTs.length > 0) setTicketTypeDrafts(existingTTs)
          } catch {
            // non-fatal
          }
        }
      } catch {
        // non-fatal
      }
    }
    void loadLookups()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pre-fill rich description editor when editing
  useEffect(() => {
    if (isEditing && editorRef.current && shortDesc) {
      editorRef.current.innerHTML = shortDesc
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Revoke preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManuallyEdited.current) {
      setSlug(slugify(value))
    }
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setBannerId('')
  }

  async function uploadImage(): Promise<string> {
    if (!imageFile) return bannerId
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('file_type', 'event_banner')
      const { data } = await fetchJson<ApiMutationResponse>('/api/files/upload', {
        method: 'POST',
        body: formData
      })
      const id = String(data.data?.id ?? '')
      setBannerId(id)
      return id
    } finally {
      setIsUploading(false)
    }
  }

  function execRichFormat(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  function validateStep1(): string {
    if (!name.trim()) return 'Event name is required.'
    return ''
  }

  function validateStep2(): string {
    if (!orgId) return 'Organization is required.'
    if (!slug.trim()) return 'Slug is required.'
    if (!startDatetime) return 'Start date & time is required.'
    if (!endDatetime) return 'End date & time is required.'
    return ''
  }

  async function handleNext() {
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setError('')
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
      setError('')
      setStep(3)
    } else if (step === 3) {
      setError('')
      setStep(4)
    }
  }

  function handleBack() {
    setError('')
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) setStep(3)
  }

  async function handleSave() {
    const step2Err = validateStep2()
    if (step2Err) { setError(step2Err); return }

    setIsSaving(true)
    setError('')
    try {
      let finalBannerId = bannerId
      if (imageFile && !bannerId) {
        finalBannerId = await uploadImage()
      }

      const richContent = editorRef.current?.innerHTML?.trim() ?? ''
      const description = richContent || shortDesc.trim()

      const eventBody: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim(),
        organization_id: orgId,
        start_datetime: toIsoDateTimeValue(startDatetime),
        end_datetime: toIsoDateTimeValue(endDatetime),
        status,
        is_featured: isFeatured ? 1 : 0
      }
      if (description) eventBody.description = description
      if (eventType) eventBody.event_type = eventType
      if (finalBannerId) eventBody.banner_file_id = finalBannerId

      const existingId = isEditing ? String(initialEvent?.id ?? '') : ''
      const url = existingId ? `/api/events/${existingId}` : '/api/events'
      const method = existingId ? 'PATCH' : 'POST'
      const { data } = await fetchJson<ApiMutationResponse>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody)
      })

      const eventId = existingId || String(data.data?.id ?? '')
      if (!eventId) throw new Error('No event ID returned from server.')

      let finalLocationId = locationId
      if (locationId) {
        await fetchJson<ApiMutationResponse>(`/api/event_locations/${locationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId })
        })
      } else if (pendingLocation) {
        const locData = await fetchJson<ApiMutationResponse>('/api/event_locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...eventLocationDraftToPayload(pendingLocation), event_id: eventId })
        })
        finalLocationId = String(locData.data?.data?.id ?? '')
      }

      // Save ticket types
      for (const tt of ticketTypeDrafts) {
        if (!tt.name.trim() && !tt.id) continue // skip blank new rows
        if (tt.deleted && tt.id) {
          await fetchJson<ApiMutationResponse>(`/api/ticket_types/${tt.id}`, { method: 'DELETE' })
          continue
        }
        if (tt.deleted) continue
        const ttBody: Record<string, unknown> = {
          event_id: eventId,
          name: tt.name.trim() || 'General Admission',
          price_paisa: Math.round(Number(tt.price_npr || 0) * 100)
        }
        if (finalLocationId) ttBody.event_location_id = finalLocationId
        if (tt.quantity_available) ttBody.quantity_available = Number(tt.quantity_available)
        if (tt.max_per_order) ttBody.max_per_order = Number(tt.max_per_order)
        if (tt.description.trim()) ttBody.description = tt.description.trim()
        if (tt.id) {
          await fetchJson<ApiMutationResponse>(`/api/ticket_types/${tt.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ttBody)
          })
        } else {
          await fetchJson<ApiMutationResponse>('/api/ticket_types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ttBody)
          })
        }
      }

      for (const coupon of coupons) {
        const couponBody: Record<string, unknown> = {
          event_id: eventId,
          code: coupon.code.trim().toUpperCase(),
          discount_type: coupon.discount_type,
          is_active: 1
        }
        if (coupon.discount_type === 'percentage' && coupon.discount_percentage) {
          couponBody.discount_percentage = Number(coupon.discount_percentage)
        }
        if (coupon.discount_type === 'fixed' && coupon.discount_amount_npr) {
          couponBody.discount_amount_paisa = Math.round(Number(coupon.discount_amount_npr) * 100)
        }
        if (coupon.max_redemptions) couponBody.max_redemptions = Number(coupon.max_redemptions)
        if (coupon.description.trim()) couponBody.description = coupon.description.trim()
        await fetchJson<ApiMutationResponse>('/api/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(couponBody)
        })
      }

      await onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  function addCoupon() {
    if (!couponDraft.code.trim()) { setCouponError('Coupon code is required.'); return }
    setCouponError('')
    setCoupons(prev => [...prev, { ...couponDraft, localId: Date.now().toString() }])
    setCouponDraft(emptyDraft())
  }

  async function saveLocationFromPopup() {
    const name = locationDraft.name.trim()
    if (!name) { setLocationError('Location name is required.'); return }
    setIsSavingLocation(true)
    setLocationError('')
    try {
      const { data } = await fetchJson<ApiMutationResponse>('/api/event_locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventLocationDraftToPayload({ ...locationDraft, name }))
      })
      const created = data.data ?? null
      const createdId = String(created?.id ?? '')
      if (created) setLocations(prev => [...prev, created])
      if (createdId) setLocationId(createdId)
      setPendingLocation(null)
      setIsLocationPopupOpen(false)
    } catch (err) {
      setLocationError(getErrorMessage(err))
    } finally {
      setIsSavingLocation(false)
    }
  }

  // Build preview card data from current form state
  const selectedOrg = organizations.find(o => String(o.id) === orgId)
  const selectedLocation = locations.find(l => String(l.id) === locationId)

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="record-modal event-wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        {/* Header */}
        <header className="record-modal-header wizard-header">
          <div>
            <p className="admin-breadcrumb">Events</p>
            <h2 id="wizard-title">{isEditing ? 'Edit Event' : 'Create New Event'}</h2>
          </div>
          <div className="wizard-step-indicators">
            {([1, 2, 3, 4] as const).map((s) => (
              <div
                key={s}
                className={`wizard-step-dot ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`}
              >
                {step > s ? <Check size={11} /> : s}
              </div>
            ))}
          </div>
          <button aria-label="Close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {/* Step bar */}
        <div className="wizard-step-bar">
          {['Event Details', 'Schedule & Venue', 'Ticket Types', 'Coupons'].map((label, i) => (
            <div key={label} className={`wizard-step-item ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
              <span className="wizard-step-number">{i + 1}</span>
              <span className="wizard-step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="record-modal-body wizard-body">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="wizard-step1-layout">
              <div className="wizard-step1-form">
                <div className="wizard-field-row">
                  <label className="wizard-label">
                    <span>Event Name <em className="required-indicator">*</em></span>
                    <input
                      className="wizard-input"
                      placeholder="e.g. Sunset Dinner Party"
                      type="text"
                      value={name}
                      onChange={e => handleNameChange(e.target.value)}
                    />
                  </label>
                  <label className="wizard-label">
                    <span>
                      Short Description <em className="required-indicator">*</em>
                      <small className="char-counter">{shortDesc.length} / 150</small>
                    </span>
                    <textarea
                      className="wizard-input wizard-textarea"
                      maxLength={150}
                      placeholder="A short summary about your event"
                      rows={3}
                      value={shortDesc}
                      onChange={e => setShortDesc(e.target.value)}
                    />
                  </label>
                </div>

                <div className="wizard-field-row">
                  <label className="wizard-label">
                    <span>Category</span>
                    <select
                      className="wizard-input"
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
                    >
                      <option value="">Select a category</option>
                      {EVENT_TYPES.map(t => (
                        <option key={t} value={t}>{eventTypeLabels[t] ?? t}</option>
                      ))}
                    </select>
                  </label>

                  <div className="wizard-label">
                    <span>Event Image</span>
                    <div
                      className={`wizard-dropzone ${isDragOver ? 'drag-over' : ''} ${imagePreviewUrl ? 'has-image' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={e => {
                        e.preventDefault()
                        setIsDragOver(false)
                        const file = e.dataTransfer.files[0]
                        if (file) handleImageFile(file)
                      }}
                    >
                      {imagePreviewUrl ? (
                        <>
                          <img alt="Event banner preview" className="dropzone-preview-img" src={imagePreviewUrl} />
                          <button
                            aria-label="Remove image"
                            className="dropzone-remove-btn"
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              URL.revokeObjectURL(imagePreviewUrl)
                              setImagePreviewUrl('')
                              setImageFile(null)
                              setBannerId('')
                            }}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <Image size={28} className="dropzone-icon" />
                          <p className="dropzone-label">Upload Image</p>
                          <p className="dropzone-hint">PNG, JPG up to 5MB</p>
                        </>
                      )}
                    </div>
                    <input
                      accept="image/*"
                      className="sr-only"
                      ref={fileInputRef}
                      type="file"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleImageFile(file)
                      }}
                    />
                  </div>
                </div>

                <label className="wizard-label wizard-full-width">
                  <span>Description</span>
                  <div className="rich-editor-wrap">
                    <div className="rich-editor-toolbar">
                      <button type="button" title="Bold" onMouseDown={e => { e.preventDefault(); execRichFormat('bold') }}><Bold size={14} /></button>
                      <button type="button" title="Italic" onMouseDown={e => { e.preventDefault(); execRichFormat('italic') }}><Italic size={14} /></button>
                      <button type="button" title="Underline" onMouseDown={e => { e.preventDefault(); execRichFormat('underline') }}><Underline size={14} /></button>
                      <span className="rich-toolbar-sep" />
                      <button type="button" title="Bullet list" onMouseDown={e => { e.preventDefault(); execRichFormat('insertUnorderedList') }}><List size={14} /></button>
                      <button type="button" title="Numbered list" onMouseDown={e => { e.preventDefault(); execRichFormat('insertOrderedList') }}><ListOrdered size={14} /></button>
                      <span className="rich-toolbar-sep" />
                      <button
                        type="button"
                        title="Insert link"
                        onMouseDown={e => {
                          e.preventDefault()
                          const url = prompt('Enter URL')
                          if (url) execRichFormat('createLink', url)
                        }}
                      >
                        <LinkIcon size={14} />
                      </button>
                      <button type="button" title="Remove formatting" onMouseDown={e => { e.preventDefault(); execRichFormat('removeFormat') }}><RotateCcw size={14} /></button>
                    </div>
                    <div
                      className="rich-editor-body"
                      contentEditable
                      data-placeholder="Tell people more about your event..."
                      ref={editorRef}
                      role="textbox"
                      aria-multiline="true"
                      suppressContentEditableWarning
                    />
                  </div>
                </label>
              </div>

              {/* Live preview card */}
              <div className="wizard-preview-panel">
                <p className="wizard-preview-label">Preview</p>
                <EventCardPreview
                  name={name}
                  shortDesc={shortDesc}
                  eventType={eventType}
                  imageUrl={imagePreviewUrl}
                  startDatetime={startDatetime}
                  orgName={String(selectedOrg?.name ?? '')}
                  locationName={String(selectedLocation?.name ?? pendingLocation?.name ?? '')}
                  locationAddress={String(selectedLocation?.address ?? pendingLocation?.address ?? '')}
                />
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="modal-form-grid wizard-step2-grid">
              <label className="wizard-label">
                <span>Organization <em className="required-indicator">*</em></span>
                {isOrgRole ? (
                  <input
                    className="wizard-input"
                    disabled
                    type="text"
                    value={String(organizations.find(o => String(o.id) === orgId)?.name ?? orgId)}
                  />
                ) : (
                  <select
                    className="wizard-input"
                    value={orgId}
                    onChange={e => setOrgId(e.target.value)}
                  >
                    <option value="">Select organization</option>
                    {organizations.map(o => (
                      <option key={String(o.id)} value={String(o.id)}>
                        {String(o.name ?? o.id)}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="wizard-label">
                <span>Slug <em className="required-indicator">*</em></span>
                <input
                  className="wizard-input"
                  placeholder="event-slug"
                  type="text"
                  value={slug}
                  onChange={e => {
                    slugManuallyEdited.current = true
                    setSlug(e.target.value)
                  }}
                />
              </label>

              <label className="wizard-label">
                <span>Start Date & Time <em className="required-indicator">*</em></span>
                <input
                  className="wizard-input"
                  step={60}
                  type="datetime-local"
                  value={startDatetime}
                  onChange={e => setStartDatetime(e.target.value)}
                />
              </label>

              <label className="wizard-label">
                <span>End Date & Time <em className="required-indicator">*</em></span>
                <input
                  className="wizard-input"
                  step={60}
                  type="datetime-local"
                  value={endDatetime}
                  onChange={e => setEndDatetime(e.target.value)}
                />
              </label>

              <label className="wizard-label">
                <span>Status <em className="required-indicator">*</em></span>
                <select
                  className="wizard-input"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </label>

              <label className="wizard-label">
                <span>Featured</span>
                <button
                  className={isFeatured ? 'boolean-toggle active' : 'boolean-toggle'}
                  type="button"
                  onClick={() => setIsFeatured(v => !v)}
                >
                  {isFeatured ? 'Yes' : 'No'}
                </button>
              </label>

              <div className="wizard-label" style={{ gridColumn: '1 / -1' }}>
                <span>Venue / Location</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    className="wizard-input"
                    style={{ flex: '1 1 200px' }}
                    value={locationId}
                    onChange={e => {
                      setLocationId(e.target.value)
                      if (e.target.value) setPendingLocation(null)
                    }}
                  >
                    <option value="">No location yet</option>
                    {locations.map(l => (
                      <option key={String(l.id)} value={String(l.id)}>
                        {String(l.name ?? l.id)}
                        {l.address ? ` — ${String(l.address)}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    className="inline-action-btn"
                    type="button"
                    onClick={() => {
                      setLocationDraft(emptyEventLocationDraft)
                      setLocationError('')
                      setIsLocationPopupOpen(true)
                    }}
                  >
                    <Plus size={14} />
                    Create new
                  </button>
                  {pendingLocation ? (
                    <span className="pending-location-tag">
                      <MapPin size={13} />
                      {pendingLocation.name}
                      <button
                        aria-label="Remove pending location"
                        type="button"
                        onClick={() => setPendingLocation(null)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Ticket Types ── */}
          {step === 3 && (
            <div className="wizard-step3-layout">
              <div className="wizard-coupons-intro">
                <Ticket size={20} />
                <div>
                  <h3>Ticket Types</h3>
                  <p>Define the tickets available for this event. You can add multiple types with different prices and limits.</p>
                </div>
              </div>

              <div className="wizard-ticket-types">
                {ticketTypeDrafts.filter(tt => !tt.deleted).map((tt) => (
                  <div key={tt.localId} className="wizard-ticket-row">
                    <div className="wizard-field-row">
                      <label className="wizard-label">
                        <span>Name <em className="required-indicator">*</em></span>
                        <input
                          className="wizard-input"
                          placeholder="e.g. General Admission"
                          type="text"
                          value={tt.name}
                          onChange={e => setTicketTypeDrafts(prev => prev.map(d => d.localId === tt.localId ? { ...d, name: e.target.value } : d))}
                        />
                      </label>
                      <label className="wizard-label">
                        <span>Price (NPR) <em className="required-indicator">*</em></span>
                        <input
                          className="wizard-input"
                          inputMode="decimal"
                          min={0}
                          placeholder="500"
                          type="number"
                          value={tt.price_npr}
                          onChange={e => setTicketTypeDrafts(prev => prev.map(d => d.localId === tt.localId ? { ...d, price_npr: e.target.value } : d))}
                        />
                      </label>
                    </div>
                    <div className="wizard-field-row">
                      <label className="wizard-label">
                        <span>Quantity Available</span>
                        <input
                          className="wizard-input"
                          inputMode="numeric"
                          min={1}
                          placeholder="Unlimited"
                          type="number"
                          value={tt.quantity_available}
                          onChange={e => setTicketTypeDrafts(prev => prev.map(d => d.localId === tt.localId ? { ...d, quantity_available: e.target.value } : d))}
                        />
                      </label>
                      <label className="wizard-label">
                        <span>Max Per Order</span>
                        <input
                          className="wizard-input"
                          inputMode="numeric"
                          min={1}
                          placeholder="No limit"
                          type="number"
                          value={tt.max_per_order}
                          onChange={e => setTicketTypeDrafts(prev => prev.map(d => d.localId === tt.localId ? { ...d, max_per_order: e.target.value } : d))}
                        />
                      </label>
                    </div>
                    <div className="wizard-ticket-row-footer">
                      <label className="wizard-label wizard-full-width">
                        <span>Description (optional)</span>
                        <input
                          className="wizard-input"
                          placeholder="VIP access, front row seats, etc."
                          type="text"
                          value={tt.description}
                          onChange={e => setTicketTypeDrafts(prev => prev.map(d => d.localId === tt.localId ? { ...d, description: e.target.value } : d))}
                        />
                      </label>
                      {ticketTypeDrafts.filter(d => !d.deleted).length > 1 ? (
                        <button
                          aria-label="Remove ticket type"
                          className="coupon-remove-btn tt-remove-btn"
                          type="button"
                          onClick={() => setConfirmDeleteTT(tt)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {ticketTypeError ? <p className="record-modal-error">{ticketTypeError}</p> : null}

              <button
                className="primary-admin-button wizard-add-coupon-btn"
                type="button"
                onClick={() => { setTicketTypeError(''); setTicketTypeDrafts(prev => [...prev, emptyTicketTypeDraft()]) }}
              >
                <Plus size={16} />
                Add Ticket Type
              </button>
            </div>
          )}

          {/* ── Step 4: Coupons ── */}
          {step === 4 && (
            <div className="wizard-step3-layout">
              <div className="wizard-coupons-intro">
                <Tag size={20} />
                <div>
                  <h3>Add Discount Coupons</h3>
                  <p>Optionally create coupon codes for this event. You can skip this step and add them later.</p>
                </div>
              </div>

              <div className="wizard-coupon-form">
                <div className="wizard-field-row">
                  <label className="wizard-label">
                    <span>Coupon Code <em className="required-indicator">*</em></span>
                    <input
                      className="wizard-input wizard-input-mono"
                      placeholder="e.g. EARLY20"
                      type="text"
                      value={couponDraft.code}
                      onChange={e => setCouponDraft(d => ({ ...d, code: e.target.value.toUpperCase() }))}
                    />
                  </label>
                  <label className="wizard-label">
                    <span>Discount Type</span>
                    <select
                      className="wizard-input"
                      value={couponDraft.discount_type}
                      onChange={e => setCouponDraft(d => ({ ...d, discount_type: e.target.value as 'percentage' | 'fixed' }))}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (NPR)</option>
                    </select>
                  </label>
                </div>

                <div className="wizard-field-row">
                  {couponDraft.discount_type === 'percentage' ? (
                    <label className="wizard-label">
                      <span>Discount %</span>
                      <input
                        className="wizard-input"
                        inputMode="decimal"
                        max={100}
                        min={0}
                        placeholder="10"
                        type="number"
                        value={couponDraft.discount_percentage}
                        onChange={e => setCouponDraft(d => ({ ...d, discount_percentage: e.target.value }))}
                      />
                    </label>
                  ) : (
                    <label className="wizard-label">
                      <span>Discount Amount (NPR)</span>
                      <input
                        className="wizard-input"
                        inputMode="decimal"
                        min={0}
                        placeholder="500"
                        type="number"
                        value={couponDraft.discount_amount_npr}
                        onChange={e => setCouponDraft(d => ({ ...d, discount_amount_npr: e.target.value }))}
                      />
                    </label>
                  )}

                  <label className="wizard-label">
                    <span>Max Redemptions</span>
                    <input
                      className="wizard-input"
                      inputMode="numeric"
                      min={1}
                      placeholder="Unlimited"
                      type="number"
                      value={couponDraft.max_redemptions}
                      onChange={e => setCouponDraft(d => ({ ...d, max_redemptions: e.target.value }))}
                    />
                  </label>
                </div>

                <label className="wizard-label wizard-full-width">
                  <span>Description (optional)</span>
                  <input
                    className="wizard-input"
                    placeholder="Early bird discount"
                    type="text"
                    value={couponDraft.description}
                    onChange={e => setCouponDraft(d => ({ ...d, description: e.target.value }))}
                  />
                </label>

                {couponError ? <p className="record-modal-error">{couponError}</p> : null}

                <button className="primary-admin-button wizard-add-coupon-btn" type="button" onClick={addCoupon}>
                  <Plus size={16} />
                  Add Coupon
                </button>
              </div>

              {coupons.length > 0 ? (
                <ul className="wizard-coupon-list">
                  {coupons.map(c => (
                    <li key={c.localId} className="wizard-coupon-item">
                      <span className="coupon-code-badge">{c.code}</span>
                      <span className="coupon-detail">
                        {c.discount_type === 'percentage'
                          ? `${c.discount_percentage || '?'}% off`
                          : `NPR ${c.discount_amount_npr || '?'} off`}
                      </span>
                      {c.max_redemptions ? (
                        <span className="coupon-detail">max {c.max_redemptions} uses</span>
                      ) : null}
                      {c.description ? <span className="coupon-detail coupon-desc">{c.description}</span> : null}
                      <button
                        aria-label={`Remove coupon ${c.code}`}
                        className="coupon-remove-btn"
                        type="button"
                        onClick={() => setCoupons(prev => prev.filter(x => x.localId !== c.localId))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="wizard-coupons-empty">No coupons added yet. You can skip this step.</p>
              )}
            </div>
          )}

          {error ? <p className="record-modal-error wizard-error">{error}</p> : null}
        </div>

        {/* Footer */}
        <footer className="record-modal-actions wizard-footer">
          <button disabled={isSaving} type="button" onClick={step === 1 ? onClose : handleBack}>
            {step === 1 ? 'Cancel' : <><ChevronLeft size={15} /> Back</>}
          </button>

          <div className="wizard-footer-right">
            {step < 4 ? (
              <>
                {step === 3 ? (
                  <button
                    disabled={isSaving}
                    type="button"
                    onClick={() => void handleSave()}
                  >
                    {isSaving ? <span aria-hidden="true" className="button-spinner" /> : null}
                    {isSaving ? 'Saving...' : 'Skip & Save'}
                  </button>
                ) : null}
                <button
                  className="primary-admin-button"
                  disabled={isSaving || isUploading}
                  type="button"
                  onClick={() => void handleNext()}
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={isSaving}
                  type="button"
                  onClick={() => void handleSave()}
                >
                  {isSaving ? <span aria-hidden="true" className="button-spinner" /> : null}
                  {isSaving ? 'Saving...' : 'Skip & Save'}
                </button>
                <button
                  className="primary-admin-button"
                  disabled={isSaving || coupons.length === 0}
                  type="button"
                  onClick={() => void handleSave()}
                >
                  {isSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : `Save with ${coupons.length} coupon${coupons.length !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </footer>
      </section>

      {confirmDeleteTT ? (
        <ConfirmDialog
          message={`Remove "${confirmDeleteTT.name || 'this ticket type'}"? This cannot be undone after saving.`}
          confirmLabel="Remove"
          isDanger
          onConfirm={() => {
            const id = confirmDeleteTT.localId
            setTicketTypeDrafts(prev => prev.map(d => d.localId === id ? { ...d, deleted: true } : d))
            setConfirmDeleteTT(null)
          }}
          onCancel={() => setConfirmDeleteTT(null)}
        />
      ) : null}

      {isLocationPopupOpen ? (
        <EventLocationPopup
          draft={locationDraft}
          errorMessage={locationError}
          isSaving={isSavingLocation}
          mode="create"
          onChange={setLocationDraft as Dispatch<SetStateAction<EventLocationDraft>>}
          onClose={() => setIsLocationPopupOpen(false)}
          onSave={() => void saveLocationFromPopup()}
        />
      ) : null}
    </div>
  )
}


function EventCardPreview({
  name,
  shortDesc,
  eventType,
  imageUrl,
  startDatetime,
  orgName,
  locationName,
  locationAddress
}: {
  name: string
  shortDesc: string
  eventType: string
  imageUrl: string
  startDatetime: string
  orgName: string
  locationName: string
  locationAddress: string
}) {
  const displayName = name.trim() || 'Event Name'
  const displayOrg = orgName || 'Organization'
  const displayLocation = locationAddress || locationName || 'Location TBA'
  const displayVenue = locationName || orgName || 'Venue TBA'
  const displayDate = startDatetime ? formatEventDate(toIsoDateTimeValue(startDatetime)) : 'Date TBA'
  const displayTime = startDatetime ? formatEventTime(toIsoDateTimeValue(startDatetime)) : 'Time TBA'
  const displayType = eventTypeLabels[eventType] ?? eventType

  return (
    <article className="preview-event-card">
      <div className="preview-card-media">
        {imageUrl ? (
          <img alt="Event preview" className="preview-card-image" src={imageUrl} />
        ) : (
          <div className="preview-card-placeholder">
            <Image size={32} />
            <span>Event Image</span>
          </div>
        )}
        <span className="preview-date-badge">
          <CalendarDays size={13} />
          {displayDate}
        </span>
        {displayType ? (
          <span className="preview-type-badge">{displayType}</span>
        ) : null}
      </div>
      <div className="preview-card-content">
        <h3 className="preview-card-name">{displayName}</h3>
        {shortDesc ? <p className="preview-card-desc">{shortDesc}</p> : null}
        <p className="preview-card-meta"><Building2 size={13} /> {displayOrg}</p>
        <p className="preview-card-meta"><MapPin size={13} /> {displayVenue}</p>
        <p className="preview-card-meta"><Clock size={13} /> {displayTime}</p>
        <p className="preview-card-meta preview-card-address" title={displayLocation}>
          <MapPin size={13} /> {displayLocation}
        </p>
        <div className="preview-card-footer">
          <strong>Price announced soon</strong>
          <span className="preview-view-btn">View Tickets</span>
        </div>
      </div>
    </article>
  )
}
