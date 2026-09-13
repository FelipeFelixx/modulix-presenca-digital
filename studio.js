const { createClient } = supabase;
const db = createClient(MODULIX_SUPABASE_URL, MODULIX_SUPABASE_PUBLISHABLE_KEY);
let clients = [], projects = [], templates = [], current = null;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
const slug = v => String(v || "cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,70) || "cliente";

function show(tab){ $$(".tab").forEach(x=>x.classList.remove("active")); $("#"+tab)?.classList.add("active"); $$(".tabs button").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab)); }
$$(".tabs button").forEach(b=>b.onclick=()=>show(b.dataset.tab));

async function boot(){
  const {data:{session}} = await db.auth.getSession();
  if(session) enter(session); else showLogin();
  db.auth.onAuthStateChange((_event,session)=>session ? enter(session) : showLogin());
}
function showLogin(){ $("#loginScreen")?.classList.remove("hidden"); $("#app")?.classList.add("hidden"); }
function enter(session){ $("#loginScreen")?.classList.add("hidden"); $("#app")?.classList.remove("hidden"); loadAll(); }
$("#loginForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const {error}=await db.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});
  $("#loginMessage").textContent=error ? error.message : "Entrando...";
});
$("#logoutBtn")?.addEventListener("click",()=>db.auth.signOut());

async function loadAll(){
  const [c,p,t]=await Promise.all([
    db.from("digital_presence_clients").select("*").order("created_at",{ascending:false}),
    db.from("digital_presence_projects").select("*,digital_presence_clients(name),digital_presence_templates(name,slug)").order("created_at",{ascending:false}),
    db.from("digital_presence_templates").select("*").eq("active",true).order("name")
  ]);
  if(c.error||p.error||t.error){ console.error(c.error,p.error,t.error); alert("Não foi possível carregar os dados do Studio. Confira o login e as políticas do Supabase."); return; }
  clients=c.data||[]; projects=p.data||[]; templates=t.data||[]; renderAll();
}
function renderAll(){
  $("#clientCount").textContent=clients.length; $("#projectCount").textContent=projects.length;
  $("#metricClients").textContent=clients.length; $("#metricProjects").textContent=projects.length;
  $("#metricPublished").textContent=projects.filter(p=>p.status==="published").length;
  $("#clientList").innerHTML=clients.length ? clients.map(c=>`<article class="client"><div><h3>${esc(c.name)}</h3><p>${esc(c.category||"Sem categoria")} · ${esc(c.status)}</p></div><div class="client-actions"><button onclick="editClient('${c.id}')">Editar</button><button onclick="newProject('${c.id}')">Novo projeto</button><button class="delete" onclick="deleteClient('${c.id}')">Excluir</button></div></article>`).join("") : '<div class="empty">Nenhum cliente cadastrado.</div>';
  $("#projectList").innerHTML=projects.length ? projects.map(p=>`<article class="client"><div><h3>${esc(p.name)}</h3><p>${esc(p.digital_presence_clients?.name||"Cliente")} · ${esc(p.digital_presence_templates?.name||"Modelo")} · ${esc(p.status)}</p></div><div class="client-actions"><button onclick="previewProject('${p.id}')">Preview</button><button onclick="generateProject('${p.id}')">Gerar HTML</button></div></article>`).join("") : '<div class="empty">Nenhum projeto criado.</div>';
  $("#templateList").innerHTML=templates.map(t=>`<article><div class="sample ${esc(t.slug)}"><strong>${esc(t.name)}</strong></div><h3>${esc(t.name)}</h3><p>${esc(t.description||"")}</p></article>`).join("");
  renderChoices();
}
function renderChoices(){
  const box=$("#templateChoices"); if(!box) return;
  box.innerHTML=templates.map((t,i)=>`<label class="${i===0?"selected":""}"><input type="radio" name="template" value="${t.id}" ${i===0?"checked":""}> <b>${esc(t.name)}</b><span>${esc(t.description||"")}</span></label>`).join("");
}
function resetForm(){ $("#clientForm").reset(); $("#clientId").value=""; $("#projectId").value=""; $("#accent").value="#c8a45d"; $("#formTitle").textContent="Cadastrar cliente"; renderChoices(); }
function openForm(){ resetForm(); show("new"); }
$("#newBtn")?.addEventListener("click",openForm); $("#newClientBtn")?.addEventListener("click",openForm); $("#newClientBtn2")?.addEventListener("click",openForm);
$("#cancelBtn")?.addEventListener("click",()=>show("clients")); $("#backBtn")?.addEventListener("click",()=>show("clients"));

