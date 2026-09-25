import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { adjacentItem, swipeDirection } from '../utils/detailNavigation'

export default function DetailNavigation({ items, id, basePath, label, disabled = false, previews = false, renderPreview, children }) {
  const navigate = useNavigate()
  const start = useRef(null)
  const available = items.length > 1 && !disabled
  const move = direction => {
    const item = adjacentItem(items, id, direction)
    if (available && item) navigate(`${basePath}/${item.id}`, { replace: true })
  }

  return (
    <div
      className={`detail-swipe-region${previews ? ' has-previews' : ''}`}
      tabIndex={previews ? 0 : undefined}
      aria-label={previews ? `${label} cards. Swipe left or right, or use arrow keys to browse.` : undefined}
      onKeyDown={event => {
        if (!previews || event.target !== event.currentTarget) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          move(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
      onTouchStart={event => {
        const interactive = event.target.closest('button, a, input, select, textarea')
        start.current = available && !interactive && event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null
      }}
      onTouchCancel={() => { start.current = null }}
      onTouchEnd={event => {
        const origin = start.current
        start.current = null
        if (!origin || event.touches.length || !event.changedTouches.length) return
        const touch = event.changedTouches[0]
        const direction = swipeDirection(touch.clientX - origin.x, touch.clientY - origin.y)
        if (direction) move(direction)
      }}
    >
      {previews ? [-1, 1].map(direction => {
        const item = adjacentItem(items, id, direction)
        return item && <div key={direction} className={`castaway-card-preview ${direction < 0 ? 'is-previous' : 'is-next'}`} aria-hidden="true">
          {renderPreview ? renderPreview(item) : <>
          <img src={item.picture_url} alt="" style={{ filter: item.is_eliminated ? 'grayscale(1)' : 'none' }} />
          <h2>{item.display_name || item.name}</h2>
          </>}
        </div>
      }) : <nav className="detail-side-navigation" aria-label={`${label} navigation`}>
        <button className="detail-side-arrow is-previous" type="button" disabled={!available} onClick={() => move(-1)} aria-label={`Previous ${label}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <button className="detail-side-arrow is-next" type="button" disabled={!available} onClick={() => move(1)} aria-label={`Next ${label}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </nav>}
      {children}
    </div>
  )
}
