import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { adjacentItem, swipeDirection } from '../utils/detailNavigation'

export default function DetailNavigation({ items, id, basePath, label, disabled = false, children }) {
  const navigate = useNavigate()
  const start = useRef(null)
  const available = items.length > 1 && !disabled
  const move = direction => {
    const item = adjacentItem(items, id, direction)
    if (available && item) navigate(`${basePath}/${item.id}`, { replace: true })
  }

  return (
    <div
      className="detail-swipe-region"
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
      <nav className="detail-pagination" aria-label={`${label} navigation`}>
        <button type="button" disabled={!available} onClick={() => move(-1)} aria-label={`Previous ${label}`}>← Previous</button>
        <span>{items.length > 1 ? 'Swipe to browse' : label}</span>
        <button type="button" disabled={!available} onClick={() => move(1)} aria-label={`Next ${label}`}>Next →</button>
      </nav>
      {children}
    </div>
  )
}