function formData(){
 return {name:$("#name").value.trim(),category:$("#category").value.trim(),slogan:$("#slogan").value.trim(),accent:$("#accent").value,description:$("#description").value.trim(),services:$("#services").value.split("\n").map(x=>x.trim()).filter(Boolean),whatsapp:$("#whatsapp").value.trim(),phone:$("#phone").value.trim(),email:$("#email").value.trim(),instagram:$("#instagram").value.trim(),address:$("#address").value.trim(),hours:$("#hours").value.trim()};
}
function fill(c){ Object.entries(c).forEach(([k,v])=>{const el=$("#"+k);if(el)el.value=Array.isArray(v)?v.join("\n"):v}); }
async function editClient(id){const c=clients.find(x=>x.id===id);if(!c)return;show("new");fill(c);$("#clientId").value=c.id;$("#formTitle").textContent="Editar cliente";}
async function saveClient(e){
 e.preventDefault(); const {data:{user}}=await db.auth.getUser(); if(!user)return;
 const data={...formData(),created_by:user.id,status:"active"};
 const q=$("#clientId").value ? db.from("digital_presence_clients").update(data).eq("id",$("#clientId").value).select().single() : db.from("digital_presence_clients").insert(data).select().single();
 const {error}=await q; if(error){alert(error.message);return;} await loadAll(); show("clients");
}
$("#clientForm")?.addEventListener("submit",saveClient);
async function deleteClient(id){if(!confirm("Excluir este cliente e seus projetos?"))return;const {error}=await db.from("digital_presence_clients").delete().eq("id",id);if(error)alert(error.message);else loadAll();}
async function newProject(clientId){const c=clients.find(x=>x.id===clientId);if(!c)return;resetForm();fill(c);$("#clientId").value=c.id;$("#formTitle").textContent="Novo projeto · "+c.name;show("new");}
$("#previewBtn")?.addEventListener("click",()=>openPreview({content:formData(),template:templates.find(t=>t.id===$('input[name="template"]:checked')?.value)}));

function page(c,t="premium"){
 const dark=t==="premium",accent=c.accent||"#c8a45d",bg=dark?"#090909":"#f3efe6",fg=dark?"#fff":"#171717",muted=dark?"#999":"#666",border=dark?"#292929":"#ddd";
 const items=(c.services||[]).map(x=>`<li>${esc(x)}</li>`).join(""), wa=c.whatsapp?`<a href="https://wa.me/${String(c.whatsapp).replace(/\D/g,"")}" target="_blank">Falar no WhatsApp →</a>`:"";
 return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.name)}</title><style>*{box-sizing:border-box}body{margin:0;font:16px Arial;background:${bg};color:${fg};line-height:1.6}main{max-width:1050px;margin:auto;padding:70px 6%}.tag{color:${accent};font-size:11px;font-weight:800;letter-spacing:.16em}h1{font-size:clamp(45px,8vw,90px);line-height:.94;letter-spacing:-.06em;margin:18px 0}h2{font-size:36px}p{max-width:720px;color:${muted}}a{display:inline-block;margin-top:20px;background:${accent};color:#111;padding:12px 18px;border-radius:9px;font-weight:800;text-decoration:none}.section{margin-top:90px}.services{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0;list-style:none}.services li{padding:20px;border:1px solid ${border};border-radius:13px}.contact{padding:25px;border-radius:16px;background:${dark?"#111":"#fff"} }@media(max-width:650px){.services{grid-template-columns:1fr}}</style></head><body><main><span class="tag">${esc(c.category||"EMPRESA")}</span><h1>${esc(c.name||"Sua marca")}</h1><h2>${esc(c.slogan||"Uma presença digital profissional.")}</h2><p>${esc(c.description||"Conheça nosso negócio, serviços e formas de contato.")}</p>${wa}<section class="section"><span class="tag">SERVIÇOS</span><h2>O que oferecemos</h2><ul class="services">${items||"<li>Adicione seus serviços.</li>"}</ul></section><section class="section contact"><span class="tag">CONTATO</span><h2>Fale conosco</h2><p>${esc(c.address||"")}${c.hours?" · "+esc(c.hours):""}</p><p>${esc(c.phone||"")}${c.email?" · "+esc(c.email):""}</p></section></main></body></html>`;
}
function openPreview(p){current=p;$("#previewName").textContent=p.content?.name||"Cliente";$("#frame").srcdoc=page(p.content,p.template?.slug||"premium");$("#preview").classList.add("open");}
async function previewProject(id){const p=projects.find(x=>x.id===id);if(p)openPreview({content:p.content,template:p.digital_presence_templates});}
function generateProject(id){const p=projects.find(x=>x.id===id);if(p)download(p);}
function download(p){const blob=new Blob([page(p.content,p.digital_presence_templates?.slug||"premium")],{type:"text/html"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=slug(p.content?.name)+"-modulix.html";a.click();URL.revokeObjectURL(a.href);}
$("#closePreview")?.addEventListener("click",()=>$("#preview").classList.remove("open"));
$("#generateBtn")?.addEventListener("click",()=>current&&download(current));

async function createProjectFromEditor(){
 const {data:{user}}=await db.auth.getUser(),clientId=$("#clientId").value,templateId=$('input[name="template"]:checked')?.value;
 if(!user||!clientId||!templateId){alert("Selecione um cliente e um modelo.");return;}
 const c=formData(), row={client_id:clientId,template_id:templateId,name:c.name+" — Presença Digital",slug:slug(c.name)+"-"+Date.now().toString(36),status:"draft",content:c,created_by:user.id};
 const {error}=await db.from("digital_presence_projects").insert(row);
 if(error)alert(error.message);else{await loadAll();show("projects");}
}
window.editClient=editClient;window.newProject=newProject;window.deleteClient=deleteClient;window.previewProject=previewProject;window.generateProject=generateProject;
document.getElementById("createProjectBtn")?.addEventListener("click",createProjectFromEditor);
boot();
