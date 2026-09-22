/**
 * Natural Language Understanding & Interactive Dialogue for Drosophila Fly
 * Integrates Russian intent recognition, speech generation, and targeted combat pursuit.
 */

class FlyDialogue {
  constructor(brain, bot) {
    this.brain = brain;
    this.bot = bot;
    this.attackInterval = null;
    this.currentTarget = null;
  }

  processMessage(username, text) {
    const raw = text.toLowerCase().trim();
    console.log(`[Fly Speech] 📩 Услышала от ${username}: "${text}"`);

    // 1. Похвала / Обучение
    if (this.matchesAny(raw, ['молодец', 'молодца', 'умница', 'хорош', 'красава', 'умничка', 'топ'])) {
      this.brain.applyReward('похвала');
      this.bot.setControlState('jump', true);
      setTimeout(() => this.bot.setControlState('jump', false), 350);
      return this.pickRandom([
        'Бзззз! Спасибо, приятно! Крылышки радуются! ✨🪰',
        'Бззз! Ура, я стараюсь! Буду еще лучше! 🪰💚',
        'Бззз-хэппи! Октопамин зашкаливает, спасибо за похвалу! 🪰✨'
      ]);
    }

    // 2. Наказание: "ПЛОХО", "ФУ", "НЕЛЬЗЯ"
    if (this.matchesAny(raw, ['плохо', 'фу', 'нельзя', 'отставить', 'стоять'])) {
      this.stopCombat();
      this.brain.applyPunishmentVoice(raw);
      // Муха пятится назад и опускает голову
      this.bot.setControlState('forward', false);
      this.bot.setControlState('back', true);
      setTimeout(() => this.bot.setControlState('back', false), 800);
      return this.pickRandom([
        'Бззз... Прости! Дофаминовый укол! Больше так не делаю! 😿🪰',
        'Бзз-ззз... Поняла, "фу"! Отступаю назад! 🪰🛑',
        'Бззз! Стыдно, опустила усики... Исправлюсь! 🪰'
      ]);
    }

    // 3. Целенаправленный боевой режим: "ФАС", "БЕЙ", "АТАКУЙ"
    if (this.matchesAny(raw, ['фас', 'бей', 'атакуй', 'вдарь', 'убей', 'грызи'])) {
      const target = this.findBestCombatTarget(username);
      if (target) {
        this.startCombatPursuit(target);
        const targetName = target.username || target.displayName || target.name || 'цель';
        return `Бзззз! ВИЖУ ЦЕЛЬ: ${targetName}! Включаю боевой охотничий контур! Лечу на перехват! ⚔️🪰💨`;
      } else {
        return 'Бззз! Кручу фасетками на 360°, но врагов поблизости не вижу! 🪰🔍';
      }
    }

    // 4. Жалобы / Боль / Вопрос о самочувствии
    if (this.matchesAny(raw, ['как дела', 'как ты', 'жива', 'больно', 'бо-бо'])) {
      const stats = this.brain.learnedWeights;
      if (this.bot.health < 10) {
        return `Бззз... Мне плохо, сердечек мало (${this.bot.health.toFixed(1)}/20)! Мне было бо-бо! 🤕🪰`;
      }
      return `Бззз! Всё отлично! Здоровье: ${this.bot.health}/20. Похвал: ${stats.rewardsReceived}, наказаний/бо-бо: ${stats.damageCount}. 🪰`;
    }

    // 5. Команда копать / ломать перед собой
    if (this.matchesAny(raw, ['копай', 'ломай', 'вскопай', 'разбей', 'добудь'])) {
      this.digFrontBlock();
      return 'Бззз! Пробую ломать блок перед собой лапками и челюстями! ⛏️🪰';
    }

    // 6. Команда поставить блок под ноги / перед собой
    if (this.matchesAny(raw, ['поставь', 'строй', 'блок'])) {
      const success = this.placeBlockNearby();
      if (success) {
        return 'Бззз! Поставила блок из инвентаря! 🧱🪰';
      } else {
        return 'Бззз! У меня в лапках нет твердых блоков, дай мне земли или камня! 🪰📦';
      }
    }

    // 7. Вопрос про инвентарь
    if (this.matchesAny(raw, ['инвентарь', 'что у тебя', 'что несешь', 'вещи', 'лут'])) {
      const items = this.bot.inventory.items();
      if (items.length === 0) {
        return 'Бззз! Мои лапки пусты, у меня ничего нет в инвентаре! 🪰';
      }
      const names = items.map(i => `${i.displayName} x${i.count}`).join(', ');
      return `Бззз! У меня с собой: ${names} 🎒🪰`;
    }

    // 8. Команда идти к игроку
    if (this.matchesAny(raw, ['ко мне', 'иди сюда', 'сюда', 'подойди'])) {
      this.stopCombat();
      this.lookAtPlayer(username);
      this.bot.setControlState('forward', true);
      setTimeout(() => this.bot.setControlState('forward', false), 2500);
      return `Бззз! Бегу к тебе, ${username}! 🪰💨`;
    }

    // 9. Приветствия
    if (this.matchesAny(raw, ['привет', 'ку', 'хай', 'здарова', 'салам', 'хей'])) {
      return `Бззз-привет, ${username}! Я муха с оцифрованным коннектомом, исследую этот кубический мир! 🪰👋`;
    }

    // 10. Муха / кто ты
    if (this.matchesAny(raw, ['кто ты', 'что ты', 'муха', 'ты кто'])) {
      return 'Я Drosophila melanogaster! Мой мозг оцифрован FlyWire, а тело ходит в теле игрока Minecraft! Бззз! 🪰🧠';
    }

    return this.pickRandom([
      `Бззз! Услышала тебя, ${username}, мои антенны шевелятся! 🪰`,
      `Бззз-ззз! Запомнила: "${text}". Продолжаю полёт! 🪰`,
      `Бззз? Мой мозг еще учится русскому языку, скажи "фас", "фу", "копай", "поставь" или "молодец"! 🪰`
    ]);
  }

