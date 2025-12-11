import React, {useState} from "react";

export default function CommandForm({client, onSubmit}) {
  const [cmd, setCmd] = useState("");
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msgType, setMsgType] = useState(null); // 'success', 'error', 'info'

  const submit = async () => {
    if (!cmd.trim()) {
      setMsg("Please enter a command");
      setMsgType("error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await client.post("/commands", { command_text: cmd });
      const data = res.data;
      
      // Determine message type based on status
      let type = "info";
      if (data.status === "EXECUTED") {
        type = "success";
        setMsg(`✅ Command executed: ${data.result || "Success"}`);
      } else if (data.status === "REJECTED") {
        type = "error";
        setMsg(`❌ Command rejected: ${data.result || "Auto-rejected by rule"}`);
      } else if (data.status === "PENDING_APPROVAL") {
        type = "info";
        setMsg(`⏳ Command pending approval #${data.approval_id}`);
      } else {
        setMsg(`📤 Command submitted: Status = ${data.status}`);
      }
      
      setMsgType(type);
      setCmd("");
      if (onSubmit) onSubmit();
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e?.message || "Unknown error";
      setMsg(`❌ Error: ${errorMsg}`);
      setMsgType("error");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !submitting) {
      submit();
    }
  };

  const getMessageStyle = () => {
    const baseStyle = {
      padding: "12px",
      borderRadius: "4px",
      marginTop: "12px",
      fontSize: "14px",
      lineHeight: "1.5"
    };
    
    const typeStyles = {
      success: { backgroundColor: "#d4edda", border: "1px solid #c3e6cb", color: "#155724" },
      error: { backgroundColor: "#f8d7da", border: "1px solid #f5c6cb", color: "#721c24" },
      info: { backgroundColor: "#d1ecf1", border: "1px solid #bee5eb", color: "#0c5460" }
    };

    return { ...baseStyle, ...(typeStyles[msgType] || typeStyles.info) };
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <input
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter command (e.g., ls -la, git status)"
          disabled={submitting}
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px",
            fontFamily: "monospace",
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "not-allowed" : "auto"
          }}
        />
        <button
          onClick={submit}
          disabled={submitting || !cmd.trim()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: submitting || !cmd.trim() ? "not-allowed" : "pointer",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            opacity: submitting || !cmd.trim() ? 0.6 : 1
          }}
        >
          {submitting ? "Sending..." : "📤 Submit"}
        </button>
      </div>
      
      {msg && (
        <div style={getMessageStyle()}>
          {msg}
        </div>
      )}
    </div>
  );
}
