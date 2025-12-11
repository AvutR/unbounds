import React from "react";

export default function AdminRules({client}) {
  const [rules, setRules] = React.useState([]);
  const [pattern, setPattern] = React.useState("");
  const [action, setAction] = React.useState("AUTO_ACCEPT");

  React.useEffect(() => {
    client.get("/rules").then(r => setRules(r.data)).catch(e => console.error(e));
  }, []);

  const addRule = async () => {
    try {
      await client.post("/rules", { pattern, action });
      setPattern("");
      client.get("/rules").then(r => setRules(r.data));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <h2>Admin Rules</h2>
      <input placeholder="Regex pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      <select value={action} onChange={(e) => setAction(e.target.value)}>
        <option>AUTO_ACCEPT</option>
        <option>AUTO_REJECT</option>
        <option>REQUIRE_APPROVAL</option>
      </select>
      <button onClick={addRule}>Add Rule</button>
      <h3>Current Rules</h3>
      <ul>
        {rules.map(r => <li key={r.id}>{r.pattern} → {r.action}</li>)}
      </ul>
    </div>
  );
}
