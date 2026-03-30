import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import siteLogo from "../assets/Logo.png";
import leftArrowIcon from "../assets/arrow-left-circle.svg";
import rightArrowIcon from "../assets/arrow-right-circle.svg";
import kaloBuff from "../assets/Survivor_50_Kalo_Buff.png";
import cilaBuff from "../assets/Survivor_50_Cila_Buff.png";
import vatuBuff from "../assets/Survivor_50_Vatu_Buff.png";

const TOTAL_EPISODES = 14;
const DEFAULT_OPEN_WEEK = 6;
const TEAMS = [
  { name: "Kalo", flagSrc: kaloBuff },
  { name: "Cila", flagSrc: cilaBuff },
  { name: "Vatu", flagSrc: vatuBuff },
];

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

function resolveContestantFromPickValue(pickValue, contestantsById, contestants) {
  if (!pickValue) return null;

  const normalizedPickValue = String(pickValue);
  return contestantsById.get(normalizedPickValue) || contestants.find((contestant) => String(contestant.name) === normalizedPickValue) || null;
}

function getTeamPick(pickValue) {
  if (!pickValue) return null;
  return TEAMS.find((team) => team.name === String(pickValue)) || null;
}

function getPickPresentation(pickValue, contestantsById, contestants) {
  const teamPick = getTeamPick(pickValue);
  if (teamPick) {
    return {
      label: teamPick.name,
      imageSrc: teamPick.flagSrc,
      contestantId: null,
    };
  }

  const contestant = resolveContestantFromPickValue(pickValue, contestantsById, contestants);
  if (contestant) {
    return {
      label: getContestantLabel(contestant),
      imageSrc: getContestantImage(contestant),
      contestantId: String(contestant.id),
    };
  }

  return {
    label: String(pickValue || "No Pick"),
    imageSrc: null,
    contestantId: null,
  };
}

