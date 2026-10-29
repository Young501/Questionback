'use strict';
const KEY='shiti.local.v1';
const TYPE={single:'单选题',multiple:'多选题',boolean:'判断题',recall:'回忆题',matching:'连线匹配'};
const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const afterDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return dayKey(d)};
const fresh=()=>({version:1,questions:[],knowledge:[],materials:[],progress:{},sessions:{},extraPractice:null,favorites:[]});
let db=fresh(),page='today',selected=[],recallText='',revealed=false,practice=null,index=0,search='',category='全部',type='全部',storageOK=true,showSummary=false,observedDay=dayKey();
try{const raw=localStorage.getItem(KEY);if(raw)db=validateBackup(JSON.parse(raw));}catch(e){storageOK=false;}
function notice(s){$('#notice').hidden=!s;$('#notice').textContent=s;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));storageOK=true;return true;}catch(e){storageOK=false;notice('保存失败：浏览器存储不可用或空间不足。请立即导出备份，避免关闭页面后丢失进度。');return false;}}
function validateQuestions(items){
 if(!Array.isArray(items)||!items.length||items.length>10000)throw Error('questions 必须是包含 1 至 10000 题的数组。');
 const ids=new Set();return items.map((q,i)=>{
  const err=s=>{throw Error(`第 ${i+1} 题：${s}`)};
  if(!q||typeof q!=='object')err('格式不正确。');
  for(const k of ['id','type','category','prompt','explanation'])if(typeof q[k]!=='string'||!q[k].trim())err(`${k} 不能为空。`);
  if(!Object.hasOwn(TYPE,q.type))err('type 应为 single、multiple、boolean、recall 或 matching。');
  if(Object.hasOwn(Object.prototype,q.id)||q.id==='prototype')err('请更换 id。');
  if(ids.has(q.id))err('id 重复。');ids.add(q.id);
  if(q.type==='single'||q.type==='multiple'){
   if(!Array.isArray(q.options)||q.options.length<2||q.options.length>12||q.options.some(x=>typeof x!=='string'||!x.trim()))err('options 需要 2 至 12 个非空文本选项。');
   if(!Array.isArray(q.answer)||!q.answer.length||new Set(q.answer).size!==q.answer.length||q.answer.some(x=>!Number.isInteger(x)||x<0||x>=q.options.length))err('answer 需要有效的选项下标数组，从 0 开始。');
   if(q.type==='single'&&q.answer.length!==1)err('单选题只能有一个正确答案。');
  }else if(q.type==='matching'){
   if(!Array.isArray(q.left)||q.left.length<2||q.left.length>8||q.left.some(v=>typeof v!=='string'||!v.trim()))err('left 需要 2 至 8 个概念。');
   if(!Array.isArray(q.options)||q.options.length!==q.left.length||q.options.some(v=>typeof v!=='string'||!v.trim()))err('options 需要与概念等量的解释。');
   if(!Array.isArray(q.answer)||q.answer.length!==q.left.length||new Set(q.answer).size!==q.answer.length||q.answer.some(v=>!Number.isInteger(v)||v<0||v>=q.options.length))err('answer 应按左侧顺序给出不重复的右侧下标。');
  }else if(q.type==='boolean'&&typeof q.answer!=='boolean')err('判断题 answer 必须是 true 或 false。');
  else if(q.type==='recall'&&(typeof q.answer!=='string'||!q.answer.trim()))err('回忆题 answer 必须是非空参考答案。');
  if(q.knowledgeIds!==undefined&&(!Array.isArray(q.knowledgeIds)||q.knowledgeIds.some(id=>typeof id!=='string')))err('knowledgeIds 应为知识笔记 id 数组。');
  return {id:q.id,type:q.type,category:q.category.trim(),topic:typeof q.topic==='string'?q.topic:'',prompt:q.prompt,options:q.options,left:q.left,answer:q.answer,explanation:q.explanation,source:typeof q.source==='string'?q.source:'',knowledgeIds:q.knowledgeIds||[]};
 });
}
function validateBackup(x){
 if(!x||x.version!==1||!Array.isArray(x.questions)||!Array.isArray(x.materials)||!x.progress||!x.sessions)throw Error('不是有效的拾题备份。');
 const questions=x.questions.length?validateQuestions(x.questions):[];
 if(x.materials.some(m=>!m||typeof m.id!=='string'||typeof m.name!=='string'||typeof m.content!=='string'))throw Error('资料格式不正确。');
 if(typeof x.progress!=='object'||Array.isArray(x.progress)||typeof x.sessions!=='object'||Array.isArray(x.sessions))throw Error('进度格式不正确。');
 const ids=new Set(questions.map(q=>q.id));
 if(x.favorites!==undefined&&(!Array.isArray(x.favorites)||x.favorites.some(id=>typeof id!=='string')))throw Error('收藏记录格式不正确。');
 const favorites=[...new Set(x.favorites||[])].filter(id=>ids.has(id));
 const progress={};for(const [id,p]of Object.entries(x.progress)){
  if(!ids.has(id))continue;
  if(!p||!Number.isInteger(p.attempts)||p.attempts<0||!Number.isInteger(p.wrong)||p.wrong<0||p.wrong>p.attempts||!Number.isInteger(p.streak)||p.streak<0||typeof p.due!=='string')throw Error('复习进度格式不正确。');
  progress[id]={attempts:p.attempts,wrong:p.wrong,streak:p.streak,due:p.due,last:p.last||'',lastCorrect:p.lastCorrect===true};
 }
 const sessions={};for(const [date,s]of Object.entries(x.sessions)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!s||!Array.isArray(s.ids)||s.ids.length>20||new Set(s.ids).size!==s.ids.length||s.ids.some(id=>!ids.has(id))||!s.answers||typeof s.answers!=='object')throw Error('每日记录格式不正确。');
  const answers={};for(const [id,a]of Object.entries(s.answers)){
   if(!s.ids.includes(id)||!a||typeof a.correct!=='boolean'||!Array.isArray(a.selected)||a.selected.some(n=>!Number.isInteger(n))||typeof a.text!=='string')throw Error('答题记录格式不正确。');
   answers[id]={correct:a.correct,selected:a.selected,text:a.text};
  }sessions[date]={ids:s.ids,answers};
 }
 const knowledge=validateKnowledge(x.knowledge||[]);
 let extraPractice=null;
 if(x.extraPractice){const e=x.extraPractice;if(!e||typeof e.date!=='string'||!Number.isInteger(e.round)||e.round<1||typeof e.active!=='boolean')throw Error('加练记录格式不正确。');const validated=validateBackup({...x,extraPractice:null,sessions:{[e.date]:{ids:e.ids,answers:e.answers}}});extraPractice={date:e.date,round:e.round,active:e.active,ids:validated.sessions[e.date].ids,answers:validated.sessions[e.date].answers,label:`加练第 ${e.round} 轮`,kind:'extra'};}
 return {version:1,questions,knowledge,materials:x.materials.map(m=>({id:m.id,name:m.name,content:m.content,created:typeof m.created==='string'?m.created:''})),progress,sessions,extraPractice,favorites};
}
function download(name,data){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function daily(){return db.sessions[dayKey()]||null}
function poolSession(){return practice||daily()}
function activeExtra(){return db.extraPractice?.date===dayKey()&&db.extraPractice.active?db.extraPractice:null}
// 输入已经按复习优先级或随机顺序排列；每轮优先控制为 18 道客观题 + 2 道回忆题。
function pickReviewQuestions(ordered){
 const recall=ordered.filter(q=>q.type==='recall'),objective=ordered.filter(q=>q.type!=='recall');
 const chosen=[...recall.slice(0,2),...objective.slice(0,20-Math.min(2,recall.length))];
 // 仅在客观题不足时补入回忆题，保持每天最多 20 道不同题目。
 if(chosen.length<Math.min(20,ordered.length))chosen.push(...recall.slice(2,2+20-chosen.length));
 const ids=new Set(chosen.map(q=>q.id));return ordered.filter(q=>ids.has(q.id));
}
function startExtraPractice(){
 if(!db.questions.length)return;
 const previous=new Set((practice||db.extraPractice?.date===dayKey()&&db.extraPractice||daily())?.ids||[]);
 const shuffled=db.questions.map(q=>({q,r:Math.random()})).sort((a,b)=>Number(previous.has(a.q.id))-Number(previous.has(b.q.id))||a.r-b.r);
 const round=db.extraPractice?.date===dayKey()?db.extraPractice.round+1:1;
 db.extraPractice={date:dayKey(),round,active:true,kind:'extra',label:`加练第 ${round} 轮`,ids:pickReviewQuestions(shuffled.map(x=>x.q)).map(q=>q.id),answers:{}};
 practice=db.extraPractice;page='today';index=0;showSummary=false;knowledgeReturn=null;resetAnswer();save();render();notice('已换一轮题目，优先抽取上一轮没出现的题。题库不足以完全避重时，会补入部分上一轮题目。');
}
function returnDaily(){if(db.extraPractice)db.extraPractice.active=false;practice=null;index=Math.max(0,daily()?.ids.findIndex(id=>!daily().answers[id])??0);showSummary=!!daily()&&Object.keys(daily().answers).length===daily().ids.length;resetAnswer();save();render();}
function startDaily(){
 if(!db.questions.length)return;
 if(!daily()){
  const shuffled=db.questions.map(q=>({q,r:Math.random()}));
  const rank=q=>{const p=db.progress[q.id];if(p&&p.due<=dayKey()&&!p.lastCorrect)return 0;if(p&&p.due<=dayKey())return 1;if(!p)return 2;return 3};
  shuffled.sort((a,b)=>rank(a.q)-rank(b.q)||((db.progress[a.q.id]?.due||'').localeCompare(db.progress[b.q.id]?.due||''))||a.r-b.r);
  db.sessions[dayKey()]={ids:pickReviewQuestions(shuffled.map(x=>x.q)).map(q=>q.id),answers:{}};save();
 }
 if(db.extraPractice)db.extraPractice.active=false;practice=null;showSummary=Object.keys(daily().answers).length===daily().ids.length;index=Math.max(0,daily().ids.findIndex(id=>!daily().answers[id]));resetAnswer();save();render();
}
let matchFocus=null;
function resetAnswer(){selected=[];recallText='';revealed=false;matchFocus=null}
function checkDay(){if(observedDay===dayKey())return false;observedDay=dayKey();practice=null;knowledgeReturn=null;index=0;showSummary=false;resetAnswer();render();notice('新的一天开始了，可以重新抽取今天的复习题。');return true;}
function switchPage(p){page=p;practice=p==='today'?activeExtra():null;const s=poolSession();showSummary=!!s&&Object.keys(s.answers).length===s.ids.length;if(practice)index=Math.max(0,practice.ids.findIndex(id=>!practice.answers[id]));resetAnswer();render()}
function intro(eyebrow,title,desc,action=''){return `<div class="intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function render(){
 document.querySelectorAll('[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 $('#date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
 $('#breadcrumb').textContent='学习空间 / '+({today:'今日复习',library:'我的题库',mistakes:'错题回顾',favorites:'收藏题目',knowledge:'知识库',materials:'资料与导入'}[page]);
 if(page==='today')renderToday();else if(page==='materials')renderMaterials();else if(page==='knowledge')renderKnowledge();else renderLibrary();
}
function renderToday(){
 const s=poolSession(),done=s?Object.keys(s.answers).length:0,total=s?s.ids.length:Math.min(20,db.questions.length);
 const mastered=db.questions.filter(q=>(db.progress[q.id]?.streak||0)>=3).length;
 let html=intro(practice?.kind==='extra'?'EXTRA PRACTICE':practice?'专项练习':'DAILY PRACTICE',practice?.kind==='extra'?`加练第 ${practice.round} 轮，再巩固一点。`:practice?'把不确定的，再记牢一次。':'每天 20 题，把知识留在脑海里。',practice?(practice.label?escapeHTML(practice.label)+(practice.kind==='extra'?' · 随时换一轮，刷新后可以继续。':' · 专项练习也会更新复习时间。'):'错题练习也会更新知识点的复习时间。'):'先回忆，再看解析。今天的题目固定，随时可以回来继续。',`<div class="toolbar" style="margin-bottom:0">${db.questions.length?'<button class="button" data-extra>再练 20 题 ↻</button>':''}${practice?'<button class="button secondary" id="dailyMode">返回每日复习</button>':''}</div>`);
 html+=`<div class="stats"><div class="stat"><span class="muted">${practice?'本轮进度':'今日进度'}</span><strong>${done}<small>/ ${total} 题</small></strong></div><div class="stat"><span class="muted">题库总量</span><strong>${db.questions.length}<small>题 · ${new Set(db.questions.map(q=>q.category)).size} 个分类</small></strong></div><div class="stat"><span class="muted">连续答对 3 次</span><strong>${mastered}<small>题已巩固</small></strong></div></div>`;
 if(!db.questions.length){html+=`<section class="card empty"><div class="eyebrow">从第一份资料开始</div><h2>你的复习计划，等知识入库。</h2><p>把资料发给我，我会生成可导入的题库。</p><button class="button secondary" data-go="materials">导入我的题库</button></section>`;}
 else if(!s){html+=`<section class="card empty"><div class="eyebrow">今天的小目标</div><h2>${total} 道题，给记忆一次练习。</h2><p>优先抽取答错、到期和未学过的题目。<br>${db.questions.length<20?'题库不足 20 题，今天先复习全部题目，不重复凑数。':'本轮抽取 20 道不同的题目。'}</p><button class="button" id="start">开始今日复习 →</button></section>`;}
 else if(done===total&&showSummary){const correct=Object.values(s.answers).filter(a=>a.correct).length;html+=`<section class="card completion"><div class="eyebrow">${practice?'本轮练习已完成':'今日复习已完成'}</div><h2>又向记牢迈进了一步。</h2><strong>${correct} / ${total}</strong><p>答对 ${correct} 题，待巩固 ${total-correct} 题。${practice?'':'明天会重新抽题，今天可以继续回顾错题。'}</p><button class="button" data-extra>再练 20 题 ↻</button> <button class="button secondary" data-go="mistakes">回顾错题</button> <button class="button secondary" id="review">查看本轮解析</button>${practice?' <button class="button secondary" id="returnDaily">返回今日复习</button>':''}</section>`;}
 else html+=studyHTML(s);
 $('#view').innerHTML=html;bindCommon();
 $('#start')?.addEventListener('click',startDaily);
 $('#review')?.addEventListener('click',()=>{index=0;renderStudyReview()});
 $('#returnDaily')?.addEventListener('click',returnDaily);
 document.querySelectorAll('[data-extra]').forEach(b=>b.onclick=startExtraPractice);
 $('#dailyMode')?.addEventListener('click',returnDaily);
 bindStudy();
}
function answerText(q){return q.type==='matching'?q.left.map((v,i)=>v+' → '+q.options[q.answer[i]]).join('\n'):q.type==='recall'?q.answer:q.type==='boolean'?(q.answer?'正确':'错误'):q.answer.map(i=>String.fromCharCode(65+i)+' · '+q.options[i]).join('\n')}
function matchHTML(q,a){
 const values=a?.selected||selected;
 const item=(text,i,side)=>{const left=side==='left',linked=left?values[i]:values.indexOf(i),paired=linked!==undefined&&linked>=0;const good=a&&paired&&(left?q.answer[i]===linked:q.answer[linked]===i);return `<button class="match-item ${left&&matchFocus===i?'focused':''} ${paired?'paired':''} ${a&&paired?(good?'correct':'wrong'):''}" data-match-${side}="${i}" aria-pressed="${left?matchFocus===i:paired}" ${a?'disabled':''}><span class="letter">${left?i+1:String.fromCharCode(65+i)}</span><span>${escapeHTML(text)}${paired?`<small>${left?'已配 '+String.fromCharCode(65+linked):'已配 '+(linked+1)}</small>`:''}</span></button>`};
 return `<p class="help" id="matchHelp" role="status">${a?'绿色配对正确，红色配对错误。请对照下方答案。':matchFocus===null?'先选左侧概念，再选右侧解释。点击已配概念可重新连线。':'已选「'+escapeHTML(q.left[matchFocus])+'」，请选择右侧解释。'}</p><div class="match-board"><svg class="match-lines" aria-hidden="true"></svg><div class="match-column">${q.left.map((v,i)=>item(v,i,'left')).join('')}</div><div class="match-column">${q.options.map((v,i)=>item(v,i,'right')).join('')}</div></div>${!a?'<button class="text-button" id="clearMatch">清空连线</button>':''}`;
}
function connectMatch(left,right,count){if(left===null)return;const values=Array.from({length:count},(_,i)=>selected[i]??-1);const owner=values.indexOf(right);if(owner>=0)values[owner]=-1;values[left]=right;selected=values;matchFocus=null;}
function drawMatchLines(){
 const board=$('.match-board'),svg=$('.match-lines');if(!board||!svg)return;
 const s=poolSession(),q=db.questions.find(q=>q.id===s?.ids[index]);if(q?.type!=='matching')return;
 const rect=board.getBoundingClientRect(),a=s.answers[q.id],values=a?.selected||selected;
 svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
 svg.innerHTML=values.map((right,left)=>{if(right<0)return '';const l=$(`[data-match-left="${left}"]`),r=$(`[data-match-right="${right}"]`);if(!l||!r)return '';const lr=l.getBoundingClientRect(),rr=r.getBoundingClientRect(),x=lr.right-rect.left,y=lr.top+lr.height/2-rect.top,x2=rr.left-rect.left,y2=rr.top+rr.height/2-rect.top;return `<path class="${a?(q.answer[left]===right?'correct':'wrong'):''}" d="M ${x} ${y} C ${x+(x2-x)/2} ${y},${x+(x2-x)/2} ${y2},${x2} ${y2}"/>`}).join('');
}
function studyHTML(s){
 const q=db.questions.find(q=>q.id===s.ids[index]);if(!q)return '';
 const a=s.answers[q.id],isRecall=q.type==='recall';const shown=!!a||revealed;
 let options='';
 if(isRecall)options=`<label for="recall">先用自己的话回答</label><textarea id="recall" class="recall" placeholder="写下关键点，再对照参考答案…" ${a?'disabled':''}>${escapeHTML(a?.text??recallText)}</textarea><p class="help">回忆题由你对照要点自评，文字不会被自动判分。</p>`;
 else if(q.type==='matching')options=matchHTML(q,a);
 else {const opts=q.type==='boolean'?['正确','错误']:q.options;const correct=q.type==='boolean'?[q.answer?0:1]:q.answer;options=`<div class="options">${opts.map((o,i)=>`<button class="option ${(a?.selected||selected).includes(i)?'selected':''} ${a&&correct.includes(i)?'correct':''} ${a&&a.selected.includes(i)&&!correct.includes(i)?'wrong':''}" data-option="${i}" aria-pressed="${(a?.selected||selected).includes(i)}" ${a?'disabled':''}><span class="letter">${String.fromCharCode(65+i)}</span><span>${escapeHTML(o)}</span></button>`).join('')}</div>`;}
 const answer=answerText(q);
 return `<div class="study-layout"><article class="card"><div class="card-top"><span><span class="tag">${TYPE[q.type]}</span> <span class="muted">${escapeHTML(q.category)}${q.topic?' / '+escapeHTML(q.topic):''}</span></span><span class="question-actions">${favoriteButton(q)}<span class="muted">${index+1} / ${s.ids.length}</span></span></div><h2 class="question-title">${escapeHTML(q.prompt)}</h2>${options}${shown?`<div class="analysis"><strong>${a?(a.correct?'✓ 已掌握':'还需巩固'):'对照参考答案'}</strong><b>参考答案</b>\n${escapeHTML(answer)}\n\n<b>解析</b>\n${escapeHTML(q.explanation)}<div class="source">来源：${escapeHTML(q.source||'未注明')}</div>${knowledgeLink(q)}</div>`:''}${isRecall&&shown&&!a?'<div class="ratings"><button class="button secondary" data-rate="false">没想起来 / 要点不全</button><button class="button" data-rate="true">要点正确，已掌握</button></div>':''}<div class="action-row"><span class="muted">${q.type==='matching'?'全部配对后提交，每组都正确才算答对。':q.type==='multiple'?'选出所有正确选项，完全一致才算答对。':isRecall?'主动回忆比直接读答案更有效。':'选好答案后提交，查看解析。'}</span>${a?`<button class="button" id="next">${index===s.ids.length-1?'完成 / 返回进度':'下一题 →'}</button>`:isRecall?`<button class="button secondary" id="reveal" ${shown?'disabled':''}>查看答案与解析</button>`:`<button class="button" id="submit" ${(q.type==='matching'?selected.length===q.left.length&&selected.every(v=>v>=0):selected.length)?'':'disabled'}>提交答案</button>`}</div></article><aside class="study-side"><section class="card aside-card"><h3>本轮题目</h3><div class="dots">${s.ids.map((id,i)=>`<button class="q-dot ${i===index?'current':''} ${s.answers[id]?(s.answers[id].correct?'done':'miss'):''}" data-index="${i}" aria-label="第 ${i+1} 题${s.answers[id]?'，已答':''}">${i+1}</button>`).join('')}</div><div class="progress"><span style="width:${Object.keys(s.answers).length/s.ids.length*100}%"></span></div><p>绿色已掌握 · 红色待巩固<br>点击题号可跳转，已答题可回看。</p></section><section class="card aside-card"><h3>给记忆留一点间隔</h3><p>答错后次日复习；连续答对后，复习间隔逐步延长至 3、7、14、30 天。题量不足时会用其他题补充。</p></section></aside></div>`;
}
function renderStudyReview(){ $('#view').innerHTML=intro('答案回顾','再看看，刚才哪里卡住了。','点击题号查看答案与解析。', '<button class="button secondary" id="backToday">返回进度</button>')+studyHTML(poolSession());$('#backToday').onclick=render;bindStudy();bindKnowledgeLinks();bindFavorites();}
function bindStudy(){
 const s=poolSession();if(!s)return;
 const current=db.questions.find(q=>q.id===s.ids[index]);
 document.querySelectorAll('[data-match-left]').forEach(b=>b.onclick=()=>{matchFocus=Number(b.dataset.matchLeft);rerenderStudy();$(`[data-match-left="${matchFocus}"]`)?.focus()});
 document.querySelectorAll('[data-match-right]').forEach(b=>b.onclick=()=>{if(matchFocus===null)return;connectMatch(matchFocus,Number(b.dataset.matchRight),current.left.length);rerenderStudy()});
 $('#clearMatch')?.addEventListener('click',()=>{resetAnswer();rerenderStudy()});
 drawMatchLines();
 document.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>{const q=db.questions.find(q=>q.id===s.ids[index]);const n=Number(b.dataset.option);selected=q.type==='multiple'?(selected.includes(n)?selected.filter(v=>v!==n):[...selected,n]):[n];rerenderStudy()});
 $('#recall')?.addEventListener('input',e=>recallText=e.target.value);
 $('#reveal')?.addEventListener('click',()=>{revealed=true;rerenderStudy()});
 document.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>grade(b.dataset.rate==='true'));
 $('#submit')?.addEventListener('click',()=>{const q=db.questions.find(q=>q.id===s.ids[index]);grade(isCorrect(q,selected))});
 $('#next')?.addEventListener('click',()=>{showSummary=Object.keys(s.answers).length===s.ids.length;index=index<s.ids.length-1?index+1:Math.max(0,s.ids.findIndex(id=>!s.answers[id]));resetAnswer();render()});
 document.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>{index=Number(b.dataset.index);resetAnswer();rerenderStudy()});
}
function rerenderStudy(){if($('#backToday'))renderStudyReview();else render()}
function isCorrect(q,values){if(q.type==='matching')return values.length===q.answer.length&&values.every((v,i)=>v===q.answer[i]);const right=q.type==='boolean'?[q.answer?0:1]:q.answer;return values.length===right.length&&values.every(i=>right.includes(i));}
function grade(correct){
 if(checkDay())return;
 const s=poolSession(),id=s.ids[index];if(s.answers[id])return;
 s.answers[id]={correct,selected:[...selected],text:recallText};
 const p=db.progress[id]||{attempts:0,wrong:0,streak:0};p.attempts++;if(!correct)p.wrong++;p.streak=correct?p.streak+1:0;p.lastCorrect=correct;p.last=dayKey();p.due=afterDays(correct?([1,3,7,14,30][Math.min(p.streak-1,4)]):1);db.progress[id]=p;save();rerenderStudy();
}
function favoriteButton(q){const on=db.favorites.includes(q.id);return `<button class="text-button favorite-button ${on?'is-favorite':''}" data-favorite="${escapeHTML(q.id)}" aria-pressed="${on}" aria-label="${on?'取消收藏':'收藏题目'}">${on?'★ 已收藏':'☆ 收藏'}</button>`}
function toggleFavorite(id){if(!db.questions.some(q=>q.id===id))return;db.favorites=db.favorites.includes(id)?db.favorites.filter(v=>v!==id):[...db.favorites,id];save();}
function bindFavorites(){document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{toggleFavorite(b.dataset.favorite);if(page==='today')rerenderStudy();else render();});}
function beginFavoritePractice(qs){if(!qs.length)return;practice={ids:qs.map(q=>({q,r:Math.random()})).sort((a,b)=>a.r-b.r).slice(0,20).map(v=>v.q.id),answers:{},label:'收藏题目'};showSummary=false;index=0;page='today';resetAnswer();render();}
function bindCommon(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>switchPage(b.dataset.go));bindKnowledgeLinks();bindFavorites();}
function renderLibrary(){
 const mistakes=page==='mistakes',favorites=page==='favorites';let qs=db.questions.filter(q=>(!favorites||db.favorites.includes(q.id))&&(!mistakes||(db.progress[q.id]?.wrong>0&&!db.progress[q.id]?.lastCorrect)));
 const cats=[...new Set(qs.map(q=>q.category))];
 const filtered=qs.filter(q=>(category==='全部'||q.category===category)&&(type==='全部'||q.type===type)&&(!search||(q.prompt+' '+q.topic+' '+q.explanation).toLowerCase().includes(search.toLowerCase())));
 $('#view').innerHTML=intro(favorites?'FAVORITES':mistakes?'REVISIT':'QUESTION LIBRARY',favorites?'值得再看一遍的，收在这里。':mistakes?'把错题变成会的题。':'你的知识，逐批积累。',favorites?`已收藏 ${qs.length} 道题。集中回看解析，也可以每轮练习最多 20 题。`:mistakes?'这里保留最近一次仍未掌握的题目。答对后自动移出。':`已保存 ${db.questions.length} 道题。每道题都能回看答案、解析和来源。`,favorites?(qs.length?'<button class="button" id="practice">练习收藏题目 →</button>':''):mistakes&&qs.length?'<button class="button" id="practice">练习这些错题 →</button>':'<button class="button secondary" data-go="materials">＋ 导入题库</button>')+`<div class="toolbar"><input id="search" type="search" aria-label="搜索题目" placeholder="搜索题目或知识点" value="${escapeHTML(search)}"><select id="category" aria-label="按分类筛选"><option>全部</option>${cats.map(c=>`<option ${category===c?'selected':''}>${escapeHTML(c)}</option>`).join('')}</select><select id="type" aria-label="按题型筛选"><option value="全部">全部题型</option>${Object.entries(TYPE).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v}</option>`).join('')}</select></div><p class="help">共 ${filtered.length} 道${mistakes?'待巩固':''}题目</p><div class="list">${filtered.length?filtered.map(q=>{const p=db.progress[q.id];const answer=answerText(q);return `<article class="card item"><div class="item-head"><span><span class="tag">${TYPE[q.type]}</span> <span class="muted">${escapeHTML(q.category)} / ${escapeHTML(q.topic)}</span></span><small>${p?`已练 ${p.attempts} 次 · 答错 ${p.wrong} 次`:'未练习'}</small>${favoriteButton(q)}</div><h3>${escapeHTML(q.prompt)}</h3><details><summary>查看答案与解析</summary><div class="analysis"><b>参考答案</b>\n${escapeHTML(answer)}\n\n${escapeHTML(q.explanation)}<div class="source">来源：${escapeHTML(q.source||'未注明')}${p?' · 下次复习：'+escapeHTML(p.due):''}</div>${knowledgeLink(q)}</div></details></article>`}).join(''):`<div class="card empty"><h2>${favorites?(qs.length?'没有匹配的收藏题目':'还没有收藏题目'):mistakes?'目前没有待巩固的错题':'没有匹配的题目'}</h2><p>${favorites?(qs.length?'调整搜索词或筛选条件，再找找看。':'做题或浏览题库时点击「☆ 收藏」，就能收进这里。'):mistakes?'完成每日练习后，未掌握的题目会出现在这里。':'可以调整筛选条件，或导入一批新的题目。'}</p><button class="button secondary" data-go="${favorites?'library':mistakes?'today':'materials'}">${favorites?'去我的题库':mistakes?'去今日复习':'导入题库'}</button></div>`}</div>`;
 bindCommon();$('#search').oninput=e=>{const pos=e.target.selectionStart;search=e.target.value;renderLibrary();$('#search').focus();$('#search').setSelectionRange(pos,pos)};$('#category').onchange=e=>{category=e.target.value;renderLibrary()};$('#type').onchange=e=>{type=e.target.value;renderLibrary()};
 $('#practice')?.addEventListener('click',()=>{if(favorites){beginFavoritePractice(filtered.length?filtered:qs);return;}practice={ids:(filtered.length?filtered:qs).slice(0,20).map(q=>q.id),answers:{}};showSummary=false;index=0;page='today';resetAnswer();render()});
}
function renderMaterials(){
 $('#view').innerHTML=intro('GROW YOUR KNOWLEDGE','新资料，新的一批知识。','资料生成一次题库，之后每天在本地复习，不需要每天重新生成。')+`<div class="two-col"><section class="card"><h2>导入知识笔记与题库</h2><p class="help">把资料发给聊天中的我，我会返回包含知识笔记、题目、答案和解析的 JSON 学习包。支持追加多批资料，笔记与题目分别按 id 去重。</p><div class="upload"><h3>选择学习包 JSON 文件</h3><p class="help">导入后自动保存，下次打开仍可使用。</p><input id="questionFile" type="file" accept=".json,application/json" aria-label="选择学习包文件"><div id="importStatus" class="file-status" role="status"></div></div><div class="action-row"><button class="text-button" id="sample">下载题库格式示例 ↗</button><button class="text-button" id="exportQuestions">导出当前题库 ↗</button></div><details style="margin-top:24px"><summary>给我生成题库时的要求</summary><p class="help">根据我的资料生成单选、多选、判断、回忆和连线匹配题。出题偏好：每 20 题只安排 1 至 2 道回忆／简答题，其余以选择、判断和连线匹配为主；概念与定义、职责对应优先使用匹配题。覆盖所有知识点，并用易混淆选项检验理解。每题附参考答案、解释、资料出处，避免编造资料未说明的结论。输出拾题兼容 JSON，顶层为 questions 数组，每题 id 唯一，type 为 single、multiple、boolean、recall 或 matching。选择题 answer 为从 0 开始的下标数组，判断题为布尔值，回忆题为参考答案字符串。每题包含 category、topic、prompt、explanation、source；选择题额外包含 options；匹配题 left 为概念数组，options 为打乱的解释数组，answer 按左侧顺序给出右侧下标，每项一一对应。整理笔记放在 knowledge 数组，每篇包含 id、title、category、summary、tags、source、sections、references。题目通过 knowledgeIds 关联笔记；可直接参考本地 Agent 学习包的结构。</p></details></section><section class="card"><h2>保存原始资料</h2><p class="help">支持 TXT、Markdown 文件或粘贴文本。这里只保存资料，不自动生成题目。PDF、Word 等可以直接发到聊天中处理。</p><label for="materialName">资料名称</label><input id="materialName" placeholder="例如：计算机网络 · TCP" style="width:100%;margin-bottom:16px"><label for="materialText">资料正文</label><textarea id="materialText" placeholder="把需要记牢的内容粘贴到这里…"></textarea><div class="action-row"><label class="text-button" for="materialFile">读取 TXT / MD 文件<input id="materialFile" type="file" accept=".txt,.md,text/plain,text/markdown" style="display:block;max-width:220px;margin-top:8px"></label><button class="button" id="saveMaterial">保存资料</button></div><div id="materialStatus" class="file-status" role="status"></div></section></div><section class="card" style="margin-top:24px"><div class="card-top"><h2>已保存资料 <span class="muted">${db.materials.length}</span></h2><button class="button secondary" id="backupHere">导出完整备份</button></div><div class="list">${db.materials.length?db.materials.map(m=>`<details><summary>${escapeHTML(m.name)} <small>${escapeHTML(m.created)}</small></summary><p class="material-body">${escapeHTML(m.content)}</p></details>`).join(''):'<p class="muted">还没有保存资料。先粘贴一段内容，或者读取一个文本文件。</p>'}</div></section><section class="card" style="margin-top:24px"><h3>恢复浏览器备份</h3><p class="help">完整备份包含知识笔记、题库、收藏、原始资料、每日进度和错题记录。恢复将替换当前数据，请先导出当前备份。</p><input id="restoreFile" type="file" accept=".json" aria-label="选择完整备份"><div id="restoreStatus" class="file-status" role="status"></div><button class="button danger" id="confirmRestore" hidden>确认用此备份替换当前数据</button></section>`;
 $('#questionFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const parsed=JSON.parse(await readFile(f));const added=mergeLearningPack(parsed);const ok=save();$('#importStatus').textContent=`新增 ${added.knowledge} 篇笔记、${added.questions} 道题，跳过 ${added.skipped} 条重复内容。${ok?'已保存。':'保存失败，请导出备份。'}${daily()?'今天已抽取的题目保持固定，新题明天参与抽取。':''}`;}catch(err){$('#importStatus').textContent='导入失败：'+err.message}};
 $('#sample').onclick=()=>download('拾题题库示例.json',{questions:LOCAL_PACKS[0].questions.filter((q,i,all)=>all.findIndex(v=>v.type===q.type)===i)});$('#exportQuestions').onclick=()=>download('拾题学习包.json',{knowledge:db.knowledge,questions:db.questions});$('#backupHere').onclick=backup;
 $('#materialFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(!/\.(md|txt)$/i.test(f.name))throw Error('请选择 TXT 或 Markdown 文件。');$('#materialText').value=await readFile(f);$('#materialName').value=f.name;$('#materialStatus').textContent='文件已读取，点击保存资料完成保存。';}catch(err){$('#materialStatus').textContent=err.message}};
 $('#saveMaterial').onclick=()=>{const name=$('#materialName').value.trim(),content=$('#materialText').value.trim();if(!name||!content){$('#materialStatus').textContent='请填写资料名称和正文。';return}if(content.length>2000000){$('#materialStatus').textContent='资料过长，请拆成小于 200 万字的多份资料。';return}db.materials.push({id:crypto.randomUUID(),name,content,created:dayKey()});const ok=save();renderMaterials();if(ok)notice('资料已保存。把资料发到聊天中，即可生成配套题库。')};
 let pending=null;$('#restoreFile').onchange=async e=>{pending=null;$('#confirmRestore').hidden=true;try{const f=e.target.files[0];if(!f)return;pending=validateBackup(JSON.parse(await readFile(f)));$('#restoreStatus').textContent=`备份包含 ${pending.knowledge.length} 篇知识笔记、${pending.questions.length} 题、${pending.materials.length} 份资料、${Object.keys(pending.sessions).length} 天复习记录。`;$('#confirmRestore').hidden=false;}catch(err){$('#restoreStatus').textContent='恢复失败：'+err.message}};
 $('#confirmRestore').onclick=()=>{if(!pending)return;db=pending;practice=null;index=0;resetAnswer();const ok=save();render();if(ok)notice('备份已恢复。')};
}
async function readFile(f){if(f.size>15*1024*1024)throw Error('文件超过 15 MB，请拆分后导入。');return (await f.text()).replace(/^\uFEFF/,'')}
function backup(){download('拾题完整备份-'+dayKey()+'.json',db)}
function removeDemoQuestions(){
 const removed=new Set(db.questions.filter(q=>q.id.startsWith('demo-')&&q.source.startsWith('内置演示')).map(q=>q.id));
 if(!removed.size)return 0;
 db.questions=db.questions.filter(q=>!removed.has(q.id));
 for(const id of removed)delete db.progress[id];
 db.favorites=db.favorites.filter(id=>!removed.has(id));
 for(const [date,s]of Object.entries(db.sessions)){
  s.ids=s.ids.filter(id=>!removed.has(id));
  for(const id of removed)delete s.answers[id];
  if(!s.ids.length)delete db.sessions[date];
 }
 practice=null;index=0;showSummary=false;resetAnswer();save();return removed.size;
}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{search='';category='全部';type='全部';knowledgeReturn=null;if(b.dataset.page==='knowledge'){currentKnowledge=null;knowledgeSearch='';knowledgeCategory='全部'}switchPage(b.dataset.page)});
$('#backup').onclick=backup;
$('#privacy').onclick=()=>notice('所有数据仅保存在当前浏览器的本地存储中，不会上传。更换浏览器、地址或清理浏览器数据后，需要用完整备份恢复。回忆题自评；错题按最近一次答题结果记录。');
if(typeof RETIRE_DEMO_QUESTIONS!=='undefined'&&RETIRE_DEMO_QUESTIONS)removeDemoQuestions();
if(daily()){index=Math.max(0,daily().ids.findIndex(id=>!daily().answers[id]));showSummary=Object.keys(daily().answers).length===daily().ids.length;}
if(activeExtra()){practice=activeExtra();index=Math.max(0,practice.ids.findIndex(id=>!practice.answers[id]));showSummary=Object.keys(practice.answers).length===practice.ids.length;}
let addedLocal={questions:0,knowledge:0};
if(storageOK&&typeof LOCAL_PACKS!=='undefined'){try{for(const pack of LOCAL_PACKS){const result=mergeLearningPack(pack);addedLocal.questions+=result.questions;addedLocal.knowledge+=result.knowledge;}if(addedLocal.questions||addedLocal.knowledge)save();}catch(e){notice('本地学习包载入失败：'+e.message)}}
if(storageOK&&typeof LOCAL_PACKS!=='undefined'){for(const pack of LOCAL_PACKS)for(const q of pack.questions){const at=db.questions.findIndex(old=>old.id===q.id&&old.type==='recall'&&q.type==='matching');if(at>=0)db.questions[at]=validateQuestions([q])[0];}save();}
if(typeof window!=='undefined')window.addEventListener('resize',drawMatchLines);
render();if(!storageOK)notice('未能读取或保存本地存储。为保护已有数据，请检查浏览器设置并导出备份。');else if(addedLocal.questions||addedLocal.knowledge)notice(`本地资料已整理入库：新增 ${addedLocal.knowledge} 篇知识笔记、${addedLocal.questions} 道题目。${daily()?'今日已抽题保持固定，新题明天加入。也可以到知识库单独练习。':''}`);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay()});
setInterval(checkDay,60000);
