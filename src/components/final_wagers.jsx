import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import siteLogo from "../assets/Logo.png";

function getContestantImage(contestant) {
  return (
    contestant?.picture_url ||
    contestant?.elimPhoto_url ||
    contestant?.elim_photo_url ||
    "/fallback.png"
  );
}

function getContestantLabel(contestant) {
  if (!contestant) return "Unknown Contestant";
  return contestant.name || `Contestant ${contestant.id}`;
}

function resolveSeasonWinner(contestants) {
  const rankedContestants = [...contestants]
    .map((contestant) => ({
      ...contestant,
      juryVotes: Number(contestant?.jury_votes_received || 0),
    }))
    .sort((a, b) => {
      if (b.juryVotes !== a.juryVotes) return b.juryVotes - a.juryVotes;
      return (a.name || "").localeCompare(b.name || "");
    });

  const topContestant = rankedContestants[0];
  if (!topContestant || topContestant.juryVotes <= 0) return null;

  const secondContestant = rankedContestants[1];
  if (secondContestant && secondContestant.juryVotes === topContestant.juryVotes) {
    return null;
  }

  return topContestant;
}

export default function FinalWagers() {
  const [profile, setProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [leagueProfiles, setLeagueProfiles] = useState([]);
  const [selectedWinnerId, setSelectedWinnerId] = useState("");
  const [selectedWagerPoints, setSelectedWagerPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  const fetchSubmittedWagers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, team_name, player_name, avatar_url, final_winner_pick, final_wager_points")
      .not("final_winner_pick", "is", null)
      .order("team_name", { ascending: true });

    if (error) {
      console.error(error);
      setLeagueProfiles([]);
      return;
    }

    setLeagueProfiles((data || []).filter((profileItem) => Number(profileItem.final_wager_points || 0) > 0));
  }, []);

  useEffect(() => {
    const loadContestants = async () => {
      const { data, error } = await supabase
        .from("contestants")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setContestants(data || []);
    };

    Promise.resolve().then(() => {
      loadContestants();
    });
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(userError);
        return;
      }

      if (!user) return;

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("bonus_points, total_score")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      const baseProfile = {
        ...(data || {}),
        final_winner_pick: null,
        final_wager_points: 0,
      };

      const { data: finalWagerData, error: finalWagerError } = await supabase
        .from("profiles")
        .select("final_winner_pick, final_wager_points")
        .eq("id", user.id)
        .single();

      if (finalWagerError) {
        console.error(finalWagerError);
        setProfile(baseProfile);
        return;
      }

      const mergedProfile = {
        ...baseProfile,
        ...(finalWagerData || {}),
      };

      setProfile(mergedProfile);
      if (mergedProfile?.final_winner_pick) {
        setSelectedWinnerId(String(mergedProfile.final_winner_pick));
      }
      if (mergedProfile?.final_wager_points) {
        setSelectedWagerPoints(String(mergedProfile.final_wager_points));
        await fetchSubmittedWagers();
      }
    };

    Promise.resolve().then(() => {
      loadProfile();
    });
  }, [fetchSubmittedWagers]);

  const contestantsById = useMemo(() => {
    const map = new Map();
    contestants.forEach((contestant) => {
      map.set(String(contestant.id), contestant);
    });
    return map;
  }, [contestants]);

  const finalistOptions = useMemo(
    () => {
      const activeContestants = contestants.filter((contestant) => !contestant.is_eliminated);
      const source = activeContestants.length > 0 ? activeContestants : contestants;
      return [...source].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    },
    [contestants]
  );

  const resolvedWinner = useMemo(() => resolveSeasonWinner(contestants), [contestants]);
  const currentBonusPoints = Math.max(0, Number(profile?.bonus_points || 0));
  const lockedWagerPoints = Math.max(0, Number(profile?.final_wager_points || 0));
  const hasSubmittedWager = !!profile?.final_winner_pick && lockedWagerPoints > 0;
  const ownPickedContestant = contestantsById.get(String(profile?.final_winner_pick || ""));
  const ownWager = lockedWagerPoints;
  const ownWagerOutcome = resolvedWinner && ownPickedContestant
    ? String(ownPickedContestant.id) === String(resolvedWinner.id)
      ? "winner"
      : "loser"
    : "pending";

  const wagerOptions = useMemo(
    () => Array.from({ length: currentBonusPoints }, (_, index) => String(index + 1)),
    [currentBonusPoints]
  );

  const submitWager = async () => {
    if (!currentUserId || !selectedWinnerId) {
      alert("Pick a winner first.");
      return;
    }

    const parsedWager = Number.parseInt(selectedWagerPoints, 10);
    if (Number.isNaN(parsedWager) || parsedWager < 1) {
      alert("Select how many bonus points you want to wager.");
      return;
    }

    if (parsedWager > currentBonusPoints) {
      alert("You cannot wager more bonus points than you currently have.");
      return;
    }

    const pickedContestant = contestantsById.get(String(selectedWinnerId));
    const confirmed = window.confirm(
      `Are you sure you want to wager ${parsedWager} bonus point${parsedWager === 1 ? "" : "s"} on ${getContestantLabel(pickedContestant)}?`
    );
    if (!confirmed) return;

    setLoading(true);
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({
        final_winner_pick: Number(selectedWinnerId),
        final_wager_points: parsedWager,
      })
      .eq("id", currentUserId);

    if (error) {
      console.error(error);
      alert("Final wager columns are not available in Supabase yet. Run the SQL update first.");
      setLoading(false);
      return;
    }

    const nextProfile = {
      ...(profile || {}),
      final_winner_pick: Number(selectedWinnerId),
      final_wager_points: parsedWager,
    };
    setProfile(nextProfile);
    setSaved(true);
    await fetchSubmittedWagers();
    setLoading(false);
  };

  return (
    <div style={{ padding: "12px" }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: "block", width: "min(180px, 46vw)", margin: "0 auto 0.75rem auto" }} />
      <h1 style={{ fontSize: "clamp(1.6rem, 7vw, 2.1rem)", fontWeight: "bold", marginBottom: "10px", textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Final Wagers
      </h1>
      <p style={{ textAlign: "center", marginBottom: "10px", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Pick the season winner, wager from your current bonus points, and lock it in once.
      </p>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        <Link to="/weekly-picks" style={{ color: "#fef08a", fontWeight: "bold" }}>Back to Weekly Picks</Link>
      </p>

      <div style={{ width: "100%", maxWidth: "980px", margin: "0 auto" }}>
        <div style={{ marginBottom: "16px", padding: "14px", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: "10px", border: "1px solid rgba(209,213,219,0.9)", backdropFilter: "blur(2px)" }}>
          <p style={{ margin: "0 0 8px 0", textAlign: "center", color: "#111827", fontWeight: "bold" }}>
            Current Bonus Points: {currentBonusPoints}
          </p>
          {hasSubmittedWager && (
            <p style={{ margin: "0 0 8px 0", textAlign: "center", color: "#374151", fontWeight: "bold" }}>
              Locked Final Wager: {lockedWagerPoints}
            </p>
          )}
          <p style={{ margin: 0, textAlign: "center", color: "#374151" }}>
            Current Total Score: {Number(profile?.total_score || 0)}
          </p>
        </div>

        {resolvedWinner && (
          <div style={{ marginBottom: "16px", padding: "14px", backgroundColor: "rgba(236,253,245,0.92)", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.35)", backdropFilter: "blur(2px)" }}>
            <p style={{ margin: 0, textAlign: "center", color: "#166534", fontWeight: "bold" }}>
              Season winner locked: {getContestantLabel(resolvedWinner)} with {Number(resolvedWinner.jury_votes_received || 0)} jury vote{Number(resolvedWinner.jury_votes_received || 0) === 1 ? "" : "s"}.
            </p>
          </div>
        )}

        {hasSubmittedWager ? (
          <div style={{ marginBottom: "18px", padding: "14px", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: "10px", border: "1px solid rgba(209,213,219,0.9)", backdropFilter: "blur(2px)" }}>
            <p style={{ margin: "0 0 8px 0", textAlign: "center", color: "#111827", fontWeight: "bold" }}>
              Your final wager is locked in.
            </p>
            <p style={{ margin: 0, textAlign: "center", color: ownWagerOutcome === "winner" ? "#166534" : ownWagerOutcome === "loser" ? "#991b1b" : "#374151", fontWeight: "bold" }}>
              {getContestantLabel(ownPickedContestant)} for {ownWager} point{ownWager === 1 ? "" : "s"}
              {ownWagerOutcome === "winner" ? ` | +${ownWager} points` : ownWagerOutcome === "loser" ? ` | -${ownWager} points` : ""}
            </p>
          </div>
        ) : currentBonusPoints === 0 ? (
          <div style={{ marginBottom: "18px", padding: "14px", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: "10px", border: "1px solid rgba(209,213,219,0.9)", backdropFilter: "blur(2px)" }}>
            <p style={{ margin: 0, textAlign: "center", color: "#111827", fontWeight: "bold" }}>
              You need at least 1 bonus point to place a final wager.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: "18px", padding: "14px", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: "10px", border: "1px solid rgba(209,213,219,0.9)", backdropFilter: "blur(2px)" }}>
            <p style={{ margin: "0 0 12px 0", fontWeight: "bold", color: "#111827" }}>Pick the winner</p>
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "6px", scrollSnapType: "x mandatory" }}>
              {finalistOptions.map((contestant) => {
                const contestantId = String(contestant.id);
                const imageFailed = imageErrors[contestantId];
                const selected = selectedWinnerId === contestantId;
                return (
                  <button
                    key={`final-wager-pick-${contestant.id}`}
                    onClick={() => setSelectedWinnerId(contestantId)}
                    style={{
                      flex: "0 0 min(220px, 62vw)",
                      border: selected ? "2px solid #0f766e" : "1px solid #d1d5db",
                      borderRadius: "12px",
                      background: selected ? "rgba(236,253,245,0.96)" : "rgba(255,255,255,0.92)",
                      cursor: "pointer",
                      padding: "12px 8px",
                      scrollSnapAlign: "start",
                    }}
                  >
                    {!imageFailed ? (
                      <img
                        src={getContestantImage(contestant)}
                        alt={getContestantLabel(contestant)}
                        style={{ width: "100%", height: "clamp(180px, 46vw, 260px)", objectFit: "cover", borderRadius: "10px", backgroundColor: "#f3f4f6" }}
                        onError={() => setImageErrors((prev) => ({ ...prev, [contestantId]: true }))}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "clamp(180px, 46vw, 260px)", borderRadius: "10px", background: "linear-gradient(160deg, #e5c07b, #c2410c)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", padding: "10px", textAlign: "center" }}>
                        {getContestantLabel(contestant)}
                      </div>
                    )}
                    <p style={{ margin: "10px 0 0 0", fontWeight: "bold", fontSize: "0.95rem", lineHeight: 1.2 }}>{getContestantLabel(contestant)}</p>
                  </button>
                );
              })}
            </div>

            <label htmlFor="final-wager-points" style={{ display: "block", margin: "12px 0 8px 0", color: "#374151", fontWeight: "bold", fontSize: "0.9rem" }}>
              Wager amount
            </label>
            <select
              id="final-wager-points"
              value={selectedWagerPoints}
              onChange={(event) => setSelectedWagerPoints(event.target.value)}
              disabled={loading}
              style={{ width: "100%", borderRadius: "10px", border: "1px solid rgba(156,163,175,0.9)", background: "rgba(255,255,255,0.98)", color: "#111827", fontWeight: "bold", padding: "10px 12px" }}
            >
              <option value="">Select wager</option>
              {wagerOptions.map((value) => (
                <option key={`wager-${value}`} value={value}>
                  {value} Point{value === "1" ? "" : "s"}
                </option>
              ))}
            </select>

            <button
              onClick={submitWager}
              disabled={loading}
              style={{ width: "100%", marginTop: "12px", border: "none", borderRadius: "10px", background: "#0f766e", color: "white", fontWeight: "bold", padding: "10px 12px", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Saving wager..." : "Submit Final Wager"}
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "6px" }}>
          {saved && <p style={{ color: "#bbf7d0", textShadow: "0 2px 8px rgba(0,0,0,0.6)", fontWeight: "bold", fontSize: "18px" }}>Final wager saved!</p>}
          {loading && <p style={{ color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)", fontSize: "16px" }}>Saving...</p>}
        </div>

        {hasSubmittedWager && (
          <div style={{ width: "100%", maxWidth: "980px", margin: "24px auto 0 auto" }}>
            <h2 style={{ textAlign: "center", marginBottom: "12px", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Final Wager Picks</h2>
            {leagueProfiles.length === 0 ? (
              <p style={{ textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>No final wagers have been submitted yet.</p>
            ) : (
              <div style={{ display: "flex", gap: "12px", overflowX: "auto", padding: "4px 2px 8px 2px", scrollSnapType: "x mandatory" }}>
                {leagueProfiles.map((profileItem) => {
                  const pickedContestant = contestantsById.get(String(profileItem.final_winner_pick || ""));
                  const wagerPoints = Number(profileItem.final_wager_points || 0);
                  const outcome = resolvedWinner && pickedContestant
                    ? String(pickedContestant.id) === String(resolvedWinner.id)
                      ? "winner"
                      : "loser"
                    : "pending";
                  const isLosingPick = outcome === "loser";

                  return (
                    <div
                      key={profileItem.id}
                      style={{
                        flex: "0 0 calc((100% - 24px) / 3)",
                        minWidth: "112px",
                        scrollSnapAlign: "start",
                        border: "1px solid rgba(209,213,219,0.9)",
                        borderRadius: "12px",
                        backgroundColor: isLosingPick ? "rgba(229,231,235,0.72)" : "rgba(255,255,255,0.9)",
                        backdropFilter: "blur(2px)",
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        opacity: isLosingPick ? 0.62 : 1,
                        filter: isLosingPick ? "grayscale(100%)" : "none",
                      }}
                    >
                      <p style={{ margin: "0 0 7px 0", fontWeight: "bold", textAlign: "center", fontSize: "0.82rem", lineHeight: 1.15, minHeight: "2.3em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {profileItem.team_name || "Unnamed Team"}
                      </p>
                      <img
                        src={getContestantImage(pickedContestant)}
                        alt={getContestantLabel(pickedContestant)}
                        style={{ width: "100%", height: "clamp(180px, 46vw, 260px)", objectFit: "cover", borderRadius: "10px", backgroundColor: "#f3f4f6" }}
                      />
                      <p style={{ margin: "8px 0 0 0", fontWeight: "bold", textAlign: "center", fontSize: "0.84rem", minHeight: "2.4em", lineHeight: 1.2 }}>
                        {getContestantLabel(pickedContestant)}
                      </p>
                      <p style={{ margin: "6px 0 0 0", textAlign: "center", color: "#374151", fontWeight: "bold", fontSize: "0.8rem" }}>
                        Wager: {wagerPoints}
                      </p>
                      {outcome === "winner" && (
                        <p style={{ margin: "7px 0 0 0", fontWeight: "bold", textAlign: "center", color: "#166534", fontSize: "0.8rem" }}>
                          +{wagerPoints} Points
                        </p>
                      )}
                      {outcome === "loser" && (
                        <p style={{ margin: "7px 0 0 0", fontWeight: "bold", textAlign: "center", color: "#991b1b", fontSize: "0.8rem" }}>
                          -{wagerPoints} Points
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
