const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const { DrosophilaBrain } = require('./brain');
const { FlyWireConnectomeLoader } = require('./connectome_loader');
const path = require('path');
require('dotenv').config();

const CONFIG = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_USERNAME || 'Drosophila_Fly',
  version: '1.20.1', // Targets Fabric / Vanilla 1.20.1
};

async function main() {
  console.log('====================================================');
  console.log(' 🪰 Drosophila Connectome Agent for Minecraft 1.20.1');
  console.log('====================================================');

  // Load FlyWire Codex neurons.csv if present in root folder
  const loader = new FlyWireConnectomeLoader();
  const neuronsCsvPath = path.join(__dirname, 'neurons.csv');
  await loader.loadNeuronsCSV(neuronsCsvPath);

  console.log(`Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`);

  const bot = mineflayer.createBot(CONFIG);
  const brain = new DrosophilaBrain(16);

  bot.on('spawn', () => {
    console.log(`[Fly Brain] 🟢 ${bot.username} has spawned in the world!`);
    console.log('[Fly Brain] Starting visual ommatidia & central complex loop (20 TPS)...');
    
    // Start the fly brain decision loop (every 50ms = 1 Minecraft game tick)
    setInterval(() => {
      if (!bot.entity) return;
      
      const sensoryData = sampleFlyVision(bot);
      const motorActions = brain.update(sensoryData);
      applyFlyMotorOutput(bot, motorActions);
    }, 50);
  });


/**
 * Samples 16-sector compound eye (ommatidia) vision around the fly
 */
function sampleFlyVision(bot) {
  const eyePos = bot.entity.position.offset(0, bot.entity.height, 0);
  const currentYaw = bot.entity.yaw;

  const numSectors = 16;
  const brightnessSectors = new Float32Array(numSectors);
  const obstacleDistance = new Float32Array(numSectors);

  // Raycast around 360 degrees in horizontal plane
  const maxRayDist = 12;
  for (let i = 0; i < numSectors; i++) {
    // Sector angle relative to player yaw
    const relAngle = (i / numSectors) * 2 * Math.PI;
    const absAngle = currentYaw + relAngle;
    const dx = -Math.sin(absAngle);
    const dz = -Math.cos(absAngle);

    let hitDist = maxRayDist;
    let maxLightFound = 0;

    for (let step = 1; step <= maxRayDist; step++) {
      const checkPos = eyePos.offset(dx * step, 0, dz * step);
      const block = bot.blockAt(checkPos);
      if (!block) continue;

      if (block.light > maxLightFound) {
        maxLightFound = block.light;
      }

      if (block.boundingBox === 'block' && hitDist === maxRayDist) {
        hitDist = step;
        break;
      }
    }

    brightnessSectors[i] = maxLightFound / 15.0; // Minecraft light is 0..15
    obstacleDistance[i] = hitDist;
  }

  // Check immediate front block (antenna tactile feelers)
  const frontCheckPos = bot.entity.position.offset(
    -Math.sin(currentYaw) * 0.9,
    0,
    -Math.cos(currentYaw) * 0.9
  );
  const blockFrontFoot = bot.blockAt(frontCheckPos);
  const blockFrontHead = bot.blockAt(frontCheckPos.offset(0, 1, 0));
  const frontBlocked = (blockFrontFoot && blockFrontFoot.boundingBox === 'block') ||
                       (blockFrontHead && blockFrontHead.boundingBox === 'block');

  // Threat detection (nearest non-fly entity - player or hostile mob)
  let nearestThreatDist = Infinity;
  let nearestThreatAngle = 0;

  for (const id in bot.entities) {
    const entity = bot.entities[id];
    if (entity === bot.entity) continue;
    if (entity.type === 'mob' || entity.type === 'player') {
      const dist = bot.entity.position.distanceTo(entity.position);
      if (dist < nearestThreatDist) {
        nearestThreatDist = dist;
        // Calculate relative angle to threat
        const diffX = entity.position.x - bot.entity.position.x;
        const diffZ = entity.position.z - bot.entity.position.z;
        const threatYaw = Math.atan2(-diffX, -diffZ);
        nearestThreatAngle = threatYaw - currentYaw;
      }
    }
  }

  return {
    brightnessSectors,
    obstacleDistance,
    frontBlocked: !!frontBlocked,
    nearestThreatDist,
    nearestThreatAngle
  };
}

/**
 * Sends motor control packets to Minecraft server
 */
function applyFlyMotorOutput(bot, actions) {
  bot.setControlState('forward', actions.forward);
  bot.setControlState('back', actions.back);
  bot.setControlState('jump', actions.jump);
  bot.setControlState('sprint', actions.sprint);

  if (Math.abs(actions.turn) > 0.01) {
    // Turn yaw by angular velocity
    const targetYaw = bot.entity.yaw + actions.turn * 0.35;
    bot.look(targetYaw, bot.entity.pitch, true);
  }
}

bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  if (message.toLowerCase().includes('fly') || message.toLowerCase().includes('муха')) {
    bot.chat('Bzzzz! 🪰');
  }
});

bot.on('kicked', (reason) => {
  console.log('[Fly Brain] Kicked from server:', reason);
});

bot.on('error', (err) => {
  console.error('[Fly Brain] Error:', err.message);
});

}

main().catch(console.error);
