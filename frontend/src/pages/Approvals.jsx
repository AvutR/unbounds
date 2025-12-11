import React from "react";

export default function Approvals({client}) {
  const [approvals, setApprovals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [votingId, setVotingId] = React.useState(null);

  React.useEffect(() => {
    const fetch = async () => {
      try {
        const res = await client.get("/approvals/pending");
        setApprovals(res.data || []);
      } catch (e) {
        console.error("Fetch approvals failed:", e);
        setApprovals([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [client]);

  const vote = async (id, v) => {
    setVotingId(id);
    try {
      await client.post(`/approvals/${id}/vote`, { vote: v });
      const res = await client.get("/approvals/pending");
      setApprovals(res.data || []);
    } catch (e) {
      console.error("Vote failed:", e);
      alert("Vote failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setVotingId(null);
    }
  };

  const pendingApprovals = approvals.filter(a => !a.resolved);
  const resolvedApprovals = approvals.filter(a => a.resolved);

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px", paddingBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <h1 style={{ margin: "0 0 5px 0" }}>⚖️ Approval Queue</h1>
        <p style={{ color: "#666", margin: 0 }}>Review and vote on pending command approvals</p>
      </div>

      {/* Pending Approvals */}
      <div style={{ backgroundColor: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "20px", marginBottom: "30px" }}>
        <h2 style={{ marginTop: 0, color: "#ff6b6b" }}>🔴 Pending ({pendingApprovals.length})</h2>
        {loading ? (
          <p style={{ color: "#666", textAlign: "center" }}>Loading approvals...</p>
        ) : pendingApprovals.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", fontStyle: "italic" }}>No pending approvals</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "15px" }}>
            {pendingApprovals.map(a => (
              <div key={a.id} style={{ border: "1px solid #ffc107", borderRadius: "6px", padding: "15px", backgroundColor: "#fffbf0" }}>
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Approval ID</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>#{a.id}</div>
                </div>
                
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Command</div>
                  <code style={{ display: "block", backgroundColor: "#f5f5f5", padding: "8px", borderRadius: "4px", fontSize: "12px", overflow: "auto", whiteSpace: "pre-wrap" }}>
                    Command #{a.command_id}
                  </code>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Votes Required</div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#007bff" }}>{a.threshold_required}</div>
                    <div style={{ fontSize: "12px", color: "#999" }}>votes needed to execute</div>
                  </div>
                </div>

                {a.escalated && (
                  <div style={{ marginBottom: "10px", padding: "8px", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px", fontSize: "12px", color: "#856404" }}>
                    ⚠️ <strong>ESCALATED</strong> — Over 10 minutes without resolution
                  </div>
                )}

                <div style={{ fontSize: "11px", color: "#999", marginBottom: "15px" }}>
                  Expires: {new Date(a.expires_at).toLocaleString()}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    onClick={() => vote(a.id, "APPROVE")}
                    disabled={votingId === a.id}
                    style={{
                      padding: "10px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: votingId === a.id ? "wait" : "pointer",
                      fontWeight: "bold",
                      opacity: votingId === a.id ? 0.6 : 1
                    }}
                  >
                    {votingId === a.id ? "..." : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => vote(a.id, "REJECT")}
                    disabled={votingId === a.id}
                    style={{
                      padding: "10px",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: votingId === a.id ? "wait" : "pointer",
                      fontWeight: "bold",
                      opacity: votingId === a.id ? 0.6 : 1
                    }}
                  >
                    {votingId === a.id ? "..." : "✗ Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Approvals */}
      {resolvedApprovals.length > 0 && (
        <div style={{ backgroundColor: "#f8f9fa", border: "1px solid #ddd", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ marginTop: 0, color: "#666" }}>✅ Resolved ({resolvedApprovals.length})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
            {resolvedApprovals.map(a => (
              <div key={a.id} style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "12px", backgroundColor: "white", opacity: 0.7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong>Approval #{a.id}</strong>
                  <span style={{ fontSize: "12px", backgroundColor: a.escalated ? "#ffc107" : "#28a745", color: "white", padding: "2px 8px", borderRadius: "12px" }}>
                    {a.escalated ? "Escalated" : "Resolved"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>Command #{a.command_id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
