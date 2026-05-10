import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import type { ApiMutationResponse, HeroSettingsData, HeroSlideData } from "../../shared/types"
import { fetchJson, getErrorMessage } from "../../shared/utils"

function createSlideDraft(index: number): HeroSlideData {
  const baseId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `hero-${Date.now()}-${index + 1}`

  return {
    id: baseId,
    is_active: true,
    sort_order: index + 1,
    eyebrow_text: '',
    badge_text: '',
    title: '',
    subtitle: '',
    primary_button_text: '',
    primary_button_url: '',
    secondary_button_text: '',
    secondary_button_url: '',
    background_image_url: '',
    overlay_intensity: 70,
    text_alignment: 'left'
  }
}

function moveSlide(slides: HeroSlideData[], fromIndex: number, toIndex: number) {
  const next = [...slides]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next.map((slide, index) => ({ ...slide, sort_order: index + 1 }))
}

export function HeroSettingsForm({
  error,
  isLoading,
  isSaving,
  settings,
  onChange,
  onReload,
  onSave
}: {
  error: string
  isLoading: boolean
  isSaving: boolean
  settings: HeroSettingsData
  onChange: (patch: Partial<HeroSettingsData>) => void
  onReload: () => void
  onSave: () => void
}) {
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null)
  const sortedSlides = useMemo(
    () => [...settings.slides].sort((left, right) => left.sort_order - right.sort_order),
    [settings.slides]
  )
  const activeSlides = sortedSlides.filter((slide) => slide.is_active)

  function updateSlide(slideId: string, patch: Partial<HeroSlideData>) {
    onChange({
      slides: settings.slides.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide))
    })
  }

  function addSlide() {
    const nextSlides = [...settings.slides, createSlideDraft(settings.slides.length)]
    onChange({ slides: nextSlides })
  }

  function removeSlide(slideId: string) {
    const nextSlides = settings.slides
      .filter((slide) => slide.id !== slideId)
      .map((slide, index) => ({ ...slide, sort_order: index + 1 }))
    onChange({ slides: nextSlides })
  }

  async function uploadSlideImage(slideId: string, file: File) {
    setUploadingSlideId(slideId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('file_type', 'hero_slide')

      const { data } = await fetchJson<ApiMutationResponse>('/api/files/upload', {
        method: 'POST',
        body: formData
      })
      const uploadedFile = data.data ?? {}
      const publicUrl = String(uploadedFile.public_url ?? '').trim()
      if (!publicUrl) {
        throw new Error('Upload succeeded, but no public URL was returned.')
      }

      updateSlide(slideId, { background_image_url: publicUrl })
    } catch (error) {
      window.alert(getErrorMessage(error))
    } finally {
      setUploadingSlideId(null)
    }
  }

  const previewSlide = activeSlides[0] ?? sortedSlides[0] ?? null

  return (
    <section className="admin-card settings-card hero-settings-card">
      <div className="admin-card-header">
        <div>
          <h2>Hero Settings</h2>
          <p>Configure the public homepage hero section without editing code.</p>
        </div>
      </div>

      <div className="settings-grid hero-settings-grid">
        <label className="rail-autoplay-toggle">
          <span>Enable hero slider</span>
          <input
            checked={settings.slider_enabled}
            disabled={isLoading || isSaving}
            type="checkbox"
            onChange={(event) => onChange({ slider_enabled: event.target.checked })}
          />
        </label>
        <label className="rail-autoplay-toggle">
          <span>Autoplay</span>
          <input
            checked={settings.autoplay}
            disabled={isLoading || isSaving}
            type="checkbox"
            onChange={(event) => onChange({ autoplay: event.target.checked })}
          />
        </label>
        <label className="rail-autoplay-toggle">
          <span>Pause on hover</span>
          <input
            checked={settings.pause_on_hover}
            disabled={isLoading || isSaving}
            type="checkbox"
            onChange={(event) => onChange({ pause_on_hover: event.target.checked })}
          />
        </label>
        <label className="rail-autoplay-toggle">
          <span>Show arrows</span>
          <input
            checked={settings.show_arrows}
            disabled={isLoading || isSaving}
            type="checkbox"
            onChange={(event) => onChange({ show_arrows: event.target.checked })}
          />
        </label>
        <label className="rail-autoplay-toggle">
          <span>Show dots</span>
          <input
            checked={settings.show_dots}
            disabled={isLoading || isSaving}
            type="checkbox"
            onChange={(event) => onChange({ show_dots: event.target.checked })}
          />
        </label>
        <label>
          <span>Slider speed in seconds</span>
          <input
            min="1"
            max="30"
            step="1"
            type="number"
            value={settings.slider_speed_seconds}
            onChange={(event) => onChange({ slider_speed_seconds: Number(event.target.value) || 1 })}
          />
          <small className="upload-hint">Controls how many seconds each hero slide stays visible.</small>
        </label>
      </div>

      <div className="admin-section-card">
        <div className="admin-card-header">
          <div>
            <h3>Overlay content</h3>
            <p>These values apply to the default hero and as fallbacks for slide content.</p>
          </div>
        </div>
        <div className="settings-grid hero-settings-grid">
          <label>
            <span>Eyebrow text</span>
            <input
              placeholder="Discover local events"
              type="text"
              value={settings.eyebrow_text}
              onChange={(event) => onChange({ eyebrow_text: event.target.value })}
            />
          </label>
          <label>
            <span>Badge text</span>
            <input
              placeholder="New"
              type="text"
              value={settings.badge_text}
              onChange={(event) => onChange({ badge_text: event.target.value })}
            />
          </label>
          <label>
            <span>Main headline</span>
            <input
              placeholder="Your next experience starts here"
              type="text"
              value={settings.headline}
              onChange={(event) => onChange({ headline: event.target.value })}
            />
          </label>
          <label>
            <span>Supporting text</span>
            <textarea
              placeholder="Book concerts, restaurants, venues, festivals, theatre, and food events near you."
              value={settings.subtitle}
              onChange={(event) => onChange({ subtitle: event.target.value })}
            />
          </label>
          <label>
            <span>Primary CTA text</span>
            <input
              placeholder="Browse Events"
              type="text"
              value={settings.primary_cta_text}
              onChange={(event) => onChange({ primary_cta_text: event.target.value })}
            />
          </label>
          <label>
            <span>Primary CTA link</span>
            <input
              placeholder="#events"
              type="text"
              value={settings.primary_cta_url}
              onChange={(event) => onChange({ primary_cta_url: event.target.value })}
            />
          </label>
          <label>
            <span>Secondary CTA text</span>
            <input
              placeholder="Create Event"
              type="text"
              value={settings.secondary_cta_text}
              onChange={(event) => onChange({ secondary_cta_text: event.target.value })}
            />
          </label>
          <label>
            <span>Secondary CTA link</span>
            <input
              placeholder="/admin/events/create"
              type="text"
              value={settings.secondary_cta_url}
              onChange={(event) => onChange({ secondary_cta_url: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="admin-section-card">
        <div className="admin-card-header hero-settings-header">
          <div>
            <h3>Hero slides</h3>
            <p>{activeSlides.length > 1 ? `${activeSlides.length} active slides will rotate on the homepage.` : 'Use one active slide for a static hero.'}</p>
          </div>
          <button type="button" onClick={addSlide}>
            <Plus size={16} />
            Add Slide
          </button>
        </div>

        {sortedSlides.length === 0 ? (
          <div className="hero-settings-empty">
            <p>No slides configured yet.</p>
            <button type="button" onClick={addSlide}>
              <Plus size={16} />
              Add your first slide
            </button>
          </div>
        ) : (
          <div className="hero-slide-list">
            {sortedSlides.map((slide, index) => {
              const slideIndex = settings.slides.findIndex((item) => item.id === slide.id)
              const isFirst = index === 0
              const isLast = index === sortedSlides.length - 1
              return (
                <article className="hero-slide-card" key={slide.id}>
                  <div className="hero-slide-card-header">
                    <div>
                      <strong>Slide {index + 1}</strong>
                      <p>{slide.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div className="hero-slide-actions">
                      <button
                        disabled={isLoading || isSaving || isFirst}
                        type="button"
                        onClick={() => onChange({ slides: moveSlide(settings.slides, slideIndex, Math.max(0, slideIndex - 1)) })}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        disabled={isLoading || isSaving || isLast}
                        type="button"
                        onClick={() =>
                          onChange({
                            slides: moveSlide(settings.slides, slideIndex, Math.min(settings.slides.length - 1, slideIndex + 1))
                          })
                        }
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button disabled={isLoading || isSaving} type="button" onClick={() => removeSlide(slide.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="hero-slide-preview">
                    <div className="hero-slide-preview-image" style={{ backgroundImage: slide.background_image_url ? `url(${slide.background_image_url})` : undefined }}>
                      <div className="hero-slide-preview-overlay" />
                      <div className="hero-slide-preview-copy">
                        <span>{slide.eyebrow_text || settings.eyebrow_text}</span>
                        <strong>{slide.title || settings.headline}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="settings-grid hero-settings-grid hero-slide-grid">
                    <label className="rail-autoplay-toggle">
                      <span>Active</span>
                      <input
                        checked={slide.is_active}
                        disabled={isLoading || isSaving}
                        type="checkbox"
                        onChange={(event) => updateSlide(slide.id, { is_active: event.target.checked })}
                      />
                    </label>
                    <label>
                      <span>Sort order</span>
                      <input
                        min="1"
                        type="number"
                        value={slide.sort_order}
                        onChange={(event) =>
                          updateSlide(slide.id, { sort_order: Number(event.target.value) || index + 1 })
                        }
                      />
                    </label>
                    <label>
                      <span>Text alignment</span>
                      <select
                        value={slide.text_alignment}
                        onChange={(event) =>
                          updateSlide(slide.id, {
                            text_alignment: (event.target.value === 'center' || event.target.value === 'right'
                              ? event.target.value
                              : 'left') as HeroSlideData['text_alignment']
                          })
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label>
                      <span>Overlay darkness</span>
                      <input
                        min="0"
                        max="100"
                        type="range"
                        value={slide.overlay_intensity}
                        onChange={(event) => updateSlide(slide.id, { overlay_intensity: Number(event.target.value) || 70 })}
                      />
                      <small className="upload-hint">{slide.overlay_intensity}%</small>
                    </label>
                    <label>
                      <span>Slide title</span>
                      <input
                        placeholder="Your next experience starts here"
                        type="text"
                        value={slide.title}
                        onChange={(event) => updateSlide(slide.id, { title: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Subtitle / description</span>
                      <textarea
                        placeholder="Book concerts, restaurants, venues, festivals, theatre, and food events near you."
                        value={slide.subtitle}
                        onChange={(event) => updateSlide(slide.id, { subtitle: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Eyebrow text</span>
                      <input
                        placeholder="Discover local events"
                        type="text"
                        value={slide.eyebrow_text}
                        onChange={(event) => updateSlide(slide.id, { eyebrow_text: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Badge text</span>
                      <input
                        placeholder="New"
                        type="text"
                        value={slide.badge_text}
                        onChange={(event) => updateSlide(slide.id, { badge_text: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Primary button text</span>
                      <input
                        placeholder="Browse Events"
                        type="text"
                        value={slide.primary_button_text}
                        onChange={(event) => updateSlide(slide.id, { primary_button_text: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Primary button URL</span>
                      <input
                        placeholder="#events"
                        type="text"
                        value={slide.primary_button_url}
                        onChange={(event) => updateSlide(slide.id, { primary_button_url: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Secondary button text</span>
                      <input
                        placeholder="Create Event"
                        type="text"
                        value={slide.secondary_button_text}
                        onChange={(event) => updateSlide(slide.id, { secondary_button_text: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Secondary button URL</span>
                      <input
                        placeholder="/admin/events/create"
                        type="text"
                        value={slide.secondary_button_url}
                        onChange={(event) => updateSlide(slide.id, { secondary_button_url: event.target.value })}
                      />
                    </label>
                    <label className="hero-slide-image-field">
                      <span>Background image URL</span>
                      <input
                        placeholder="https://example.com/hero.jpg"
                        type="text"
                        value={slide.background_image_url}
                        onChange={(event) => updateSlide(slide.id, { background_image_url: event.target.value })}
                      />
                    </label>
                    <div className="hero-slide-upload">
                      <label>
                        <span>Upload image</span>
                        <input
                          accept="image/*"
                          disabled={Boolean(uploadingSlideId)}
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (!file) return
                            void uploadSlideImage(slide.id, file)
                          }}
                        />
                      </label>
                      {uploadingSlideId === slide.id ? (
                        <p className="upload-hint">
                          <RefreshCw className="spinning-icon" size={14} /> Uploading...
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {error ? <p className="record-modal-error">{error}</p> : null}

      <footer className="record-modal-actions hero-settings-actions">
        <button disabled={isLoading || isSaving} type="button" onClick={onReload}>
          <RefreshCw className={isLoading ? 'spinning-icon' : ''} size={17} />
          Reload hero settings
        </button>
        <button
          className="primary-admin-button"
          disabled={isLoading || isSaving}
          type="button"
          onClick={onSave}
        >
          {isSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
          {isSaving ? 'Saving...' : 'Save Hero Settings'}
        </button>
      </footer>

      <div className="hero-settings-preview">
        <div className="admin-card-header">
          <div>
            <h3>Preview</h3>
            <p>The homepage hero will use this layout when no slide is active or when only one slide is enabled.</p>
          </div>
        </div>
        <div className="hero-settings-preview-card">
          <span className="hero-settings-preview-eyebrow">{previewSlide?.eyebrow_text || settings.eyebrow_text}</span>
          <h4>{previewSlide?.title || settings.headline}</h4>
          <p>{previewSlide?.subtitle || settings.subtitle}</p>
          <div className="hero-settings-preview-actions">
            <button type="button">{previewSlide?.primary_button_text || settings.primary_cta_text}</button>
            <button type="button" className="secondary">
              {previewSlide?.secondary_button_text || settings.secondary_cta_text}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
