import React, {useState} from "react";

export default function LoginKey({onLogin}){
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!key.trim()) {
      setError("Please enter an API key");
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      onLogin(key);
    } catch (e) {
      setError("Invalid API key");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f5f5f5"
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        padding: "40px",
        maxWidth: "400px",
        width: "100%"
      }}>
        <h1 style={{ textAlign: "center", marginBottom: "10px" }}>🔐 Command Gateway</h1>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "30px" }}>
          Controlled command execution with approval workflows
        </p>

        {error && (
          <div style={{
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            color: "#721c24",
            padding: "12px",
            borderRadius: "4px",
            marginBottom: "20px",
            fontSize: "14px"
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "bold",
            fontSize: "14px"
          }}>
            API Key
          </label>
          <input
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(null);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Paste your API key here"
            type="password"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              fontFamily: "monospace",
              boxSizing: "border-box",
              opacity: loading ? 0.6 : 1
            }}
          />
          <p style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
            💡 Use the admin key from backend startup, or ask an admin for your API key
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !key.trim()}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading || !key.trim() ? "not-allowed" : "pointer",
            fontWeight: "bold",
            fontSize: "16px",
            opacity: loading || !key.trim() ? 0.6 : 1,
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => !loading && !key.trim() && (e.target.style.backgroundColor = "#0056b3")}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#007bff"}
        >
          {loading ? "🔄 Verifying..." : "🚀 Login"}
        </button>

        <div style={{
          marginTop: "30px",
          paddingTop: "30px",
          borderTop: "1px solid #eee",
          fontSize: "12px",
          color: "#999",
          lineHeight: "1.6"
        }}>
          <strong>Quick Start:</strong>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Backend running? Check /docs for API documentation</li>
            <li>Lost your key? Check backend logs for admin key</li>
            <li>Need a new user? Ask an admin to create one</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
