/**
 * Drosophila Brain Model with Reinforcement Plasticity (Dopamine & Octopamine System)
 * 
 * Biological basis:
 * - Octopamine (DANs - PAM cluster): Reward signal ("молодца" / food) -> reinforces recent actions.
 * - Dopamine (DANs - PPL1 cluster): Punishment signal (damage / pain "бо бо") -> penalizes recent actions and triggers acute avoidance.
 * - Mushroom Body (Грибовидное тело): Associates sensory contexts (light, obstacles, sounds) with rewards/punishments.
 */

const fs = require('fs');
const path = require('path');

class DrosophilaBrain {
  constructor(numSectors = 16) {
    this.numSectors = numSectors;
    
    // Compass neurons (Ellipsoid body E-PG)
    this.compassNeurons = new Float32Array(numSectors);
    this.compassNeurons[0] = 1.0;
    this.prevBrightness = new Float32Array(numSectors);

    // Motor Descending Neurons
    this.DN_forward = 0.0;
    this.DN_turn = 0.0;
    this.DN_backward = 0.0;
    this.DN_escape = 0.0;
    
    // Neurotransmitter state
    this.octopamine = 0.0; // Reward / Pleasure / Reinforcement
    this.dopamine_pain = 0.0; // Pain / Negative reinforcement ("бо бо")
    
    // Eligibility trace (short-term memory of actions taken over last seconds)
    // to reinforce or penalize through Spike-Timing-Dependent Plasticity (STDP)
    this.actionHistory = []; // stores { heading, forward, turn, obstacleFront }
    
    // Learned behavioral biases (Mushroom body weights)
    this.memoryFile = path.join(__dirname, 'fly_memory.json');
    this.learnedWeights = this.loadMemory();

    this.saccadeTimer = 0;
    this.currentTurnBias = 0;
    this.painCooldown = 0;
    this.combatMode = false; // whether actively locked into target pursuit
  }

