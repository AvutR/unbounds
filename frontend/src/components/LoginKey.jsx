import React, {useState} from "react";
export default function LoginKey({onLogin}){
  const [k, setK] = useState("");
  return (
    <div>
      <h3>Enter API Key</h3>
      <input value={k} onChange={(e)=> setK(e.target.value)} style={{width:400}} />
      <button onClick={()=>onLogin(k)}>Login</button>
    </div>
  );
}
