import { useEffect, useMemo, useRef, useState, type ChangeEventHandler, type MouseEvent } from 'react'
import type { AdPlacement, AdRecord, AdSettings } from '@waahtickets/shared-types'
import { shouldShowAd } from './shared/utils'

export const adPlacementOptions: AdPlacement[] = [
  'HOME_BETWEEN_RAILS',
  'EVENT_DETAIL_BETWEEN_RAILS',
  'WEB_LEFT_SIDEBAR',
  'CHECKOUT_BETWEEN_RAILS'
]

export const adDeviceTargetOptions = ['web', 'mobile', 'both'] as const
export const adStatusOptions = ['draft', 'active', 'paused', 'expired'] as const

type AdSlotProps = {
  placementKey?: AdPlacement
  placement?: AdPlacement
  device?: 'web' | 'mobile'
  pageUrl?: string
  railIndex?: number
  adsServed?: number
  variant?: 'card' | 'banner' | 'rail' | 'sidebar'
  className?: string
  fallbackHidden?: boolean
}

type AdsSettingsFormProps = {
  settings: AdSettings
  ads: AdRecord[]
  isLoading: boolean
  isSaving: boolean
  error: string
  onChange: (patch: Partial<AdSettings>) => void
  onReload: () => void
  onSave: () => void
}

type AdCampaignFormProps = {
  value: AdDraft
  isSaving: boolean
  error: string
  onChange: (patch: Partial<AdDraft>) => void
  onCancel: () => void
  onSubmit: () => void
}

type AdsTableProps = {
  ads: AdRecord[]
  isLoading: boolean
  error: string
  search: string
  placementFilter: string
  statusFilter: string
  deviceFilter: string
  onSearchChange: (value: string) => void
  onPlacementFilterChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onDeviceFilterChange: (value: string) => void
  onCreate: () => void
  onEdit: (ad: AdRecord) => void
  onClone: (ad: AdRecord) => void
  onPause: (ad: AdRecord) => void
  onActivate: (ad: AdRecord) => void
  onDelete: (ad: AdRecord) => void
}

export type AdDraft = {
  id?: string
  name: string
  advertiser_name: string
  placement: AdPlacement
  device_target: 'web' | 'mobile' | 'both'
  image_url: string
  destination_url: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'paused' | 'expired'
  priority: string
  display_frequency: string
  max_impressions: string
  max_clicks: string
  open_in_new_tab: boolean
}

type AdPreviewProps = {
  ad: Partial<AdRecord> | AdDraft
  variant: 'desktop-banner' | 'mobile-banner' | 'sidebar'
}

type SponsoredAdProps = {
  ad: AdRecord | null
  className?: string
}

const previewPlaceholder =
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80'

function SafeImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  imageClassName = ''
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
  imageClassName?: string
}) {
  const [hasFailed, setHasFailed] = useState(false)
  const cleanSrc = typeof src === 'string' ? src.trim() : ''

  useEffect(() => {
    setHasFailed(false)
  }, [cleanSrc])

  if (!cleanSrc || hasFailed) {
    return <div aria-hidden="true" className={fallbackClassName || `tw-bg-gradient-to-br tw-from-violet-100 tw-via-fuchsia-50 tw-to-slate-100 ${className}`.trim()} />
  }

  return (
    <img
      alt={alt}
      className={imageClassName || className}
      loading="lazy"
      src={cleanSrc}
      onError={() => setHasFailed(true)}
    />
  )
}

function SponsoredLabel({ placement }: { placement?: AdPlacement }) {
  return (
    <div className="tw-inline-flex tw-items-center tw-gap-2">
      <span className="tw-inline-flex tw-w-fit tw-items-center tw-rounded-full tw-border tw-border-violet-200 tw-bg-violet-50 tw-px-2.5 tw-py-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-[0.22em] tw-text-violet-700">
        Sponsored
      </span>
      {placement ? (
        <span className="tw-text-[11px] tw-font-medium tw-text-slate-400">{formatPlacementLabel(placement)}</span>
      ) : null}
    </div>
  )
}

function SponsoredAction() {
  return (
    <div className="tw-inline-flex tw-w-fit tw-items-center tw-gap-2 tw-rounded-full tw-bg-violet-600 tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-text-white tw-shadow-[0_10px_20px_rgba(124,58,237,0.18)]">
      Explore offer
    </div>
  )
}

