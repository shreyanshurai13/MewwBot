const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const conversation = document.querySelector('#conversation');
const moodCopy = document.querySelector('#mood-copy');
const quickPrompts = document.querySelector('#quick-prompts');
const welcomeMessage = conversation.innerHTML;
let selectedLanguage = null;
let pointerOnEye = false;

function addMessage(text, kind) {
  const row = document.createElement('div');
  row.className = `message ${kind}`;
  const content = document.createElement('div');
  content.className = 'message-content';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  content.append(bubble);
  const time = document.createElement('time');
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  content.append(time);
  if (kind === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = '🐱';
    row.append(avatar);
  }
  row.append(content);
  conversation.append(row);
  conversation.scrollTop = conversation.scrollHeight;
}

function setAngry(angry) {
  document.body.classList.toggle('is-angry', angry);
  moodCopy.textContent = angry ? 'what are you typing?!' : 'watching you...';
}

function resizeComposer() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
}

function sendMessage(value = input.value) {
  const message = value.trim();
  if (!message) return;
  addMessage(message, 'user');
  input.value = '';
  resizeComposer();
  setAngry(pointerOnEye);

  if (/^(hi|hello)[!.?\s]*$/i.test(message)) {
    addMessage('Hello', 'assistant');
  } else if (selectedLanguage === 'Hindi') {
    addMessage('मुझे सिर्फ “hi” और “hello” समझ आता है।', 'assistant');
  } else {
    addMessage('I only know “hi” and “hello.” You are testing my patience.', 'assistant');
  }
  input.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage();
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
form.addEventListener('click', (event) => {
  if (event.target === form) input.focus();
});

input.addEventListener('focus', () => setAngry(true));
input.addEventListener('input', () => { setAngry(true); resizeComposer(); });
input.addEventListener('blur', () => setAngry(pointerOnEye));
document.querySelectorAll('.eye').forEach((eye) => {
  eye.addEventListener('pointerenter', () => { pointerOnEye = true; setAngry(true); });
  eye.addEventListener('pointerleave', () => { pointerOnEye = false; setAngry(input === document.activeElement); });
});

conversation.addEventListener('click', (event) => {
  const languageButton = event.target.closest('[data-language]');
  if (languageButton) chooseLanguage(languageButton.dataset.language);
});

document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});

document.querySelector('#reset-chat').addEventListener('click', () => {
  selectedLanguage = null;
  pointerOnEye = false;
  conversation.innerHTML = welcomeMessage;
  quickPrompts.classList.remove('visible');
  input.value = '';
  setAngry(false);
});

function chooseLanguage(language) {
  selectedLanguage = language;
  document.querySelector('.language-options')?.remove();
  addMessage(language, 'user');
  addMessage(language === 'Hindi' ? 'ठीक है, हिन्दी! अब hi या hello कहो।' : 'English it is. Try hi or hello.', 'assistant');
  quickPrompts.classList.add('visible');
  input.focus();
}
