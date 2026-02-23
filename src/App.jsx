import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

import Navbar from "./components/Navbar";

import Login from "./components/Login";
import Contestants from "./components/contestantsGrid";
import ContestantDetail from "./components/contestantDetail";
import MyTeam from "./components/MyTeam";
import Teams from "./components/Teams";
import CreateTeam from "./components/CreateTeam";
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
      setProfile(null);
      console.error(error);
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

  const needsTeamSetup = !!session && (!profile?.player_name || !profile?.team_name);

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
              <Navigate to={needsTeamSetup ? "/create-team" : "/"} />
            ) : (
              <Login />
            )
          }
        />

        {/* One-time team setup */}
        <Route
          path="/create-team"
          element={
            session ? (
              needsTeamSetup ? (
                <CreateTeam
                  onTeamCreated={(createdProfile) => {
                    setProfile(createdProfile);
                  }}
                />
              ) : (
                <Navigate to="/" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            session && !needsTeamSetup ? (
              <Profile session={session} profile={profile} setProfile={setProfile} />
            ) : (
              <Navigate to={session ? "/create-team" : "/login"} />
            )
          }
        />

        {/* Contestants */}
        <Route
          path="/"
          element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Contestants />) : <Navigate to="/login" />}
        />

        {/* Contestant Detail */}
        <Route
          path="/contestant/:id"
          element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <ContestantDetail />) : <Navigate to="/login" />}
        />

        {/* My Team */}
        <Route
          path="/my-team"
          element={
            session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <MyTeam profile={profile} />) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* League Teams */}
        <Route
          path="/teams"
          element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Teams />) : <Navigate to="/login" />}
        />

        {/* Weekly Picks Page */}
        <Route
          path="/weekly-picks"
          element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <WeeklyPicksPage />) : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
