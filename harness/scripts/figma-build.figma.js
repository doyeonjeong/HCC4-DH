// Figma Plugin API script. Run via Figma MCP use_figma; reuses the existing blank Huddling PoC page.
const page = figma.currentPage;
page.name = "Huddling MVP PoC";

const available = await figma.listAvailableFontsAsync();
const family = available.some(f => f.fontName.family === "Noto Sans KR") ? "Noto Sans KR" : "Inter";
const styles = [...new Set(available.filter(f => f.fontName.family === family).map(f => f.fontName.style))];
const regularStyle = styles.includes("Regular") ? "Regular" : styles[0];
const boldStyle = styles.includes("Bold") ? "Bold" : (styles.includes("Semi Bold") ? "Semi Bold" : regularStyle);
const regularFont = {family, style:regularStyle};
const boldFont = {family, style:boldStyle};
await Promise.all([figma.loadFontAsync(regularFont), figma.loadFontAsync(boldFont)]);

const colors = {
  ink:"#141414", softInk:"#262626", canvas:"#ffffff", soft:"#f3f3f3",
  field:"#f0f0f0", hairline:"#e0e0e0", muted:"#707070", faint:"#adadad", accent:"#0066ff"
};
const rgb = hex => ({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255});
const solid = hex => ({type:"SOLID",color:rgb(hex)});
const created = [];
function addRect(parent,name,x,y,w,h,color,radius=0,stroke=null){
  const n=figma.createRectangle();
  n.name=name; n.x=x; n.y=y; n.resize(w,h); n.cornerRadius=radius; n.fills=[solid(color)];
  if(stroke) n.strokes=[solid(stroke)];
  parent.appendChild(n); created.push({id:n.id,name:n.name,type:n.type}); return n;
}
function addText(parent,name,value,x,y,w,h,size=14,weight="regular",color=colors.ink,align="LEFT"){
  const n=figma.createText();
  n.name=name; n.fontName=weight==="bold"?boldFont:regularFont; n.fontSize=size; n.characters=value;
  n.fills=[solid(color)]; n.textAlignHorizontal=align; n.resize(w,h); n.x=x; n.y=y;
  parent.appendChild(n); created.push({id:n.id,name:n.name,type:n.type}); return n;
}
function makeFrame(name,x){
  const f=figma.createFrame();
  f.name=name; f.resize(390,844); f.x=x; f.y=0; f.fills=[solid(colors.canvas)]; f.clipsContent=true;
  page.appendChild(f); created.push({id:f.id,name:f.name,type:f.type,width:f.width,height:f.height}); return f;
}
function addHeader(f,back=false){
  if(back) addText(f,"header/back","‹",20,20,24,34,28,"regular",colors.ink);
  else {
    addRect(f,"header/brand-mark",20,24,24,24,colors.ink,8);
    addText(f,"header/brand-letter","H",20,25,24,22,12,"bold",colors.canvas,"CENTER");
  }
  addText(f,"header/brand","Huddling",52,22,180,28,17,"bold",colors.ink);
  if(!back) addText(f,"header/profile","내 학습",292,24,78,24,12,"regular",colors.muted,"RIGHT");
}
function addNav(f,active){
  addRect(f,"nav/divider",0,763,390,1,colors.hairline);
  const labels=["홈","스킬","미션","내 자산"], xs=[15,105,195,285];
  labels.forEach((label,i)=>addText(f,"nav/"+label,label,xs[i],784,76,24,12,i===active?"bold":"regular",i===active?colors.ink:colors.muted,"CENTER"));
  addRect(f,"nav/active-indicator",xs[active]+27,775,22,3,colors.ink,2);
}
function addPill(f,label,x,y,w,active=false,accent=false){
  addRect(f,"filter/"+label,x,y,w,34,active?colors.ink:colors.soft,9999,active?null:colors.hairline);
  addText(f,"filter-label/"+label,label,x+4,y+6,w-8,21,12,active?"bold":"regular",active?colors.canvas:(accent?colors.accent:colors.ink),"CENTER");
}
const button = figma.createComponent();
button.name="Huddling / Button / Primary"; button.resize(350,48); button.x=1500; button.y=0;
button.cornerRadius=9999; button.fills=[solid(colors.ink)];
const buttonLabel=figma.createText();
buttonLabel.name="label"; buttonLabel.fontName=boldFont; buttonLabel.fontSize=15; buttonLabel.characters="Action";
buttonLabel.fills=[solid(colors.canvas)]; buttonLabel.textAlignHorizontal="CENTER"; buttonLabel.resize(310,48);
buttonLabel.x=20; buttonLabel.y=0; button.appendChild(buttonLabel); page.appendChild(button);
created.push({id:button.id,name:button.name,type:button.type});
function addButton(parent,label,x,y,w=350){
  const i=button.createInstance(); i.name="Button / "+label; i.resize(w,48); i.x=x; i.y=y; parent.appendChild(i);
  const t=i.findOne(n=>n.type==="TEXT"); if(t) t.characters=label;
  created.push({id:i.id,name:i.name,type:i.type}); return i;
}

