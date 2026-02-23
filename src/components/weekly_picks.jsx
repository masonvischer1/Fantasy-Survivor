import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import kaloBuff from "../assets/Survivor_50_Kalo_Buff.png";
import cilaBuff from "../assets/Survivor_50_Cila_Buff.png";
import vatuBuff from "../assets/Survivor_50_Vatu_Buff.png";

const TEAMS = [
  { name: "Kalo", color: "#3B82F6", flagSrc: kaloBuff },
  { name: "Cila", color: "#F97316", flagSrc: cilaBuff },
  { name: "Vatu", color: "#A855F7", flagSrc: vatuBuff },
];

const TOTAL_EPISODES = 14;

export default function WeeklyPicks({ currentWeek = 1 }) {
  const [profile, setProfile] = useState(null);
  const [otherProfiles, setOtherProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  const fetchOtherProfiles = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, team_name, player_name, weekly_picks");

    if (error) {
      console.error(error);
      return;
    }

    const othersWithPicks = (data || []).filter((p) => {
      if (p.id === userId) return false;
      return !!p.weekly_picks?.[currentWeek];
    });

    setOtherProfiles(othersWithPicks);
  }, [currentWeek]);

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

      const { data, error } = await supabase
        .from("profiles")
        .select("weekly_picks")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile(data);
      }

      await fetchOtherProfiles(user.id);
    };

    Promise.resolve().then(() => {
      load();
    });
  }, [fetchOtherProfiles]);

  const handlePick = async (weekNum, teamName) => {
    if (!profile) return;
    if (weekNum > currentWeek) return;

    const confirmed = window.confirm(`Are you sure you want to select ${teamName} Tribe for Week ${weekNum}?`);
    if (!confirmed) return;

    setLoading(true);
    setSaved(false);

    const updatedPicks = {
      ...profile.weekly_picks,
      [weekNum]: teamName,
    };

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ weekly_picks: updatedPicks })
      .eq("id", user.id);

    if (error) {
      console.error(error);
    } else {
      setProfile((prev) => ({ ...prev, weekly_picks: updatedPicks }));
      setSaved(true);
      await fetchOtherProfiles(user.id);
    }

    setLoading(false);
  };

  const getTeam = (teamName) => TEAMS.find((team) => team.name === teamName);
  const weekNum = Math.min(currentWeek, TOTAL_EPISODES);
  const currentWeekPick = profile?.weekly_picks?.[weekNum];
  const hasOwnPickThisWeek = !!currentWeekPick;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "10px", textAlign: "center" }}>
        Survivor Picks
      </h1>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "#4b5563" }}>
        Make your tribe pick each week. Current week: {currentWeek}
      </p>

      <div style={{ width: "100%", maxWidth: "980px", margin: "0 auto" }}>
        {hasOwnPickThisWeek && (
          <div style={{ marginBottom: "20px", padding: "14px", backgroundColor: "white", borderRadius: "10px", border: "1px solid #d1d5db" }}>
            <p style={{ margin: 0, textAlign: "center", color: "#4b5563" }}>
              Your Week {weekNum} pick is locked in.
            </p>
          </div>
        )}

        {!hasOwnPickThisWeek && (
          <div
            style={{
              marginBottom: "14px",
              padding: "14px",
              backgroundColor: "white",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
            }}
          >
            <p style={{ margin: "0 0 12px 0", fontWeight: "bold" }}>Week {weekNum}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
              {TEAMS.map((team) => {
                const imageFailed = imageErrors[team.name];
                return (
                  <button
                    key={`${weekNum}-select-${team.name}`}
                    onClick={() => handlePick(weekNum, team.name)}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      background: "white",
                      cursor: "pointer",
                      padding: "8px",
                    }}
                  >
                    {!imageFailed ? (
                      <img
                        src={team.flagSrc}
                        alt={`${team.name} flag`}
                        style={{ width: "100%", height: "88px", objectFit: "cover", borderRadius: "8px", backgroundColor: "#f3f4f6" }}
                        onError={() => setImageErrors((prev) => ({ ...prev, [team.name]: true }))}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "88px",
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
      </div>

      <div style={{ textAlign: "center", marginTop: "6px" }}>
        {saved && <p style={{ color: "#16a34a", fontWeight: "bold", fontSize: "18px" }}>Pick saved!</p>}
        {loading && <p style={{ color: "#6b7280", fontSize: "16px" }}>Saving...</p>}
      </div>

      {hasOwnPickThisWeek && (
        <div style={{ width: "100%", maxWidth: "980px", margin: "24px auto 0 auto" }}>
          <h2 style={{ textAlign: "center", marginBottom: "12px" }}>Your Week {weekNum} Pick</h2>
          <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "white" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px", maxWidth: "260px", margin: "0 auto" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: "bold", color: "#6b7280" }}>Week {weekNum}</p>
              <img
                src={getTeam(currentWeekPick)?.flagSrc}
                alt={`${currentWeekPick} flag`}
                style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "6px", backgroundColor: "#f3f4f6" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <p style={{ margin: "6px 0 0 0", fontWeight: "bold" }}>{currentWeekPick}</p>
            </div>
          </div>

          <h2 style={{ textAlign: "center", marginBottom: "12px" }}>League Week {weekNum} Picks</h2>
          {otherProfiles.length === 0 && (
            <p style={{ textAlign: "center", color: "#6b7280" }}>No other players have submitted Week {weekNum} picks yet.</p>
          )}

          {otherProfiles.map((p) => (
            <div key={p.id} style={{ marginBottom: "20px", padding: "12px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "white" }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>
                {p.team_name || "Unnamed Team"}
                {p.player_name ? ` (${p.player_name})` : ""}
              </p>
              <div style={{ border: "1px solid #9ca3af", borderRadius: "6px", padding: "8px", maxWidth: "260px" }}>
                <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: "bold", color: "#6b7280" }}>Week {weekNum}</p>
                <img
                  src={getTeam(p.weekly_picks?.[weekNum])?.flagSrc}
                  alt={`${p.weekly_picks?.[weekNum]} flag`}
                  style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "6px", backgroundColor: "#f3f4f6" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <p style={{ margin: "6px 0 0 0", fontWeight: "bold" }}>{p.weekly_picks?.[weekNum]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
