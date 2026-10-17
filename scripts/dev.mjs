import "./build.mjs";
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {extname,join,resolve,sep} from "node:path";
const root=resolve("dist");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".xml":"application/xml",".txt":"text/plain"};
createServer(async(req,res)=>{
  let p;
  try{p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400).end("Bad request");return;}
  const path=resolve(join(root,"."+p));
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end("Forbidden");return;}
  try{
    const f=(await stat(path)).isDirectory()?join(path,"index.html"):path;
    const data=await readFile(f);res.writeHead(200,{"Content-Type":mime[extname(f)]||"application/octet-stream"});res.end(data);
  }catch{res.writeHead(404).end("Not found");}
}).listen(4173,"127.0.0.1",()=>console.log("TwoDollarGig preview: http://localhost:4173"));