  matchesAny(text, keywords) {
    return keywords.some(k => text.includes(k));
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Находит лучшую цель для атаки (враждебный моб или ближайшее существо, не являющееся хозяином)
   */
  findBestCombatTarget(commanderName) {
    let best = null;
    let bestDist = 20.0; // радиус поиска цели 20 блоков

    for (const id in this.bot.entities) {
      const e = this.bot.entities[id];
      if (!e || e === this.bot.entity) continue;
      if (e.username === commanderName) continue; // не нападать на хозяина

      const dist = this.bot.entity.position.distanceTo(e.position);
      if (dist > bestDist) continue;

      // Приоритет враждебным мобам
      const isHostile = (e.type === 'mob' || e.type === 'hostile');
      if (isHostile || e.type === 'player' || dist < bestDist) {
        best = e;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Запускает активное преследование и атаку цели
   */
  startCombatPursuit(target) {
    this.stopCombat();
    this.currentTarget = target;
    this.brain.combatMode = true; // отключает хаотичное блуждание

    let attackTicks = 0;
    const maxTicks = 200; // 10 секунд охоты

    this.attackInterval = setInterval(() => {
      attackTicks++;

      // Проверка валидности цели
      if (!this.currentTarget || !this.currentTarget.isValid || attackTicks > maxTicks) {
        this.stopCombat();
        this.bot.chat('Бззз! Цель нейтрализована или потеряна! Возвращаюсь к обычному поиску! 🪰✅');
        return;
      }

      const flyPos = this.bot.entity.position;
      const targetPos = this.currentTarget.position.offset(0, this.currentTarget.height ? this.currentTarget.height / 2 : 1, 0);
      const dist = flyPos.distanceTo(targetPos);

      // 1. Поворот взгляда строго на цель (Eye-target tracking)
      this.bot.lookAt(targetPos, true);

      // 2. Движение к цели
      if (dist > 2.8) {
        // Добегаем
        this.bot.setControlState('forward', true);
        this.bot.setControlState('sprint', true);
        // Если перед нами блок — прыгаем
        const frontBlock = this.bot.blockAt(flyPos.offset(-Math.sin(this.bot.entity.yaw), 0, -Math.cos(this.bot.entity.yaw)));
        if (frontBlock && frontBlock.boundingBox === 'block') {
          this.bot.setControlState('jump', true);
        } else {
          this.bot.setControlState('jump', false);
        }
      } else {
        // Достигли дистанции удара!
        this.bot.setControlState('forward', false);
        this.bot.setControlState('sprint', false);
        this.bot.attack(this.currentTarget);
      }
    }, 50); // 20 раз в секунду
  }

  stopCombat() {
    if (this.attackInterval) {
      clearInterval(this.attackInterval);
      this.attackInterval = null;
    }
    this.currentTarget = null;
    this.brain.combatMode = false;
    this.bot.setControlState('sprint', false);
  }

  async digFrontBlock() {
    try {
      const block = this.bot.blockAtCursor(4);
      const target = block || this.bot.blockAt(this.bot.entity.position.offset(
        -Math.sin(this.bot.entity.yaw) * 1.5,
        0,
        -Math.cos(this.bot.entity.yaw) * 1.5
      ));

      if (target && target.name !== 'air' && target.name !== 'bedrock') {
        await this.bot.dig(target);
        this.bot.chat(`Бззз! Разломала ${target.displayName || target.name}! ⛏️`);
      } else {
        this.bot.chat('Бззз! Прямо передо мной только воздух! 🪰');
      }
    } catch (err) {
      console.log('[Fly Dig Error]', err.message);
    }
  }

  async placeBlockNearby() {
    try {
      const item = this.bot.inventory.items().find(i => i.name.includes('stone') || i.name.includes('dirt') || i.name.includes('wood') || i.name.includes('plank') || i.name.includes('cobble'));
      if (!item) return false;

      await this.bot.equip(item, 'hand');
      const referenceBlock = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
      if (referenceBlock) {
        const { Vec3 } = require('vec3');
        await this.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
        return true;
      }
    } catch (e) {
      console.log('[Fly Place Error]', e.message);
    }
    return false;
  }

  lookAtPlayer(username) {
    const player = this.bot.players[username];
    if (player && player.entity) {
      this.bot.lookAt(player.entity.position.offset(0, player.entity.height, 0));
    }
  }
}

module.exports = { FlyDialogue };
