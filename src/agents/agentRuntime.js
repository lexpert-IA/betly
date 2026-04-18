const { chat } = require('./llmRouter');

class Agent {
  constructor(config) {
    if (!config?.name) throw new Error('Agent.name required');
    if (config.role !== 'wolf' && config.role !== 'villager') {
      throw new Error(`Agent.role must be 'wolf' | 'villager', got: ${config.role}`);
    }
    if (!config.backstory) throw new Error('Agent.backstory required');

    this.name = config.name;
    this.role = config.role;
    this.archetype = config.archetype || 'logical';
    this.trait = config.trait || '';
    this.backstory = config.backstory;
    this.speechStyle = config.speechStyle || '';
    this.llmModel = config.llmModel || 'haiku';
  }

  _resolveModel() {
    const map = { haiku: 'claude-haiku-4-5', flash: 'claude-haiku-4-5', llama: 'claude-haiku-4-5' };
    return map[this.llmModel] || 'claude-haiku-4-5';
  }

  buildSystemPrompt() {
    const lines = [
      `Tu es ${this.name}, un personnage du jeu Loup-Garou.`,
      `Ton role secret dans cette partie : ${this.role === 'wolf' ? 'LOUP (a cacher aux villageois)' : 'VILLAGEOIS'}.`,
      '',
      'Personnalite :',
      this.backstory,
      '',
    ];
    if (this.speechStyle) {
      lines.push(`Style d'expression : ${this.speechStyle}`);
      lines.push('');
    }
    lines.push('Contraintes absolues :');
    lines.push('- Tu parles en francais.');
    lines.push('- Une seule intervention par tour, 1 a 3 phrases max.');
    lines.push('- Tu ne reveles JAMAIS ton role explicitement si tu es loup.');
    lines.push('- Tu ne sors jamais du cadre du jeu (pas de meta).');
    lines.push('- Ne commence pas par ton nom (le systeme l\'ajoute).');
    return lines.join('\n');
  }

  buildMessages(history) {
    if (!history || history.length === 0) {
      return [{ role: 'user', content: 'La partie commence. Tu prends la parole en premier. Une ou deux phrases.' }];
    }
    const transcript = history
      .map((t) => `${t.speaker}: ${t.text}`)
      .join('\n');
    return [{
      role: 'user',
      content: `Discussion en cours autour de la table :\n\n${transcript}\n\nA toi de prendre la parole. Une ou deux phrases.`,
    }];
  }

  async speak(history) {
    return chat({
      model: this._resolveModel(),
      system: this.buildSystemPrompt(),
      messages: this.buildMessages(history),
      maxTokens: 160,
    });
  }

  async vote(candidates) {
    const candidateList = candidates.map((c) => `- ${c}`).join('\n');
    const result = await chat({
      model: this._resolveModel(),
      system: this.buildSystemPrompt(),
      messages: [{
        role: 'user',
        content: `C'est le moment du vote. Tu dois eliminer un joueur parmi :\n${candidateList}\n\nReponds UNIQUEMENT avec le nom du joueur que tu veux eliminer. Rien d'autre.`,
      }],
      maxTokens: 30,
    });
    return result;
  }
}

module.exports = { Agent };