function getPickColor(label) {
  if (label === "Kalo") return "#95ECF0";
  if (label === "Cila") return "#F97316";
  if (label === "Vatu") return "#EE0372";

  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 56%)`;
}

export default function WeeklyPicks({ currentWeek = DEFAULT_OPEN_WEEK }) {
  const [profile, setProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(DEFAULT_OPEN_WEEK);
  const [leagueProfiles, setLeagueProfiles] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [adminWinnerIdsByWeek, setAdminWinnerIdsByWeek] = useState({});
  const [adminBonusPointsByWeek, setAdminBonusPointsByWeek] = useState({});
  const [adminWinnerSaving, setAdminWinnerSaving] = useState(false);
  const [weeklyResultByWeek, setWeeklyResultByWeek] = useState({});

  useEffect(() => {
    let isMounted = true;

    const loadDefaultWeek = async () => {
      const { data, error } = await supabase
        .from("weekly_immunity_results")
        .select("week, winner_team, winner_contestant_id, winner_contestant_ids")
        .order("week", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (!isMounted) return;

      const latestResolvedRow = (data || []).find((row) => {
        const hasIndividualWinners = Array.isArray(row?.winner_contestant_ids) && row.winner_contestant_ids.length > 0;
        return !!row?.winner_team || !!row?.winner_contestant_id || hasIndividualWinners;
      });

      const latestResolvedWeek = Number(latestResolvedRow?.week || 0);
      const nextOpenWeek = Math.min(TOTAL_EPISODES, Math.max(1, latestResolvedWeek + 1));

      setSelectedWeek(nextOpenWeek);
    };

    Promise.resolve().then(() => {
      loadDefaultWeek();
    });

    return () => {
      isMounted = false;
    };
  }, [currentWeek]);

  const fetchLeagueProfiles = useCallback(async (weekNum) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, team_name, player_name, weekly_picks")
      .order("team_name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const submittedForWeek = (data || []).filter((p) => !!p.weekly_picks?.[weekNum]);
    setLeagueProfiles(submittedForWeek);
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
    const load = async () => {
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
        .select("weekly_picks, is_admin")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile(data);
        setIsAdmin(!!data?.is_admin);
        if (data?.weekly_picks?.[selectedWeek]) {
          await fetchLeagueProfiles(selectedWeek);
        } else {
          setLeagueProfiles([]);
        }
      }
    };

    Promise.resolve().then(() => {
      load();
    });
  }, [fetchLeagueProfiles, selectedWeek]);

  useEffect(() => {
    if (!profile?.weekly_picks?.[selectedWeek]) {
      Promise.resolve().then(() => {
        setLeagueProfiles([]);
      });
      return;
    }
    Promise.resolve().then(() => {
      fetchLeagueProfiles(selectedWeek);
    });
  }, [selectedWeek, profile, fetchLeagueProfiles]);

  useEffect(() => {
    const loadWeeklyWinner = async () => {
      const { data, error } = await supabase
        .from("weekly_immunity_results")
        .select("week, phase, winner_team, winner_contestant_id, winner_contestant_ids, players_remaining, bonus_points_awarded")
        .eq("week", selectedWeek)
        .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      setWeeklyResultByWeek((prev) => ({
        ...prev,
        [selectedWeek]: data || null,
      }));

      if (!isAdmin) return;

      const winnerIds = Array.isArray(data?.winner_contestant_ids)
        ? data.winner_contestant_ids.map((value) => String(value))
        : data?.winner_contestant_id
          ? [String(data.winner_contestant_id)]
          : [];
      setAdminWinnerIdsByWeek((prev) => ({
        ...prev,
        [selectedWeek]: winnerIds,
      }));
      setAdminBonusPointsByWeek((prev) => ({
        ...prev,
        [selectedWeek]: data?.bonus_points_awarded ? String(data.bonus_points_awarded) : data?.players_remaining ? String(data.players_remaining) : "",
      }));
    };

    Promise.resolve().then(() => {
      loadWeeklyWinner();
    });
  }, [isAdmin, selectedWeek]);

  const contestantsById = useMemo(() => {
    const map = new Map();
    contestants.forEach((contestant) => {
      map.set(String(contestant.id), contestant);
    });
    return map;
  }, [contestants]);

  const remainingContestants = useMemo(
    () =>
      contestants
        .filter((contestant) => !contestant.is_eliminated)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [contestants]
  );

  const adminWinnerOptions = useMemo(() => {
    const activeIds = new Set(remainingContestants.map((contestant) => String(contestant.id)));
    const merged = [...remainingContestants];

    contestants.forEach((contestant) => {
      const key = String(contestant.id);
      if (!activeIds.has(key)) {
        merged.push(contestant);
      }
    });

    return merged;
  }, [contestants, remainingContestants]);

  const handlePick = async (weekNum, contestant) => {
    if (!profile || !currentUserId) return;

    const contestantId = String(contestant.id);
    const contestantName = getContestantLabel(contestant);
    const confirmed = window.confirm(`Are you sure you want to select ${contestantName} for Week ${weekNum}?`);
    if (!confirmed) return;

    setLoading(true);
    setSaved(false);

    const updatedPicks = {
      ...(profile.weekly_picks || {}),
      [weekNum]: contestantId,
    };

    const { error } = await supabase
      .from("profiles")
      .update({ weekly_picks: updatedPicks })
      .eq("id", currentUserId);

    if (error) {
      console.error(error);
    } else {
      setProfile((prev) => ({ ...prev, weekly_picks: updatedPicks }));
      setSaved(true);
      await fetchLeagueProfiles(weekNum);
    }

    setLoading(false);
  };

  const goBackWeek = () => setSelectedWeek((prev) => Math.max(1, prev - 1));
  const goForwardWeek = () => setSelectedWeek((prev) => Math.min(TOTAL_EPISODES, prev + 1));

  const currentWeekPick = profile?.weekly_picks?.[selectedWeek];
  const hasOwnPickThisWeek = !!currentWeekPick;
  const selectedWinnerIds = adminWinnerIdsByWeek?.[selectedWeek] || [];
  const selectedBonusPoints = adminBonusPointsByWeek?.[selectedWeek] || "";
  const selectedWeeklyResult = weeklyResultByWeek?.[selectedWeek] || null;
  const resolvedWinnerIds = selectedWeeklyResult?.phase === "individual"
    ? (
      Array.isArray(selectedWeeklyResult?.winner_contestant_ids) && selectedWeeklyResult.winner_contestant_ids.length > 0
        ? selectedWeeklyResult.winner_contestant_ids.map((value) => String(value))
        : selectedWeeklyResult?.winner_contestant_id
          ? [String(selectedWeeklyResult.winner_contestant_id)]
          : []
    )
    : [];
  const resolvedPlayersRemaining = Number(selectedWeeklyResult?.players_remaining || remainingContestants.length || 0);
  const resolvedBonusPoints = Number(selectedWeeklyResult?.bonus_points_awarded || selectedWeeklyResult?.players_remaining || 0);
  const hasResolvedWinner = resolvedWinnerIds.length > 0;
  const ownPickPresentation = getPickPresentation(currentWeekPick, contestantsById, contestants);
  const displayedPlayersRemaining = Number(selectedWeeklyResult?.players_remaining || remainingContestants.length || 0);
  const bonusPointOptions = useMemo(
    () => Array.from({ length: Math.max(contestants.length, displayedPlayersRemaining, 1) }, (_, index) => String(index + 1)),
    [contestants.length, displayedPlayersRemaining]
  );

  useEffect(() => {
    if (!isAdmin) return;

    setAdminBonusPointsByWeek((prev) => {
      if (prev?.[selectedWeek]) return prev;
      return {
        ...prev,
        [selectedWeek]: String(displayedPlayersRemaining || 1),
      };
    });
  }, [displayedPlayersRemaining, isAdmin, selectedWeek]);

  const handleAdminWinnerToggle = (winnerId) => {
    setAdminWinnerIdsByWeek((prev) => {
      const currentWinnerIds = prev?.[selectedWeek] || [];
      const nextWinnerIds = currentWinnerIds.includes(winnerId)
        ? currentWinnerIds.filter((value) => value !== winnerId)
        : [...currentWinnerIds, winnerId];
      return {
        ...prev,
        [selectedWeek]: nextWinnerIds,
      };
    });
  };

  const handleAdminBonusPointsChange = (event) => {
    setAdminBonusPointsByWeek((prev) => ({
      ...prev,
      [selectedWeek]: event.target.value,
    }));
  };

  const saveAdminWinner = async () => {
    const parsedBonusPoints = Number.parseInt(selectedBonusPoints, 10);

    if (selectedWinnerIds.length === 0) {
      alert("Select at least one immunity winner.");
      return;
    }

    if (Number.isNaN(parsedBonusPoints) || parsedBonusPoints < 1) {
      alert("Select how many bonus points should be awarded.");
      return;
    }

    setAdminWinnerSaving(true);

    const { error } = await supabase.rpc("admin_set_weekly_immunity_result", {
      p_week: selectedWeek,
      p_phase: "individual",
      p_winner_team: null,
      p_winner_contestant_id: Number(selectedWinnerIds[0]),
      p_players_remaining: remainingContestants.length,
      p_bonus_points_awarded: parsedBonusPoints,
      p_winner_contestant_ids: selectedWinnerIds.map((value) => Number(value)),
    });

    if (error) {
      console.error(error);
      setAdminWinnerSaving(false);
      return;
    }

    setWeeklyResultByWeek((prev) => ({
      ...prev,
      [selectedWeek]: {
        week: selectedWeek,
        phase: "individual",
        winner_team: null,
        winner_contestant_id: Number(selectedWinnerIds[0]),
        winner_contestant_ids: selectedWinnerIds.map((value) => Number(value)),
        players_remaining: remainingContestants.length,
        bonus_points_awarded: parsedBonusPoints,
      },
    }));
    await fetchLeagueProfiles(selectedWeek);
    setAdminWinnerSaving(false);
  };

  const pickBreakdown = useMemo(() => {
    if (!hasOwnPickThisWeek || leagueProfiles.length === 0) return null;

    const counts = new Map();

    leagueProfiles.forEach((profileItem) => {
      const contestantId = String(profileItem.weekly_picks?.[selectedWeek] || "");
      if (!contestantId) return;
      counts.set(contestantId, (counts.get(contestantId) || 0) + 1);
    });

    if (counts.size === 0) return null;

    const rows = Array.from(counts.entries())
      .map(([contestantId, count]) => {
        const pickPresentation = getPickPresentation(contestantId, contestantsById, contestants);
        const percentage = (count / leagueProfiles.length) * 100;
        return {
          contestantId,
          pickPresentation,
          count,
          percentage,
          percentageLabel: `${Math.round(percentage)}%`,
          color: getPickColor(pickPresentation.label),
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.pickPresentation.label.localeCompare(b.pickPresentation.label);
      });

    return {
      total: leagueProfiles.length,
      rows,
      gradientStops: rows.reduce((acc, row, index) => {
        const start = index === 0 ? 0 : acc.running;
        const end = start + row.percentage;
        acc.running = end;
        acc.stops.push(`${row.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
        return acc;
      }, { running: 0, stops: [] }).stops.join(", "),
    };
  }, [contestants, contestantsById, hasOwnPickThisWeek, leagueProfiles, selectedWeek]);

  return (
    <div
      style={{
        padding: "12px",
      }}
    >
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: "block", width: "min(180px, 46vw)", margin: "0 auto 0.75rem auto" }} />
      <h1 style={{ fontSize: "clamp(1.6rem, 7vw, 2.1rem)", fontWeight: "bold", marginBottom: "10px", textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Survivor Picks
      </h1>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Pick the individual immunity winner each week. Admin can award the selected bonus value for any winning picks.
      </p>

      <div style={{ width: "100%", maxWidth: "980px", margin: "0 auto 14px auto" }}>
        <div style={{ padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: "10px", border: "1px solid rgba(209,213,219,0.9)", backdropFilter: "blur(2px)" }}>
          <p style={{ margin: 0, textAlign: "center", color: "#111827", fontWeight: "bold" }}>
            {displayedPlayersRemaining} Players Remaining
          </p>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: "980px", margin: "0 auto" }}>
        {hasOwnPickThisWeek && (
          <div style={{ marginBottom: "20px", padding: "14px", backgroundColor: "rgba(255,255,255,0.86)", borderRadius: "10px", border: "1px solid rgba(209,213,219,0.9)", backdropFilter: "blur(2px)" }}>
            <p style={{ margin: 0, textAlign: "center", color: "#4b5563" }}>
              Your Week {selectedWeek} pick is locked in.
            </p>
          </div>
        )}

        {!hasOwnPickThisWeek && (
          <div
            style={{
              marginBottom: "14px",
              padding: "14px",
              backgroundColor: "rgba(255,255,255,0.86)",
              borderRadius: "10px",
              border: "1px solid rgba(209,213,219,0.9)",
              backdropFilter: "blur(2px)",
            }}
          >
            <p style={{ margin: "0 0 12px 0", fontWeight: "bold" }}>Week {selectedWeek}</p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                overflowX: "auto",
                paddingBottom: "6px",
                scrollSnapType: "x mandatory",
              }}
            >
              {remainingContestants.map((contestant) => {
                const imageKey = String(contestant.id);
                const imageFailed = imageErrors[imageKey];
                return (
                  <button
                    key={`${selectedWeek}-select-${contestant.id}`}
                    onClick={() => handlePick(selectedWeek, contestant)}
                    style={{
                      flex: "0 0 min(220px, 62vw)",
                      border: "1px solid #d1d5db",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.86)",
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
                        onError={() => setImageErrors((prev) => ({ ...prev, [imageKey]: true }))}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "clamp(180px, 46vw, 260px)",
                          borderRadius: "10px",
                          background: "linear-gradient(160deg, #e5c07b, #c2410c)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: "bold",
                          padding: "10px",
                          textAlign: "center",
                        }}
                      >
                        {getContestantLabel(contestant)}
                      </div>
                    )}
                    <p style={{ margin: "10px 0 0 0", fontWeight: "bold", fontSize: "0.95rem", lineHeight: 1.2 }}>{getContestantLabel(contestant)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(42px,56px) minmax(140px, 220px) minmax(42px,56px)", gap: "0.65rem", alignItems: "center", justifyContent: "center", marginTop: "8px" }}>
          <button
            onClick={goBackWeek}
            disabled={selectedWeek === 1}
            aria-label="Previous week"
            style={{
              width: "clamp(42px, 10vw, 56px)",
              height: "clamp(42px, 10vw, 56px)",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: selectedWeek === 1 ? "not-allowed" : "pointer",
              opacity: selectedWeek === 1 ? 0.5 : 1
            }}
          >
            <img src={leftArrowIcon} alt="Previous" width="48" height="48" style={{ display: "block", filter: "brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }} />
          </button>
          <div style={{ textAlign: "center", padding: "0.55rem 0.75rem", borderRadius: "12px", border: "1px solid rgba(209,213,219,0.9)", backgroundColor: "rgba(255,255,255,0.86)", backdropFilter: "blur(2px)" }}>
            <span style={{ fontWeight: "bold", color: "#111827" }}>Week {selectedWeek}</span>
          </div>
          <button
            onClick={goForwardWeek}
            disabled={selectedWeek === TOTAL_EPISODES}
            aria-label="Next week"
            style={{
              width: "clamp(42px, 10vw, 56px)",
              height: "clamp(42px, 10vw, 56px)",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: selectedWeek === TOTAL_EPISODES ? "not-allowed" : "pointer",
              opacity: selectedWeek === TOTAL_EPISODES ? 0.5 : 1
            }}
          >
            <img src={rightArrowIcon} alt="Next" width="48" height="48" style={{ display: "block", filter: "brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }} />
          </button>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "6px" }}>
        {saved && <p style={{ color: "#bbf7d0", textShadow: "0 2px 8px rgba(0,0,0,0.6)", fontWeight: "bold", fontSize: "18px" }}>Pick saved!</p>}
        {loading && <p style={{ color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)", fontSize: "16px" }}>Saving...</p>}
      </div>

      {hasOwnPickThisWeek && (
        <div style={{ width: "100%", maxWidth: "980px", margin: "24px auto 0 auto" }}>
          <h2 style={{ textAlign: "center", marginBottom: "12px", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Week {selectedWeek} Picks</h2>
          {ownPickPresentation && currentWeekPick && (
            <p style={{ textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)", marginTop: 0 }}>
              Your pick: <b>{ownPickPresentation.label}</b>
            </p>
          )}
          {leagueProfiles.length === 0 && (
            <p style={{ textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>No teams have submitted Week {selectedWeek} picks yet.</p>
          )}

          {leagueProfiles.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                padding: "4px 2px 8px 2px",
                scrollSnapType: "x mandatory"
              }}
            >
              {leagueProfiles.map((p) => {
                const pickId = String(p.weekly_picks?.[selectedWeek] || "");
                const pickPresentation = getPickPresentation(p.weekly_picks?.[selectedWeek], contestantsById, contestants);
                const pickedContestantId = pickPresentation.contestantId || pickId;
                const isResolvedWeek = !!selectedWeeklyResult;
                const isWinningPick = selectedWeeklyResult?.phase === "tribal"
                  ? String(p.weekly_picks?.[selectedWeek]) === String(selectedWeeklyResult?.winner_team)
                  : hasResolvedWinner && resolvedWinnerIds.includes(String(pickedContestantId));
                const isLosingPick = isResolvedWeek && !!p.weekly_picks?.[selectedWeek] && !isWinningPick;

                return (
                  <div
                    key={p.id}
                    data-status={isResolvedWeek ? (isWinningPick ? "winner" : "loser") : "pending"}
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
                    <p
                      style={{
                        margin: "0 0 7px 0",
                        fontWeight: "bold",
                        textAlign: "center",
                        fontSize: "0.82rem",
                        lineHeight: 1.15,
                        minHeight: "2.3em",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}
                    >
                      {p.team_name || "Unnamed Team"}
                    </p>

                    {pickPresentation.imageSrc ? (
                      <img
                        src={pickPresentation.imageSrc}
                        alt={pickPresentation.label}
                        style={{
                          width: "100%",
                          height: "clamp(180px, 46vw, 260px)",
                          objectFit: "cover",
                          borderRadius: "10px",
                          backgroundColor: "#f3f4f6"
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "clamp(180px, 46vw, 260px)",
                          borderRadius: "10px",
                          backgroundColor: "#e5e7eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#111827",
                          fontWeight: "bold",
                          textAlign: "center",
                          padding: "10px"
                        }}
                      >
                        No Pick
                      </div>
                    )}

                    <p
                      style={{
                        margin: "8px 0 0 0",
                        fontWeight: "bold",
                        textAlign: "center",
                        fontSize: "0.84rem",
                        minHeight: "2.4em",
                        lineHeight: 1.2
                      }}
                    >
                      {pickPresentation.label || "No Pick"}
                    </p>

                    {isWinningPick && (
                      <p
                        style={{
                          margin: "7px 0 0 0",
                          fontWeight: "bold",
                          textAlign: "center",
                          color: "#166534",
                          fontSize: "0.8rem",
                        }}
                      >
                        {selectedWeeklyResult?.phase === "tribal" ? "+5 Points" : `+${resolvedBonusPoints} Points`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pickBreakdown && (
            <div
              style={{
                marginTop: "16px",
                border: "1px solid rgba(209,213,219,0.9)",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(2px)",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 10px 0", fontWeight: "bold", textAlign: "center", color: "#111827" }}>
                Pick Breakdown ({pickBreakdown.total} teams)
              </p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: "min(48vw, 180px)",
                    height: "min(48vw, 180px)",
                    borderRadius: "50%",
                    background: `conic-gradient(${pickBreakdown.gradientStops})`,
                    position: "relative",
                    boxShadow: "0 6px 20px rgba(17,24,39,0.18)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: "22%",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.94)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      fontWeight: "bold",
                      color: "#111827",
                      fontSize: "0.86rem",
                      lineHeight: 1.15,
                      padding: "6px",
                    }}
                  >
                    Week {selectedWeek}
                    <br />
                    Picks
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                {pickBreakdown.rows.map((row) => (
                  <div
                    key={`${selectedWeek}-breakdown-${row.contestantId}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "14px 48px 1fr auto auto",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: "rgba(248,250,252,0.95)",
                      border: "1px solid rgba(209,213,219,0.9)",
                    }}
                  >
                    <span style={{ width: "14px", height: "14px", borderRadius: "999px", backgroundColor: row.color, display: "inline-block" }} />
                    <img
                      src={row.pickPresentation.imageSrc || "/fallback.png"}
                      alt={row.pickPresentation.label}
                      style={{
                        width: "48px",
                        height: "48px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        backgroundColor: "#e5e7eb",
                      }}
                    />
                    <span style={{ fontWeight: "bold", color: "#111827" }}>{row.pickPresentation.label}</span>
                    <span style={{ color: "#374151", fontWeight: "bold" }}>{row.percentageLabel}</span>
                    <span style={{ color: "#374151", fontWeight: "bold" }}>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {isAdmin && (
        <div style={{ width: "100%", maxWidth: "980px", margin: "16px auto 0 auto" }}>
          <div
            style={{
              border: "1px solid rgba(209,213,219,0.9)",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(2px)",
              padding: "12px",
            }}
          >
            <p style={{ margin: "0 0 10px 0", fontWeight: "bold", textAlign: "center", color: "#111827" }}>
              Admin: Immunity Winner
            </p>
            <p style={{ display: "block", margin: "0 0 8px 0", color: "#374151", fontWeight: "bold", fontSize: "0.9rem" }}>
              Week {selectedWeek} winner{selectedWinnerIds.length === 1 ? "" : "s"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", maxHeight: "220px", overflowY: "auto", padding: "2px" }}>
              {adminWinnerOptions.map((contestant) => {
                const contestantId = String(contestant.id);
                const checked = selectedWinnerIds.includes(contestantId);
                return (
                  <label
                    key={`admin-winner-${contestant.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "20px 40px 1fr",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "1px solid rgba(209,213,219,0.9)",
                      background: checked ? "rgba(236,253,245,0.95)" : "rgba(255,255,255,0.98)",
                      cursor: adminWinnerSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={adminWinnerSaving}
                      onChange={() => handleAdminWinnerToggle(contestantId)}
                    />
                    <img
                      src={getContestantImage(contestant)}
                      alt={getContestantLabel(contestant)}
                      style={{
                        width: "40px",
                        height: "40px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        backgroundColor: "#e5e7eb",
                      }}
                    />
                    <span style={{ color: "#111827", fontWeight: "bold" }}>{getContestantLabel(contestant)}</span>
                  </label>
                );
              })}
            </div>

            <label
              htmlFor="admin-bonus-points"
              style={{ display: "block", margin: "12px 0 8px 0", color: "#374151", fontWeight: "bold", fontSize: "0.9rem" }}
            >
              Bonus points awarded
            </label>
            <select
              id="admin-bonus-points"
              value={selectedBonusPoints}
              onChange={handleAdminBonusPointsChange}
              disabled={adminWinnerSaving}
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "1px solid rgba(156,163,175,0.9)",
                background: "rgba(255,255,255,0.98)",
                color: "#111827",
                fontWeight: "bold",
                padding: "10px 12px",
              }}
            >
              <option value="">Select bonus points</option>
              {bonusPointOptions.map((value) => (
                <option key={`bonus-points-${value}`} value={value}>
                  {value} Points
                </option>
              ))}
            </select>

            <button
              onClick={saveAdminWinner}
              disabled={adminWinnerSaving}
              style={{
                width: "100%",
                marginTop: "12px",
                border: "none",
                borderRadius: "10px",
                background: "#0f766e",
                color: "white",
                fontWeight: "bold",
                padding: "10px 12px",
                cursor: adminWinnerSaving ? "not-allowed" : "pointer",
              }}
            >
              {adminWinnerSaving ? "Saving winner..." : "Save Winner"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
