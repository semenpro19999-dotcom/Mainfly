/**
 * Natural Language Understanding & Interactive Dialogue for Drosophila Fly
 * Integrates Russian intent recognition and speech generation.
 */

class FlyDialogue {
  constructor(brain, bot) {
    this.brain = brain;
    this.bot = bot;
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

    // 2. Жалобы / Боль / Вопрос о самочувствии
    if (this.matchesAny(raw, ['как дела', 'как ты', 'жива', 'больно', 'бо-бо'])) {
      const stats = this.brain.learnedWeights;
      if (this.bot.health < 10) {
        return `Бззз... Мне плохо, сердечек мало (${this.bot.health.toFixed(1)}/20)! Мне было бо-бо! 🤕🪰`;
      }
      return `Бззз! Всё отлично! Здоровье: ${this.bot.health}/20. Похвал получено: ${stats.rewardsReceived}, ушибов: ${stats.damageCount}. 🪰`;
    }

    // 3. Команда копать / ломать перед собой
    if (this.matchesAny(raw, ['копай', 'ломай', 'вскопай', 'разбей', 'добудь'])) {
      this.digFrontBlock();
      return 'Бззз! Пробую ломать блок перед собой лапками и челюстями! ⛏️🪰';
    }

    // 4. Команда поставить блок под ноги / перед собой
    if (this.matchesAny(raw, ['поставь', 'строй', 'блок'])) {
      const success = this.placeBlockNearby();
      if (success) {
        return 'Бззз! Поставила блок из инвентаря! 🧱🪰';
      } else {
        return 'Бззз! У меня в лапках нет твердых блоков, дай мне земли или камня! 🪰📦';
      }
    }

    // 5. Команда атаковать / драться
    if (this.matchesAny(raw, ['бей', 'атакуй', 'вдарь', 'фас', 'убей'])) {
      this.attackNearestTarget();
      return 'Бзззз! В бой! Атакую ближайшую цель лапками! ⚔️🪰';
    }

    // 6. Вопрос про инвентарь
    if (this.matchesAny(raw, ['инвентарь', 'что у тебя', 'что несешь', 'вещи', 'лут'])) {
      const items = this.bot.inventory.items();
      if (items.length === 0) {
        return 'Бззз! Мои лапки пусты, у меня ничего нет в инвентаре! 🪰';
      }
      const names = items.map(i => `${i.displayName} x${i.count}`).join(', ');
      return `Бззз! У меня с собой: ${names} 🎒🪰`;
    }

    // 7. Команда идти к игроку
    if (this.matchesAny(raw, ['ко мне', 'иди сюда', 'сюда', 'стой', 'подойди'])) {
      this.lookAtPlayer(username);
      this.bot.setControlState('forward', true);
      setTimeout(() => this.bot.setControlState('forward', false), 2000);
      return `Бззз! Бегу к тебе, ${username}! 🪰💨`;
    }

    // 8. Приветствия
    if (this.matchesAny(raw, ['привет', 'ку', 'хай', 'здарова', 'салам', 'хей'])) {
      return `Бззз-привет, ${username}! Я муха с оцифрованным коннектомом, исследую этот кубический мир! 🪰👋`;
    }

    // 9. Муха / кто ты
    if (this.matchesAny(raw, ['кто ты', 'что ты', 'муха', 'ты кто'])) {
      return 'Я Drosophila melanogaster! Мой мозг оцифрован FlyWire, а тело ходит в теле игрока Minecraft! Бззз! 🪰🧠';
    }

    // Дефолтный ответ с признаками понимания
    return this.pickRandom([
      `Бззз! Услышала тебя, ${username}, мои антенны шевелятся! 🪰`,
      `Бззз-ззз! Запомнила: "${text}". Продолжаю полёт! 🪰`,
      `Бззз? Мой мозг еще учится русскому языку, скажи "копай", "поставь", "молодец" или "что у тебя"! 🪰`
    ]);
  }

  matchesAny(text, keywords) {
    return keywords.some(k => text.includes(k));
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
      // Ищем любой блок в инвентаре
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

  attackNearestTarget() {
    let nearest = null;
    let minDist = 4.0;
    for (const id in this.bot.entities) {
      const e = this.bot.entities[id];
      if (e === this.bot.entity) continue;
      const d = this.bot.entity.position.distanceTo(e.position);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      this.bot.attack(nearest);
      this.bot.chat(`Бззз! Кусь лапками по ${nearest.username || nearest.name || 'врагу'}! ⚔️`);
    } else {
      this.bot.chat('Бззз! Рядом никого нет, чтобы укусить! 🪰');
    }
  }

  lookAtPlayer(username) {
    const player = this.bot.players[username];
    if (player && player.entity) {
      this.bot.lookAt(player.entity.position.offset(0, player.entity.height, 0));
    }
  }
}

module.exports = { FlyDialogue };
