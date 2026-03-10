import{b as l}from"./browser-BnURzfs5.js";const d={API_KEY:"settings:apiKey",ACTIVE_JD_ID:"settings:activeJdId",DATA_RETENTION_DAYS:"settings:dataRetentionDays",JD_INDEX:"jd:index",jd:t=>`jd:${t}`,candidate:t=>`candidate:${t}`,CANDIDATE_INDEX:"candidate:index"};async function k(){return(await l.storage.local.get(d.JD_INDEX))[d.JD_INDEX]??[]}async function v(t){const e=await k();e.includes(t.id)||(e.push(t.id),await l.storage.local.set({[d.JD_INDEX]:e})),await l.storage.local.set({[d.jd(t.id)]:t})}async function m(){const t=await k();if(t.length===0)return[];const e=t.map(n=>d.jd(n)),a=await l.storage.local.get(e);return e.map(n=>a[n]).filter(Boolean)}async function J(t){const a=(await k()).filter(i=>i!==t);await l.storage.local.set({[d.JD_INDEX]:a}),await l.storage.local.remove(d.jd(t)),(await l.storage.local.get(d.ACTIVE_JD_ID))[d.ACTIVE_JD_ID]===t&&await l.storage.local.remove(d.ACTIVE_JD_ID)}async function S(t){await l.storage.local.set({[d.ACTIVE_JD_ID]:t})}async function $(){return(await l.storage.local.get(d.ACTIVE_JD_ID))[d.ACTIVE_JD_ID]}async function E(){const t=document.getElementById("api-key-indicator"),a=!!(await l.storage.local.get("settings:apiKey"))["settings:apiKey"];t.textContent=a?"A key is saved":"No key saved"}async function _(){const t=document.getElementById("api-key-input"),e=document.getElementById("api-key-status"),a=t.value.trim();if(!a)return;/^sk-ant-/.test(a)?e.textContent="":e.textContent="Warning: key does not start with sk-ant- — proceeding anyway",await l.storage.local.set({"settings:apiKey":a}),e.textContent="Validating...";const n=await l.runtime.sendMessage({type:"VALIDATE_API_KEY"});n.valid?(e.textContent="API key saved and validated",t.value="",await E()):e.textContent=`Validation failed: ${n.error??"Unknown error"}`}function x(t){const e=t.skills.map((a,n)=>`
    <div class="skill-row" data-skill-index="${n}">
      <span class="skill-text">${a.text}</span>
      <label style="display:inline; font-weight:normal;">
        <input type="radio" name="skill-${t.id}-${n}-weight" value="mandatory"
          ${a.weight==="mandatory"?"checked":""} data-weight-jd="${t.id}" data-weight-index="${n}">
        Mandatory
      </label>
      <label style="display:inline; font-weight:normal;">
        <input type="radio" name="skill-${t.id}-${n}-weight" value="nice-to-have"
          ${a.weight==="nice-to-have"?"checked":""} data-weight-jd="${t.id}" data-weight-index="${n}">
        Nice-to-have
      </label>
      <button data-remove-skill="${n}" data-jd-id="${t.id}">×</button>
    </div>
  `).join("");return`
    <details>
      <summary>Edit Skills (${t.skills.length})</summary>
      <div class="skill-list-editor" data-jd-id="${t.id}">
        ${e||'<p style="color:#888; font-size:0.85em;">No skills added yet.</p>'}
        <div class="add-skill-form">
          <input type="text" class="skill-text-input" placeholder="e.g. TypeScript">
          <select class="skill-weight-select">
            <option value="mandatory">Mandatory</option>
            <option value="nice-to-have">Nice-to-have</option>
          </select>
          <button class="add-skill-btn" data-jd-id="${t.id}">Add Skill</button>
        </div>
      </div>
    </details>
  `}async function p(){const t=document.getElementById("jd-list"),e=await m();if(t.innerHTML="",e.length===0){t.innerHTML="<li><em>No job descriptions saved yet.</em></li>",await h();return}e.forEach(a=>{const n=document.createElement("li");n.innerHTML=`
      <div class="jd-item-header">
        <strong>${a.title}</strong>
        <span style="color:#666; font-size:0.85em;">(${a.skills.length} skills)</span>
        <button data-delete-jd="${a.id}">Delete</button>
      </div>
      ${x(a)}
    `,t.appendChild(n)}),await h()}async function b(){const t=document.getElementById("jd-title-input"),e=document.getElementById("jd-raw-text-input"),a=t.value.trim(),n=e.value.trim();if(!a||!n)return;const i={id:crypto.randomUUID(),title:a,rawText:n,skills:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await v(i),t.value="",e.value="",await p()}async function h(){const t=document.getElementById("active-jd-selector");if(!t)return;const e=await m(),a=await $();if(e.length===0){t.innerHTML="<p><em>Add at least one job description above.</em></p>";return}t.innerHTML="",e.forEach(n=>{const i=document.createElement("label");i.style.display="block",i.style.fontWeight="normal",i.innerHTML=`
      <input type="radio" name="active-jd" value="${n.id}"
        ${a===n.id?"checked":""}>
      ${n.title}
    `,t.appendChild(i)})}document.addEventListener("DOMContentLoaded",async()=>{await E(),await p(),document.getElementById("api-key-save-btn").addEventListener("click",()=>{_()}),document.getElementById("jd-add-btn").addEventListener("click",()=>{b()});const a=document.getElementById("jd-list");a.addEventListener("click",async i=>{const s=i.target,g=s.dataset.deleteJd;if(g){await J(g),await p();return}if(s.classList.contains("add-skill-btn")){const w=s.dataset.jdId,c=s.closest(".add-skill-form"),r=c.querySelector(".skill-text-input"),o=c.querySelector(".skill-weight-select"),u=r.value.trim();if(!u)return;const I=(await m()).find(A=>A.id===w);if(!I)return;const D={text:u,weight:o.value};await v({...I,skills:[...I.skills,D],updatedAt:new Date().toISOString()}),await p();return}const y=s.dataset.removeSkill;if(y!==void 0){const w=s.dataset.jdId,r=(await m()).find(u=>u.id===w);if(!r)return;const o=r.skills.filter((u,f)=>f!==parseInt(y,10));await v({...r,skills:o,updatedAt:new Date().toISOString()}),await p();return}}),a.addEventListener("change",async i=>{const s=i.target,g=s.dataset.weightJd,y=s.dataset.weightIndex;if(!g||y===void 0)return;const c=(await m()).find(o=>o.id===g);if(!c)return;const r=c.skills.map((o,u)=>u===parseInt(y,10)?{...o,weight:s.value}:o);await v({...c,skills:r,updatedAt:new Date().toISOString()})}),document.getElementById("active-jd-selector")?.addEventListener("change",async i=>{const s=i.target;s.name==="active-jd"&&await S(s.value)})});
