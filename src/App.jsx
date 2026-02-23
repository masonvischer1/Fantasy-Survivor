import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { TopNav, BottomNav } from "./components/Navbar";
import "./App.css";

import Login from "./components/Login";
import Contestants from "./components/contestantsGrid";
import ContestantDetail from "./components/contestantDetail";
import Teams from "./components/Teams";
import CreateTeam from "./components/CreateTeam";
import Profile from "./components/Profile";
import WeeklyPicksPage from "./components/weekly_picks";
import Rules from "./components/Rules";

import castawaysBg from "./assets/Tribe Flags - Castaways.png";
import rulesBg from "./assets/Jungle to Beach - Rules.png";
import leaderboardBg from "./assets/Island Life - Leaderboard.png";
import weeklyPicksBg from "./assets/Challenge - Weekly Picks.png";
import profileBg from "./assets/sand - profile.png";
import createTeamBg from "./assets/Logo - Create Team.png";

function getRouteBackground(pathname) {
  if (pathname === "/login" || pathname === "/create-team") return createTeamBg;
  if (pathname === "/profile") return profileBg;
  if (pathname === "/teams") return leaderboardBg;
  if (pathname === "/weekly-picks") return weeklyPicksBg;
  if (pathname === "/rules") return rulesBg;
  if (pathname === "/" || pathname.startsWith("/contestant/")) return castawaysBg;
  return null;
}

function AppLayout({ session, profile, setProfile, needsTeamSetup, hasCompletedInitialDraft }) {
  const location = useLocation();
  const pageBackground = getRouteBackground(location.pathname);

  return (
    <div
      className="app-shell"
      style={{
        "--top-nav-height": "56px",
        "--bottom-nav-height": "0px",
      }}
    >
      <div className="app-fixed-band-bg" style={{ backgroundImage: pageBackground ? `url(${pageBackground})` : "none" }} />

      <div className="app-shell-top">
        <TopNav session={session} profile={profile} />
      </div>

      <main className="app-shell-main">
        <Routes>
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

          <Route
            path="/profile"
            element={
              session && !needsTeamSetup ? (
                <Profile session={session} setProfile={setProfile} />
              ) : (
                <Navigate to={session ? "/create-team" : "/login"} />
              )
            }
          />

          <Route
            path="/"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Contestants />) : <Navigate to="/login" />}
          />

          <Route
            path="/contestant/:id"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <ContestantDetail />) : <Navigate to="/login" />}
          />

          <Route
            path="/teams"
            element={
              session
                ? (needsTeamSetup
                  ? <Navigate to="/create-team" />
                  : (hasCompletedInitialDraft ? <Teams /> : <Navigate to="/" />))
                : <Navigate to="/login" />
            }
          />

          <Route
            path="/weekly-picks"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <WeeklyPicksPage />) : <Navigate to="/login" />}
          />

          <Route
            path="/rules"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Rules />) : <Navigate to="/login" />}
          />
        </Routes>
      </main>

      <BottomNav session={session} profile={profile} />
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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

  useEffect(() => {
    const userId = session?.user?.id;
    Promise.resolve().then(() => {
      fetchProfile(userId);
    });
  }, [session]);

  const needsTeamSetup = !!session && (!profile?.player_name || !profile?.team_name);
  const hasCompletedInitialDraft = Array.isArray(profile?.team) && profile.team.length >= 5;

  if (loadingProfile) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  return (
    <Router>
      <AppLayout
        session={session}
        profile={profile}
        setProfile={setProfile}
        needsTeamSetup={needsTeamSetup}
        hasCompletedInitialDraft={hasCompletedInitialDraft}
      />
    </Router>
  );
}

export default App;
