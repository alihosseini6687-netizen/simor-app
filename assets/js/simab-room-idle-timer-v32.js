/* Read-only UI countdown; only the server can cancel a room or refund escrow. */
(()=>{'use strict';
 let expiry=null,at=0,serverTTL=0,roomCode=null;
 const messages={
  en:['Waiting room: offline player timeout in ','If someone stays offline, the server cancels the table and refunds each entry.'],
  fa:['مهلت حضور بازیکنان در میز: ','اگر بازیکنی یک دقیقه آفلاین بماند، میز بسته می‌شود و ورودی همه برمی‌گردد.'],
  ru:['Ожидание игроков: ','Если участник не вернётся, сервер закроет стол и вернёт взносы.'],
  ar:['مهلة حضور اللاعبين: ','إذا بقي لاعب غير متصل، تُلغى الطاولة وتُسترد المساهمات.'],
  hi:['खिलाड़ियों की प्रतीक्षा: ','एक खिलाड़ी ऑफलाइन रहने पर टेबल बंद होगी और प्रवेश राशि लौटेगी।'],
  fr:['Présence des joueurs : ','Si un joueur reste hors ligne, la table sera annulée et les mises remboursées.'],
  de:['Wartezeit der Spieler: ','Bleibt jemand offline, wird der Tisch geschlossen und alle Einsätze erstattet.']
 };
 const elem=()=>document.getElementById('room-idle-timer');
 function paint(){
  const el=elem();if(!el)return;
  if(!expiry){el.hidden=true;el.textContent='';return;}
  const words=messages[document.documentElement.lang]||messages.en;
  const remain=Math.max(0,serverTTL-(Date.now()-at));
  const ss=Math.ceil(remain/1000);
  el.hidden=false;el.textContent=words[0]+String(Math.floor(ss/60)).padStart(2,'0')+':'+String(ss%60).padStart(2,'0')+' — '+words[1];
 }
 function update(r){const info=r?.room;
  if(!info||info.status!=='waiting'||!info.idleExpiresAt){expiry=null;roomCode=null;paint();return;}
  // Avoid resetting the clock for an out-of-order poll.
  if(roomCode===info.code&&expiry===info.idleExpiresAt)return;
  roomCode=info.code;expiry=info.idleExpiresAt;at=Date.now();
  serverTTL=Math.max(0,Date.parse(expiry)-(Number.isFinite(r.serverNow)?r.serverNow:Date.now()));
  paint();
 }
 window.SimabIdleTimer=Object.freeze({update});
 setInterval(paint,250);
})();
