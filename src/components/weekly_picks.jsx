// components/WeeklyPicks.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const TEAMS = [
  { name: "Kalo", color: "#3B82F6" }, // Blue
  { name: "Cila", color: "#F97316" }, // Orange
  { name: "Vatu", color: "#A855F7" }, // Purple
];

const TOTAL_EPISODES = 14;

export default function WeeklyPicks({ currentWeek = 5 }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) return console.error(userError);
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("weekly_picks")
        .eq("id", user.id)
        .single();

      if (error) console.error(error);
      else setProfile(data);
    };

    fetchProfile();
  }, []);

  // Pick a team for an episode
  const handlePick = async (episodeNum, teamName) => {
    if (!profile) return;
    if (episodeNum > currentWeek) return;

    setLoading(true);
    setSaved(false);

    const updatedPicks = {
      ...profile.weekly_picks,
      [episodeNum]: teamName,
    };

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error(userError);
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ weekly_picks: updatedPicks })
      .eq("id", user.id);

    if (!error) {
      setProfile((prev) => ({ ...prev, weekly_picks: updatedPicks }));
      setSaved(true);
    } else {
      console.error(error);
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f3f4f6",
      padding: "20px"
    }}>
      <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "20px", textAlign: "center" }}>
        Survivor Picks
      </h1>
      <p style={{ textAlign: "center", marginBottom: "20px" }}>
        Click a color in each episode to select your team (up to episode {currentWeek})
      </p>

      {/* Game Board */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
        gap: "10px",
        justifyContent: "center",
        marginBottom: "20px",
        width: "100%",
        maxWidth: "880px"
      }}>
        {Array.from({ length: TOTAL_EPISODES }, (_, i) => {
          const episodeNum = i + 1;
          const pickedTeam = profile?.weekly_picks?.[episodeNum];
          const pickedTeamColor = TEAMS.find(t => t.name === pickedTeam)?.color;
          const isDisabled = episodeNum > currentWeek;

          return (
            <div
              key={episodeNum}
              style={{
                width: "120px",
                height: "120px",
                display: "flex",
                flexDirection: "column",
                border: "2px solid #6b7280",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: isDisabled ? "not-allowed" : "pointer",
                backgroundColor: pickedTeamColor || "#fff",
              }}
            >
              {/* Episode number */}
              <div style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderBottom: "1px solid #9ca3af",
                fontWeight: "bold",
                fontSize: "18px"
              }}>
                {episodeNum}
              </div>

              {/* Color buttons */}
              {!pickedTeam && !isDisabled && (
                <div style={{ flex: 1, display: "flex" }}>
                  {TEAMS.map(team => (
                    <div
                      key={team.name}
                      onClick={() => handlePick(episodeNum, team.name)}
                      style={{
                        flex: 1,
                        backgroundColor: team.color,
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = "0.8"}
                      onMouseOut={e => e.currentTarget.style.opacity = "1"}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status */}
      <div style={{ textAlign: "center" }}>
        {saved && <p style={{ color: "#16a34a", fontWeight: "bold", fontSize: "18px" }}>Pick saved!</p>}
        {loading && <p style={{ color: "#6b7280", fontSize: "16px" }}>Saving...</p>}
      </div>
    </div>
  );
}
