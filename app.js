'use strict';
const $ = id => document.getElementById(id);
const initial = [
  {role:'reply', text:'雨比预报停得早。', direction:'林川合上书，把长椅上干燥的一半让出来。'},
  {role:'user', text:'你怎么知道，我不是在等雨停？'},
  {role:'reply', text:'那我就不替你猜了。\n这里还有空位，你想坐一会儿吗？', direction:'他往旁边挪了挪，没有继续追问。'}
];
const replies = {
  '你在看什么？':'一本很旧的旅行随笔。作者每到一个地方，都先找车站。\n他说，那里最容易遇见还没决定往哪儿去的人。',
  '如果末班车不来呢？':'先看时刻表，再想别的办法吧。\n车站对面的店还亮着灯，可以去问问。',
  '先安静坐一会儿。':'好。\n\n站台安静下来，只剩下屋檐偶尔落下的水声。'
};
let timer = null, pending = null, lastTrigger = null;
const state = { mode:'story', messages:[], busy:false };
function bubble(message) {
  const article = document.createElement('article'); article.className = 'message '+message.role;
  const sender = document.createElement('div'); sender.className='sender';
  sender.append(document.createTextNode(message.role==='user'?'你':'林川'));
  if(message.role!=='user') {const label=document.createElement('span');label.className='demo-label';label.textContent='预写示例';sender.append(label);}
  const content=document.createElement('div');content.className='content';
  if(message.direction){const direction=document.createElement('span');direction.className='stage-direction';direction.textContent=message.direction;content.append(direction);}
  content.append(document.createTextNode(message.text));article.append(sender,content);$('messages').append(article);return content;
}
function nearBottom(){return $('conversation').scrollHeight-$('conversation').scrollTop-$('conversation').clientHeight<90;}
function scrollEnd(){ $('conversation').scrollTop=$('conversation').scrollHeight; $('latest-button').hidden=true; }
function updateInput(){const n=Array.from($('message').value).length;$('count').textContent=n+' / 500';$('send').disabled=state.busy||!$('message').value.trim();}
function setBusy(busy){state.busy=busy;$('send').hidden=busy;$('cancel').hidden=!busy;$('message').disabled=busy;document.querySelectorAll('[data-prompt]').forEach(button=>button.disabled=busy);updateInput();}
function setMode(mode){if(!['story','compact'].includes(mode))throw new Error('Unknown layout');const atEnd=nearBottom();state.mode=mode;document.documentElement.dataset.layout=mode;document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));if(atEnd)requestAnimationFrame(scrollEnd);}
function submit(text){
  text=text.trim();if(!text||state.busy)return false;
  if(text.length>500)throw new Error('Message exceeds 500 UTF-16 code units');
  state.messages.push({role:'user',text});bubble({role:'user',text});$('message').value='';setBusy(true);
  $('status').textContent='正在播放预写示例；这不是模型生成。';
  pending=bubble({role:'reply',text:'示例回复准备中'});pending.classList.add('typing');scrollEnd();
  timer=setTimeout(()=>{
    const shouldScroll=nearBottom();const answer=replies[text]||'这份样片没有连接语言模型，不能理解你刚输入的内容。\n它演示的是回复出现时的排版、布局和交互；你也可以试试上方的三个预设开场。';
    pending.classList.remove('typing');pending.textContent=answer;state.messages.push({role:'reply',text:answer});pending=null;timer=null;setBusy(false);$('status').textContent='预写示例播放完毕。输入不上传，刷新后清空。';if(shouldScroll)scrollEnd();else $('latest-button').hidden=false;$('message').focus();
  },1100);return true;
}
function cancel(){if(timer)clearTimeout(timer);timer=null;if(pending){pending.classList.remove('typing');pending.textContent='示例回复已停止。';state.messages.push({role:'reply',text:'示例回复已停止。'});pending=null;}setBusy(false);$('status').textContent='已停止演示，你可以继续输入。';$('message').focus();}
function reset(){if(timer)clearTimeout(timer);timer=null;pending=null;state.messages=initial.map(m=>({...m}));$('messages').replaceChildren();state.messages.forEach(bubble);$('message').value='';setBusy(false);$('status').textContent='这是界面样片：发送后会播放一段预写示例回复，不是真实 AI 对话。';$('latest-button').hidden=true;requestAnimationFrame(()=>{$('conversation').scrollTop=0;});}
$('composer').addEventListener('submit',event=>{event.preventDefault();submit($('message').value);});
$('message').addEventListener('input',updateInput);
$('message').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();submit($('message').value);}});
$('cancel').addEventListener('click',cancel);$('reset-button').addEventListener('click',reset);
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>submit(button.dataset.prompt)));
$('latest-button').addEventListener('click',scrollEnd);
$('conversation').addEventListener('scroll',()=>{if(nearBottom())$('latest-button').hidden=true;});
$('about-button').addEventListener('click',()=>{lastTrigger=document.activeElement;$('about').showModal();});
$('close-about').addEventListener('click',()=>$('about').close());
$('about').addEventListener('close',()=>lastTrigger?.focus());
reset();
// Optional browser-native agent access: same actions and state as the visible UI.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_demo_state',description:'Read layout and demo messages. No backend AI is connected.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>JSON.parse(JSON.stringify(state))});
  register({name:'set_demo_layout',description:'Switch the visible conversation layout without resetting the conversation.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['story','compact']}},required:['mode'],additionalProperties:false},execute:input=>{if(!input||!['story','compact'].includes(input.mode))throw new Error('mode must be story or compact');setMode(input.mode);return {mode:state.mode};}});
  window.addEventListener('pagehide',()=>{lifecycle.abort();if(timer)clearTimeout(timer);},{once:true});
}
