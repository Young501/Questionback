const http=require('http');
const fs=require('fs');
const path=require('path');
const root=__dirname;
const allowed=new Set(['index.html','style.css','app.js','demo.js','content.js','knowledge.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html'}catch{res.writeHead(400);return res.end('Bad request')}
 if(!allowed.has(name)){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});return res.end('<h1>拾题 · 页面不存在</h1><a href="/">返回今日复习</a>')}
 fs.readFile(path.join(root,name),(err,data)=>{if(err){res.writeHead(500);return res.end('Read failed')}res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-cache'});res.end(data)})
}).listen(4173,'127.0.0.1',()=>{
 console.log('拾题 Local: http://127.0.0.1:4173');
 if(process.argv.includes('--open'))require('child_process').execFile('rundll32.exe',['url.dll,FileProtocolHandler','http://127.0.0.1:4173'],{windowsHide:true},err=>{if(err)console.log('请在浏览器打开 http://127.0.0.1:4173')});
}).on('error',err=>{if(err.code==='EADDRINUSE')console.log('4173 端口已被占用。如果拾题已经运行，请直接打开 http://127.0.0.1:4173');else console.error(err.message);process.exitCode=1});
