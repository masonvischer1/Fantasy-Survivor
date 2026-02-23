import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

import Navbar from "./components/Navbar";

import Login from "./components/Login";
import Contestants from "./components/contestantsGrid";
import ContestantDetail from "./components/contestantDetail";
import MyTeam from "./components/MyTeam";
import Teams from "./components/Teams";
import Profile from "./components/Profile";
import WeeklyPicksPage from "./components/weekly_picks"; // <- new page import

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Track Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    if (!userId) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setProfile(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      const sessionUser = session?.user;
      const fallbackProfile = {
        id: userId,
        player_name: sessionUser?.user_metadata?.player_name || "",
        team_name: sessionUser?.user_metadata?.team_name || "",
        avatar_url: "",
        team: []
      };

      const { error: createError } = await supabase
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" });

      if (createError) {
        setProfile(null);
        console.error(createError);
      } else {
        setProfile(fallbackProfile);
      }
    } else {
      setProfile(data);
    }
    setLoadingProfile(false);
  }

  // Fetch profile once session exists
  useEffect(() => {
    const userId = session?.user?.id;
    Promise.resolve().then(() => {
      fetchProfile(userId);
    });
  }, [session]);

  if (loadingProfile) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  return (
    <Router>
      <Navbar session={session} profile={profile} />

      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/" />
            ) : (
              <Login
                onProfileCreated={(createdProfile) => {
                  setProfile(createdProfile);
                }}
              />
            )
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            session ? (
              <Profile session={session} profile={profile} setProfile={setProfile} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Contestants */}
        <Route
          path="/"
          element={session ? <Contestants /> : <Navigate to="/login" />}
        />

        {/* Contestant Detail */}
        <Route
          path="/contestant/:id"
          element={session ? <ContestantDetail /> : <Navigate to="/login" />}
        />

        {/* My Team */}
        <Route
          path="/my-team"
          element={
            session ? <MyTeam profile={profile} /> : (
              <Navigate to="/login" />
            )
          }
        />

        {/* League Teams */}
        <Route
          path="/teams"
          element={session ? <Teams /> : <Navigate to="/login" />}
        />

        {/* Weekly Picks Page */}
        <Route
          path="/weekly-picks"
          element={session ? <WeeklyPicksPage /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
