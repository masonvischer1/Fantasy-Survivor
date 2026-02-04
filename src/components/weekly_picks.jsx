// components/WeeklyPicks.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const TEAMS = [
  { name: "Kalo", color: "#3B82F6" }, // Blue
  { name: "Cila", color: "#F97316" }, // Orange
  { name: "Vatu", color: "#A855F7" }, // Pinkish Purple
];

export default function WeeklyPicks() {
  const [profile, setProfile] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      const user = supabase.auth.user();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("weekly_picks")
        .eq("id", user.id)
        .single();

      if (error) console.error(error);
      else {
        setProfile(data);
        setSelectedTeam(data.weekly_picks?.[selectedWeek] || "");
      }
    };

    fetchProfile();
  }, [selectedWeek]);

  const handlePick = async (team) => {
    if (!profile) return;

    setSelectedTeam(team);
    setLoading(true);
    setSaved(false);

    const updatedPicks = {
      ...profile.weekly_picks,
      [selectedWeek]: team,
    };

    const { error } = await supabase
      .from("profiles")
      .update({ weekly_picks: updatedPicks })
      .eq("id", supabase.auth.user().id);

    if (!error) {
      setProfile((prev) => ({ ...prev, weekly_picks: updatedPicks }));
      setSaved(true);
    } else {
      console.error("Error saving pick:", error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <h1 className="text-4xl font-bold mb-6 text-center">
        Week {selectedWeek} Immunity Pick
      </h1>

      {/* Week selector */}
      <div className="mb-8">
        <label className="mr-2 font-semibold text-lg">Select Week:</label>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-lg"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => (
            <option key={week} value={week}>
              Week {week}
            </option>
          ))}
        </select>
      </div>

      {/* Team Buttons */}
      <div className="flex flex-col sm:flex-row gap-6 justify-center w-full max-w-3xl">
        {TEAMS.map((team) => (
          <button
            key={team.name}
            onClick={() => handlePick(team.name)}
            disabled={loading}
            style={{
              backgroundColor: selectedTeam === team.name ? team.color : "#ffffff",
              color: selectedTeam === team.name ? "#ffffff" : team.color,
              border: `3px solid ${team.color}`,
            }}
            className="flex-1 px-10 py-8 text-2xl font-bold rounded-lg shadow-lg hover:scale-105 transform transition-all"
          >
            {team.name}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="mt-6 text-center">
        {saved && <p className="text-green-600 text-xl font-semibold">Pick saved!</p>}
        {loading && <p className="text-gray-500 text-lg">Saving...</p>}
        {!loading && selectedTeam && (
          <p className="text-lg mt-2">
            You selected <strong>{selectedTeam}</strong> for Week {selectedWeek}.
          </p>
        )}
      </div>
    </div>
  );
}
