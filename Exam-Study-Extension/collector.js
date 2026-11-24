// Operates only on the currently authorized, signed-in Pocket Prep tab.
// No cookies, tokens, hidden application state or undocumented endpoints are read.
(()=>{'use strict';if(globalThis.__examCollector)return;globalThis.__examCollector=true;
let exam,host,ui,config={},running=false,stop=false,picking=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const visible=el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const label=el=>norm(el.getAttribute('aria-label')||el.getAttribute('alt')||el.innerText||el.textContent);
const defaults={stem:'.uikit-question__prompt',explanation:'.uikit-question-summary__summary-dropdown-explanation-text,.uikit-question-dropdown-explanation__dropdown-explanation-text,.uikit-question-explanation__explanation-text',images:'.uikit-question__main'};
const get=key=>{try{return [...document.querySelectorAll(config[key]||defaults[key]||':not(*)')].find(visible)||null}catch{return null}};
function status(s){ui.querySelector('#status').textContent=s;}
function selector(el){if(el.id)return '#'+CSS.escape(el.id);const path=[];while(el&&el!==document.body){const siblings=[...el.parentElement.children].filter(e=>e.tagName===el.tagName);path.unshift(el.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(el)+1)+')');el=el.parentElement;}return 'body>'+path.join('>');}
function pick(key){if(running)return;status('Click the '+key+' on the Pocket Prep page. Press Escape to cancel.');picking=key;}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picking){picking=null;status('Selection cancelled.')}},true);
document.addEventListener('click',async e=>{if(!picking||e.composedPath().includes(host))return;e.preventDefault();e.stopImmediatePropagation();let el=e.target;if(['next','submit','reveal'].includes(picking))el=el.closest('button,[role=button],a')||el;config[picking]=selector(el);picking=null;await chrome.storage.local.set({['mapping:'+exam.id]:config});status('Page element saved. You can preview the capture before saving.');},true);
function answerElements(){return [...document.querySelectorAll('[aria-label]')].filter(el=>visible(el)&&/^(?:Incorrect|Correct) Answer\s*,/i.test(label(el)));}
function orderList(){return [...document.querySelectorAll('.uikit-question-build-list-choices-container')].find(visible);}
function gradedOrder(){const list=orderList();return list&&['--correct','--incorrect'].some(s=>list.classList.contains('uikit-question-build-list-choices-container'+s));}
function extractOrder(){
 const list=orderList();if(!gradedOrder())throw new Error('The correct sequence has not been revealed yet.');
 const rows=[...list.querySelectorAll('.uikit-question-build-list-choices-container__choice-container')];
 const positions=rows.map((row,i)=>{const marker=row.querySelector('.uikit-question-build-list-choices-container__correct-position-order-number');return marker?Number(marker.textContent.trim()):i+1;});
 if(rows.length<2||rows.length>20||new Set(positions).size!==rows.length||positions.some(n=>!Number.isInteger(n)||n<1||n>rows.length))throw new Error('The displayed correct sequence is incomplete.');
 const options=rows.map((row,i)=>({key:String.fromCharCode(65+i),text:row.querySelector('.uikit-question-build-list-choices-container__choice-text')?.innerText.trim()}));
 if(options.some(o=>!o.text))throw new Error('An ordering item is missing its text.');
 return {type:'order',options,answer:positions.map((n,i)=>({n,key:options[i].key})).sort((a,b)=>a.n-b.n).map(x=>x.key)};
}
function autoButton(pattern){return [...document.querySelectorAll('button,[role=button],img[alt],[aria-label]')].find(el=>visible(el)&&pattern.test(label(el)));}
function clickControl(el){if(!el)throw new Error('Control not found. Use the setup buttons to select it.');const target=el.closest('button,[role=button],a')||el;if(target.disabled||target.getAttribute('aria-disabled')==='true'||el.getAttribute('aria-disabled')==='true')throw new Error('End of available questions, or control disabled.');target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}
function identity(){return new URL(location.href).searchParams.get('questionSerial')||norm(get('stem')?.innerText);}
async function embed(im){if(!im.complete||!im.naturalWidth)throw new Error('An evidence image has not loaded.');const src=im.currentSrc||im.src;if(/^data:image\/(png|jpeg|webp|gif);base64,/.test(src))return src;const canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;try{canvas.getContext('2d').drawImage(im,0,0);return canvas.toDataURL('image/png')}catch{throw new Error('An image cannot be saved offline from this page. Capture stopped to avoid losing evidence.');}}
async function extract(){
 const stemEl=get('stem'),explanationEl=get('explanation');if(!visible(stemEl)||!visible(explanationEl))throw new Error('Select the question text and expanded explanation using the setup buttons.');
 const stem=stemEl.innerText.trim(),explanation=explanationEl.innerText.trim();if(!stem||!explanation)throw new Error('Question or explanation is empty.');
 const ordered=orderList()?extractOrder():null;
 const els=answerElements();if(!ordered&&(els.length<2||els.length>20))throw new Error('Could not identify graded answers. Collection stopped without skipping this item.');
 const options=els.map((el,i)=>({key:String.fromCharCode(65+i),text:label(el).replace(/^(Incorrect|Correct) Answer\s*,\s*/i,'')}));
 const answer=els.flatMap((el,i)=>/^Correct Answer\s*,/i.test(label(el))?[options[i].key]:[]);if(!ordered&&!answer.length)throw new Error('The correct answer is not visible yet.');
 if(options.some(o=>stem===o.text)||/^(Show|Hide) Explanation$/i.test(explanation))throw new Error('Select the actual question/explanation text, not a choice or toggle button.');
 const roots=[stemEl,explanationEl,get('images')].filter(Boolean);const imgs=[...new Set(roots.flatMap(el=>el.matches('img')?[el]:[...el.querySelectorAll('img')]))].filter(visible);
 const images=await Promise.all(imgs.map(embed));
 return {stem,explanation,options,answer,images,optionExplanations:Object.fromEntries(options.map(o=>[o.key,'Source explanation: '+explanation])),...ordered};
}
async function reveal(){const button=get('reveal')||autoButton(/^Show Explanation$/i);if(button&&button.getAttribute('aria-expanded')!=='true'&&!/^Hide Explanation$/i.test(label(button))){clickControl(button);await sleep(500);}}
async function prepareStudy(){
 if(!visible(get('stem')))throw new Error('Question text not found. Configure the question selector before submitting answers.');
 if(answerElements().length||gradedOrder())return;
 if(!ui.querySelector('#changeHistory').checked)throw new Error('This question is unanswered. Enable the study-history option to submit an answer.');
 if(orderList()){
  const submit=get('submit')||autoButton(/^Check (?:answer|order)$/i);
  if(!submit)throw new Error('Select the ordering question’s Check Answer control in Page setup, or submit it manually.');
  clickControl(submit);
  for(let i=0;i<20&&!stop&&!gradedOrder();i++)await sleep(250);
  if(!gradedOrder())throw new Error('The ordering feedback did not appear. Saved questions are retained.');
  return;
 }
 const choices=[...document.querySelectorAll('input[type=radio],input[type=checkbox],[role=radio],[role=checkbox]')].filter(el=>visible(el)&&!el.disabled&&!/flag|community|stats/i.test(label(el)));
 if(!choices.length)throw new Error('No supported study choices found.');
 const stem=norm(get('stem')?.innerText);const match=stem.match(/(?:choose|select)\s+(two|three|four|\d+)/i);const n=match?({two:2,three:3,four:4}[match[1].toLowerCase()]||Number(match[1])):1;
 if(n>choices.length)throw new Error('Required choice count could not be determined.');
 for(let i=0;i<n;i++)if(!choices[i].checked&&choices[i].getAttribute('aria-checked')!=='true')choices[i].click();
 await sleep(250);
 if(stop)return;
 if(!answerElements().length){
  const submit=autoButton(/^Check Answer$/i)||get('submit');
  if(!submit)throw new Error('The Check Answer button was not found. Select it using Page setup.');
  clickControl(submit);
 }
 for(let i=0;i<20&&!stop&&!answerElements().length;i++)await sleep(250);
 if(!answerElements().length)throw new Error('Answer feedback did not appear. Select the submit/check-answer control or finish this question manually.');
}
async function saveOne(){await prepareStudy();await reveal();const serial=identity();if(!serial)throw new Error('Question identity is unavailable.');const question=await extract();const result=await chrome.runtime.sendMessage({type:'saveQuestion',exam,serial,question});if(result.error)throw new Error(result.error);status(result.count+' / '+exam.expectedCount+' distinct questions saved'+(result.duplicate?' (already collected)':'')+'.');return result;}
async function collect(all){if(running)return;running=true;stop=false;try{let repeated=0;for(let i=0;i<exam.expectedCount&&!stop;i++){
 const before=identity();const result=await saveOne();if(!all||result.count>=exam.expectedCount)break;
 repeated=result.duplicate?repeated+1:0;if(repeated>=3)throw new Error('Stopped after three already-collected items. Navigate to an uncollected question to resume.');
 if(stop)break;clickControl(get('next')||autoButton(/^Next question$/i));
 let changed=false;for(let j=0;j<40&&!stop;j++){await sleep(250);if(identity()&&identity()!==before){changed=true;break;}}
 if(!changed&&!stop)throw new Error('Next question did not load. Saved questions are retained.');await sleep(600);
 }}catch(e){status('Paused: '+e.message+' Earlier captures are saved.')}finally{running=false;}}
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type!=='openCollector')return;if(running){reply({ok:true});return;}exam=m.exam;open().then(()=>reply({ok:true}));return true;});
async function open(){config=(await chrome.storage.local.get('mapping:'+exam.id))['mapping:'+exam.id]||{};host?.remove();host=document.createElement('div');host.id='exam-study-collector';document.documentElement.append(host);ui=host.attachShadow({mode:'open'});ui.innerHTML=`<style>:host{all:initial}section{position:fixed;right:12px;top:12px;width:350px;max-height:90vh;overflow:auto;z-index:2147483647;background:white;color:#172b40;border:2px solid #205985;box-shadow:0 4px 24px #0005;border-radius:8px;padding:16px;font:14px/1.5 Arial}button{background:#205985;color:white;border:0;border-radius:3px;padding:8px;margin:4px;cursor:pointer;font:inherit}h2{font-size:18px;margin:0}p{margin:10px 0}label{display:block}#status{white-space:pre-wrap}details{margin:12px 0}#preview{width:100%;height:160px;box-sizing:border-box;font:12px monospace}</style><section><h2></h2><p id="status">Collector ready. Configure the question and explanation once, then preview.</p><details open><summary>Page setup</summary><button data-pick="stem">Pick question text</button><button data-pick="explanation">Pick explanation text</button><button data-pick="images">Pick evidence area (optional)</button><button data-pick="next">Pick next control</button><button data-pick="submit">Pick submit control</button><button data-pick="reveal">Pick explanation toggle</button><p>Expand the explanation first. Click the text area itself. Choices are read from Pocket Prep's Correct/Incorrect Answer labels.</p></details><label><input id="changeHistory" type="checkbox"> Allow submitting answers to unseen questions. This changes Pocket Prep scores and history.</label><button id="previewButton">Preview capture</button><textarea id="preview" readonly aria-label="Captured question preview" hidden></textarea><button id="one">Save this question</button><button id="all">Collect from here</button><button id="stop">Stop</button><button id="close">Close</button><p>Keep this tab open. Stops on unsupported layouts, missing evidence, login changes or the end of this question set. Reopen to resume; saved questions are deduplicated.</p></section>`;
 ui.querySelector('h2').textContent=exam.name+' collector';for(const b of ui.querySelectorAll('[data-pick]'))b.onclick=()=>pick(b.dataset.pick);
 ui.querySelector('#previewButton').onclick=async()=>{try{await reveal();const q=await extract();const p=ui.querySelector('#preview');p.hidden=false;p.value=JSON.stringify(q,null,2);status('Check the captured text and correct choices before collecting.')}catch(e){status(e.message)}};
 ui.querySelector('#one').onclick=()=>collect(false);ui.querySelector('#all').onclick=()=>collect(true);ui.querySelector('#stop').onclick=()=>{stop=true;status('Stopping after the current operation. Saved questions are retained.')};ui.querySelector('#close').onclick=()=>{stop=true;picking=null;host.remove()};
 const result=await chrome.runtime.sendMessage({type:'collectorStatus',exam});status(result.error||((result.count||0)+' / '+exam.expectedCount+' distinct questions saved. Configure and preview before collecting.'));
}
})();

