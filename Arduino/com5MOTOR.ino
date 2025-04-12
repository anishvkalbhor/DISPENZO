#include <AFMotor.h>

// Define DC Motors
AF_DCMotor motor1(1);
AF_DCMotor motor2(2);
AF_DCMotor motor3(3);
AF_DCMotor motor4(4);

bool motorStopped = false; // Track motor state

void setup() {
  Serial.begin(9600); // Start Serial communication

  // Set motor speeds
  motor1.setSpeed(220);
  motor2.setSpeed(180);
  motor3.setSpeed(180);
  motor4.setSpeed(180);

  Serial.println("✅ Ready to receive commands...");
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n'); // Read command
    command.trim(); // Remove whitespace

    if (command == "MOVE_ARM_90") {
      Serial.println("🔄 Moving Arm 90° FORWARD...");
      moveForward();
      delay(500); // Move for 90 degrees
      stopMotors();
    }

    else if (command == "STOP_MOTOR") {
      Serial.println("🛑 STOP_MOTOR received. Moving arm BACK before stopping...");
      
      moveBackward();  // Move the arm back slightly
      delay(500);      // Allow time for movement

      stopMotors();    // Stop motors after moving back
      motorStopped = true; // Prevent multiple STOP commands
    }
  }
}

// Move forward function (90 degrees)
void moveForward() {
  motor1.run(FORWARD);
  motor2.run(FORWARD);
  motor3.run(FORWARD);
  motor4.run(FORWARD);
}

// Move backward function
void moveBackward() {
  motor1.run(BACKWARD);
  motor2.run(BACKWARD);
  motor3.run(BACKWARD);
  motor4.run(BACKWARD);
}

// Stop motors function
void stopMotors() {
  motor1.run(RELEASE);
  motor2.run(RELEASE);
  motor3.run(RELEASE);
  motor4.run(RELEASE);
  Serial.println("✅ Motors Stopped.");
}
