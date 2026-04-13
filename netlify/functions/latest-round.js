const fetch = require('node-fetch');

function getCurrentRound() {
  const firstDraw = new Date('2002-12-07');
  const now = new Date();
  return Math.floor((now - firstDraw) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

async function fetchRound(round) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 8000
  });
  const data = await res.json();
  if (data.returnValue !== 'success') return null;
  return {
    round: data.drwNo,
    date: data.drwNoDate,
    numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
    bonus: data.bnusNo
  };
}

exports.handler = async (event) => {
  try {
    const currentRound = getCurrentRound();
    const from = parseInt(event.queryStringParameters?.from || currentRound);
    // Use max(currentRound, from) to handle KST/UTC timezone edge cases
    const upTo = Math.max(currentRound, from) + 1;
    const draws = [];

    for (let r = from; r <= upTo; r++) {
      const draw = await fetchRound(r);
      if (draw) draws.push(draw);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ currentRound, draws })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