  loadMemory() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const data = fs.readFileSync(this.memoryFile, 'utf8');
        console.log('[Fly Brain] 🧠 Загружены долговременные синаптические веса (опыт мухи)!');
        return JSON.parse(data);
      }
    } catch (e) {
      console.log('[Fly Brain] Создаем новую чистую память для мухи.');
    }
    return {
      lightAttraction: 0.5,     // Насколько тянет к свету (0..1)
      cautiousness: 0.3,        // Осторожность перед препятствиями/высотой
      turningVolatility: 0.5,   // Склонность к резким маневрам
      rewardsReceived: 0,
      damageCount: 0
    };
  }

  saveMemory() {
    try {
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.learnedWeights, null, 2), 'utf8');
    } catch (e) {
      console.error('[Fly Brain] Ошибка сохранения памяти:', e.message);
    }
  }

  /**
   * Наказание за урон: "Бо-бо!"
   * Выброс дофамина PPL1-нейронами грибовидного тела.
   */
  applyDamagePain(healthBefore, healthNow) {
    const damage = healthBefore - healthNow;
    this.dopamine_pain = 1.0;
    this.painCooldown = 40; // 2 секунды панического бегства
    this.learnedWeights.damageCount++;
    
    // Пластичность: муха становится более осторожной и начинает меньше лезть в то место, где больно
    this.learnedWeights.cautiousness = Math.min(1.0, this.learnedWeights.cautiousness + 0.08 * damage);
    this.learnedWeights.turningVolatility = Math.min(1.0, this.learnedWeights.turningVolatility + 0.05);

    // Если урон получен при движении вперёд, снижаем безрассудную тягу лететь напролом
    if (this.actionHistory.length > 0) {
      const recent = this.actionHistory[this.actionHistory.length - 1];
      if (recent.forward) {
        this.learnedWeights.lightAttraction = Math.max(0.1, this.learnedWeights.lightAttraction - 0.04);
      }
    }

    this.saveMemory();
    console.log(`[Fly Brain] 💥 БО-БО! Муха получила ${damage.toFixed(1)} урона! Дофаминовый шок. Осторожность выросла до ${this.learnedWeights.cautiousness.toFixed(2)}.`);
  }

  /**
   * Наказание голосом: "Плохо!", "Фу!", "Нельзя!"
   */
  applyPunishmentVoice(word = 'фу') {
    this.dopamine_pain = 0.8;
    this.learnedWeights.damageCount++;
    this.learnedWeights.cautiousness = Math.min(1.0, this.learnedWeights.cautiousness + 0.05);

    // Снижаем агрессию и отменяем последнее действие
    if (this.actionHistory.length > 0) {
      const recent = this.actionHistory[this.actionHistory.length - 1];
      if (recent.forward) {
        this.learnedWeights.lightAttraction = Math.max(0.1, this.learnedWeights.lightAttraction - 0.05);
      }
    }
    this.saveMemory();
    console.log(`[Fly Brain] 🛑 Получена голосовая команда наказания ("${word}"). Осторожность повышена до ${this.learnedWeights.cautiousness.toFixed(2)}.`);
  }

  /**
   * Похвала: "Молодца!"
   * Выброс октопамина PAM-нейронами (вознаграждение).
   */
  applyReward(praiseWord = 'молодца') {
    this.octopamine = 1.0;
    this.learnedWeights.rewardsReceived++;

    // Подкрепляем текущее поведение мухи
    if (this.actionHistory.length > 0) {
      const recent = this.actionHistory[this.actionHistory.length - 1];
      // Если муха сейчас шла к свету или исследовала
      if (recent.forward) {
        this.learnedWeights.lightAttraction = Math.min(1.0, this.learnedWeights.lightAttraction + 0.06);
      }
      // Муха становится более уверенной
      this.learnedWeights.cautiousness = Math.max(0.1, this.learnedWeights.cautiousness - 0.03);
    }

    this.saveMemory();
    console.log(`[Fly Brain] ✨ Октопаминовый всплеск! Муху похвалили ("${praiseWord}")! Удовлетворение закреплено в памяти.`);
  }

  update(sensorData) {
    const {
      brightnessSectors,
      obstacleDistance,
      frontBlocked,
      nearestThreatDist,
      nearestThreatAngle
    } = sensorData;

    // Затухание медиаторов
    this.octopamine = Math.max(0, this.octopamine - 0.05);
    this.dopamine_pain = Math.max(0, this.dopamine_pain - 0.04);
    if (this.painCooldown > 0) this.painCooldown--;

    // 1. Аварийный рефлекс при боли ("БО-БО!") или угрозе
    const inPain = this.painCooldown > 0;
    let threatLooming = nearestThreatDist < 3.5 || inPain;
    
    let frontDarkening = 0;
    for (const idx of [15, 0, 1]) {
      const drop = this.prevBrightness[idx] - brightnessSectors[idx];
      if (drop > 0.4) frontDarkening += drop;
    }

    if (threatLooming || frontDarkening > 0.6) {
      this.DN_escape = 1.0;
      this.DN_forward = 1.0;
      // В панике при боли хаотично мечется
      this.DN_turn = inPain ? (Math.random() > 0.5 ? 1.0 : -1.0) : (nearestThreatAngle > 0 ? -1.0 : 1.0);
      this.DN_backward = threatLooming && nearestThreatDist < 1.5 ? 0.8 : 0.0;
    } else {
      this.DN_escape = Math.max(0, this.DN_escape - 0.2);
    }

    // 2. Фототаксис с учетом выученной привлекательности света
    let maxLight = -1;
    let brightestSector = 0;
    for (let i = 0; i < this.numSectors; i++) {
      if (brightnessSectors[i] > maxLight) {
        maxLight = brightnessSectors[i];
        brightestSector = i;
      }
    }

    for (let i = 0; i < this.numSectors; i++) {
      const target = (i === brightestSector) ? 1.0 : 0.0;
      this.compassNeurons[i] = this.compassNeurons[i] * 0.7 + target * 0.3;
    }

    const frontDistance = obstacleDistance[0];
    const leftObstacle = Math.min(obstacleDistance[14], obstacleDistance[15]);
    const rightObstacle = Math.min(obstacleDistance[1], obstacleDistance[2]);

    // Порог реакции на стену зависит от выученной осторожности
    const avoidDist = 1.0 + this.learnedWeights.cautiousness * 1.5;

    if (this.DN_escape <= 0.1) {
      if (frontBlocked || frontDistance < avoidDist) {
        // Отступление или разворот
        this.DN_backward = Math.random() < (0.2 + this.learnedWeights.cautiousness * 0.3) ? 0.8 : 0.0;
        this.DN_turn = leftObstacle > rightObstacle ? -1.0 : 1.0;
        this.DN_forward = 0.2;
      } else {
        this.DN_backward = 0.0;
        this.saccadeTimer--;
        
        if (this.saccadeTimer <= 0) {
          const exploreRandomness = this.learnedWeights.turningVolatility;
          if (Math.random() < exploreRandomness * 0.4) {
            this.currentTurnBias = (Math.random() - 0.5) * 1.8;
            this.saccadeTimer = Math.floor(5 + Math.random() * 12);
          } else {
            // Тяга к свету модулируется выученным весом
            let lightAngle = (brightestSector <= 8) 
              ? (brightestSector / 8) 
              : -((16 - brightestSector) / 8);
            this.currentTurnBias = lightAngle * (0.2 + this.learnedWeights.lightAttraction * 0.6) + (Math.random() - 0.5) * 0.2;
            this.saccadeTimer = Math.floor(10 + Math.random() * 20);
          }
        }
        this.DN_turn = this.currentTurnBias;
        // При похвале муха бегает более бодро
        const speedBoost = this.octopamine * 0.3;
        this.DN_forward = 0.7 + speedBoost + Math.random() * 0.2;
      }
    }

    for (let i = 0; i < this.numSectors; i++) {
      this.prevBrightness[i] = brightnessSectors[i];
    }

    // Сохраняем в краткосрочную память действие
    this.actionHistory.push({
      forward: this.DN_forward > 0.4,
      turn: this.DN_turn,
      inPain: inPain
    });
    if (this.actionHistory.length > 30) this.actionHistory.shift();

    return {
      forward: this.DN_forward > 0.4,
      back: this.DN_backward > 0.5,
      turn: this.DN_turn,
      jump: this.DN_escape > 0.5 || (frontBlocked && frontDistance < 1.0),
      sprint: this.DN_escape > 0.5,
      inPain: inPain,
      isHappy: this.octopamine > 0.3
    };
  }
}

module.exports = { DrosophilaBrain };
