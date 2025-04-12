import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const socket = io("http://localhost:5000");

function Rfid() {
  const [rfidUID, setRfidUID] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [authSuccess, setAuthSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    socket.on("rfidData", (uid) => {
      const cleanUID = uid.replace("UID:", "").trim();
      console.log("🔹 Scanned UID:", cleanUID);
      setRfidUID(cleanUID);
      setAuthSuccess(false);
      setEnteredPassword("");
      setError("");
      setUserData(null);
    });

    return () => socket.off("rfidData");
  }, []);

  const verifyPassword = async () => {
    console.log("🔹 Verifying password for UID:", rfidUID);
    try {
      const userRef = doc(db, "customer", rfidUID);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const user = userSnap.data();
        console.log("✅ User found in Firestore:", user);

        if (enteredPassword.trim() === user.password.trim()) {
          setAuthSuccess(true);
          setUserData(user);
          setError("");
          console.log("✅ Access Granted!");
        } else {
          setAuthSuccess(false);
          setUserData(null);
          setError("❌ Incorrect Password! Please try again.");
          console.log("❌ Password Mismatch.");
        }
      } else {
        setAuthSuccess(false);
        setUserData(null);
        setError("❌ No user found for this UID.");
        console.log("❌ UID not found in Firestore.");
      }
    } catch (error) {
      console.error("❌ Firestore Error:", error);
      setError("❌ Error fetching user data.");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>RFID Scanner</h1>
      <p style={{ fontSize: "20px", fontWeight: "bold", color: "#007BFF" }}>
        Scanned UID: {rfidUID || "Waiting for scan..."}
      </p>

      {rfidUID && (
        <>
          <input
            type="password"
            placeholder="Enter Password"
            value={enteredPassword}
            onChange={(e) => setEnteredPassword(e.target.value)}
            style={{ padding: "8px", fontSize: "16px", marginTop: "10px" }}
          />
          <button
            onClick={verifyPassword}
            style={{ padding: "8px 15px", fontSize: "16px", marginLeft: "10px", cursor: "pointer" }}
          >
            Submit
          </button>
        </>
      )}

      {authSuccess && userData && (
        <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "10px", display: "inline-block", textAlign: "left" }}>
          <h2 style={{ color: "green" }}>✅ Access Granted!</h2>
          <p><strong>Name:</strong> {userData.name || "N/A"}</p>
          <p><strong>Email:</strong> {userData.email || "N/A"}</p>
          <p><strong>Phone:</strong> {userData.phone || "N/A"}</p>
          <p><strong>Membership:</strong> {userData.membership || "N/A"}</p>
        </div>
      )}

      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}
    </div>
  );
}

export default Rfid;
