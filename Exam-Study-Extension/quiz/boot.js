'use strict';
(async()=>{try{
 const id=new URLSearchParams(location.search).get('exam')||'cysa-original';
 if(id==='cysa-original'){
  window.EXAM={id,name:'CompTIA CySA+ · Original PDF'};
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='bank.js';s.onload=resolve;s.onerror=reject;document.body.append(s)});
 }else{const exam=await ExamStore.get(id);if(!exam)throw new Error('Exam not found. Return to the exam library.');window.EXAM=exam;window.QUESTION_BANK=exam.questions;}
 const bank=window.QUESTION_BANK;
 document.title=window.EXAM.name+' | Exam Study Library';
 document.querySelector('.brand > span:last-child').textContent=window.EXAM.name;
 document.querySelector('h1').textContent=window.EXAM.name;
 document.querySelector('#all-count').textContent=bank.length;
 for(const type of ['mcq','pbq'])document.querySelector('[data-mode='+type+'] b').textContent=bank.filter(q=>(q.type===type||(type==='pbq'&&q.type==='order'))).length;
 const progress=document.querySelector('.progress-card p');progress.innerHTML='<strong id="done-count">0</strong> of '+bank.length+' reviewed <span id="accuracy">— accuracy</span>';
 document.querySelector('.map-help').textContent='Select any number to jump. Progress is separate for each exam.';
 if(id!=='cysa-original'){document.querySelector('.aside-bottom p').textContent=bank.length+' locally stored questions.';document.querySelector('.aside-bottom').childNodes[2].textContent=' LOCAL EXAM';}
 const s=document.createElement('script');s.src='app.js';document.body.append(s);
 }catch(e){document.querySelector('#question-area').textContent=e.message;}
})();