function SponsoredAdShell({
  ad,
  placement,
  variant,
  className = '',
  onActivate
}: {
  ad: AdRecord
  placement?: AdPlacement
  variant: 'card' | 'banner' | 'rail' | 'sidebar'
  className?: string
  onActivate?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const isBanner = variant === 'banner'
  const isSidebar = variant === 'sidebar'
  const isRail = variant === 'rail'
  const outerClass =
    isSidebar || isRail
      ? 'tw-group tw-relative tw-overflow-hidden tw-rounded-[22px] tw-border tw-border-slate-200 tw-bg-white tw-shadow-[0_18px_40px_rgba(15,23,42,0.08)]'
      : 'tw-group tw-relative tw-overflow-hidden tw-rounded-[24px] tw-border tw-border-slate-200 tw-bg-white tw-shadow-[0_16px_34px_rgba(15,23,42,0.07)]'

  const imageClass =
    isSidebar
      ? 'tw-h-56 tw-w-full tw-rounded-2xl tw-object-cover'
      : isBanner
        ? 'tw-h-40 tw-w-full tw-rounded-2xl tw-object-cover md:tw-h-full'
        : isRail
          ? 'tw-h-44 tw-w-full tw-rounded-2xl tw-object-cover'
          : 'tw-h-36 tw-w-full tw-rounded-2xl tw-object-cover'

  const contentClass =
    isBanner
      ? 'tw-flex tw-min-w-0 tw-flex-col tw-gap-2 tw-px-1'
      : isSidebar || isRail
        ? 'tw-flex tw-min-w-0 tw-flex-col tw-gap-2 tw-px-1'
        : 'tw-flex tw-min-w-0 tw-flex-col tw-gap-2 tw-px-1'

  const layoutClass = isBanner
    ? 'tw-grid tw-gap-3 tw-p-4 md:tw-grid-cols-[minmax(0,176px)_minmax(0,1fr)] md:tw-items-center'
    : isSidebar
      ? 'tw-p-3'
      : 'tw-grid tw-gap-3 tw-p-4 md:tw-grid-cols-[176px_minmax(0,1fr)] md:tw-items-center'

  const inner = (
    <div className={layoutClass}>
      <SafeImage
        alt={ad.name}
        className="tw-w-full"
        fallbackClassName={
          isSidebar
            ? 'tw-h-56 tw-w-full tw-rounded-2xl tw-bg-gradient-to-br tw-from-violet-100 tw-via-fuchsia-50 tw-to-slate-100'
            : isBanner
              ? 'tw-h-40 tw-w-full tw-rounded-2xl tw-bg-gradient-to-br tw-from-violet-100 tw-via-fuchsia-50 tw-to-slate-100'
              : isRail
                ? 'tw-h-44 tw-w-full tw-rounded-2xl tw-bg-gradient-to-br tw-from-violet-100 tw-via-fuchsia-50 tw-to-slate-100'
                : 'tw-h-36 tw-w-full tw-rounded-2xl tw-bg-gradient-to-br tw-from-violet-100 tw-via-fuchsia-50 tw-to-slate-100'
        }
        imageClassName={imageClass}
        src={ad.image_url}
      />
      <div className={contentClass}>
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
          <SponsoredLabel placement={placement ?? ad.placement} />
        </div>
        <div className="tw-min-w-0">
          <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.16em] tw-text-violet-700">
            {ad.advertiser_name}
          </p>
          <h3 className="tw-mt-1 tw-line-clamp-2 tw-text-lg tw-font-semibold tw-leading-tight tw-text-slate-900">
            {ad.name}
          </h3>
        </div>
        <SponsoredAction />
      </div>
    </div>
  )

  return (
    <aside className={`${outerClass} ${className}`.trim()} data-ad-placement={placement ?? ad.placement}>
      {onActivate ? (
        <a
          className="tw-block tw-text-inherit tw-no-underline"
          href={ad.destination_url}
          onClick={onActivate}
          rel={ad.open_in_new_tab ? 'noreferrer noopener' : undefined}
          target={ad.open_in_new_tab ? '_blank' : undefined}
        >
          {inner}
        </a>
      ) : (
        <a
          className="tw-block tw-text-inherit tw-no-underline"
          href={ad.destination_url}
          rel={ad.open_in_new_tab ? 'noreferrer noopener' : undefined}
          target={ad.open_in_new_tab ? '_blank' : undefined}
        >
          {inner}
        </a>
      )}
    </aside>
  )
}

export function createEmptyAdDraft(): AdDraft {
  return {
    name: '',
    advertiser_name: '',
    placement: 'HOME_BETWEEN_RAILS',
    device_target: 'both',
    image_url: '',
    destination_url: '',
    start_date: new Date().toISOString().slice(0, 16),
    end_date: '',
    status: 'draft',
    priority: '0',
    display_frequency: '',
    max_impressions: '',
    max_clicks: '',
    open_in_new_tab: true
  }
}

