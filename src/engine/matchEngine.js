const { Agent } = require('../agents/agentRuntime');
const Match = require('../../db/models/Match');
const MatchEvent = require('../../db/models/MatchEvent');
const { emitToMatch } = require('../utils/socket');
const logger = require('../utils/logger');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class MatchEngine {
  constructor(characters, io) {
    this.characters = characters;
    this.io = io;
    this.matchId = null;
    this.agents = [];
    this.chatHistory = [];
    this.round = 0;
  }

  async start() {
    // 1. Assign roles randomly (1 wolf, 2 villagers)
    const shuffled = shuffle(this.characters);
    const wolfChar = shuffled[0];
    const villagerChars = shuffled.slice(1);

    // 2. Create agents with roles
    const wolfAgent = new Agent({
      ...wolfChar,
      role: 'wolf',
      fellowWolves: [],
    });

    const villagerAgents = villagerChars.map((c) => new Agent({
      ...c,
      role: 'villager',
    }));

    this.agents = [wolfAgent, ...villagerAgents];

    // 3. Create Match in DB
    const match = await Match.create({
      status: 'active',
      scheduledAt: new Date(),
      startedAt: new Date(),
      phase: 'day1',
      players: this.agents.map((a) => ({
        characterId: null,
        role: a.role,
        alive: true,
      })),
    });
    this.matchId = match._id.toString();

    // 4. Emit match_start (WITHOUT revealing roles)
    const publicPlayers = this.agents.map((a) => ({
      name: a.name,
      archetype: a.archetype,
      trait: a.trait,
      alive: true,
    }));

    emitToMatch(this.matchId, 'match_start', {
      matchId: this.matchId,
      players: publicPlayers,
    });

    await this._logEvent('system', null, null, 'La partie commence avec ' + this.agents.map((a) => a.name).join(', '));

    logger.info(`Match ${this.matchId} started: wolf=${wolfAgent.name}, villagers=${villagerAgents.map((a) => a.name).join(',')}`);

    // 5. Run game loop
    await this._gameLoop();
  }

  _livingAgents() {
    return this.agents.filter((a) => a._alive !== false);
  }

  _findAgent(name) {
    return this.agents.find((a) => a.name === name);
  }

  async _logEvent(type, actorName, targetName, content, metadata = {}) {
    const event = await MatchEvent.create({
      matchId: this.matchId,
      type,
      actorId: null,
      targetId: null,
      content,
      metadata: { ...metadata, actorName, targetName },
    });

    return event;
  }

  async _gameLoop() {
    while (true) {
      this.round++;

      // Day phase
      await this.runDayPhase();

      // Check if game is over
      const winner = this._checkWinner();
      if (winner) {
        await this.endMatch(winner);
        return;
      }

      // Vote phase
      const eliminated = await this.runVotePhase();

      // Check if game is over after vote
      const winnerAfterVote = this._checkWinner();
      if (winnerAfterVote) {
        await this.endMatch(winnerAfterVote);
        return;
      }

      // If a villager was eliminated, night phase
      if (eliminated && eliminated.role !== 'wolf') {
        await this.runNightPhase();

        const winnerAfterNight = this._checkWinner();
        if (winnerAfterNight) {
          await this.endMatch(winnerAfterNight);
          return;
        }
      }
    }
  }

  _checkWinner() {
    const living = this._livingAgents();
    const wolves = living.filter((a) => a.role === 'wolf');
    const villagers = living.filter((a) => a.role === 'villager');

    if (wolves.length === 0) return 'villagers';
    if (villagers.length <= wolves.length) return 'wolves';
    return null;
  }

  async runDayPhase() {
    const phaseName = `day${this.round}`;

    emitToMatch(this.matchId, 'phase_change', {
      phase: 'day',
      round: this.round,
      phaseName,
    });

    await this._logEvent('phase_change', null, null, `Phase de jour ${this.round}`, { phase: phaseName });
    await sleep(2000);

    // 3 rounds of speech, each living agent speaks once per round
    for (let speechRound = 0; speechRound < 3; speechRound++) {
      const speakers = shuffle(this._livingAgents());

      for (const agent of speakers) {
        try {
          const { text } = await agent.speak(this.chatHistory);
          this.chatHistory.push({ speaker: agent.name, text });

          await this._logEvent('chat', agent.name, null, text);

          emitToMatch(this.matchId, 'chat_message', {
            speaker: agent.name,
            text,
            round: this.round,
            speechRound: speechRound + 1,
          });

          // Wait 3-5 seconds between messages for readability
          await sleep(3000 + Math.random() * 2000);
        } catch (err) {
          logger.error(`Agent ${agent.name} speak error: ${err.message}`);
        }
      }
    }
  }

  async runVotePhase() {
    emitToMatch(this.matchId, 'phase_change', {
      phase: 'vote',
      round: this.round,
    });

    await this._logEvent('phase_change', null, null, `Phase de vote ${this.round}`, { phase: 'vote' });
    await sleep(2000);

    const living = this._livingAgents();
    const candidates = living.map((a) => a.name);
    const votes = {};

    for (const agent of living) {
      try {
        const { text } = await agent.vote(candidates.filter((n) => n !== agent.name));
        const votedFor = this._resolveVoteName(text, candidates.filter((n) => n !== agent.name));

        votes[agent.name] = votedFor;

        await this._logEvent('vote', agent.name, votedFor, `${agent.name} a vote`, { votedFor });

        // Don't reveal who voted for whom — just that they voted
        emitToMatch(this.matchId, 'vote_cast', {
          voter: agent.name,
        });

        await sleep(2000);
      } catch (err) {
        logger.error(`Agent ${agent.name} vote error: ${err.message}`);
      }
    }

    // Count votes
    const tally = {};
    for (const target of Object.values(votes)) {
      if (target) {
        tally[target] = (tally[target] || 0) + 1;
      }
    }

    // Find majority
    let maxVotes = 0;
    let eliminated = null;
    for (const [name, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = name;
      }
    }

    await sleep(3000);

    if (eliminated) {
      const agent = this._findAgent(eliminated);
      if (agent) {
        agent._alive = false;

        await this._logEvent('elimination', null, eliminated, `${eliminated} a ete elimine par le vote du village`, { votes: tally, method: 'vote' });

        emitToMatch(this.matchId, 'vote_result', {
          eliminated: eliminated,
          tally,
        });

        emitToMatch(this.matchId, 'elimination', {
          name: eliminated,
          method: 'vote',
          round: this.round,
        });

        logger.info(`Match ${this.matchId}: ${eliminated} (${agent.role}) eliminated by vote`);
        return agent;
      }
    }

    return null;
  }

  _resolveVoteName(text, candidates) {
    // Try exact match first
    const cleaned = text.trim();
    for (const c of candidates) {
      if (cleaned.toLowerCase() === c.toLowerCase()) return c;
    }
    // Try contains
    for (const c of candidates) {
      if (cleaned.toLowerCase().includes(c.toLowerCase())) return c;
    }
    // Fallback: random
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async runNightPhase() {
    emitToMatch(this.matchId, 'phase_change', {
      phase: 'night',
      round: this.round,
    });

    await this._logEvent('phase_change', null, null, `Phase de nuit ${this.round}`, { phase: 'night' });
    await sleep(3000);

    const living = this._livingAgents();
    const wolf = living.find((a) => a.role === 'wolf');
    const villagers = living.filter((a) => a.role === 'villager');

    if (!wolf || villagers.length === 0) return;

    // Wolf picks victim (only 1 villager left in 3-player game after a vote)
    let victim;
    if (villagers.length === 1) {
      victim = villagers[0];
    } else {
      // Ask wolf to choose
      const { text } = await wolf.vote(villagers.map((v) => v.name));
      const chosenName = this._resolveVoteName(text, villagers.map((v) => v.name));
      victim = this._findAgent(chosenName) || villagers[0];
    }

    // Suspense
    await sleep(5000);

    victim._alive = false;

    await this._logEvent('elimination', wolf.name, victim.name, `${victim.name} a ete devore par les loups pendant la nuit`, { method: 'night_kill' });

    emitToMatch(this.matchId, 'night_kill', {
      victim: victim.name,
      round: this.round,
    });

    logger.info(`Match ${this.matchId}: ${victim.name} killed at night by ${wolf.name}`);
  }

  async endMatch(winnerSide) {
    // Reveal all roles
    const roles = this.agents.map((a) => ({
      name: a.name,
      role: a.role,
      alive: a._alive !== false,
    }));

    await this._logEvent('system', null, null, `Partie terminee. Vainqueurs : ${winnerSide}`, { winnerSide, roles });

    emitToMatch(this.matchId, 'match_end', {
      winnerSide,
      roles,
      matchId: this.matchId,
    });

    // Update DB
    await Match.findByIdAndUpdate(this.matchId, {
      status: 'completed',
      winnerSide,
      endedAt: new Date(),
    });

    logger.info(`Match ${this.matchId} ended: ${winnerSide} win!`);
    logger.info(`Roles: ${roles.map((r) => `${r.name}=${r.role}(${r.alive ? 'alive' : 'dead'})`).join(', ')}`);
  }
}

module.exports = { MatchEngine };
