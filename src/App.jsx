import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { TopNav, BottomNav } from "./components/Navbar";
import "./App.css";

import GuestSite from "./components/GuestSite";
import Login from "./components/Login";
import Contestants from "./components/contestantsGrid";
import Teams from "./components/Teams";
import CreateTeam from "./components/CreateTeam";
import Profile from "./components/Profile";
import TeamProfileView from "./components/TeamProfileView";
import WeeklyPicksPage from "./components/weekly_picks";
import Rules from "./components/Rules";
import Seasons from "./components/Seasons";
import SeasonArchive from "./components/SeasonArchive";
import SeasonContestantDetail from "./components/SeasonContestantDetail";

import castawaysBg from "./assets/51/Castaways.png";
import rulesBg from "./assets/Jungle to Beach - Rules.png";
import leaderboardBg from "./assets/51/Leaderboard.png";
import weeklyPicksBg from "./assets/Challenge - Weekly Picks.png";
import profileBg from "./assets/51/My Tribe.png";
import loginBg from "./assets/51/Login.png";

function getRouteBackground(pathname) {
  if (pathname.startsWith("/guest")) return getRouteBackground(pathname.slice(6) || "/teams");
  if (pathname === "/login") return loginBg;
  if (pathname === "/create-team") return loginBg;
  if (pathname === "/profile") return profileBg;
  if (pathname.startsWith("/teams/")) return profileBg;
  if (pathname === "/teams") return leaderboardBg;
  if (pathname === "/weekly-picks") return weeklyPicksBg;
  if (pathname === "/rules") return rulesBg;
  if (pathname === "/seasons" || pathname.startsWith("/seasons/")) return leaderboardBg;
  if (pathname === "/castaways" || pathname.startsWith("/castaways/") || pathname.startsWith("/contestant/")) return castawaysBg;
  if (pathname === "/") return leaderboardBg;
  return null;
}

function AppLayout({ session, profile, setProfile, needsTeamSetup }) {
  const location = useLocation();
  const pageBackground = getRouteBackground(location.pathname);

  useEffect(() => {
    document.querySelector('.app-shell-main')?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div
      className="app-shell"
      style={{
        "--top-nav-height": "0px",
        "--bottom-nav-height": "0px",
      }}
    >
      <div className="app-fixed-band-bg" style={{ backgroundImage: pageBackground ? `url(${pageBackground})` : "none" }} />

      <div className="app-shell-top">
        <TopNav session={session} />
      </div>

      <main className="app-shell-main">
        <Routes>
          <Route path="/guest/*" element={<GuestSite />} />
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
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Navigate to="/teams" replace />) : <Navigate to="/login" />}
          />

          <Route
            path="/castaways"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Contestants />) : <Navigate to="/login" />}
          />

          <Route
            path="/castaways/:id"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <SeasonContestantDetail key={location.pathname} />) : <Navigate to="/login" />}
          />

          <Route
            path="/teams"
            element={
              session
                ? (needsTeamSetup
                  ? <Navigate to="/create-team" />
                  : <Teams />)
                : <Navigate to="/login" />
            }
          />

          <Route
            path="/teams/:id"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <TeamProfileView key={location.pathname} />) : <Navigate to="/login" />}
          />

          <Route
            path="/weekly-picks"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <WeeklyPicksPage />) : <Navigate to="/login" />}
          />

          <Route
            path="/final-wagers"
            element={<Navigate to="/weekly-picks" replace />}
          />

          <Route
            path="/rules"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Rules />) : <Navigate to="/login" />}
          />

          <Route
            path="/seasons"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <Seasons />) : <Navigate to="/login" />}
          />

          <Route
            path="/seasons/:slug"
            element={session ? (needsTeamSetup ? <Navigate to="/create-team" /> : <SeasonArchive />) : <Navigate to="/login" />}
          />
        </Routes>
      </main>

      {!location.pathname.startsWith("/guest") && <BottomNav session={session} profile={profile} />}
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
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
    const [{ data: account, error: accountError }, { data: activeSeason, error: seasonError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("seasons").select("*").in("status", ["draft", "active", "finale"]).single(),
    ]);

    if (accountError || seasonError) {
      setProfile(null);
      console.error(accountError || seasonError);
    } else {
      let { data: seasonEntry, error: entryError } = await supabase
        .from("season_entries")
        .select("*")
        .eq("season_id", activeSeason.id)
        .eq("profile_id", userId)
        .maybeSingle();

      if (!seasonEntry && !entryError) {
        const created = await supabase
          .from("season_entries")
          .insert({
            season_id: activeSeason.id,
            profile_id: userId,
            player_name: account.player_name,
            avatar_url: account.avatar_url,
          })
          .select("*")
          .single();
        seasonEntry = created.data;
        entryError = created.error;
      }

      if (entryError) {
        setProfile(null);
        console.error(entryError);
      } else {
        setProfile({
          ...account,
          ...seasonEntry,
          id: account.id,
          entry_id: seasonEntry.id,
          season_id: activeSeason.id,
          season_name: activeSeason.name,
        });
      }
    }
    setLoadingProfile(false);
  }

  useEffect(() => {
    if (loadingSession) return;
    const userId = session?.user?.id;
    Promise.resolve().then(() => {
      fetchProfile(userId);
    });
  }, [session, loadingSession]);

  const needsTeamSetup = !!session && (!profile?.player_name || !profile?.team_name);
  if (loadingSession || loadingProfile) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  return (
    <Router>
      <AppLayout
        session={session}
        profile={profile}
        setProfile={setProfile}
        needsTeamSetup={needsTeamSetup}
      />
    </Router>
  );
}

export default App;