// 01 — Public/free learning material discovery.
const s1=makeFrame("library_home · 무료 학습자료",0);
addHeader(s1);
addText(s1,"home/greeting","오늘, 무엇을 배워볼까요?",20,74,350,24,14,"regular",colors.muted);
addText(s1,"home/title","AI 실무를 작게 시작해요",20,106,350,36,23,"bold",colors.ink);
addRect(s1,"home/search",20,158,350,48,colors.field,16);
addText(s1,"home/search-placeholder","검색어 또는 주제를 입력해요",36,171,315,22,14,"regular",colors.muted);
addPill(s1,"전체",20,224,64,true); addPill(s1,"AI 실무",92,224,82); addPill(s1,"Figma + AI",184,224,100);
addRect(s1,"home/featured-card",20,280,350,226,colors.soft,24);
addText(s1,"home/featured-label","오늘의 추천 · 무료",40,300,300,18,12,"bold",colors.muted);
addText(s1,"home/featured-title","회의 내용을 10분 만에\n실행 목록으로",40,330,310,60,21,"bold",colors.ink);
addText(s1,"home/featured-copy","바로 써볼 수 있는 프롬프트와 예시를 확인해요.",40,395,310,38,13,"regular",colors.muted);
addButton(s1,"학습 시작",40,448,310);
addText(s1,"home/library-title","무료 학습자료",20,530,230,24,17,"bold",colors.ink);
addText(s1,"home/see-all","모두 보기",285,532,85,20,12,"regular",colors.muted,"RIGHT");
addRect(s1,"home/resource-1",20,564,350,66,colors.canvas,16,colors.hairline);
addText(s1,"home/resource-1-meta","자동화 · 입문",36,572,300,16,11,"regular",colors.muted);
addText(s1,"home/resource-1-title","반복 업무를 작은 자동화로",36,591,316,24,14,"bold",colors.ink);
addRect(s1,"home/resource-2",20,640,350,66,colors.canvas,16,colors.hairline);
addText(s1,"home/resource-2-meta","Figma + AI · 8분",36,648,300,16,11,"regular",colors.muted);
addText(s1,"home/resource-2-title","첫 화면 구조를 빠르게 잡기",36,667,316,24,14,"bold",colors.ink);
addNav(s1,0);

