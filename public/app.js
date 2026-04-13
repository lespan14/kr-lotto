let statsData = null;

function ballClass(n) {
  if (n <= 10) return 'b1';
  if (n <= 20) return 'b2';
  if (n <= 30) return 'b3';
  if (n <= 40) return 'b4';
  return 'b5';
}

function makeBall(n, isBonus) {
  const cls = isBonus ? 'bonus-ball' : ballClass(n);
  return `<div class="ball ${cls}">${n}</div>`;
}

function computeStats(draws) {
  const freq = {};
  const bonusFreq = {};
  for (let n = 1; n <= 45; n++) { freq[n] = 0; bonusFreq[n] = 0; }
  for (const draw of draws) {
    for (const n of draw.numbers) freq[n]++;
    bonusFreq[draw.bonus]++;
  }
  const sorted = Object.entries(freq)
    .map(([num, count]) => ({ num: parseInt(num), count, bonus: bonusFreq[num] }))
    .sort((a, b) => b.count - a.count);
  return { freq, sorted };
}

async function loadData() {
  const res = await fetch('/lotto-data.json');
  if (!res.ok) throw new Error('lotto-data.json 로딩 실패');
  const data = await res.json();
  const draws = data.draws;

  try {
    const nextRound = (data.lastRound || 0) + 1;
    const liveRes = await fetch(`/.netlify/functions/latest-round?from=${nextRound}`);
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      if (liveData.draws && liveData.draws.length > 0) {
        draws.push(...liveData.draws);
      }
    }
  } catch (e) {
    console.warn('최신 회차 fetch 실패 (정적 데이터 사용):', e.message);
  }

  return draws;
}

function renderHotCold(sorted, totalRounds) {
  const maxCount = sorted[0].count;

  document.getElementById('hot-numbers').innerHTML = sorted.slice(0, 10).map((item, i) => `
    <div class="ball-stat-item">
      <span class="rank">${i + 1}</span>
      ${makeBall(item.num)}
      <div class="bar-wrap">
        <div class="bar" style="width:${(item.count / maxCount * 100).toFixed(1)}%; background: linear-gradient(90deg, #ff6b35, #e94560);"></div>
      </div>
      <span class="count">${item.count}회 (${(item.count / totalRounds * 100).toFixed(1)}%)</span>
    </div>
  `).join('');

  const coldSorted = [...sorted].sort((a, b) => a.count - b.count);
  document.getElementById('cold-numbers').innerHTML = coldSorted.slice(0, 10).map((item, i) => `
    <div class="ball-stat-item">
      <span class="rank">${i + 1}</span>
      ${makeBall(item.num)}
      <div class="bar-wrap">
        <div class="bar" style="width:${(item.count / maxCount * 100).toFixed(1)}%; background: linear-gradient(90deg, #1e3a5f, #4ecdc4);"></div>
      </div>
      <span class="count">${item.count}회 (${(item.count / totalRounds * 100).toFixed(1)}%)</span>
    </div>
  `).join('');
}

function renderHeatmap(freq) {
  const counts = Object.values(freq);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  document.getElementById('heatmap').innerHTML = Array.from({ length: 45 }, (_, i) => {
    const n = i + 1;
    const count = freq[n];
    const ratio = (count - min) / (max - min || 1);
    const r = Math.round(30 + ratio * 200);
    const g = Math.round(58 + ratio * 50);
    const b = Math.round(200 - ratio * 150);
    const textColor = ratio > 0.5 ? '#fff' : '#ccc';
    return `<div class="hm-cell" style="background:rgb(${r},${g},${b});color:${textColor}" title="${n}번: ${count}회">
      <span class="hm-num">${n}</span>
      <span class="hm-cnt">${count}</span>
    </div>`;
  }).join('');
}

function renderRecentDraws(draws) {
  document.getElementById('recent-tbody').innerHTML = draws.slice(-20).reverse().map(draw => `
    <tr>
      <td>${draw.round}</td>
      <td>${draw.date}</td>
      <td><div class="td-balls">${draw.numbers.map(n => makeBall(n)).join('')}</div></td>
      <td>${makeBall(draw.bonus, true)}</td>
    </tr>
  `).join('');
}

function generateNumbers(type) {
  if (!statsData) return;
  const { sorted } = statsData;

  let pool, desc;
  if (type === 'random') {
    pool = Array.from({ length: 45 }, (_, i) => i + 1);
    desc = '1~45 중 완전 랜덤 추첨';
  } else if (type === 'hot') {
    const top20 = sorted.slice(0, 20).map(x => x.num);
    pool = [...top20, ...top20, ...sorted.slice(20).map(x => x.num)];
    desc = '자주 나온 번호(TOP 20)에 높은 가중치를 부여한 랜덤 추첨';
  } else if (type === 'cold') {
    const bottom20 = [...sorted].sort((a, b) => a.count - b.count).slice(0, 20).map(x => x.num);
    pool = [...bottom20, ...bottom20, ...sorted.slice(0, 25).map(x => x.num)];
    desc = '적게 나온 번호(하위 20)에 높은 가중치를 부여한 랜덤 추첨';
  } else {
    const top10 = sorted.slice(0, 10).map(x => x.num);
    const bottom10 = [...sorted].sort((a, b) => a.count - b.count).slice(0, 10).map(x => x.num);
    const mid = sorted.slice(10, 35).map(x => x.num);
    pool = [...top10, ...bottom10, ...mid];
    desc = '자주·적게 나온 번호를 균형있게 조합한 추첨';
  }

  const picked = [];
  const poolCopy = [...pool];
  while (picked.length < 6 && poolCopy.length > 0) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    const n = poolCopy.splice(idx, 1)[0];
    if (!picked.includes(n)) picked.push(n);
  }
  picked.sort((a, b) => a - b);

  document.getElementById('generated-numbers').innerHTML = picked.map(n => makeBall(n)).join('');
  document.getElementById('gen-desc').textContent = desc;
}

async function init() {
  try {
    const draws = await loadData();
    const { freq, sorted } = computeStats(draws);
    statsData = { draws, freq, sorted };

    const totalRounds = draws.length;
    const lastDraw = draws[draws.length - 1];

    document.getElementById('subtitle').textContent =
      `총 ${totalRounds}회차 데이터 | 최근 ${lastDraw?.round}회 (${lastDraw?.date})`;

    document.getElementById('stat-total').textContent = totalRounds;
    document.getElementById('stat-most-num').textContent = sorted[0].num + '번';
    document.getElementById('stat-most-cnt').textContent = sorted[0].count + '회';
    document.getElementById('stat-least-num').textContent =
      [...sorted].sort((a, b) => a.count - b.count)[0].num + '번';

    renderHotCold(sorted, totalRounds);
    renderHeatmap(freq);
    renderRecentDraws(draws);
    generateNumbers('random');

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = '';
  } catch (e) {
    document.getElementById('loading-msg').textContent = '데이터 로딩 실패: ' + e.message;
    console.error(e);
  }
}

init();
