import { MapPin, Calendar, Navigation } from 'lucide-react'
import type { PopupField } from './KathmanduMap'

interface EventMapPopupProps {
  title: string
  category: string
  area: string
  time: string
  priceFrom: string
  sponsored: boolean
  eventId: string
  categoryColor: string
  popupConfig?: PopupField[]
  distance?: number
  bearing?: string
  imageUrl?: string
  below?: boolean
  onViewDetails: (eventId: string) => void
  onDirections?: () => void
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export function EventMapPopup({
  title, category, area, time, priceFrom, sponsored,
  eventId, categoryColor, distance, bearing, imageUrl,
  below, onViewDetails, onDirections,
}: EventMapPopupProps) {
  const isLive = time.toLowerCase().includes('tonight')

  return (
    <div className={`event-pin-card${below ? ' event-pin-card--below' : ''}`}>
      {/* Arrow tail pointing toward the pin */}
      <div className="event-pin-card-tail" />

      {/* Image header — shown only when banner is available */}
      {imageUrl && (
        <div
          className="event-pin-card-image-bar"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}

      {/* Badge row */}
      <div className="event-pin-card-badges">
        <span className="event-pin-badge-category" style={{ color: categoryColor, borderColor: categoryColor }}>
          {category}
        </span>
        {sponsored && (
          <span className="event-pin-badge-sponsored">
            ★ Sponsored
          </span>
        )}
        {isLive && (
          <span className="event-pin-badge-live">● LIVE</span>
        )}
      </div>

      {/* Body */}
      <div className="event-pin-card-body">
        <h3 className="event-pin-card-title">{title}</h3>

        <div className="event-pin-card-row">
          <MapPin size={11} style={{ color: categoryColor }} />
          <span>{area}</span>
        </div>

        <div className="event-pin-card-row">
          <Calendar size={11} style={{ color: categoryColor }} />
          <span>{time}</span>
        </div>

        {/* Price + distance inline */}
        <div className="event-pin-card-price-row">
          <Navigation size={10} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span className="event-pin-card-price-value">{priceFrom}</span>
          {distance != null && (
            <>
              <span className="event-pin-card-dot" />
              <span>{formatDistance(distance)} away</span>
            </>
          )}
          {bearing && <span className="event-pin-card-bearing">{bearing}</span>}
        </div>

        {/* Action buttons */}
        <div className="event-pin-card-actions">
          <button
            className="event-pin-btn-primary"
            type="button"
            onClick={() => onViewDetails(eventId)}
          >
            View Details
          </button>
          <button
            className="event-pin-btn-secondary"
            type="button"
            onClick={onDirections}
          >
            Directions
          </button>
        </div>
      </div>
    </div>
  )
}