// 02 — Paid member skill / prompt detail.
const s2=makeFrame("skill_detail · 스킬 상세",450);
addHeader(s2,true);
addText(s2,"skill/page-title","스킬 상세",52,22,250,28,17,"bold",colors.ink);
addText(s2,"skill/access-badge","유료 멤버",20,76,110,20,12,"bold",colors.accent);
addText(s2,"skill/title","Figma 화면 기획\n프롬프트",20,105,350,58,22,"bold",colors.ink);
addText(s2,"skill/summary","요구사항을 사용자 흐름과 핵심 화면으로 나누는 실무용 가이드",20,169,350,44,13,"regular",colors.muted);
addRect(s2,"skill/recommended-card",20,226,350,66,colors.soft,16);
addText(s2,"skill/recommended-label","추천 대상",36,236,100,16,11,"regular",colors.muted);
addText(s2,"skill/recommended-value","화면 설계를 시작하는 디자이너",36,256,315,22,14,"bold",colors.ink);
addText(s2,"skill/when-title","언제 쓰나요?",20,315,350,24,17,"bold",colors.ink);
addText(s2,"skill/when-copy","PRD는 있지만 어떤 화면부터 그릴지 막막할 때 사용해요.",20,345,350,40,13,"regular",colors.softInk);
addText(s2,"skill/steps-title","사용 순서",20,399,350,24,17,"bold",colors.ink);
[["01","PRD에서 사용자와 목표를 고르기"],["02","핵심 흐름을 화면 3개로 나누기"],["03","각 화면의 필수 상태를 적기"]].forEach((row,i)=>{
  const y=432+i*43;
  addRect(s2,"skill/step-number-"+i,20,y,32,30,colors.soft,12);
  addText(s2,"skill/step-index-"+i,row[0],20,y+5,32,19,11,"bold",colors.ink,"CENTER");
  addText(s2,"skill/step-copy-"+i,row[1],64,y+4,306,22,12,"regular",colors.ink);
});
addRect(s2,"skill/prompt-preview",20,570,350,62,colors.field,16);
addText(s2,"skill/prompt-preview-copy","예시 프롬프트 · 화면 구조 질문 5개",36,590,316,24,12,"regular",colors.softInk);
addButton(s2,"프롬프트 복사",20,648,350);
addNav(s2,1);

// 03 — Monthly mission submission (MVP states only).
const s3=makeFrame("mission_submit · 미션 제출",900);
addHeader(s3,true);
addText(s3,"mission/page-title","미션 제출",52,22,250,28,17,"bold",colors.ink);
addText(s3,"mission/kicker","이번 달 미션",20,76,250,20,12,"bold",colors.accent);
addText(s3,"mission/title","업무에 적용한 AI 자산 만들기",20,105,350,54,20,"bold",colors.ink);
addText(s3,"mission/summary","실제 업무에 사용한 프롬프트나 자동화 사례를 정리해 제출해요.",20,163,350,44,13,"regular",colors.muted);
addRect(s3,"mission/progress-track",20,226,350,8,colors.field,9999);
addRect(s3,"mission/progress-fill",20,226,145,8,colors.ink,9999);
addText(s3,"mission/progress-label","이번 달 미션 1/2",20,243,250,20,12,"regular",colors.muted);
addText(s3,"mission/title-label","산출물 제목",20,282,350,18,12,"bold",colors.ink);
addRect(s3,"mission/title-field",20,306,350,44,colors.field,16);
addText(s3,"mission/title-placeholder","예: 회의록 정리 프롬프트",36,318,318,22,13,"regular",colors.muted);
addText(s3,"mission/description-label","사용 방법과 결과",20,367,350,18,12,"bold",colors.ink);
addRect(s3,"mission/description-field",20,391,350,78,colors.field,16);
addText(s3,"mission/description-placeholder","어떤 업무에 적용했는지, 어떻게 달라졌는지 적어주세요.",36,407,318,48,12,"regular",colors.muted);
addText(s3,"mission/visibility-label","공개 범위",20,486,350,18,12,"bold",colors.ink);
addPill(s3,"비공개",20,510,92,true); addPill(s3,"멤버 공개",122,510,116);
addRect(s3,"mission/attachment-card",20,566,350,50,colors.canvas,16,colors.hairline);
addText(s3,"mission/attachment-label","＋  파일 첨부하기",36,580,318,22,12,"bold",colors.ink);
addButton(s3,"제출하기",20,642,350);
addNav(s3,2);

return {
  pageId:page.id,
  pageName:page.name,
  fontFamily:family,
  fontStyles:[regularFont.style,boldFont.style],
  created,
  frames:[s1,s2,s3].map(f=>({id:f.id,name:f.name,width:f.width,height:f.height,x:f.x,y:f.y}))
};
