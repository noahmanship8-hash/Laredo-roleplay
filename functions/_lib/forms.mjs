// The questions on each application form. Edit the text freely.
// Field types: text, textarea, number, select, checkbox.
// The website draws the forms from this file and the server checks every answer against it.

const RULES_TEXT = 'I have read the rules and agree to follow them.';

export const FORMS = {
  staff: {
    label: 'Staff application',
    intro: 'Tell us about yourself and how you would handle the job. Be honest and specific. Short, copied answers are the quickest way to be denied.',
    fields: [
      { id: 'roblox', label: 'Roblox username', type: 'text', required: true, max: 40 },
      { id: 'age', label: 'Age', type: 'number', required: true, min: 13, max: 99 },
      { id: 'timezone', label: 'Time zone and the hours you are usually online', type: 'text', required: true, max: 120 },
      { id: 'hours', label: 'How many hours a week can you be active?', type: 'select', required: true,
        options: ['Under 5 hours', '5 to 10 hours', '10 to 20 hours', 'More than 20 hours'] },
      { id: 'experience', label: 'Do you have moderation or staff experience? Where, and for how long?', type: 'textarea', required: true, max: 1500 },
      { id: 'why', label: 'Why do you want to join the Laredo Roleplay staff team?', type: 'textarea', required: true, max: 1500 },
      { id: 'scenario_rdm', label: 'A player shoots another player for no reason and says they did not know it was against the rules. What do you do?', type: 'textarea', required: true, max: 1500 },
      { id: 'scenario_conflict', label: 'Two members are arguing in a Discord channel and it is getting personal. How do you handle it?', type: 'textarea', required: true, max: 1500 },
      { id: 'rules', label: RULES_TEXT, type: 'checkbox', required: true }
    ]
  },
  discord_dev: {
    label: 'Discord developer application',
    intro: 'Discord developers build and look after the bots, channels and automation in our server.',
    fields: [
      { id: 'roblox', label: 'Roblox username', type: 'text', required: true, max: 40 },
      { id: 'age', label: 'Age', type: 'number', required: true, min: 13, max: 99 },
      { id: 'tools', label: 'Which languages, libraries or bots have you worked with? (for example discord.js or discord.py)', type: 'textarea', required: true, max: 1000 },
      { id: 'years', label: 'How long have you been building Discord bots or servers?', type: 'select', required: true,
        options: ['Less than 1 year', '1 to 2 years', '3 to 5 years', 'More than 5 years'] },
      { id: 'portfolio', label: 'Link to your work (GitHub, a bot you made, anything we can look at)', type: 'text', required: false, max: 300 },
      { id: 'project', label: 'Describe a bot or Discord project you built. What did it do and what was your part?', type: 'textarea', required: true, max: 1500 },
      { id: 'why', label: 'Why do you want to help with Laredo Roleplay?', type: 'textarea', required: true, max: 1500 },
      { id: 'availability', label: 'How much time can you give each week?', type: 'text', required: true, max: 120 },
      { id: 'rules', label: RULES_TEXT + ' I will keep any access I am given private.', type: 'checkbox', required: true }
    ]
  },
  server_dev: {
    label: 'Server developer application',
    intro: 'Server developers help build and improve what players see and use in the game.',
    fields: [
      { id: 'roblox', label: 'Roblox username', type: 'text', required: true, max: 40 },
      { id: 'age', label: 'Age', type: 'number', required: true, min: 13, max: 99 },
      { id: 'build', label: 'What do you build or maintain? (liveries, maps, scripts, tools and so on)', type: 'textarea', required: true, max: 1500 },
      { id: 'tools', label: 'Which tools do you use? (Roblox Studio, Blender, Lua and so on)', type: 'textarea', required: true, max: 1000 },
      { id: 'portfolio', label: 'Link to your work', type: 'text', required: false, max: 300 },
      { id: 'why', label: 'Why do you want to help with Laredo Roleplay?', type: 'textarea', required: true, max: 1500 },
      { id: 'availability', label: 'How much time can you give each week?', type: 'text', required: true, max: 120 },
      { id: 'rules', label: RULES_TEXT, type: 'checkbox', required: true }
    ]
  }
};

export const FORM_IDS = Object.keys(FORMS);

export function publicForms() {
  return JSON.parse(JSON.stringify(FORMS));
}

// Returns [{ id, label, value }] or throws an Error whose message is safe to show to the applicant.
export function validateAnswers(type, answers) {
  const form = FORMS[type];
  if (!form) throw new Error('Unknown application.');
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Missing answers.');
  const cleaned = [];
  for (const field of form.fields) {
    const raw = answers[field.id];
    const label = field.label;
    if (field.type === 'checkbox') {
      const ok = raw === true || raw === 'true' || raw === 'on';
      if (field.required && !ok) throw new Error('Please tick: ' + label);
      cleaned.push({ id: field.id, label, value: ok ? 'Yes' : 'No' });
      continue;
    }
    const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
      if (field.required) throw new Error('Please answer: ' + label);
      continue;
    }
    if (field.type === 'select') {
      if (!field.options.includes(text)) throw new Error('Pick one of the options for: ' + label);
    } else if (field.type === 'number') {
      const n = Number(text);
      if (!Number.isInteger(n) || n < (field.min ?? 0) || n > (field.max ?? 999)) {
        throw new Error('Enter a valid number for: ' + label);
      }
    } else {
      const max = field.max || (field.type === 'textarea' ? 2000 : 200);
      if (text.length > max) throw new Error('Too long (' + max + ' characters at most): ' + label);
    }
    cleaned.push({ id: field.id, label, value: text });
  }
  return cleaned;
}
