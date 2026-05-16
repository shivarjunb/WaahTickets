import React, { useState } from 'react'
import { Music, Utensils, Star, Trophy, Laugh, Moon, Calendar } from 'lucide-react'
import { EventPinCard } from './EventPinCard'

const CATEGORY_CONFIG: Record<string, { color: string; Icon: React.ElementType }> = {
  'Concert':      { color: '#e91e63', Icon: Music },
  'Food & Drink': { color: '#ff9800', Icon: Utensils },
  'Festival':     { color: '#9c27b0', Icon: Star },
  'Sports':       { color: '#22c55e', Icon: Trophy },
  'Comedy':       { color: '#3b82f6', Icon: Laugh },
  'Nightlife':    { color: '#06b6d4', Icon: Moon },
}

const DEFAULT_CONFIG = { color: '#e91e63', Icon: Calendar }

interface PinData {
  id: string
  title: string
  category: string
  area: string
  time: string
  priceFrom: string
  sponsored: boolean
  x: number
  y: number
}

interface AnimatedEventPinProps {
  pin: PinData
  isVisible: boolean
  onViewDetails: (eventId: string) => void
}

export function AnimatedEventPin({ pin, isVisible, onViewDetails }: AnimatedEventPinProps) {
  const [isActive, setIsActive] = useState(false)

  if (!isVisible) return null

  const cfg = CATEGORY_CONFIG[pin.category] ?? DEFAULT_CONFIG
  const color = pin.sponsored ? '#e91e63' : cfg.color
  const { Icon } = cfg

  return (
    <div
      className={`animated-event-pin${pin.sponsored ? ' pin-sponsored' : ''}`}
      style={{ left: `${pin.x}%`, top: `${pin.y}%`, '--pin-color': color } as React.CSSProperties}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onClick={(e) => { e.stopPropagation(); setIsActive((v) => !v) }}
    >
      <div className="pin-ripple pin-ripple-outer" />
      <div className="pin-ripple pin-ripple-inner" />
      <div className="pin-body">
        <Icon size={13} strokeWidth={2.5} />
      </div>
      {pin.sponsored && <div className="pin-sponsored-dot" />}

      {isActive && (
        <div className="pin-preview-card">
          <EventPinCard
            title={pin.title}
            category={pin.category}
            area={pin.area}
            time={pin.time}
            priceFrom={pin.priceFrom}
            sponsored={pin.sponsored}
            eventId={pin.id}
            categoryColor={color}
            onViewDetails={onViewDetails}
          />
        </div>
      )}
    </div>
  )
}
