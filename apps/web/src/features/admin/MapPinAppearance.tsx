import { Music, Utensils, Star, Trophy, Laugh, Moon, Calendar } from 'lucide-react'

export interface PinConfig {
  icon: string
  color: string
}

const ICON_OPTIONS = [
  { key: 'Concert',      label: 'Concert',      Icon: Music,     color: '#e91e63' },
  { key: 'Food & Drink', label: 'Food & Drink',  Icon: Utensils,  color: '#ff9800' },
  { key: 'Festival',     label: 'Festival',      Icon: Star,      color: '#9c27b0' },
  { key: 'Sports',       label: 'Sports',         Icon: Trophy,    color: '#22c55e' },
  { key: 'Comedy',       label: 'Comedy',         Icon: Laugh,     color: '#3b82f6' },
  { key: 'Nightlife',    label: 'Nightlife',      Icon: Moon,      color: '#06b6d4' },
  { key: 'General',      label: 'General',        Icon: Calendar,  color: '#e91e63' },
]

interface MapPinAppearanceProps {
  value: PinConfig
  onChange: (cfg: PinConfig) => void
}

export function MapPinAppearance({ value, onChange }: MapPinAppearanceProps) {
  const selected = ICON_OPTIONS.find((o) => o.key === value.icon) ?? ICON_OPTIONS[0]
  const { Icon } = selected

  return (
    <div className="map-wizard-step">
      <p className="map-wizard-section-label">Choose a pin icon</p>
      <div className="map-pin-icon-grid">
        {ICON_OPTIONS.map((opt) => {
          const active = opt.key === value.icon
          return (
            <button
              key={opt.key}
              type="button"
              className={`map-pin-icon-btn${active ? ' active' : ''}`}
              style={active ? { '--btn-color': opt.color, borderColor: opt.color, background: `${opt.color}18` } as React.CSSProperties : {}}
              onClick={() => onChange({ icon: opt.key, color: opt.color })}
              title={opt.label}
            >
              <div
                className="map-pin-icon-preview"
                style={{ background: opt.color, boxShadow: `0 0 12px ${opt.color}66` }}
              >
                <opt.Icon size={14} strokeWidth={2.5} color="white" />
              </div>
              <span className="map-pin-icon-label">{opt.label}</span>
            </button>
          )
        })}
      </div>

      <p className="map-wizard-section-label" style={{ marginTop: '1.5rem' }}>Color override</p>
      <div className="map-pin-color-row">
        <input
          type="color"
          className="map-pin-color-swatch"
          value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
          title="Custom pin color"
        />
        <input
          type="text"
          className="map-wizard-coord-input"
          value={value.color}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange({ ...value, color: v })
          }}
        />
        <span className="map-wizard-hint-sm">Leave as default or pick a custom brand color</span>
      </div>

      {/* Live preview */}
      <p className="map-wizard-section-label" style={{ marginTop: '1.5rem' }}>Preview</p>
      <div className="map-pin-preview-area">
        <div className="map-pin-preview-bg">
          <div className="map-leaflet-pin" style={{ '--pin-color': value.color, position: 'relative', display: 'inline-block' } as React.CSSProperties}>
            <div className="pin-ripple pin-ripple-outer" />
            <div className="pin-ripple pin-ripple-inner" />
            <div className="pin-body">
              <Icon size={13} strokeWidth={2.5} />
            </div>
          </div>
          <span className="map-pin-preview-label">{selected.label} pin</span>
        </div>
      </div>
    </div>
  )
}
