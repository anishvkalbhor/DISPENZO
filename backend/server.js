const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const arduino1 = new SerialPort({ path: "COM8", baudRate: 9600 }); 
const arduino2 = new SerialPort({ path: "COM5", baudRate: 9600 }); 
const parser1 = arduino1.pipe(new ReadlineParser({ delimiter: "\n" }));

let latestWeight = 0;
let weightThreshold = 0;
let motorStopped = false;
let lastScannedUID = null;
let uidProcessing = false;
const scannedUIDs = new Set();
let lastScanTime = 0;
const SCAN_DEBOUNCE_TIME = 500;

arduino1.on("open", () => console.log("✅ Serial Port Opened on COM8"));
arduino2.on("open", () => console.log("✅ Serial Port Opened on COM5"));

arduino1.on("error", (err) => console.error("❌ Serial Port Error:", err.message));
arduino2.on("error", (err) => console.error("❌ Serial Port Error:", err.message));

async function fetchWeightThreshold(uid) {
  try {
    const userRef = db.collection("customer").doc(uid);
    const userSnap = await userRef.get();

    weightThreshold = userSnap.exists ? userSnap.data().weightThreshold : 50;
    console.log(`Weight Threshold for UID ${uid}: ${weightThreshold}g`);
  } catch (error) {
    console.error("❌ Error fetching weight threshold:", error);
  
}
}
// ✅ Listen for Data from Load Cell & RFID

parser1.on("data", async (data) => {
    const message = data.trim();
    const currentTime = Date.now();
  
    if (message.startsWith("UID:")) {
      const uid = message.replace("UID:", "").trim();
  
      if (scannedUIDs.has(uid) && currentTime - lastScanTime < SCAN_DEBOUNCE_TIME) {
        return;
      }
  
      scannedUIDs.add(uid);
      lastScanTime = currentTime;
      lastScannedUID = uid;
      uidProcessing = true;
  
      console.log("✅ Scanned UID:", uid);
      await fetchWeightThreshold(uid);
      io.emit("rfidData", uid);
      return;
    }
  
    if (!uidProcessing) return;

  const weightMatch = message.match(/(\d+)\s*g/); // Extracts number followed by "g"
  
  if (weightMatch) {
    latestWeight = parseFloat(weightMatch[1]);
    console.log(`✅ The current weight is: ${latestWeight} g`);

    io.emit("weightUpdate", latestWeight);

    // ✅ Check if weight exceeds threshold and stop motor
    if (latestWeight >= weightThreshold && !motorStopped) {
      console.log(`🛑 Weight (${latestWeight} g) exceeded threshold (${weightThreshold} g). Stopping Motor...`);
      arduino2.write("STOP_MOTOR\n");
      motorStopped = true;
    }
  }
});

// ✅ Listen for UI Commands
io.on("connection", (socket) => {
  socket.emit("helloMessage", "Hello from Node server to UI");


    // ✅ Handle SCANCARD event
    socket.on("scancard", () => {
      if (!arduino1.isOpen) {
        return socket.emit("scancardResponse", { success: false, message: "Serial port not open" });
      }
  
      console.log("🎫 Sending SCANCARD Command to Arduino1...");
      arduino1.write("SCANCARD\n", (err) => {
        if (err) {
          return socket.emit("scancardResponse", { success: false, message: "Failed to send command" });
        }
        console.log("✅ SCANCARD command sent!");
        socket.emit("scancardResponse", { success: true, message: "Scanning started!" });
      });
    });
    
  socket.on("dispenseWater", () => {
    if (!arduino1.isOpen) {
      return socket.emit("dispenseResponse", { success: false, message: "Serial port not open" });
    }

    console.log("💧 Sending DISPENSE Command...");
    arduino1.write("DISPENSE\n", (err) => {
      if (err) {
        return socket.emit("dispenseResponse", { success: false, message: "Failed to send command" });
      }
      console.log("✅ Water Dispensed!");
      socket.emit("dispenseResponse", { success: true, message: "Water dispensing started!" });
    });
  });

  socket.on("dispenseGrains", () => {
    if (!arduino1.isOpen || !arduino2.isOpen) {
      return socket.emit("dispenseGrainResponse", { success: false, message: "One of the serial ports is not open" });
    }

    console.log("🌾 Sending DISPENSE_GRAINS Command...");

    // Send command to Load Cell (Arduino1)
    arduino1.write("DISPENSE_GRAINS\n", (err) => {
      if (err) {
        return socket.emit("dispenseGrainResponse", { success: false, message: "Failed to send command to Arduino1" });
      }
      console.log("✅ DISPENSE_GRAINS sent to Arduino1!");

      // Now send command to Motor Control (Arduino2) only if the first command was successful
      arduino2.write("MOVE_ARM_90\n", (err) => {
        if (err) {
          return socket.emit("dispenseGrainResponse", { success: false, message: "Failed to send command to Arduino2" });
        }
        console.log("✅ MOVE_ARM_90 sent to Arduino2!");
        socket.emit("dispenseGrainResponse", { success: true, message: "Grains dispensing started!" });
      });
    });
});


  socket.on("updateWeightThreshold", async (newThreshold) => {
    weightThreshold = newThreshold;
    console.log(`🔄 Updating Weight Threshold to: ${newThreshold}g`);

    try {
      await db.collection("settings").doc("weightThreshold").set({ value: newThreshold });
      socket.emit("thresholdUpdateResponse", { success: true, message: "Threshold updated!" });
    } catch (error) {
      console.error("❌ Error updating weight threshold:", error);
      socket.emit("thresholdUpdateResponse", { success: false, message: "Failed to update threshold" });
    }
  });
});

// ✅ Start Server
server.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));