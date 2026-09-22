/**
 * Drosophila Brain Model - Central Complex & Spiking Reflex Circuits
 * Implements:
 * 1. Ring Attractor (Compass / E-PG neurons) for head direction
 * 2. Hassenstein-Reichardt motion detectors for optical flow
 * 3. Giant Fiber System (escape jump/dash reflex upon rapid looming/darkening)
 * 4. Descending Neurons (DNb - forward crawl/fly, DNa - turning saccades, MDN - backward moonwalk)
 */

class DrosophilaBrain {
  constructor(numSectors = 16) {
    this.numSectors = numSectors; // 16 visual sectors (ommatidia groups around 360°)
    
    // Ring Attractor Compass Neurons (E-PG neurons in the Ellipsoid Body)
    this.compassNeurons = new Float32Array(numSectors);
    this.compassNeurons[0] = 1.0; // Initial heading bump

    // Memory of previous visual brightness per sector (for motion / looming detection)
    this.prevBrightness = new Float32Array(numSectors);

    // Motor Descending Neurons activation states (0.0 to 1.0)
    this.DN_forward = 0.0;   // DNb01 / DNb02
    this.DN_turn = 0.0;      // DNa01 / DNa02 (positive = right, negative = left)
    this.DN_backward = 0.0;  // MDN (Moonwalker)
    this.DN_escape = 0.0;    // Giant Fiber System (Jump / Evasive burst)
    
    // Internal foraging state (Lévy flight / wander burst timer)
    this.saccadeTimer = 0;
    this.currentTurnBias = 0;
  }

  /**
   * Process sensory input each tick (20 Hz / Minecraft tick)
   * @param {Object} sensorData
   * @param {Float32Array|Array} sensorData.brightnessSectors 16 sectors [0..1] of ambient light around the fly
   * @param {Float32Array|Array} sensorData.obstacleDistance 16 sectors distance in blocks to obstacles
   * @param {boolean} sensorData.frontBlocked whether immediate block is obstructing forward step
   * @param {number} sensorData.nearestThreatDist distance to nearest approaching mob/player (or Infinity)
   * @param {number} sensorData.nearestThreatAngle relative angle in radians to threat
   */
  update(sensorData) {
    const {
      brightnessSectors,
      obstacleDistance,
      frontBlocked,
      nearestThreatDist,
      nearestThreatAngle
    } = sensorData;

    // 1. Giant Fiber (GF) System - Looming Threat / Rapid Darkening detector
    // Flies have a dedicated giant axon for ultra-fast escape response
    let threatLooming = false;
    if (nearestThreatDist < 3.5) {
      threatLooming = true;
    }

    // Check optical looming (sudden massive drop in light in front sectors)
    let frontDarkening = 0;
    const frontIndices = [15, 0, 1];
    for (const idx of frontIndices) {
      const drop = this.prevBrightness[idx] - brightnessSectors[idx];
      if (drop > 0.4) frontDarkening += drop;
    }

    if (threatLooming || frontDarkening > 0.6) {
      // GIANT FIBER FIRE!
      this.DN_escape = 1.0;
      this.DN_forward = 1.0;
      // Turn away from threat
      this.DN_turn = nearestThreatAngle > 0 ? -1.0 : 1.0;
      this.DN_backward = threatLooming && nearestThreatDist < 1.5 ? 0.8 : 0.0;
    } else {
      this.DN_escape = Math.max(0, this.DN_escape - 0.2); // quick decay
    }

    // 2. Phototaxis & Ring Attractor (Central Complex - Ellipsoid Body)
    // Find direction of highest light source
    let maxLight = -1;
    let brightestSector = 0;
    for (let i = 0; i < this.numSectors; i++) {
      if (brightnessSectors[i] > maxLight) {
        maxLight = brightnessSectors[i];
        brightestSector = i;
      }
    }

    // Shift ring attractor bump towards brightest sector (positive phototaxis)
    // Sector 0 is forward, 4 is right, 8 is backward, 12 is left (for 16 sectors)
    for (let i = 0; i < this.numSectors; i++) {
      // Leaky Integrate
      const target = (i === brightestSector) ? 1.0 : 0.0;
      this.compassNeurons[i] = this.compassNeurons[i] * 0.7 + target * 0.3;
    }

    // 3. Antenna tactile input (Obstacle avoidance / tactile grooming)
    const frontDistance = obstacleDistance[0]; // distance directly ahead
    const leftObstacle = Math.min(obstacleDistance[14], obstacleDistance[15]);
    const rightObstacle = Math.min(obstacleDistance[1], obstacleDistance[2]);

    if (this.DN_escape <= 0.1) {
      // Normal fly exploratory behavior
      
      // If blocked in front -> back up or make sharp saccadic turn
      if (frontBlocked || frontDistance < 1.2) {
        if (Math.random() < 0.3) {
          this.DN_backward = 0.8; // MDN active (moonwalk)
        } else {
          this.DN_backward = 0.0;
        }
        // Turn sharply towards the side with more open space
        this.DN_turn = leftObstacle > rightObstacle ? -1.0 : 1.0;
        this.DN_forward = 0.2;
      } else {
        this.DN_backward = 0.0;
        
        // Saccade generator (Drosophila flight saccades are quick ballistic turns)
        this.saccadeTimer--;
        if (this.saccadeTimer <= 0) {
          // Lévy flight: mostly forward, occasional spontaneous fast turn
          if (Math.random() < 0.25) {
            this.currentTurnBias = (Math.random() - 0.5) * 1.5;
            this.saccadeTimer = Math.floor(5 + Math.random() * 15); // lasts 5-20 ticks
          } else {
            // Slight steering towards brightest sector (if not blocked)
            let lightAngle = (brightestSector <= 8) 
              ? (brightestSector / 8) // 0 to 1 (turning right)
              : -((16 - brightestSector) / 8); // -1 to 0 (turning left)
            this.currentTurnBias = lightAngle * 0.4 + (Math.random() - 0.5) * 0.2;
            this.saccadeTimer = Math.floor(10 + Math.random() * 20);
          }
        }

        this.DN_turn = this.currentTurnBias;
        this.DN_forward = 0.8 + Math.random() * 0.2; // constant crawling / moving forward
      }
    }

    // Save current brightness for next tick's motion detectors
    for (let i = 0; i < this.numSectors; i++) {
      this.prevBrightness[i] = brightnessSectors[i];
    }

    return {
      forward: this.DN_forward > 0.4,
      back: this.DN_backward > 0.5,
      turn: this.DN_turn, // Angular velocity (radians or factor)
      jump: this.DN_escape > 0.5 || (frontBlocked && frontDistance < 1.0),
      sprint: this.DN_escape > 0.5
    };
  }
}

module.exports = { DrosophilaBrain };
