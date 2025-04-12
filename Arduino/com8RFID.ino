#include <SPI.h>
#include <MFRC522.h>
#include "HX711.h"
#include <EEPROM.h>

#define SS_PIN 10       // RFID SS pin
#define RST_PIN 9       // RFID Reset pin
#define RELAY_WATER 7   // Water relay pin
#define RELAY_GRAINS 6  // Grains relay pin
#define LOADCELL_DOUT_PIN 3
#define LOADCELL_SCK_PIN 2

MFRC522 rfid(SS_PIN, RST_PIN);
HX711 LOADCELL_HX711;
float CALIBRATION_FACTOR;

bool scanRequestReceived = false;  // Flag to track scan request

void setup() {
    Serial.begin(9600);
    SPI.begin();
    rfid.PCD_Init();
    
    pinMode(RELAY_WATER, OUTPUT);
    pinMode(RELAY_GRAINS, OUTPUT);
    digitalWrite(RELAY_WATER, HIGH);
    digitalWrite(RELAY_GRAINS, HIGH);

    Serial.println("System Ready...");

    LOADCELL_HX711.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    delay(1000);

    if (LOADCELL_HX711.is_ready()) {
        EEPROM.get(0, CALIBRATION_FACTOR);
        LOADCELL_HX711.set_scale(CALIBRATION_FACTOR);
        Serial.println("Scale Ready");
    } else {
        Serial.println("HX711 Not Found.");
    }
}

String lastScannedUID = "";

void loop() {
    readSerialCommand();  // Continuously check for serial commands

    if (scanRequestReceived) {
        scanCard();  // Scan only when requested
        scanRequestReceived = false;  // Reset the flag after scanning
    }
}

void scanCard() {
    String scannedUID = "";

    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
        for (byte i = 0; i < rfid.uid.size; i++) {
            scannedUID += (rfid.uid.uidByte[i] < 0x10 ? "0" : "");
            scannedUID += String(rfid.uid.uidByte[i], HEX);
        }
        scannedUID.toUpperCase();
    } else {
        // Default UID if no card detected
        scannedUID = "EAA8F72E";
    }

    // ✅ Only send UID if it has changed
    if (scannedUID != lastScannedUID) {
        Serial.print("UID: ");
        Serial.println(scannedUID);
        lastScannedUID = scannedUID;
    }
}

void dispenseWater() {
    Serial.println("💧 Dispensing Water...");
    digitalWrite(RELAY_WATER, LOW);
    delay(5000);
    digitalWrite(RELAY_WATER, HIGH);
    Serial.println("✅ Water Dispensed!");
}

void dispenseGrains() {
    Serial.println("🌾 Dispensing Grains...");

    Serial.println("Taring Scale...");
    LOADCELL_HX711.tare();
    delay(500);

    Serial.println("Scale ready. Displaying weight...");

    int finalWeight = 0;  

    for (int i = 0; i < 7; i++) {
        if (LOADCELL_HX711.is_ready()) {
            finalWeight = LOADCELL_HX711.get_units(10);
            float weight_In_oz = float(finalWeight) / 28.34952;

            Serial.print("Reading ");
            Serial.print(i + 1);
            Serial.print(": ");
            Serial.print(finalWeight);
            Serial.print(" g | ");
            Serial.print(weight_In_oz, 2);
            Serial.println(" oz");
        } else {
            Serial.println("HX711 Not Found.");
        }
        delay(1000);
    }

    Serial.print("✅ Final Weight: ");
    Serial.print(finalWeight);
    Serial.println(" g");
}

void readSerialCommand() {
    if (Serial.available() > 0) {
        String command = Serial.readStringUntil('\n');  
        command.trim();  

        Serial.print("Received Command: ");
        Serial.println(command);

        if (command == "SCANCARD") {
            Serial.println("🔍 Scan Card Command Received!");
            scanRequestReceived = true;  // Set flag to scan RFID
        }
        else if (command == "DISPENSE") {
            Serial.println("💧 Water Dispense Command Received!");
            dispenseWater();  
        }
        else if (command == "DISPENSE_GRAINS") {
            Serial.println("🌾 Grain Dispense Command Received!");
            dispenseGrains();  
        }
    }
}
