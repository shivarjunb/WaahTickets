import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ticket } from 'lucide-react'

const MESSAGES = [
  'Loading tonight\'s events…',
  'Setting up the stage…',
  'Printing VIP passes…',
  'Checking the hottest events…',
  'Loading the vibe…',
]

const CONFETTI_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#f43f5e', '#818cf8']

interface Particle {
  id: number; x: number; delay: number; dur: number; color: string; size: number; round: boolean
}

const PARTICLES: Particle[] = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: 4 + (i * 4.4) % 92,
  delay: (i * 0.28) % 3.2,
  dur: 2.4 + (i * 0.41) % 2.2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 4 + (i * 3) % 7,
  round: i % 3 !== 1,
}))

const TICKET_VARIANTS = {
  left: {
    hidden: { x: -160, rotate: -22, opacity: 0 },
    visible: { x: 0, rotate: -13, opacity: 1, transition: { type: 'spring', stiffness: 200, damping: 18, delay: 0.15 } },
  },
  center: {
    hidden: { y: -100, rotate: -8, opacity: 0 },
    visible: { y: 0, rotate: -3, opacity: 1, transition: { type: 'spring', stiffness: 200, damping: 18, delay: 0.35 } },
  },
  right: {
    hidden: { x: 160, rotate: 18, opacity: 0 },
    visible: { x: 0, rotate: 11, opacity: 1, transition: { type: 'spring', stiffness: 200, damping: 18, delay: 0.55 } },
  },
}

function TicketStub({
  variant, label, event, seat, dot1, dot2, showQr,
}: {
  variant: 'left' | 'center' | 'right'
  label: string; event: string; seat: string
  dot1: string; dot2: string; showQr?: boolean
}) {
  return (
    <motion.div
      className={`loader-ticket loader-ticket--${variant}`}
      variants={TICKET_VARIANTS[variant]}
      initial="hidden"
      animate="visible"
    >
      <div className="loader-ticket-notch loader-ticket-notch--l" />
      <div className="loader-ticket-notch loader-ticket-notch--r" />
      <div className="loader-ticket-row">
        <span className={`loader-ticket-dot loader-dot--${dot1}`} />
        <span className="loader-ticket-label">{label}</span>
        <span className={`loader-ticket-dot loader-dot--${dot2}`} />
      </div>
      <div className="loader-ticket-event">{event}</div>
      {showQr && (
        <div className="loader-ticket-qr-wrap">
          <motion.div
            className="loader-qr-grid"
            initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 0.9 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 1.1 }}
          />
        </div>
      )}
      <div className="loader-ticket-seat">{seat}</div>
    </motion.div>
  )
}

export function HomepageLoader({ isLoading }: { isLoading: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [showExtra, setShowExtra] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setShowExtra(true), 3000)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!showExtra) return
    const iv = window.setInterval(() => setMsgIndex(i => (i + 1) % MESSAGES.length), 2200)
    return () => window.clearInterval(iv)
  }, [showExtra])

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="homepage-loader"
          className="homepage-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -60, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] } }}
          aria-hidden="true"
        >
          {/* Confetti rain */}
          {PARTICLES.map(p => (
            <div
              key={p.id}
              className="loader-confetti"
              style={{
                left: `${p.x}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                background: p.color,
                width: p.size,
                height: p.size,
                borderRadius: p.round ? '50%' : '2px',
              }}
            />
          ))}

          {/* Background glow orbs */}
          <div className="loader-orb loader-orb--purple" />
          <div className="loader-orb loader-orb--cyan" />

          {/* Light sweep */}
          <div className="loader-sweep" />

          {/* Ticket stubs */}
          <div className="loader-tickets-stage">
            <TicketStub variant="left" label="VIP ACCESS" event="TONIGHT" seat="ROW A · SEAT 12" dot1="purple" dot2="cyan" />
            <TicketStub variant="center" label="GENERAL" event="THE EVENT" seat="SECTION B · SEAT 7" dot1="amber" dot2="pink" showQr />
            <TicketStub variant="right" label="BACKSTAGE" event="OPENING" seat="FLOOR · OPEN" dot1="green" dot2="purple" />
          </div>

          {/* Center logo + status */}
          <motion.div
            className="loader-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
          >
            <div className="loader-logo-ring">
              <Ticket size={30} color="#fff" strokeWidth={2} />
            </div>
            <div className="loader-brand">WaahTickets</div>

            <div className="loader-bar-track">
              <div className="loader-bar-scanner" />
            </div>

            <div className="loader-message-wrap">
              <AnimatePresence mode="wait">
                <motion.span
                  key={msgIndex}
                  className="loader-message"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  {MESSAGES[msgIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
