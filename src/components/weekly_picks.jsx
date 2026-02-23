import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import kaloBuff from "../assets/Survivor_50_Kalo_Buff.png";
import cilaBuff from "../assets/Survivor_50_Cila_Buff.png";
import vatuBuff from "../assets/Survivor_50_Vatu_Buff.png";
import siteLogo from "../assets/Logo.png";
import leftArrowIcon from "../assets/arrow-left-circle.svg";
import rightArrowIcon from "../assets/arrow-right-circle.svg";

const TEAMS = [
  { name: "Kalo", color: "#3B82F6", flagSrc: kaloBuff },
  { name: "Cila", color: "#F97316", flagSrc: cilaBuff },
  { name: "Vatu", color: "#A855F7", flagSrc: vatuBuff },
];

const TOTAL_EPISODES = 14;

export default function WeeklyPicks({ currentWeek = 1 }) {
  const [profile, setProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [leagueProfiles, setLeagueProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

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
        .select("weekly_picks")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile(data);
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

  const handlePick = async (weekNum, teamName) => {
    if (!profile || !currentUserId) return;

    const confirmed = window.confirm(`Are you sure you want to select ${teamName} Tribe for Week ${weekNum}?`);
    if (!confirmed) return;

    setLoading(true);
    setSaved(false);

    const updatedPicks = {
      ...(profile.weekly_picks || {}),
      [weekNum]: teamName,
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

  const getTeam = (teamName) => TEAMS.find((team) => team.name === teamName);
  const currentWeekPick = profile?.weekly_picks?.[selectedWeek];
  const hasOwnPickThisWeek = !!currentWeekPick;

  return (
    <div
      style={{
        padding: "12px",
      }}
    >
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: "block", width: "min(220px, 55vw)", margin: "0 auto 0.75rem auto" }} />
      <h1 style={{ fontSize: "clamp(1.6rem, 7vw, 2.1rem)", fontWeight: "bold", marginBottom: "10px", textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Survivor Picks
      </h1>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Use Back/Forward to make picks for each week or review history.
      </p>

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
              {TEAMS.map((team) => {
                const imageFailed = imageErrors[team.name];
                return (
                  <button
                    key={`${selectedWeek}-select-${team.name}`}
                    onClick={() => handlePick(selectedWeek, team.name)}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.86)",
                      cursor: "pointer",
                      padding: "8px",
                    }}
                  >
                    {!imageFailed ? (
                      <img
                        src={team.flagSrc}
                        alt={`${team.name} flag`}
                        style={{ width: "100%", height: "74px", objectFit: "cover", borderRadius: "8px", backgroundColor: "#f3f4f6" }}
                        onError={() => setImageErrors((prev) => ({ ...prev, [team.name]: true }))}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "74px",
                          borderRadius: "8px",
                          backgroundColor: team.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: "bold",
                        }}
                      >
                        {team.name}
                      </div>
                    )}
                    <p style={{ margin: "8px 0 0 0", fontWeight: "bold" }}>{team.name}</p>
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
            <img src={leftArrowIcon} alt="Previous" width="48" height="48" style={{ display: "block" }} />
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
            <img src={rightArrowIcon} alt="Next" width="48" height="48" style={{ display: "block" }} />
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
          {leagueProfiles.length === 0 && (
            <p style={{ textAlign: "center", color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>No teams have submitted Week {selectedWeek} picks yet.</p>
          )}

          {leagueProfiles.map((p) => (
            <div key={p.id} style={{ marginBottom: "20px", padding: "12px", border: "1px solid rgba(209,213,219,0.9)", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.86)", backdropFilter: "blur(2px)" }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>
                {p.team_name || "Unnamed Team"}
                {p.player_name ? ` (${p.player_name})` : ""}
              </p>
              <div style={{ border: "1px solid #9ca3af", borderRadius: "6px", padding: "8px", maxWidth: "260px" }}>
                <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: "bold", color: "#6b7280" }}>Week {selectedWeek}</p>
                <img
                  src={getTeam(p.weekly_picks?.[selectedWeek])?.flagSrc}
                  alt={`${p.weekly_picks?.[selectedWeek]} flag`}
                  style={{ width: "100%", height: "96px", objectFit: "cover", borderRadius: "6px", backgroundColor: "#f3f4f6" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <p style={{ margin: "6px 0 0 0", fontWeight: "bold" }}>{p.weekly_picks?.[selectedWeek]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


