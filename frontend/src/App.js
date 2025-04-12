import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { collection, getDocs } from "firebase/firestore";

import "./Rfid.css";

const razorpayApiKey = "";
const socket = io("http://localhost:5000");

function Rfid() {
  const [rfidUID, setRfidUID] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [authSuccess, setAuthSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [dispenseMessage, setDispenseMessage] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    socket.on("rfidData", (uid) => {
      if (uid) {
        setScanning(false);
        setRfidUID(uid);
        setAuthSuccess(false);
        setEnteredPassword("");
        setError("");
        setUserData(null);
        setDispenseMessage("");
      }
    });

    return () => {
      socket.off("rfidData");
    };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const fetchUsers = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, "customer"));
          const usersData = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setUsers(usersData);
        } catch (error) {
          console.error("Error fetching users: ", error);
        }
      };
      fetchUsers();
    }
  }, [isAdmin]);
  

  const verifyPassword = async () => {
    if (!rfidUID || !enteredPassword.trim()) {
      setError("Please scan your card and enter the password.");
      return;
    }
  
    try {
      const userRef = doc(db, "customer", rfidUID.trim()); // Use the scanned UID
      const userSnap = await getDoc(userRef);
  
      if (userSnap.exists()) {
        const user = userSnap.data();
  
        if (enteredPassword.trim() === user.password.trim()) {
          setAuthSuccess(true);
          setUserData(user);
          setError("");
        } else {
          setAuthSuccess(false);
          setUserData(null);
          setError("Incorrect Password! Please try again.");
        }
      } else {
        setAuthSuccess(false);
        setUserData(null);
        setError("No user found for this UID.");
      }
    } catch (error) {
      setError("Error fetching user data.");
    }
  };

  const scanCard = () => {
    setScanning(true); // Start scanning animation
    setRfidUID(""); // Clear previous UID
  
    socket.emit("scancard"); // Send command to Arduino via server
  
    setTimeout(() => {
      setScanning(false); // Stop scanning effect after 5s
    }, 5000);
  };
  

  const startCountdown = (message, callback) => {
    setCountdown(5);
    setDispenseMessage(`${message} in 5 seconds...`);
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          callback();
          setDispenseMessage(""); // Clear message after dispensing
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleDispenseWater = () => {
    if (countdown === 0) {
      startCountdown("Dispensing water", () => socket.emit("dispenseWater"));
    }
  };

  const handleDispenseGrains = () => {
    if (countdown === 0) {
      startCountdown("Dispensing grains", () => socket.emit("dispenseGrains"));
    }
  };

  const handlePayment = async () => {
    if (!window.Razorpay) {
      alert("Razorpay SDK not loaded! Please wait and try again.");
      return;
    }

    try {
      const userRef = doc(db, "customer", rfidUID);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const user = userSnap.data();
        const paymentAmount = user.amount;
        const razorpayAmount = paymentAmount * 100;

        const options = {
          key: razorpayApiKey,
          amount: razorpayAmount,
          currency: "INR",
          name: user.Name || "User",
          description: `RFID Payment - ₹${paymentAmount}`,
          handler: function (response) {
            console.log("✅ Payment Successful!", response.razorpay_payment_id);
            alert("✅ Payment Successful! Redirecting...");

            setTimeout(() => {
              window.location.href = "/"; // Redirect to home page
            }, 2000);
          },
          prefill: {
            name: user.Name || "User",
            email: user.email || "user@example.com",
            contact: user.phone || "0000000000",
          },
          theme: {
            color: "#F37254",
          },
        };

        const rzp1 = new window.Razorpay(options);
        rzp1.open();
      } else {
        alert("❌ No user data found for payment.");
      }
    } catch (error) {
      console.error("⚠️ Error fetching user data for payment:", error);
      alert("⚠️ Something went wrong. Please try again.");
    }
  };
  return (
    <>

      <button className="admin-btn" onClick={() => setIsAdmin(!isAdmin)}>
        {isAdmin ? "🔙 Go to User Side" : "🔧 Go to Admin Side"}
      </button>
      <button className="scan-btn" onClick={scanCard}>
  {scanning ? "📡 Reading the Card..." : "📡 Scan My Card"}
</button>

      <div className="rfid-container">
        {!isAdmin ? (
          <>
            <div className="scanner-box">
            <div className={`dispenzo-text ${rfidUID ? "move-up" : ""}`}>
  DISPENZO
</div>


              {scanning || !rfidUID ? (
                <div className="rotating-card">
                  <div className="card-chip"></div>
                  <div className="card-icon">📡</div>
                  <div className="card-text">SCAN YOUR RFID CARD</div>
                </div>
              ) : (
                <p className="uid-display">Scanned UID: {rfidUID}</p>
              )}
            </div>

            {rfidUID && !authSuccess && (
              <div className="input-container">
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                />
                <button onClick={verifyPassword}>Submit</button>
              </div>
            )}

            {authSuccess && userData && (
              <div className="user-info">
                <h2><strong>{dispenseMessage ? dispenseMessage : "✅ Access Granted!"}</strong></h2>
                {!dispenseMessage && (
                  <>
                    <p><strong>Name:</strong> {userData.Name}</p>
                    <p><strong>Phone:</strong> {userData.phone}</p>
                    <p><strong>members in the family:</strong> {userData.family_members}</p>
                    <p><strong>Weight Allocated:</strong> {userData.weightThreshold}g</p>

                    <div className="button-container">
                      <button className="dispense-btn water-btn" onClick={handleDispenseWater}>
                        🚰 Dispense Water
                      </button>
                      <button className="dispense-btn grain-btn" onClick={handleDispenseGrains}>
                        🌾 Dispense Grains
                      </button>
                      <button className="payment-btn" onClick={handlePayment}>
                        💳 Pay Now
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {dispenseMessage && <p className="dispense-text">{dispenseMessage} ({countdown}s)</p>}
          </>
        ) : (
          <div className="admin-panel">
            <h1>🔧 Admin Panel</h1>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Family Members</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.Name}</td>
                    <td>{user.phone}</td>
                    <td>{user.family_members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default Rfid;