export function adRecordToDraft(ad: AdRecord): AdDraft {
  return {
    id: ad.id,
    name: ad.name,
    advertiser_name: ad.advertiser_name,
    placement: ad.placement,
    device_target: ad.device_target,
    image_url: ad.image_url,
    destination_url: ad.destination_url,
    start_date: toDateTimeLocalValue(ad.start_date),
    end_date: toDateTimeLocalValue(ad.end_date),
    status: ad.status,
    priority: String(ad.priority),
    display_frequency: ad.display_frequency == null ? '' : String(ad.display_frequency),
    max_impressions: ad.max_impressions == null ? '' : String(ad.max_impressions),
    max_clicks: ad.max_clicks == null ? '' : String(ad.max_clicks),
    open_in_new_tab: ad.open_in_new_tab
  }
}

export function adDraftToPayload(draft: AdDraft) {
  return {
    name: draft.name.trim(),
    advertiser_name: draft.advertiser_name.trim(),
    placement: draft.placement,
    device_target: draft.device_target,
    image_url: draft.image_url.trim(),
    destination_url: draft.destination_url.trim(),
    start_date: toIsoOrEmpty(draft.start_date),
    end_date: draft.end_date.trim() ? toIsoOrEmpty(draft.end_date) : null,
    status: draft.status,
    priority: Number(draft.priority || 0),
    display_frequency: draft.display_frequency.trim() ? Number(draft.display_frequency) : null,
    max_impressions: draft.max_impressions.trim() ? Number(draft.max_impressions) : null,
    max_clicks: draft.max_clicks.trim() ? Number(draft.max_clicks) : null,
    open_in_new_tab: draft.open_in_new_tab
  }
}

export function RailAd({ placement, railIndex, adsServed = 0, className = '' }: { placement: AdPlacement; railIndex: number; adsServed?: number; className?: string }) {
  const device = useResponsiveAdDevice()
  return (
    <AdSlot
      adsServed={adsServed}
      className={className}
      device={device}
      pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
      placementKey={placement}
      railIndex={railIndex}
      variant="rail"
    />
  )
}

export function SidebarAd({ placement, adsServed = 0 }: { placement: AdPlacement; adsServed?: number }) {
  const isDesktop = useIsDesktopViewport()
  if (!isDesktop) return null

  return (
    <AdSlot
      adsServed={adsServed}
      className="waah-sidebar-ad-shell"
      device="web"
      pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
      placementKey={placement}
      variant="sidebar"
    />
  )
}

export function AdSlot({
  placementKey,
  placement,
  device,
  pageUrl = '',
  railIndex,
  adsServed = 0,
  variant = 'rail',
  className = '',
  fallbackHidden = true
}: AdSlotProps) {
  const responsiveDevice = useResponsiveAdDevice()
  const resolvedDevice = device ?? responsiveDevice
  const resolvedPlacement = placementKey ?? placement
  const [ad, setAd] = useState<AdRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    if (!resolvedPlacement) {
      setAd(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          device: resolvedDevice,
          ads_served: String(adsServed)
        })
        if (pageUrl) params.set('page_url', pageUrl)
        if (typeof railIndex === 'number') params.set('rail_index', String(railIndex))
        const response = await fetch(`/api/ads/placement/${encodeURIComponent(resolvedPlacement ?? '')}?${params.toString()}`)
        const json = (await response.json()) as { data?: AdRecord | null }
        if (!cancelled) {
          setAd(json.data ?? null)
          setHasImageError(false)
        }
      } catch {
        if (!cancelled) {
          setAd(null)
          setHasImageError(false)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [adsServed, pageUrl, railIndex, resolvedDevice, resolvedPlacement])

  useEffect(() => {
    if (!ad?.id) return
    void fetch(`/api/ads/${encodeURIComponent(ad.id)}/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placement: resolvedPlacement,
        device_type: resolvedDevice,
        page_url: pageUrl
      }),
      keepalive: true
    }).catch(() => null)
  }, [ad?.id, pageUrl, resolvedDevice, resolvedPlacement])

  const isRenderableAd = Boolean(
    ad &&
      !hasImageError &&
      shouldShowAd(ad, {
        placement: resolvedPlacement,
        device: resolvedDevice,
        nowIso: new Date().toISOString()
      })
  )

  async function onActivate(event: MouseEvent<HTMLAnchorElement>) {
    if (!ad) return
    event.preventDefault()

    const navigate = () => {
      if (ad.open_in_new_tab) {
        window.open(ad.destination_url, '_blank', 'noopener,noreferrer')
      } else {
        window.location.assign(ad.destination_url)
      }
    }

    const timeout = window.setTimeout(navigate, 500)
    try {
      await fetch(`/api/ads/${encodeURIComponent(ad.id)}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placement: resolvedPlacement,
          device_type: resolvedDevice,
          page_url: pageUrl
        }),
        keepalive: true
      })
    } catch {
      // Ignore click tracking errors and continue navigation.
    } finally {
      window.clearTimeout(timeout)
      navigate()
    }
  }

  if (isLoading || !isRenderableAd || (!ad && fallbackHidden)) {
    return null
  }

  if (!ad) return null

  return (
    <SponsoredAdShell
      ad={ad}
      className={className}
      onActivate={onActivate}
      placement={resolvedPlacement}
      variant={variant}
    />
  )
}

