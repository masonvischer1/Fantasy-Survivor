import siteLogo from '../assets/Logo.png'

export default function Rules() {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(229,231,235,0.9)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(2px)' }}>
        <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(180px, 46vw)', margin: '0 auto 0.75rem auto' }} />
        <h1 style={{ textAlign: 'center', fontSize: 'clamp(2.1rem, 7vw, 2.8rem)', marginTop: '0.25rem' }}>The Rules</h1>

        <h2>THE DRAFT</h2>
        <p>
          Your starting tribe will consist of 5 players. At the merge episode, you will be
          able to add a 6th player to your tribe.
        </p>

        <h2>SCORING</h2>
        <p>
          Players on your tribe will earn 1 point for every day they last in the game. If you
          have any players on your tribe in the final 3, you will earn 1 point for every vote
          they receive from the jury to win the game.
        </p>

        <h2>WEEKLY PICKS</h2>
        <p>
          Each week, before the episode airs, you will be given a chance to pick the tribe or
          player that you think will WIN the immunity challenge. In the tribe phase of the game,
          you must select from the 3 starting tribes, and in the individual phase of the game,
          you must select from any remaining contestant.
        </p>
        <p>
          A correct pick in the tribal phase of the game will earn your team 5 bonus points.
          A correct pick in the individual phase of the game will earn your team bonus points
          equal to the number of players remaining in the game! (Example: if there are
          12 players remaining you will earn 12 bonus points)
        </p>
        <p>
          Note: The tribe or player you pick MUST win FIRST place in the IMMUNITY challenge.
          Second place in immunity challenges do not count. Reward challenge wins also do not count.
        </p>

        <h2>FINAL WAGERS</h2>
        <p>
          Before the season finale airs, you will be allowed to wager any amount of BONUS POINTS
          that you currently have (not total score) to guess the season Winner. A correct choice
          will add the amount that you wagered to your score... BUT, an incorrect choice will
          deduct the amount that you wagered from your score.
        </p>

        <h2>TIEBREAKERS</h2>
        <p>
          The player with the most points at the end of the season finale will win our Survivor 50
          FANTASY DRAFT! In the event of a tie score, the tiebreaker will go to the person who had
          the player that lasted the longest in the game. If the tie still cannot be broken, the
          tiebreaker will go to the person with the player that lasted the second longest in the game,
          and so on.
        </p>
      </div>
    </div>
  )
}
