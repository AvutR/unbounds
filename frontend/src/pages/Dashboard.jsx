import React, {useState, useEffect} from "react";
import { apiClient } from "../api";
import CommandForm from "../components/CommandForm";

export default function Dashboard({apiKey, onLogout}) {
  const client = apiClient(apiKey);
  const [commands, setCommands] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [cmdsRes, userRes] = await Promise.allSettled([
          client.get("/commands"),
          client.get("/users/me")
        ]);

        if (cmdsRes.status === "fulfilled") setCommands(cmdsRes.value.data || []);
        else {
          console.error("Failed to load commands:", cmdsRes.reason);
          setCommands([]);
        }

        if (userRes.status === "fulfilled") setUser(userRes.value.data || null);
        else {
          // No user endpoint or failed; show a friendly empty state instead of loading forever
          console.warn("Failed to load user info:", userRes.reason);
          setUser(null);
        }
      } catch (e) {
        console.error("Unexpected fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const getStatusBadge = (status) => {
    const statusMap = {
      "EXECUTED": "success",
      "REJECTED": "error",
      "PENDING_APPROVAL": "warning",
      "SUBMITTED": "info"
    };
    return statusMap[status] || "info";
  };

  const getStatusColor = (badge) => {
    const colors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8"
    };
    return colors[badge] || "#6c757d";
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", paddingBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <div>
          <h1 style={{ margin: "0 0 5px 0" }}>Command Gateway</h1>
          <p style={{ color: "#666", margin: 0 }}>Execute and manage commands with approval workflows</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
            {user && <span>👤 {user.username || "User"} {user.role === "admin" && <span style={{ color: "#ff6b6b", fontWeight: "bold" }}>★ ADMIN</span>}</span>}
          </div>
          <button onClick={onLogout} style={{ padding: "8px 16px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
        {/* Submit Command Card */}
        <div style={{ gridColumn: "1 / 2", backgroundColor: "#f8f9fa", border: "1px solid #ddd", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ marginTop: 0 }}>📤 Submit Command</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>Enter a command to execute. It will be validated against active rules.</p>
          <CommandForm client={client} onSubmit={() => {
            client.get("/commands").then(r => setCommands(r.data)).catch(console.error);
          }} />
        </div>

        {/* Credits & Info Card */}
        <div style={{ backgroundColor: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ marginTop: 0 }}>💰 Account Info</h2>
          {user ? (
            <div>
              <div style={{ marginBottom: "15px" }}>
                <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Credits Available</div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#007bff" }}>{user.credits || 100}</div>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Role</div>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>{user.role}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", fontWeight: "bold" }}>Seniority</div>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>{user.seniority}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#666" }}>Loading user info...</p>
          )}
        </div>
      </div>

      {/* Commands History */}
      <div style={{ backgroundColor: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "20px" }}>
        <h2 style={{ marginTop: 0 }}>📜 Command History</h2>
        {loading ? (
          <p style={{ color: "#666", textAlign: "center" }}>Loading commands...</p>
        ) : commands.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", fontStyle: "italic" }}>No commands submitted yet</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd", backgroundColor: "#f8f9fa" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Command</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Status</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Result</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {commands.map(c => {
                  const badge = getStatusBadge(c.status);
                  const color = getStatusColor(badge);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #eee", hover: { backgroundColor: "#f9f9f9" } }}>
                      <td style={{ padding: "12px", fontSize: "13px", fontFamily: "monospace", color: "#333" }}>
                        <code style={{ backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: "3px" }}>{c.command_text}</code>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ display: "inline-block", padding: "4px 12px", backgroundColor: color, color: "white", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#666" }}>
                        {c.result || (c.status === "PENDING_APPROVAL" ? `Approval #${c.approval_id}` : "—")}
                      </td>
                      <td style={{ padding: "12px", fontSize: "12px", color: "#999" }}>
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
