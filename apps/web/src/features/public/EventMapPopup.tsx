import { MapPin, Calendar, Navigation } from 'lucide-react'
import { NepalMap } from './NepalMap'
import type { PopupField, MapEvent } from './NepalMap'

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
  lat?: number
  lng?: number
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
  lat, lng, below, onViewDetails, onDirections,
}: EventMapPopupProps) {
  const isLive = time.toLowerCase().includes('tonight')

  const miniMapEvent: MapEvent | null = (lat != null && lng != null) ? {
    id: eventId,
    title,
    category,
    area,
    time,
    priceFrom,
    sponsored,
    lat,
    lng,
  } : null

  return (
    <div className={`event-pin-card${below ? ' event-pin-card--below' : ''}`}>
      {/* Arrow tail pointing toward the pin */}
      <div className="event-pin-card-tail" />

      {/* Mini map header — shows event location; falls back to image if no coords */}
      {miniMapEvent ? (
        <div className="event-pin-card-mini-map">
          <NepalMap
            events={[miniMapEvent]}
            totalCount={1}
            onViewDetails={() => {}}
            disableHover
            minimal
            initialCenter={[miniMapEvent.lat, miniMapEvent.lng]}
            initialZoom={15}
          />
        </div>
      ) : imageUrl ? (
        <div
          className="event-pin-card-image-bar"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      ) : null}

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
