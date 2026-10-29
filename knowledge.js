'use strict';
let knowledgeSearch='',knowledgeCategory='全部',currentKnowledge=null,knowledgeReturn=null;
function validateKnowledge(items){
 if(!Array.isArray(items)||items.length>5000)throw Error('knowledge 必须是知识笔记数组，最多 5000 篇。');
 const ids=new Set();return items.map((n,i)=>{
  const fail=s=>{throw Error(`第 ${i+1} 篇知识笔记：${s}`)};
  if(!n||typeof n!=='object')fail('格式不正确。');
  for(const k of ['id','title','category','summary','source'])if(typeof n[k]!=='string'||!n[k].trim())fail(`${k} 不能为空。`);
  if(Object.hasOwn(Object.prototype,n.id)||n.id==='prototype'||ids.has(n.id))fail('id 无效或重复。');ids.add(n.id);
  if(!Array.isArray(n.sections)||!n.sections.length||n.sections.length>60)fail('sections 需要包含 1 至 60 个章节。');
  const sections=n.sections.map(s=>{
   if(!s||typeof s.heading!=='string'||!s.heading.trim())fail('每个章节需要 heading。');
   for(const k of ['body','source'])if(s[k]!==undefined&&typeof s[k]!=='string')fail(`${k} 应是文本。`);
   for(const k of ['bullets','steps'])if(s[k]!==undefined&&(!Array.isArray(s[k])||s[k].some(v=>typeof v!=='string')))fail(`${k} 应是文本数组。`);
   let table;
   if(s.table){const t=s.table;if(!Array.isArray(t.headers)||!t.headers.length||t.headers.some(v=>typeof v!=='string')||!Array.isArray(t.rows)||t.rows.some(r=>!Array.isArray(r)||r.length!==t.headers.length||r.some(v=>typeof v!=='string')))fail('table 需要文本 headers 和列数一致的 rows。');table={headers:t.headers,rows:t.rows};}
   if(!s.body&&!s.bullets?.length&&!s.steps?.length&&!table)fail('章节内容不能为空。');
   return {heading:s.heading,body:s.body||'',bullets:s.bullets||[],steps:s.steps||[],table,source:s.source||''};
  });
  const tags=n.tags||[],references=n.references||[];
  if(!Array.isArray(tags)||tags.some(t=>typeof t!=='string'))fail('tags 应是文本数组。');
  if(!Array.isArray(references)||references.some(r=>!r||typeof r.label!=='string'||typeof r.url!=='string'||!safeWebURL(r.url)))fail('references 需要标题和有效的 HTTP/HTTPS 链接。');
  return {id:n.id,title:n.title,category:n.category,summary:n.summary,tags,sections,source:n.source,references:references.map(r=>({label:r.label,url:r.url}))};
 });
}
function safeWebURL(s){try{return ['http:','https:'].includes(new URL(s).protocol)}catch{return false}}
function mergeLearningPack(parsed){
 if(!parsed||typeof parsed!=='object')throw Error('不是有效的学习包。');
 const rawQ=Array.isArray(parsed)?parsed:parsed.questions||[],rawK=Array.isArray(parsed)?[]:parsed.knowledge||[];
 if(!Array.isArray(rawQ))throw Error('questions 应为数组。');
 const questions=rawQ.length?validateQuestions(rawQ):[],knowledge=validateKnowledge(rawK);
 if(!questions.length&&!knowledge.length)throw Error('学习包中没有题目或知识笔记。');
 // 两类内容全部校验完成后再修改，避免半份导入。
 const existingQ=new Set(db.questions.map(q=>q.id)),existingK=new Set(db.knowledge.map(n=>n.id));
 const newQ=questions.filter(q=>!existingQ.has(q.id)),newK=knowledge.filter(n=>!existingK.has(n.id));
 db.questions.push(...newQ);db.knowledge.push(...newK);
 return {questions:newQ.length,knowledge:newK.length,skipped:questions.length+knowledge.length-newQ.length-newK.length};
}
function relatedQuestions(n){return db.questions.filter(q=>(q.knowledgeIds||[]).includes(n.id));}
function knowledgeLink(q){const n=db.knowledge.find(n=>(q.knowledgeIds||[]).includes(n.id));return n?`<button class="text-button knowledge-link" data-knowledge="${escapeHTML(n.id)}">回到知识点：${escapeHTML(n.title)} ↗</button>`:'';}
function openKnowledge(id){if(page==='today'&&poolSession()){knowledgeReturn={practice,index,selected:[...selected],recallText,revealed,showSummary};}currentKnowledge=id;switchPage('knowledge');}
function resumeKnowledgePractice(){if(!knowledgeReturn)return;({practice,index,selected,recallText,revealed,showSummary}=knowledgeReturn);knowledgeReturn=null;page='today';render();}
function bindKnowledgeLinks(){document.querySelectorAll('[data-knowledge]').forEach(b=>b.onclick=()=>openKnowledge(b.dataset.knowledge));}
function beginKnowledgePractice(id){
 const note=db.knowledge.find(n=>n.id===id);if(!note)return;
 const qs=relatedQuestions(note);if(!qs.length)return;
 const groups=Object.keys(TYPE).map(t=>qs.filter(q=>q.type===t).map(q=>({q,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.q));
 const ordered=[];while(groups.some(g=>g.length)){for(const g of groups)if(g.length)ordered.push(g.shift());}
 knowledgeReturn=null;practice={ids:pickReviewQuestions(ordered).map(q=>q.id),answers:{},label:note.title};page='today';index=0;showSummary=false;resetAnswer();render();
}
function renderKnowledge(){
 const note=db.knowledge.find(n=>n.id===currentKnowledge);
 if(note){renderKnowledgeArticle(note);return;}
 const categories=[...new Set(db.knowledge.map(n=>n.category))];
 const needle=knowledgeSearch.toLowerCase();
 const notes=db.knowledge.filter(n=>(knowledgeCategory==='全部'||n.category===knowledgeCategory)&&(!needle||JSON.stringify([n.title,n.summary,n.tags,n.sections]).toLowerCase().includes(needle)));
 $('#view').innerHTML=intro('KNOWLEDGE BASE','先把知识理清，再把它记牢。','每份资料整理成一篇笔记，连着概念、易错点与对应练习。', '<button class="button secondary" data-go="materials">＋ 导入学习包</button>')+`<div class="toolbar"><input type="search" id="knowledgeSearch" aria-label="搜索知识笔记" placeholder="搜索概念、要点或标签" value="${escapeHTML(knowledgeSearch)}"><select id="knowledgeCategory" aria-label="知识分类"><option>全部</option>${categories.map(c=>`<option ${c===knowledgeCategory?'selected':''}>${escapeHTML(c)}</option>`).join('')}</select></div><p class="help">${notes.length} 篇笔记 · ${db.knowledge.reduce((sum,n)=>sum+relatedQuestions(n).length,0)} 道关联练习</p><div class="list">${notes.length?notes.map(n=>`<article class="card knowledge-card"><div class="item-head"><span class="tag">${escapeHTML(n.category)}</span><small>${n.sections.length} 个章节 · ${relatedQuestions(n).length} 道练习</small></div><button class="note-title" data-knowledge="${escapeHTML(n.id)}">${escapeHTML(n.title)} <span aria-hidden="true">↗</span></button><p>${escapeHTML(n.summary)}</p><div class="tag-list">${n.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div><div class="action-row"><small>${escapeHTML(n.source)}</small><button class="button secondary" data-note-practice="${escapeHTML(n.id)}" ${relatedQuestions(n).length?'':'disabled'}>练习这篇知识</button></div></article>`).join(''):`<section class="card empty"><h2>${db.knowledge.length?'没有匹配的笔记':'从第一份整理笔记开始'}</h2><p>${db.knowledge.length?'调整分类或搜索词，再找找看。':'把资料发给我，我会一起整理知识笔记和题库。学习包导入后会出现在这里。'}</p><button class="button secondary" data-go="materials">导入学习包</button></section>`}</div>`;
 bindCommon();bindKnowledgeLinks();
 $('#knowledgeSearch').oninput=e=>{const pos=e.target.selectionStart;knowledgeSearch=e.target.value;renderKnowledge();$('#knowledgeSearch').focus();$('#knowledgeSearch').setSelectionRange(pos,pos)};
 $('#knowledgeCategory').onchange=e=>{knowledgeCategory=e.target.value;renderKnowledge()};
 document.querySelectorAll('[data-note-practice]').forEach(b=>b.onclick=()=>beginKnowledgePractice(b.dataset.notePractice));
}
function renderKnowledgeArticle(n){
 const qs=relatedQuestions(n);const counts=Object.entries(TYPE).map(([k,v])=>`${v} ${qs.filter(q=>q.type===k).length}`).join(' · ');
 $('#view').innerHTML=intro(escapeHTML(n.category),escapeHTML(n.title),'整理笔记 · '+n.sections.length+' 个章节 · '+qs.length+' 道关联练习','<button class="button secondary" id="knowledgeBack">← 返回知识库</button>')+`<div class="knowledge-layout"><article class="card knowledge-article"><div class="note-summary"><span class="eyebrow">核心结论</span><p>${escapeHTML(n.summary)}</p></div><p class="help">原始资料：${escapeHTML(n.source)}<br>原文要点与整理补充已在各章节标注，复习时优先理解机制。</p>${n.sections.map((s,i)=>`<section class="knowledge-section" id="kb-section-${i}"><h2>${escapeHTML(s.heading)}</h2>${s.table?`<div class="table-scroll"><table><thead><tr>${s.table.headers.map(h=>`<th scope="col">${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHTML(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${s.steps.length?`<ol class="steps-list">${s.steps.map(v=>`<li>${escapeHTML(v)}</li>`).join('')}</ol>`:''}${s.bullets.length?`<ul>${s.bullets.map(v=>`<li>${escapeHTML(v)}</li>`).join('')}</ul>`:''}${s.body?`<p class="note-body">${escapeHTML(s.body)}</p>`:''}<p class="section-source">${escapeHTML(s.source)}</p></section>`).join('')}<section class="knowledge-section"><h2>资料与核对来源</h2><ul class="references">${n.references.map(r=>`<li><a href="${escapeHTML(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.label)} ↗</a></li>`).join('')}</ul></section><section class="knowledge-section"><h2>现在试着回忆</h2><p class="note-body">合上笔记，用自己的话回答：Agent 的核心是什么？谁决定工具调用，谁真正执行？结果如何影响下一步？</p><div class="action-row"><button class="button" id="notePracticeBottom" ${qs.length?'':'disabled'}>练习这篇知识 →</button><button class="text-button" id="exportNote">导出这篇笔记</button></div></section></article><aside class="knowledge-aside"><section class="card aside-card"><h3>这篇的目录</h3><nav class="toc" aria-label="笔记目录">${n.sections.map((s,i)=>`<a href="#kb-section-${i}">${escapeHTML(s.heading)}</a>`).join('')}</nav></section><section class="card aside-card"><h3>读完，做一轮回忆</h3><p>${counts}<br>每轮最多 20 道，不计入今日固定题量。</p><button class="button" id="notePractice" ${qs.length?'':'disabled'}>练习这篇知识</button>${knowledgeReturn?'<button class="button secondary" id="resumePractice">返回刚才的练习</button>':''}</section></aside></div>`;
 $('#knowledgeBack').onclick=()=>{currentKnowledge=null;render()};$('#notePractice').onclick=$('#notePracticeBottom').onclick=()=>beginKnowledgePractice(n.id);
 $('#resumePractice')?.addEventListener('click',resumeKnowledgePractice);
 $('#exportNote').onclick=()=>downloadText(n.title+'.md',knowledgeMarkdown(n));
}
function knowledgeMarkdown(n){return '# '+n.title+'\n\n> '+n.summary+'\n\n来源：'+n.source+'\n\n'+n.sections.map(s=>'## '+s.heading+'\n\n'+(s.table?'| '+s.table.headers.join(' | ')+' |\n| '+s.table.headers.map(()=> '---').join(' | ')+' |\n'+s.table.rows.map(r=>'| '+r.join(' | ')+' |').join('\n')+'\n\n':'')+(s.steps.length?s.steps.map((v,i)=>`${i+1}. ${v}`).join('\n')+'\n\n':'')+(s.bullets.length?s.bullets.map(v=>'- '+v).join('\n')+'\n\n':'')+(s.body?s.body+'\n\n':'')+'出处：'+s.source+'\n').join('\n')+'\n## 资料与核对来源\n\n'+n.references.map(r=>`- [${r.label}](${r.url})`).join('\n')+'\n';}
function downloadText(name,text){const u=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
