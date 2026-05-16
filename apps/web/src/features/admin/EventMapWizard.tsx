import { useState } from 'react'
import { Check, MapPin, Palette, LayoutList, Eye, Trash2, X } from 'lucide-react'
import '../public/heroMapStyles.css'
import { MapLocationPicker } from './MapLocationPicker'
import { MapPinAppearance, DEFAULT_POPUP_FIELDS as _unused } from './MapPinAppearance'
import type { PinConfig } from './MapPinAppearance'
import { MapPopupCustomizer, DEFAULT_POPUP_FIELDS } from './MapPopupCustomizer'
import { MapWizardPreview } from './MapWizardPreview'
import type { PopupField } from '../public/KathmanduMap'
import { fetchJson } from '../../shared/utils'
import type { ApiRecord } from '../../shared/types'

const STEPS = [
  { label: 'Location',  Icon: MapPin },
  { label: 'Pin Style', Icon: Palette },
  { label: 'Popup',     Icon: LayoutList },
  { label: 'Preview',   Icon: Eye },
]

interface EventMapWizardProps {
  event: ApiRecord
  onClose: () => void
  onSaved: () => void
}

export function EventMapWizard({ event, onClose, onSaved }: EventMapWizardProps) {
  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState('')

  // Step 1 state
  const [lat, setLat] = useState<number | null>(
    typeof event.location_lat === 'number' ? event.location_lat : null
  )
  const [lng, setLng] = useState<number | null>(
    typeof event.location_lng === 'number' ? event.location_lng : null
  )

  // Step 2 state
  const [pinConfig, setPinConfig] = useState<PinConfig>({
    icon: String(event.map_pin_icon ?? event.event_type ?? 'General'),
    color: '#e91e63',
  })

  // Step 3 state
  const [popupFields, setPopupFields] = useState<PopupField[]>(() => {
    if (event.map_popup_config) {
      try { return JSON.parse(String(event.map_popup_config)) } catch { /* ignore */ }
    }
    return DEFAULT_POPUP_FIELDS
  })

  async function handleSave() {
    if (lat == null || lng == null) { setError('Please set a location before saving.'); return }
    setIsSaving(true)
    setError('')
    try {
      await fetchJson(`/api/events/${event.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          location_lat: lat,
          location_lng: lng,
          map_pin_icon: pinConfig.icon,
          map_popup_config: JSON.stringify(popupFields),
        }),
      })
      onSaved()
    } catch (e) {
      setError('Save failed — please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClear() {
    setIsClearing(true)
    setError('')
    try {
      await fetchJson(`/api/events/${event.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          location_lat: null,
          location_lng: null,
          map_pin_icon: null,
          map_popup_config: null,
        }),
      })
      onSaved()
    } catch {
      setError('Clear failed — please try again.')
    } finally {
      setIsClearing(false)
    }
  }

  const eventArea = String(event.location_name ?? event.location_address ?? '')
  const eventTime = String(event.start_datetime ?? '')
  const eventPrice = typeof event.starting_price_paisa === 'number'
    ? (event.starting_price_paisa === 0 ? 'Free Entry' : `Rs. ${Math.round(event.starting_price_paisa / 100)}`)
    : ''

  return (
    <div className="map-wizard-overlay" role="dialog" aria-modal="true" aria-label="Map Setup">
      <div className="map-wizard-modal">
        {/* Header */}
        <div className="map-wizard-header">
          <div>
            <h2 className="map-wizard-title">Map Setup</h2>
            <p className="map-wizard-subtitle">{String(event.name ?? 'Event')}</p>
          </div>
          <button type="button" className="map-wizard-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="map-wizard-steps">
          {STEPS.map(({ label, Icon }, i) => {
            const s = i + 1
            const done = step > s
            const active = step === s
            return (
              <div key={label} className={`map-wizard-step-item${active ? ' active' : ''}${done ? ' done' : ''}`}>
                <div className="map-wizard-step-dot">
                  {done ? <Check size={11} /> : <Icon size={13} />}
                </div>
                <span className="map-wizard-step-label">{label}</span>
                {i < STEPS.length - 1 && <div className="map-wizard-step-connector" />}
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="map-wizard-body">
          {step === 1 && (
            <MapLocationPicker
              lat={lat}
              lng={lng}
              eventAddress={eventArea}
              onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng) }}
            />
          )}
          {step === 2 && (
            <MapPinAppearance value={pinConfig} onChange={setPinConfig} />
          )}
          {step === 3 && (
            <MapPopupCustomizer
              fields={popupFields}
              eventTitle={String(event.name ?? '')}
              categoryColor={pinConfig.color}
              onChange={setPopupFields}
            />
          )}
          {step === 4 && (
            <MapWizardPreview
              lat={lat}
              lng={lng}
              pinConfig={pinConfig}
              popupFields={popupFields}
              eventTitle={String(event.name ?? '')}
              eventArea={eventArea}
              eventTime={eventTime}
              eventPrice={eventPrice}
            />
          )}
        </div>

        {error && <p className="map-wizard-error map-wizard-error--footer">{error}</p>}

        {/* Footer */}
        <div className="map-wizard-footer">
          <div className="map-wizard-footer-left">
            {(lat != null || lng != null) && (
              <button
                type="button"
                className="map-wizard-btn map-wizard-btn--danger"
                disabled={isClearing}
                onClick={handleClear}
              >
                <Trash2 size={14} />
                {isClearing ? 'Clearing…' : 'Clear Map Setup'}
              </button>
            )}
          </div>
          <div className="map-wizard-footer-right">
            {step > 1 && (
              <button type="button" className="map-wizard-btn map-wizard-btn--secondary" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}>
                ← Back
              </button>
            )}
            {step < 4 ? (
              <button type="button" className="map-wizard-btn map-wizard-btn--primary" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}>
                Next →
              </button>
            ) : (
              <button
                type="button"
                className="map-wizard-btn map-wizard-btn--primary"
                disabled={isSaving || lat == null}
                onClick={handleSave}
              >
                <Check size={14} />
                {isSaving ? 'Saving…' : 'Save Map Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
