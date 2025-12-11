import React, { useState } from "react";
import LoginKey from "./components/LoginKey";
import Dashboard from "./pages/Dashboard";

export default function App(){
  const [apiKey, setApiKey] = useState(localStorage.getItem("api_key") || "");
  const onLogin = (k) => { localStorage.setItem("api_key", k); setApiKey(k); }
  return (
    <div style={{padding:20}}>
      {!apiKey ? <LoginKey onLogin={onLogin}/> : <Dashboard apiKey={apiKey} onLogout={() => { localStorage.removeItem("api_key"); setApiKey(""); }} />}
    </div>
  );
}
