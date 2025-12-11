import React from "react";

export default function Approvals({client}) {
  const [approvals, setApprovals] = React.useState([]);

  React.useEffect(() => {
    const fetch = async () => {
      try {
        const res = await client.get("/approvals");
        setApprovals(res.data);
      } catch (e) {
        console.error("Fetch approvals failed:", e);
      }
    };
    fetch();
  }, []);

  const vote = async (id, v) => {
    try {
      await client.post(`/approvals/${id}/vote`, { vote: v });
      const res = await client.get("/approvals");
      setApprovals(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <h2>Pending Approvals</h2>
      <ul>
        {approvals.filter(a => !a.resolved).map(a => (
          <li key={a.id}>
            Command {a.command_id} — {a.threshold_required} votes required
            <button onClick={() => vote(a.id, "APPROVE")}>Approve</button>
            <button onClick={() => vote(a.id, "REJECT")}>Reject</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
