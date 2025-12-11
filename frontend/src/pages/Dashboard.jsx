import React, {useState, useEffect} from "react";
import { apiClient } from "../api";
import CommandForm from "../components/CommandForm";

export default function Dashboard({apiKey, onLogout}) {
  const client = apiClient(apiKey);
  const [commands, setCommands] = useState([]);
  useEffect(()=> {
    client.get("/commands").then(r => setCommands(r.data)).catch(e => console.error(e));
  }, []);
  return (
    <div>
      <button onClick={onLogout}>Logout</button>
      <h2>Submit command</h2>
      <CommandForm client={client} onSubmit={() => {
        client.get("/commands").then(r => setCommands(r.data));
      }} />
      <h3>History</h3>
      <ul>
        {commands.map(c => <li key={c.id}>{c.command_text} — {c.status} — {c.result}</li>)}
      </ul>
    </div>
  )
}
