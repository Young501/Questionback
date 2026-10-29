const fs=require('fs'),path=require('path'),vm=require('vm');
const ctx=vm.createContext({URL});
for(const name of ['content.js','knowledge.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),ctx);
const packs=vm.runInContext('LOCAL_PACKS',ctx);
const out=path.join(__dirname,'整理');fs.mkdirSync(out,{recursive:true});
for(const pack of packs){
 pack.knowledge=vm.runInContext('validateKnowledge',ctx)(pack.knowledge);
 const json=path.join(out,pack.id+'.json');fs.writeFileSync(json,JSON.stringify(pack,null,2),'utf8');
 for(const note of pack.knowledge){const md=vm.runInContext('knowledgeMarkdown',ctx)(note);fs.writeFileSync(path.join(out,note.id+'.md'),md,'utf8');}
 console.log(`${pack.id}: ${pack.knowledge.length} 篇笔记，${pack.questions.length} 道题，已导出。`);
}
