const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const replacements = [
  ['placeholder="Enter Room Code"', 'placeholder={t("enter_room_code")}'],
  ['"ROOM CODE: "', 't("room_code")'],
  ["'WAITING...'", 't("waiting")'],
  ['placeholder="Enter Tournament Code"', 'placeholder={t("enter_tournament_code")}'],
  ['"CODE: "', 't("room_code")'],
  ['Players: ', '{t("players")}'],
  ['CALCULATING OUTCOME...', '{t("calculating_outcome")}'],
  ['Aggregating Canthal angles, facial contours, and detecting filters...', '{t("aggregating_data")}'],
  ['"YOU MOGGED!"', 't("you_mogged")'],
  ['YOU MOGGED!', '{t("you_mogged")}'],
  ['MUTUAL DRAW', '{t("mutual_draw")}'],
  ['"YOU GOT MOGGED"', 't("got_mogged")'],
  ['GOT MOGGED!', '{t("got_mogged")}'],
  ['Match Resolution: ', '{t("match_resolution")}'],
  ['P1 (YOU)', '{t("p1_you")}'],
  ['P2 (OPPONENT)', '{t("p2_opponent")}'],
  ['MOG SCORE', '{t("mog_score")}'],
  ['TYPE:', '{t("type")}'],
  ['TILT:', '{t("tilt")}'],
  ['SYM:', '{t("sym")}'],
  ['JAW:', '{t("jaw")}'],
  ['GAZE:', '{t("gaze")}'],
  ['MEW:', '{t("mew")}'],
  ['BROW:', '{t("brow")}'],
  ['MID:', '{t("mid")}'],
  ['LIPS:', '{t("lips")}'],
  ['3RDS:', '{t("thirds")}'],
  ['ELO:', '{t("elo")}'],
  ['CONNECTING VIDEO STREAM...', '{t("connecting_video")}'],
  ['QUIT PRACTICE', '{t("quit_practice")}'],
  ['AI MOG COACH FEEDBACK', '{t("ai_mog_coach")}'],
  ['Current Performance Tier:', '{t("current_performance_tier")}'],
  ['Mog Coach Tips:', '{t("mog_coach_tips")}']
];

for (let [search, replace] of replacements) {
  code = code.split(search).join(replace);
}

fs.writeFileSync('src/App.jsx', code);
console.log('Done!');
