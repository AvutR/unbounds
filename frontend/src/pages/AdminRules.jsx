import React from "react";

export default function AdminRules({client}) {
  const [rules, setRules] = React.useState([]);
  const [pattern, setPattern] = React.useState("");
  const [action, setAction] = React.useState("AUTO_ACCEPT");
  const [threshold, setThreshold] = React.useState(2);
  const [priority, setPriority] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await client.get("/rules");
      setRules(res.data || []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Failed to load rules");
    } finally {
      setLoading(false);
    }
  };

  const addRule = async () => {
    if (!pattern.trim()) {
      setError("Pattern is required");
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      const res = await client.post("/rules", {
        pattern,
        action,
        threshold: action === "REQUIRE_APPROVAL" ? threshold : undefined,
        priority
      });
      
      // Show conflicts warning if detected
      if (res.data.conflicts && res.data.conflicts.length > 0) {
        const conflictList = res.data.conflicts.map(c => `${c.pattern} (${c.action})`).join(", ");
        setSuccess(true);
        setError(`⚠️ Rule added, but conflicts detected with: ${conflictList}`);
        setTimeout(() => setError(null), 5000);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
      
      setPattern("");
      setAction("AUTO_ACCEPT");
      setThreshold(2);
      setPriority(0);
      await fetchRules();
    } catch (e) {
      const detail = e.response?.data?.detail || e.message;
      setError(`Failed to add rule: ${detail}`);
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const getActionColor = (act) => {
    const colors = {
      "AUTO_ACCEPT": "#28a745",
      "AUTO_REJECT": "#dc3545",
      "REQUIRE_APPROVAL": "#ffc107"
    };
    return colors[act] || "#6c757d";
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px", paddingBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <h1 style={{ margin: "0 0 5px 0" }}>⚙️ Rule Management</h1>
        <p style={{ color: "#666", margin: 0 }}>Configure command matching rules and approval workflows</p>
      </div>

      {/* Add Rule Form */}
      <div style={{ backgroundColor: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "20px", marginBottom: "30px" }}>
        <h2 style={{ marginTop: 0 }}>➕ Add New Rule</h2>
        
        {error && (
          <div style={{ backgroundColor: "#f8d7da", border: "1px solid #f5c6cb", color: "#721c24", padding: "12px", borderRadius: "4px", marginBottom: "15px", fontSize: "14px" }}>
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div style={{ backgroundColor: "#d4edda", border: "1px solid #c3e6cb", color: "#155724", padding: "12px", borderRadius: "4px", marginBottom: "15px", fontSize: "14px" }}>
            ✅ Rule added successfully!
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
              Regex Pattern
            </label>
            <input
              placeholder="e.g., ^rm -rf /.*"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px", fontFamily: "monospace" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
            >
              <option value="AUTO_ACCEPT">✓ Auto Accept</option>
              <option value="AUTO_REJECT">✗ Auto Reject</option>
              <option value="REQUIRE_APPROVAL">⚖️ Require Approval</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
              Priority
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
            />
            <div style={{ fontSize: "11px", color: "#666", marginTop: "5px" }}>Lower = higher priority</div>
          </div>

          {action === "REQUIRE_APPROVAL" && (
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                Votes Required
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 2)}
                style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>
          )}
        </div>

        <button
          onClick={addRule}
          disabled={submitting || !pattern.trim()}
          style={{
            padding: "12px 24px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: submitting || !pattern.trim() ? "not-allowed" : "pointer",
            fontWeight: "bold",
            fontSize: "14px",
            opacity: submitting || !pattern.trim() ? 0.6 : 1
          }}
        >
          {submitting ? "Adding..." : "➕ Add Rule"}
        </button>
      </div>

      {/* Rules List */}
      <div style={{ backgroundColor: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "20px" }}>
        <h2 style={{ marginTop: 0 }}>📋 Current Rules ({rules.length})</h2>
        
        {loading ? (
          <p style={{ color: "#666", textAlign: "center" }}>Loading rules...</p>
        ) : rules.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", fontStyle: "italic" }}>No rules configured yet</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd", backgroundColor: "#f8f9fa" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Priority</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Pattern</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Action</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Threshold</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {rules
                  .sort((a, b) => (a.priority || 999) - (b.priority || 999))
                  .map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px", fontWeight: "bold", fontSize: "14px" }}>
                        {r.priority !== null ? r.priority : "∞"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <code style={{ backgroundColor: "#f5f5f5", padding: "4px 8px", borderRadius: "3px", fontSize: "12px", fontFamily: "monospace" }}>
                          {r.pattern}
                        </code>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ display: "inline-block", padding: "4px 12px", backgroundColor: getActionColor(r.action), color: "white", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
                          {r.action}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: "14px" }}>
                        {r.threshold || (r.action === "REQUIRE_APPROVAL" ? "2" : "—")}
                      </td>
                      <td style={{ padding: "12px", fontSize: "12px", color: "#999" }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
