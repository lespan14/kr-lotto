import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA7kMR1nz1qxp0mRmfXYR8jGVnYLszd6zQ",
  authDomain: "kr-lotto.firebaseapp.com",
  projectId: "kr-lotto",
  storageBucket: "kr-lotto.firebasestorage.app",
  messagingSenderId: "475441794338",
  appId: "1:475441794338:web:0a236f0c120e871d7be97b",
  measurementId: "G-GFEL2078CC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesRef = collection(db, 'messages');

// 닉네임 (localStorage 저장)
let username = localStorage.getItem('lotto-nick');
if (!username) {
  username = '로또왕' + Math.floor(Math.random() * 9000 + 1000);
  localStorage.setItem('lotto-nick', username);
}
document.getElementById('chat-nick').value = username;

// 실시간 메시지 수신
const q = query(messagesRef, orderBy('ts', 'desc'), limit(100));
onSnapshot(q, snapshot => {
  const msgs = [];
  snapshot.forEach(doc => msgs.push(doc.data()));
  msgs.reverse();
  const el = document.getElementById('chat-messages');
  const isBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 60;
  el.innerHTML = msgs.map(m => {
    const time = m.ts?.toDate
      ? m.ts.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="chat-msg">
      <div class="chat-msg-header">
        <span class="chat-user">${esc(m.nick)}</span>
        <span class="chat-time">${time}</span>
      </div>
      <p class="chat-text">${esc(m.text)}</p>
    </div>`;
  }).join('');
  if (isBottom) el.scrollTop = el.scrollHeight;
});

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const BAD_WORDS = [
  '씨발','시발','씨바','시바','ㅅㅂ','썅','쌍욕','개새끼','개새','새끼','놈','년','창녀','보지','자지','좆','꼴통',
  'ㅂㅅ','병신','미친','미친놈','미친년','지랄','존나','존내','ㅈㄴ','빡대가리','뒈져','뒤져','죽어','꺼져',
  'fuck','shit','bitch','asshole','bastard','dick','pussy','cunt','cock','nigger','nigga','faggot'
];
const BAD_REGEX = new RegExp(BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');

function filterText(text) {
  return text.replace(BAD_REGEX, m => '*'.repeat(m.length));
}

let sending = false;
async function send() {
  if (sending) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  sending = true;
  const nick = document.getElementById('chat-nick').value.trim() || username;
  localStorage.setItem('lotto-nick', nick);
  username = nick;
  const filtered = filterText(text);
  input.value = '';
  try {
    await addDoc(messagesRef, { nick, text: filtered, ts: serverTimestamp() });
  } finally {
    sending = false;
  }
}

document.getElementById('chat-send').addEventListener('click', send);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
