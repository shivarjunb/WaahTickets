import { ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import type { PopupField } from '../public/NepalMap'
import { EventMapPopup } from '../public/EventMapPopup'

export const DEFAULT_POPUP_FIELDS: PopupField[] = [
  { field: 'area',     label: 'Where',    visible: true },
  { field: 'time',     label: 'When',     visible: true },
  { field: 'price',    label: 'From',     visible: true },
  { field: 'category', label: 'Category', visible: false },
]

interface MapPopupCustomizerProps {
  fields: PopupField[]
  eventTitle: string
  categoryColor: string
  onChange: (fields: PopupField[]) => void
}

export function MapPopupCustomizer({ fields, eventTitle, categoryColor, onChange }: MapPopupCustomizerProps) {
  function toggle(index: number) {
    const next = fields.map((f, i) => i === index ? { ...f, visible: !f.visible } : f)
    onChange(next)
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...fields]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === fields.length - 1) return
    const next = [...fields]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  function setLabel(index: number, label: string) {
    onChange(fields.map((f, i) => i === index ? { ...f, label } : f))
  }

  // Build preview values
  const previewValues: Record<string, string> = {
    area: 'Thamel, Kathmandu',
    time: 'Tonight, 8:00 PM',
    price: 'Rs. 1,000',
    category: 'Concert',
  }

  return (
    <div className="map-wizard-step map-popup-customizer">
      <div className="map-popup-customizer-layout">
        {/* Field editor */}
        <div className="map-popup-field-list">
          <p className="map-wizard-section-label">Popup fields — toggle, reorder, rename</p>
          {fields.map((field, i) => (
            <div key={field.field} className={`map-popup-field-row${field.visible ? '' : ' field-hidden'}`}>
              <div className="map-popup-field-reorder">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="map-popup-reorder-btn" aria-label="Move up">
                  <ChevronUp size={13} />
                </button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === fields.length - 1} className="map-popup-reorder-btn" aria-label="Move down">
                  <ChevronDown size={13} />
                </button>
              </div>
              <input
                className="map-popup-field-label-input"
                value={field.label}
                onChange={(e) => setLabel(i, e.target.value)}
                placeholder="Label"
              />
              <span className="map-popup-field-key">{field.field}</span>
              <button
                type="button"
                className={`map-popup-toggle-btn${field.visible ? ' active' : ''}`}
                onClick={() => toggle(i)}
                aria-label={field.visible ? 'Hide field' : 'Show field'}
                title={field.visible ? 'Visible' : 'Hidden'}
              >
                {field.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="map-popup-preview-panel">
          <p className="map-wizard-section-label">Live preview</p>
          <div className="map-popup-preview-card-wrap">
            <EventMapPopup
              title={eventTitle || 'Your Event Name'}
              category="Concert"
              area={previewValues.area}
              time={previewValues.time}
              priceFrom={previewValues.price}
              sponsored={false}
              eventId="preview"
              categoryColor={categoryColor}
              popupConfig={fields}
              onViewDetails={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
