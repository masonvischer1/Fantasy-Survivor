// components/WeeklyPicks.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const TEAMS = [
  { name: "Kalo", color: "#3B82F6" }, // Blue
  { name: "Cila", color: "#F97316" }, // Orange
  { name: "Vatu", color: "#A855F7" }, // Purple
];

const TOTAL_EPISODES = 14;

export default function WeeklyPicks({ currentWeek }) {
  const [profile, setProfile] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch profile once
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

  const handleTeamPick = async (teamName) => {
    if (!profile || selectedEpisode === null) return;

    setLoading(true);
    setSaved(false);

    const updatedPicks = {
      ...profile.weekly_picks,
      [selectedEpisode]: teamName,
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
      setSelectedEpisode(null);
    } else {
      console.error(error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-4xl font-bold mb-6 text-center">Survivor Picks</h1>
      <p className="text-center mb-6">
        Click an episode to pick a team (up to episode {currentWeek})
      </p>

      {/* Game Board */}
      <div className="flex justify-center w-full mb-8">
        <div className="grid grid-cols-7 gap-3 border-4 border-gray-700 rounded-lg p-3 bg-gray-200">
          {Array.from({ length: TOTAL_EPISODES }, (_, i) => {
            const episodeNum = i + 1;
            const pickedTeam = profile?.weekly_picks?.[episodeNum];
            const isDisabled = episodeNum > currentWeek;

            return (
              <div
                key={episodeNum}
                onClick={() => !isDisabled && setSelectedEpisode(episodeNum)}
                style={{
                  backgroundColor: pickedTeam
                    ? TEAMS.find((t) => t.name === pickedTeam)?.color
                    : isDisabled
                    ? "#E5E7EB"
                    : "#FFFFFF",
                  border: "2px solid #6B7280",
                  width: "70px",
                  height: "70px",
                }}
                className={`flex items-center justify-center font-extrabold text-2xl rounded-md cursor-pointer transition-all ${
                  isDisabled ? "cursor-not-allowed" : "hover:scale-105"
                }`}
              >
                {episodeNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Selection Panel */}
      {selectedEpisode !== null && (
        <div className="flex flex-wrap gap-6 justify-center w-full max-w-3xl mt-6 mb-8">
          <p className="w-full text-center mb-2 text-lg font-semibold">
            Select a team for Episode {selectedEpisode}
          </p>
          {TEAMS.map((team) => (
            <button
              key={team.name}
              onClick={() => handleTeamPick(team.name)}
              disabled={loading}
              style={{ backgroundColor: team.color, color: "#ffffff" }}
              className="flex-1 min-w-[140px] sm:min-w-[180px] px-6 py-6 text-xl font-extrabold rounded-2xl shadow-lg hover:scale-105 transform transition-all text-center"
            >
              {team.name}
            </button>
          ))}
        </div>
      )}

      {/* Status */}
      <div className="text-center">
        {saved && <p className="text-green-600 text-xl font-semibold">Pick saved!</p>}
        {loading && <p className="text-gray-500 text-lg">Saving...</p>}
      </div>
    </div>
  );
}
