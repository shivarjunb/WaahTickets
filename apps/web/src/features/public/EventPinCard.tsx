import React from 'react'
import { MapPin, Clock } from 'lucide-react'

interface EventPinCardProps {
  title: string
  category: string
  area: string
  time: string
  priceFrom: string
  sponsored: boolean
  eventId: string
  categoryColor: string
  onViewDetails: (eventId: string) => void
}

export function EventPinCard({
  title, category, area, time, priceFrom, sponsored, eventId, categoryColor, onViewDetails
}: EventPinCardProps) {
  const isLive = time.toLowerCase().includes('tonight')

  return (
    <div className="event-pin-card" style={{ '--card-accent': categoryColor } as React.CSSProperties}>
      <div
        className="event-pin-card-image-bar"
        style={{ background: `linear-gradient(135deg, ${categoryColor}55, ${categoryColor}22)` }}
      >
        {isLive && <span className="event-pin-live-badge">● LIVE</span>}
        {sponsored && <span className="event-pin-badge-sponsored">Sponsored</span>}
        <span className="event-pin-category-tag" style={{ color: categoryColor }}>{category}</span>
      </div>

      <div className="event-pin-card-body">
        <h3 className="event-pin-card-title">{title}</h3>

        <div className="event-pin-card-meta">
          <span className="event-pin-meta-item">
            <MapPin size={11} style={{ color: categoryColor }} />
            {area}
          </span>
          <span className="event-pin-meta-item">
            <Clock size={11} style={{ color: categoryColor }} />
            {time}
          </span>
        </div>

        <div className="event-pin-card-footer">
          <span className="event-pin-card-price">{priceFrom}</span>
          <button
            className="event-pin-card-button"
            type="button"
            style={{ background: `linear-gradient(135deg, ${categoryColor}, ${categoryColor}bb)` }}
            onClick={() => onViewDetails(eventId)}
            aria-label={`View details for ${title}`}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  )
}