export function BetweenRailsAdSlider({
  placement = 'HOME_BETWEEN_RAILS',
  pageUrl = '',
  className = ''
}: {
  placement?: AdPlacement
  pageUrl?: string
  className?: string
}) {
  const device = useResponsiveAdDevice()
  const [ads, setAds] = useState<AdRecord[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const pausedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const params = new URLSearchParams({ device })
        const response = await fetch(`/api/ads/placement/${encodeURIComponent(placement)}/all?${params.toString()}`)
        const json = (await response.json()) as { data?: AdRecord[] }
        if (!cancelled) {
          setAds(json.data ?? [])
          setActiveIndex(0)
        }
      } catch {
        if (!cancelled) setAds([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [device, placement])

  useEffect(() => {
    if (ads.length <= 1) return
    const timer = window.setInterval(() => {
      if (!pausedRef.current) {
        setActiveIndex((current) => (current + 1) % ads.length)
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [ads.length])

  useEffect(() => {
    const ad = ads[activeIndex]
    if (!ad?.id) return
    void fetch(`/api/ads/${encodeURIComponent(ad.id)}/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement, device_type: device, page_url: pageUrl }),
      keepalive: true
    }).catch(() => null)
  }, [activeIndex, ads, device, pageUrl, placement])

  async function handleAdClick(ad: AdRecord, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    const navigate = () => {
      if (ad.open_in_new_tab) {
        window.open(ad.destination_url, '_blank', 'noopener,noreferrer')
      } else {
        window.location.assign(ad.destination_url)
      }
    }
    const timeout = window.setTimeout(navigate, 500)
    try {
      await fetch(`/api/ads/${encodeURIComponent(ad.id)}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement, device_type: device, page_url: pageUrl }),
        keepalive: true
      })
    } catch {
      // ignore
    } finally {
      window.clearTimeout(timeout)
      navigate()
    }
  }

  const nowIso = new Date().toISOString()
  const visibleAds = ads.filter((ad) => shouldShowAd(ad, { placement, device, nowIso }))

  if (visibleAds.length === 0) return null

  const clampedIndex = activeIndex % visibleAds.length
  const activeAd = visibleAds[clampedIndex]

  return (
    <div
      className={`between-rails-ad-slider ${className}`.trim()}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <div className="between-rails-ad-track" style={{ transform: `translateX(-${clampedIndex * 100}%)` }}>
        {visibleAds.map((ad) => (
          <div className="between-rails-ad-slide" key={ad.id}>
            <SponsoredAdShell
              ad={ad}
              className="between-rails-ad-shell"
              placement={placement}
              variant="banner"
              onActivate={(event) => void handleAdClick(ad, event)}
            />
          </div>
        ))}
      </div>
      {visibleAds.length > 1 ? (
        <div className="between-rails-ad-dots" aria-hidden="true">
          {visibleAds.map((ad, index) => (
            <span
              key={ad.id}
              className={`between-rails-ad-dot${index === clampedIndex ? ' is-active' : ''}`}
            />
          ))}
        </div>
      ) : null}
      {activeAd ? (
        <p className="between-rails-ad-hint" aria-hidden="true">
          Sponsored · {activeAd.advertiser_name}
        </p>
      ) : null}
    </div>
  )
}

export function SponsoredCard({ ad, className = '' }: SponsoredAdProps) {
  if (!ad) return null
  return <SponsoredAdShell ad={ad} className={className} placement={ad.placement} variant="card" />
}

export function SponsoredBanner({ ad, className = '' }: SponsoredAdProps) {
  if (!ad) return null
  return <SponsoredAdShell ad={ad} className={className} placement={ad.placement} variant="banner" />
}

export function SponsoredRail({ ad, className = '' }: SponsoredAdProps) {
  if (!ad) return null
  return <SponsoredAdShell ad={ad} className={className} placement={ad.placement} variant="rail" />
}

export function RightRailAds({
  placementKey = 'WEB_RIGHT_SIDEBAR',
  adsServed = 0,
  className = ''
}: {
  placementKey?: AdPlacement
  adsServed?: number
  className?: string
}) {
  const isDesktop = useIsDesktopViewport()
  if (!isDesktop) return null

  return (
    <AdSlot
      adsServed={adsServed}
      className={className}
      device="web"
      fallbackHidden
      pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
      placementKey={placementKey}
      variant="sidebar"
    />
  )
}

export function AdsSettingsForm({
  settings,
  ads,
  isLoading,
  isSaving,
  error,
  onChange,
  onReload,
  onSave
}: AdsSettingsFormProps) {
  return (
    <section className="tw-grid tw-gap-6">
      <div className="tw-grid tw-gap-4 lg:tw-grid-cols-[minmax(0,1.3fr)_320px]">
        <div className="tw-rounded-[28px] tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
          <div className="tw-mb-5">
            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.2em] tw-text-slate-500">Ads settings</p>
            <h3 className="tw-mt-2 tw-text-2xl tw-font-semibold tw-text-slate-900">Global delivery controls</h3>
            <p className="tw-mt-2 tw-text-sm tw-leading-6 tw-text-slate-500">
              Control device targeting, rail frequency, page caps, and the fallback creative from one place.
            </p>
          </div>

          <div className="tw-grid tw-gap-4 md:tw-grid-cols-2">
            <ToggleField
              checked={settings.ads_enabled}
              disabled={isLoading || isSaving}
              label="Enable ads globally"
              onChange={(checked) => onChange({ ads_enabled: checked })}
            />
            <ToggleField
              checked={settings.web_ads_enabled}
              disabled={isLoading || isSaving}
              label="Enable web ads"
              onChange={(checked) => onChange({ web_ads_enabled: checked })}
            />
            <ToggleField
              checked={settings.mobile_ads_enabled}
              disabled={isLoading || isSaving}
              label="Enable mobile ads"
              onChange={(checked) => onChange({ mobile_ads_enabled: checked })}
            />
            <NumberField
              disabled={isLoading || isSaving}
              label="Default ad frequency"
              min={1}
              value={settings.default_ad_frequency}
              onChange={(value) => onChange({ default_ad_frequency: value })}
            />
            <NumberField
              disabled={isLoading || isSaving}
              label="Maximum ads per page"
              min={1}
              value={settings.max_ads_per_page}
              onChange={(value) => onChange({ max_ads_per_page: value })}
            />
            <label className="tw-grid tw-gap-2">
              <span className="tw-text-sm tw-font-medium tw-text-slate-700">Fallback ad</span>
              <select
                className="tw-h-11 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-text-sm tw-text-slate-900 focus:tw-border-sky-400 focus:tw-outline-none"
                disabled={isLoading || isSaving}
                value={settings.fallback_ad_id ?? ''}
                onChange={(event) => onChange({ fallback_ad_id: event.target.value || null })}
              >
                <option value="">No fallback ad</option>
                {ads.map((ad) => (
                  <option key={ad.id} value={ad.id}>
                    {ad.name} · {ad.advertiser_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-px-4 tw-py-3 tw-text-sm tw-text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="tw-mt-6 tw-flex tw-flex-wrap tw-gap-3">
            <button
              className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-border tw-border-slate-200 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-slate-700"
              disabled={isLoading || isSaving}
              type="button"
              onClick={onReload}
            >
              Reload
            </button>
            <button
              className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-slate-950 tw-px-5 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white disabled:tw-opacity-60"
              disabled={isLoading || isSaving}
              type="button"
              onClick={onSave}
            >
              {isSaving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        <div className="tw-grid tw-gap-4">
          <AdPreview
            ad={{
              name: 'Desktop rail campaign',
              advertiser_name: 'Waah Partner',
              image_url: settings.fallback_ad_id ? ads.find((ad) => ad.id === settings.fallback_ad_id)?.image_url ?? previewPlaceholder : previewPlaceholder
            }}
            variant="desktop-banner"
          />
          <AdPreview
            ad={{
              name: 'Mobile rail campaign',
              advertiser_name: 'Waah Partner',
              image_url: settings.fallback_ad_id ? ads.find((ad) => ad.id === settings.fallback_ad_id)?.image_url ?? previewPlaceholder : previewPlaceholder
            }}
            variant="mobile-banner"
          />
          <AdPreview
            ad={{
              name: 'Sidebar campaign',
              advertiser_name: 'Waah Partner',
              image_url: settings.fallback_ad_id ? ads.find((ad) => ad.id === settings.fallback_ad_id)?.image_url ?? previewPlaceholder : previewPlaceholder
            }}
            variant="sidebar"
          />
        </div>
      </div>
    </section>
  )
}

export function AdCampaignForm({
  value,
  isSaving,
  error,
  onChange,
  onCancel,
  onSubmit
}: AdCampaignFormProps) {
  return (
    <section className="tw-rounded-[28px] tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4">
        <div>
          <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.2em] tw-text-slate-500">Campaign editor</p>
          <h3 className="tw-mt-2 tw-text-2xl tw-font-semibold tw-text-slate-900">
            {value.id ? 'Edit ad campaign' : 'Create ad campaign'}
          </h3>
        </div>
        <div className="tw-inline-flex tw-flex-wrap tw-gap-2">
          {adStatusOptions.map((status) => (
            <button
              className={`tw-rounded-full tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] ${
                value.status === status ? 'tw-border-slate-900 tw-bg-slate-900 tw-text-white' : 'tw-border-slate-200 tw-bg-white tw-text-slate-600'
              }`}
              key={status}
              type="button"
              onClick={() => onChange({ status })}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="tw-mt-6 tw-grid tw-gap-5 xl:tw-grid-cols-[minmax(0,1.4fr)_340px]">
        <div className="tw-grid tw-gap-4 md:tw-grid-cols-2">
          <TextField label="Campaign name" value={value.name} onChange={(event) => onChange({ name: event.target.value })} />
          <TextField
            label="Advertiser name"
            value={value.advertiser_name}
            onChange={(event) => onChange({ advertiser_name: event.target.value })}
          />
          <SelectField
            label="Placement"
            options={adPlacementOptions}
            value={value.placement}
            onChange={(event) => onChange({ placement: event.target.value as AdPlacement })}
          />
          <SelectField
            label="Device target"
            options={[...adDeviceTargetOptions]}
            value={value.device_target}
            onChange={(event) => onChange({ device_target: event.target.value as AdDraft['device_target'] })}
          />
          <TextField label="Image URL" value={value.image_url} onChange={(event) => onChange({ image_url: event.target.value })} />
          <TextField
            label="Destination URL"
            value={value.destination_url}
            onChange={(event) => onChange({ destination_url: event.target.value })}
          />
          <DateTimeField
            label="Start date"
            value={value.start_date}
            onChange={(event) => onChange({ start_date: event.target.value })}
          />
          <DateTimeField
            label="End date"
            value={value.end_date}
            onChange={(event) => onChange({ end_date: event.target.value })}
          />
          <TextField label="Priority" type="number" value={value.priority} onChange={(event) => onChange({ priority: event.target.value })} />
          <TextField
            label="Display frequency"
            type="number"
            value={value.display_frequency}
            onChange={(event) => onChange({ display_frequency: event.target.value })}
          />
          <TextField
            label="Maximum impressions"
            type="number"
            value={value.max_impressions}
            onChange={(event) => onChange({ max_impressions: event.target.value })}
          />
          <TextField label="Maximum clicks" type="number" value={value.max_clicks} onChange={(event) => onChange({ max_clicks: event.target.value })} />
          <ToggleField
            checked={value.open_in_new_tab}
            label="Open in new tab"
            onChange={(checked) => onChange({ open_in_new_tab: checked })}
          />
        </div>

        <div className="tw-grid tw-gap-4">
          <AdPreview ad={value} variant="desktop-banner" />
          <AdPreview ad={value} variant="mobile-banner" />
          <AdPreview ad={value} variant="sidebar" />
        </div>
      </div>

      {error ? (
        <div className="tw-mt-5 tw-rounded-2xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-px-4 tw-py-3 tw-text-sm tw-text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="tw-mt-6 tw-flex tw-flex-wrap tw-gap-3">
        <button
          className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-border tw-border-slate-200 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-slate-700"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-slate-950 tw-px-5 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white disabled:tw-opacity-60"
          disabled={isSaving}
          type="button"
          onClick={onSubmit}
        >
          {isSaving ? 'Saving…' : value.id ? 'Save changes' : 'Create campaign'}
        </button>
      </div>
    </section>
  )
}

export function AdsTable({
  ads,
  isLoading,
  error,
  search,
  placementFilter,
  statusFilter,
  deviceFilter,
  onSearchChange,
  onPlacementFilterChange,
  onStatusFilterChange,
  onDeviceFilterChange,
  onCreate,
  onEdit,
  onClone,
  onPause,
  onActivate,
  onDelete
}: AdsTableProps) {
  return (
    <section className="tw-rounded-[28px] tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
      <div className="tw-flex tw-flex-wrap tw-items-end tw-justify-between tw-gap-4">
        <div>
          <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.2em] tw-text-slate-500">Ads management</p>
          <h3 className="tw-mt-2 tw-text-2xl tw-font-semibold tw-text-slate-900">Campaign inventory</h3>
        </div>
        <button
          className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-slate-950 tw-px-5 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white"
          type="button"
          onClick={onCreate}
        >
          Create ad
        </button>
      </div>

      <div className="tw-mt-5 tw-grid tw-gap-3 md:tw-grid-cols-2 xl:tw-grid-cols-4">
        <TextField label="Search" placeholder="Search campaigns..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
        <SelectField label="Placement" options={['', ...adPlacementOptions]} value={placementFilter} onChange={(event) => onPlacementFilterChange(event.target.value)} />
        <SelectField label="Status" options={['', ...adStatusOptions]} value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} />
        <SelectField
          label="Device target"
          options={['', ...adDeviceTargetOptions]}
          value={deviceFilter}
          onChange={(event) => onDeviceFilterChange(event.target.value)}
        />
      </div>

      {error ? (
        <div className="tw-mt-4 tw-rounded-2xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-px-4 tw-py-3 tw-text-sm tw-text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="tw-mt-6 tw-rounded-[24px] tw-border tw-border-dashed tw-border-slate-200 tw-bg-slate-50 tw-p-8 tw-text-sm tw-text-slate-500">
          Loading ads…
        </div>
      ) : ads.length === 0 ? (
        <div className="tw-mt-6 tw-rounded-[24px] tw-border tw-border-dashed tw-border-slate-200 tw-bg-slate-50 tw-p-8 tw-text-sm tw-text-slate-500">
          No ads found yet. Create your first campaign to start filling rails and sidebars.
        </div>
      ) : (
        <div className="tw-mt-6 tw-overflow-x-auto">
          <table className="tw-min-w-full tw-border-separate tw-border-spacing-y-3">
            <thead>
              <tr className="tw-text-left tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.16em] tw-text-slate-500">
                <th className="tw-px-3">Campaign</th>
                <th className="tw-px-3">Placement</th>
                <th className="tw-px-3">Device</th>
                <th className="tw-px-3">Status</th>
                <th className="tw-px-3">Priority</th>
                <th className="tw-px-3">Performance</th>
                <th className="tw-px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => (
                <tr className="tw-rounded-[22px] tw-bg-slate-50 tw-text-sm tw-text-slate-700" key={ad.id}>
                  <td className="tw-rounded-l-[22px] tw-p-3">
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <img alt="" className="tw-h-14 tw-w-14 tw-rounded-2xl tw-object-cover" src={ad.image_url || previewPlaceholder} />
                      <div className="tw-min-w-0">
                        <div className="tw-font-semibold tw-text-slate-900">{ad.name}</div>
                        <div className="tw-truncate tw-text-xs tw-text-slate-500">{ad.advertiser_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tw-p-3">{formatPlacementLabel(ad.placement)}</td>
                  <td className="tw-p-3 tw-capitalize">{ad.device_target}</td>
                  <td className="tw-p-3">
                    <span className={`tw-inline-flex tw-rounded-full tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold ${statusClasses[ad.status]}`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className="tw-p-3">{ad.priority}</td>
                  <td className="tw-p-3 tw-text-xs tw-text-slate-500">
                    {ad.impression_count ?? 0} impressions · {ad.click_count ?? 0} clicks
                  </td>
                  <td className="tw-rounded-r-[22px] tw-p-3">
                    <div className="tw-flex tw-flex-wrap tw-gap-2">
                      <button className="tw-rounded-full tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold" type="button" onClick={() => onEdit(ad)}>
                        Edit
                      </button>
                      <button className="tw-rounded-full tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold" type="button" onClick={() => onClone(ad)}>
                        Clone
                      </button>
                      {ad.status === 'active' ? (
                        <button className="tw-rounded-full tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-amber-800" type="button" onClick={() => onPause(ad)}>
                          Pause
                        </button>
                      ) : (
                        <button className="tw-rounded-full tw-border tw-border-emerald-200 tw-bg-emerald-50 tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-emerald-800" type="button" onClick={() => onActivate(ad)}>
                          Activate
                        </button>
                      )}
                      <button className="tw-rounded-full tw-border tw-border-rose-200 tw-bg-rose-50 tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-rose-700" type="button" onClick={() => onDelete(ad)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function AdPreview({ ad, variant }: AdPreviewProps) {
  const title = ad.name?.trim() || 'Preview campaign'
  const advertiser = ad.advertiser_name?.trim() || 'Advertiser'
  const imageUrl = ad.image_url?.trim() || previewPlaceholder
  const frameClass =
    variant === 'sidebar'
      ? 'tw-grid tw-gap-3'
      : variant === 'mobile-banner'
        ? 'tw-grid tw-gap-3'
        : 'tw-grid tw-gap-3 md:tw-grid-cols-[120px_minmax(0,1fr)] md:tw-items-center'

  const mediaClass =
    variant === 'sidebar'
      ? 'tw-h-44 tw-w-full tw-rounded-[22px] tw-object-cover'
      : variant === 'mobile-banner'
        ? 'tw-h-28 tw-w-full tw-rounded-[22px] tw-object-cover'
        : 'tw-h-28 tw-w-full tw-rounded-[22px] tw-object-cover'

  return (
    <article className="tw-rounded-[26px] tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
        <span className="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.16em] tw-text-slate-500">
          {variant.replace('-', ' ')}
        </span>
        <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-[0.2em] tw-text-slate-500">
          Preview
        </span>
      </div>
      <div className={frameClass}>
        <img alt={title} className={mediaClass} src={imageUrl} />
        <div className="tw-flex tw-flex-col tw-gap-2">
          <p className="tw-m-0 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.16em] tw-text-slate-500">{advertiser}</p>
          <h4 className="tw-m-0 tw-text-lg tw-font-semibold tw-leading-tight tw-text-slate-900">{title}</h4>
          <div className="tw-inline-flex tw-w-fit tw-items-center tw-gap-2 tw-rounded-full tw-bg-slate-900 tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-text-white">
            Learn more
          </div>
        </div>
      </div>
    </article>
  )
}

function ToggleField({
  label,
  checked,
  disabled,
  onChange
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-rounded-[22px] tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-4 tw-py-3">
      <span className="tw-text-sm tw-font-medium tw-text-slate-700">{label}</span>
      <button
        className={`tw-relative tw-inline-flex tw-h-7 tw-w-12 tw-items-center tw-rounded-full tw-transition ${checked ? 'tw-bg-slate-900' : 'tw-bg-slate-300'} ${disabled ? 'tw-opacity-60' : ''}`}
        disabled={disabled}
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span className={`tw-inline-block tw-h-5 tw-w-5 tw-rounded-full tw-bg-white tw-transition ${checked ? 'tw-translate-x-6' : 'tw-translate-x-1'}`} />
      </button>
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  disabled,
  onChange
}: {
  label: string
  value: number
  min?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="tw-grid tw-gap-2">
      <span className="tw-text-sm tw-font-medium tw-text-slate-700">{label}</span>
      <input
        className="tw-h-11 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-text-sm tw-text-slate-900 focus:tw-border-sky-400 focus:tw-outline-none"
        disabled={disabled}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || min || 0))}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder
}: {
  label: string
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  type?: string
  placeholder?: string
}) {
  return (
    <label className="tw-grid tw-gap-2">
      <span className="tw-text-sm tw-font-medium tw-text-slate-700">{label}</span>
      <input
        className="tw-h-11 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-text-sm tw-text-slate-900 focus:tw-border-sky-400 focus:tw-outline-none"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={onChange}
      />
    </label>
  )
}

function SelectField({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: ChangeEventHandler<HTMLSelectElement>
}) {
  return (
    <label className="tw-grid tw-gap-2">
      <span className="tw-text-sm tw-font-medium tw-text-slate-700">{label}</span>
      <select
        className="tw-h-11 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-text-sm tw-text-slate-900 focus:tw-border-sky-400 focus:tw-outline-none"
        value={value}
        onChange={onChange}
      >
        {options.map((option) => (
          <option key={option || 'empty-option'} value={option}>
            {option ? formatPlacementLabel(option) : `All ${label.toLowerCase()}`}
          </option>
        ))}
      </select>
    </label>
  )
}

function DateTimeField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <label className="tw-grid tw-gap-2">
      <span className="tw-text-sm tw-font-medium tw-text-slate-700">{label}</span>
      <input
        className="tw-h-11 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-text-sm tw-text-slate-900 focus:tw-border-sky-400 focus:tw-outline-none"
        step={60}
        type="datetime-local"
        value={value}
        onChange={onChange}
      />
    </label>
  )
}

function toIsoOrEmpty(value: string) {
  return value ? new Date(value).toISOString() : ''
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function formatPlacementLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1101px)').matches
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(min-width: 1101px)')
    const update = () => setIsDesktop(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isDesktop
}

function useResponsiveAdDevice(): 'web' | 'mobile' {
  const isDesktop = useIsDesktopViewport()
  return useMemo(() => (isDesktop ? 'web' : 'mobile'), [isDesktop])
}

const statusClasses: Record<AdRecord['status'], string> = {
  draft: 'tw-bg-slate-200 tw-text-slate-700',
  active: 'tw-bg-emerald-100 tw-text-emerald-700',
  paused: 'tw-bg-amber-100 tw-text-amber-700',
  expired: 'tw-bg-rose-100 tw-text-rose-700'
}
