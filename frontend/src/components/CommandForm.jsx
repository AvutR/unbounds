import React, {useState} from "react";
export default function CommandForm({client, onSubmit}) {
  const [cmd, setCmd] = useState("");
  const [msg, setMsg] = useState(null);
  const submit = async () => {
    try {
      const res = await client.post("/commands", {command_text: cmd});
      setMsg(JSON.stringify(res.data));
      setCmd("");
      if(onSubmit) onSubmit();
    } catch (e) {
      setMsg(e?.response?.data || String(e));
    }
  }
  return (
    <div>
      <input value={cmd} onChange={e=>setCmd(e.target.value)} style={{width:400}} />
      <button onClick={submit}>Send</button>
      {msg && <pre>{JSON.stringify(msg,null,2)}</pre>}
    </div>
  )
}
