import React, { useState } from 'react'

function ContestantDetail({ contestants, selected, onClose }) {
  const startIndex = contestants.findIndex(c => c.id === selected.id)
  const [index, setIndex] = useState(startIndex)

  const contestant = contestants[index]

  const next = () =>
    setIndex((index + 1) % contestants.length)

  const prev = () =>
    setIndex(
      (index - 1 + contestants.length) % contestants.length
    )

  return (
    <div style={{ padding: '2rem' }}>
      <button onClick={onClose}>← Back</button>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <img
          src={contestant.picture_url}
          alt={contestant.name}
          style={{
            width: '250px',
            borderRadius: '10px'
          }}
        />

        <h2>{contestant.name}</h2>
        <p><b>Season:</b> {contestant.season}</p>
        <p><b>Tribe:</b> {contestant.tribe}</p>
        <p><b>Score:</b> {contestant.score}</p>
        <p style={{ maxWidth: '600px', margin: 'auto' }}>
          {contestant.bio}
        </p>

        <div style={{ marginTop: '1rem' }}>
          <button onClick={prev}>← Prev</button>
          <button onClick={next} style={{ marginLeft: '1rem' }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContestantDetail