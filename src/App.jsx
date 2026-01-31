import React, { useState } from 'react'
import ContestantsGrid from './components/ContestantsGrid'
import ContestantDetail from './components/ContestantDetail'

function App() {
  const [selected, setSelected] = useState(null)
  const [allContestants, setAllContestants] = useState([])

  const handleSelect = (contestant, contestants) => {
    setAllContestants(contestants)
    setSelected(contestant)
  }

  if (selected) {
    return (
      <ContestantDetail
        contestants={allContestants}
        selected={selected}
        onClose={() => setSelected(null)}
      />
    )
  }

  return <ContestantsGrid onSelect={handleSelect} />
}

export default App
