// Componenti schematici per segnali, controllo e scienze sperimentali.
// Curve illustrative e deterministiche, non misurazioni sperimentali.
import { mix, poly, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef } from '../registry';

const BLUE = '#6C8EBF', TEAL = '#389A91', RED = '#C76B68', GOLD = '#CFAC4B';
function drawing(n: NodeModel) {
  const p: Part[] = [];
  const rect = (x:number,y:number,w:number,h:number,fill=n.fill,stroke=n.stroke,r=0.02) => p.push({kind:'rect',x:n.x+x*n.w,y:n.y+y*n.h,w:w*n.w,h:h*n.h,r:r*Math.min(n.w,n.h),fill,stroke});
  const line = (points:number[][],stroke=n.stroke,sw=1.3,fill='none',closed=false) => p.push({kind:'path',cmds:poly(points.map(([x,y])=>[n.x+x*n.w,n.y+y*n.h]),closed),fill,stroke,sw});
  const oval=(x:number,y:number,rx:number,ry:number,fill=n.fill,stroke=n.stroke)=>p.push({kind:'ellipse',cx:n.x+x*n.w,cy:n.y+y*n.h,rx:rx*n.w,ry:ry*n.h,fill,stroke});
  const text=(x:number,y:number,value:string,size=8,fill=n.stroke)=>p.push({kind:'text',x:n.x+x*n.w,y:n.y+y*n.h,text:value,size,fill,anchor:'middle'});
  const curve=(fn:(t:number)=>number,stroke=BLUE,from=0,to=1,baseline=.83,scale=.65)=>line(Array.from({length:81},(_,i)=>{const t=from+(to-from)*i/80;return [.12+.8*t,baseline-scale*fn(t)];}),stroke,1.5);
  const axes=(vertical='')=>{line([[.12,.12],[.12,.83],[.94,.83]],'#8B95A3',.8);if(vertical)text(.06,.1,vertical,7);};
  const arrow=(a:number[],b:number[],color=n.stroke)=>{line([a,b],color,1);const ang=Math.atan2((b[1]-a[1])*n.h,(b[0]-a[0])*n.w);line([[b[0]-.055*Math.cos(ang-.55),b[1]-.055*n.w/n.h*Math.sin(ang-.55)],b,[b[0]-.055*Math.cos(ang+.55),b[1]-.055*n.w/n.h*Math.sin(ang+.55)]],color,1);};
  return {p,rect,line,oval,text,curve,axes,arrow};
}

function signal(n:NodeModel):Part[]{
 const {p,axes,curve,line,text}=drawing(n);const type=n.spec;axes();
 if(['hann','hamming','blackman','bartlett'].includes(type)){
  const fn=(t:number)=>type==='hann'?.5-.5*Math.cos(2*Math.PI*t):type==='hamming'?.54-.46*Math.cos(2*Math.PI*t):type==='blackman'?.42-.5*Math.cos(2*Math.PI*t)+.08*Math.cos(4*Math.PI*t):1-Math.abs(2*t-1);
  curve(fn);text(.54,.96,'n',8);text(.1,.06,'w[n]',8);
 }else if(type==='envelope'){
  const env=(t:number)=>.25+.5*Math.exp(-Math.pow((t-.5)/.26,2));
  curve(t=>env(t)*Math.sin(16*Math.PI*t),BLUE,0,1,.47,.4);curve(env,RED,0,1,.47,.4);curve(t=>-env(t),RED,0,1,.47,.4);text(.86,.09,'A(t)',8,RED);
 }else if(type==='cepstrum'){
  for(let i=0;i<22;i++){const t=i/22;const h=.78*Math.exp(-i/1.7)+(i===10?.53:i===20?.25:0)+.03*Math.sin(i*3)**2;line([[.12+.8*t,.83],[.12+.8*t,.83-.66*h]],BLUE,1.7);}
  text(.54,.96,'quefrency',7);
 }else{
  line([[.52,.13],[.52,.83]],'#BAC2CE',.7);
  curve(t=>Math.exp(-Math.pow((t-(type==='cross'?.66:.5))/.19,2))*Math.cos((t-(type==='cross'?.66:.5))*13),BLUE,0,1,.59,.43);
  text(.53,.96,'lag',8);if(type==='cross')text(.7,.13,'delay',7,TEAL);
 }
 return p;
}
function polyphase(n:NodeModel):Part[]{
 const {p,rect,arrow,text,line}=drawing(n);const k=Math.max(2,Math.min(5,Math.round(n.count)));
 line([[.08,.16],[.08,.86]],'#77818F');line([[.88,.16],[.88,.86]],'#77818F');
 for(let i=0;i<k;i++){const y=.13+i*.72/(k-1);rect(.3,y-.065,.34,.13,i%2?'#E4EDF6':'#E1EFE8');text(.47,y,`E${i}(z)`,8);arrow([.08,y],[.29,y]);arrow([.65,y],[.88,y]);}
 return p;
}
function control(n:NodeModel):Part[]{
 const {p,axes,curve,line,text,oval,arrow}=drawing(n);const type=n.spec;
 if(type==='gain'||type==='phase'){
  axes();for(let i=0;i<3;i++)line([[.25+i*.23,.15],[.25+i*.23,.83]],'#E4E8EE',.7);
  curve(t=>{const w=10**(4*t-2);return type==='gain'?(40-10*Math.log10(1+w*w))/44:(Math.PI/2-Math.atan(w))/(Math.PI/2);});
  text(.53,.96,'log frequency',7);text(.1,.05,type==='gain'?'dB':'phase',7);
 }else if(type==='nyquist'){
  line([[.12,.43],[.94,.43]],'#A3ABB8',.8);line([[.35,.08],[.35,.85]],'#A3ABB8',.8);
  line(Array.from({length:81},(_,i)=>{const w=6*i/80;return [.35+.51/(1+w*w),.43+.65*w/(1+w*w)];}),BLUE,1.5);
  oval(.21,.43,.015,.02,RED,RED);text(.2,.31,'$-1$',8,RED);text(.9,.32,'Re',7);text(.4,.07,'Im',7);
 }else if(type==='phaseportrait'){
  line([[.1,.5],[.93,.5]],'#A3ABB8',.8);line([[.5,.1],[.5,.9]],'#A3ABB8',.8);
  line(Array.from({length:121},(_,i)=>{const t=i/120*5*Math.PI;return [.5+.38*Math.exp(-.13*t)*Math.cos(t),.5+.35*Math.exp(-.13*t)*Math.sin(t)];}),BLUE,1.5);
  arrow([.72,.64],[.65,.72],BLUE);oval(.5,.5,.02,.025,TEAL,TEAL);text(.94,.57,'$x_1$',8);text(.55,.05,'$x_2$',8);
 }else if(type==='covariance'){
  axes();for(const r of [.38,.25,.13])line(Array.from({length:49},(_,i)=>{const a=i/48*2*Math.PI;const x=r*Math.cos(a),y=r*.42*Math.sin(a);return [.52+x*.83-y*.55,.48-x*.55-y*.83];}),r>.3?'#BACFE1':BLUE,1.1);
  oval(.52,.48,.026,.035,TEAL,TEAL);text(.8,.1,'uncertainty',7);
 }else{
  rectLeft();
  function rectLeft(){line([[.52,.08],[.52,.89]],'#A3ABB8',.8);line([[.1,.5],[.95,.5]],'#A3ABB8',.8);for(const [x,y] of [[.32,.29],[.32,.71],[.22,.5]]){line([[x-.025,y-.03],[x+.025,y+.03]],BLUE,1.4);line([[x-.025,y+.03],[x+.025,y-.03]],BLUE,1.4);}text(.26,.08,'stable',8,TEAL);text(.92,.6,'Re(s)',7);text(.59,.06,'Im(s)',7);}
 }
 return p;
}
function robotics(n:NodeModel):Part[]{
 const {p,rect,line,oval,text,arrow}=drawing(n);const type=n.spec;
 if(type==='imu'){
  rect(.29,.3,.42,.42,'#E4EDF6');oval(.5,.51,.07,.09,'#FFFFFF');arrow([.5,.51],[.9,.51],RED);arrow([.5,.51],[.5,.1],TEAL);arrow([.5,.51],[.17,.83],BLUE);text(.92,.63,'x',8,RED);text(.61,.09,'y',8,TEAL);text(.1,.86,'z',8,BLUE);
 }else if(type==='voxel'){
  for(let i=0;i<7;i++)for(let j=0;j<5;j++){const x=.12+i*.115,y=.15+j*.145;if((i-3)**2+(j-2)**2<9){rect(x,y,.095,.12,'#E1EEF4','#A9BED0',0);oval(x+.02+(i*7+j*3)%5*.012,y+.025+((i+j)*2)%5*.014,.007,.009,TEAL,TEAL);}}
 }else{
  if(type==='costmap')for(let y=0;y<6;y++)for(let x=0;x<8;x++){const dist=Math.min(Math.hypot(x-2,y-2),Math.hypot(x-5,y-3));rect(.08+x*.105,.1+y*.13,.1,.125,dist<.7?'#666F7C':dist<1.6?'#E9BCA9':dist<2.5?'#F6E5BD':'#EDF3EB','none',0);}
  else {rect(.33,.29,.15,.28,'#E4E7EA','#A7B0BC');rect(.6,.53,.16,.25,'#E4E7EA','#A7B0BC');line([[.1,.8],[.26,.2],[.52,.17],[.83,.36],[.9,.78]],'#ABB4C0',.9);}
  line(Array.from({length:61},(_,i)=>{const t=i/60;return [.1+.8*t,.79-.64*Math.sin(Math.PI*t)];}),TEAL,2);
  oval(.1,.79,.028,.035,'#D5EAD9',TEAL);oval(.9,.79,.028,.035,'#D5EAD9',TEAL);
 }
 return p;
}
function genomics(n:NodeModel):Part[]{
 const {p,rect,line,oval,text,axes,curve,arrow}=drawing(n);const type=n.spec;
 if(type==='quality'){axes();for(let i=0;i<12;i++){const x=.15+i*.063,y=.22+.21*(i/11)**2;line([[x,y-.06],[x,y+.16]],BLUE,.8);rect(x-.019,y,.038,.09,'#DAEBDD',TEAL,0);}text(.5,.96,'base position',7);text(.06,.05,'Q',8);}
 else if(type==='coverage'||type==='atac'){axes();const peaks=(t:number)=>.5*Math.exp(-Math.pow((t-.3)/.12,2))+.83*Math.exp(-Math.pow((t-.7)/.085,2));curve(peaks,type==='atac'?TEAL:BLUE);if(type==='atac'){rect(.22,.9,.2,.025,'#AFD5C9',TEAL,0);rect(.59,.9,.18,.025,'#AFD5C9',TEAL,0);}else text(.53,.97,'genomic position',7);}
 else if(type==='methylation'){line([[.08,.55],[.92,.55]],BLUE,2);for(let i=0;i<8;i++){const x=.14+i*.105;line([[x,.55],[x,.3]],'#909AA6',.8);oval(x,.27,.025,.036,i%3?'#D9B66B':'#FFFFFF',GOLD);}text(.5,.85,'CpG sites',8);}
 else if(type==='paired'){for(let i=0;i<3;i++){const y=.25+i*.23;line([[.1,y],[.9,y]],'#BAC2CD',.8);arrow([.12,y],[.35,y],BLUE);arrow([.88,y],[.65,y],TEAL);}}
 else if(type==='umi'){for(let row=0;row<3;row++){const y=.15+row*.28;for(let i=0;i<3;i++)rect(.1,y+i*.047,.25,.03,['#A6C5E1','#B7D6BE','#DCC4DF'][row],'none',0);arrow([.43,y+.06],[.65,y+.06]);rect(.72,y+.025,.19,.07,['#A6C5E1','#B7D6BE','#DCC4DF'][row],'none',0);}text(.23,.96,'reads',7);text(.8,.96,'UMIs',7);}
 else if(type==='adapter'){for(let row=0;row<3;row++){const y=.2+row*.23;rect(.07,y,.65,.105,'#DCE8F6',BLUE,0);rect(.73,y,.18,.105,'#F4D6D2',RED,0);line([[.725,y-.035],[.725,y+.14]],RED,1.4);}text(.37,.1,'read',7);text(.83,.1,'adapter',7);}
 else {for(let row=0;row<3;row++){const y=.2+row*.23;rect(.07,y,.22,.105,'#D1E5D8',TEAL,0);rect(.3,y,.15,.105,'#EAD8AF',GOLD,0);rect(.46,y,.45,.105,'#DCE8F6',BLUE,0);if(type==='adapter')line([[.76,y-.035],[.76,y+.14]],RED,1.4);}
 text(.18,.1,type==='adapter'?'read':'cell',7);text(.37,.1,type==='adapter'?'':'UMI',7);text(.71,.1,type==='adapter'?'adapter':'insert',7);}
 return p;
}
function protein(n:NodeModel):Part[]{
 const {p,rect,line,oval,text}=drawing(n);const type=n.spec;
 if(type==='membrane'){
  rect(.04,.33,.92,.34,'#EEF0F3','none');for(let i=0;i<12;i++){const x=.065+i*.079;oval(x,.36,.019,.026,'#E9D2A3',GOLD);oval(x,.64,.019,.026,'#E9D2A3',GOLD);line([[x-.012,.4],[x-.012,.6]],GOLD,.7);line([[x+.012,.4],[x+.012,.6]],GOLD,.7);}
  line(Array.from({length:71},(_,i)=>{const t=i/70;return [.4+.14*Math.sin(t*6*Math.PI),.1+.8*t];}),BLUE,3);
 }else{
  const pts=Array.from({length:31},(_,i)=>{const t=i/30;return [.08+.84*t,.52+.13*Math.sin(t*Math.PI*3)];});line(pts,BLUE,2);
  if(type==='disulfide'){line([[.3,.61],[.3,.23],[.7,.23],[.7,.57]],GOLD,2);text(.5,.14,'S—S',10,GOLD);}
  else for(const [x,label]of [[.25,'P'],[.53,'Ac'],[.78,'Me']] as const){line([[x,.5],[x,.26]],'#8A94A2',.9);oval(x,.22,.064,.09,'#E9D9EF','#9E7DB4');text(x,.22,label,7,'#785889');}
 }
 return p;
}
function material(n:NodeModel):Part[]{
 const {p,axes,curve,line,text}=drawing(n);const type=n.spec;axes();
 if(type==='stress'){line([[.12,.83],[.36,.35],[.48,.31],[.64,.25],[.76,.21],[.87,.34]],BLUE,1.7);text(.08,.05,'stress',7);text(.54,.96,'strain',7);}
 else if(type==='dos'){curve(t=>.65*Math.exp(-Math.pow((t-.24)/.11,2))+.75*Math.exp(-Math.pow((t-.76)/.09,2)),TEAL);text(.54,.96,'energy',7);text(.07,.05,'DOS',7);}
 else if(type==='bands'){for(let j=0;j<2;j++){curve(t=>.18+.09*j+.08*Math.cos(2*Math.PI*t),BLUE);curve(t=>.72+.1*j-.08*Math.cos(2*Math.PI*t),TEAL);}line([[.56,.45],[.56,.61]],GOLD,1.5);text(.68,.53,'gap',7,GOLD);text(.54,.96,'k',8);}
 else{line([[.14,.77],[.46,.56]],BLUE,1.6);line([[.46,.56],[.55,.14]],BLUE,1.6);line([[.46,.56],[.9,.32]],BLUE,1.6);text(.25,.4,'solid',8);text(.6,.3,'liquid',8);text(.64,.74,'gas',8);text(.5,.97,'temperature',7);text(.06,.08,'P',8);}
 return p;
}
function optics(n:NodeModel):Part[]{
 const {p,axes,line,text,oval}=drawing(n);
 if(n.spec==='comb'){axes();for(let i=0;i<11;i++){const x=.18+i*.065,h=.62*Math.exp(-Math.pow((i-5)/4,2));line([[x,.83],[x,.83-h]],i%2?BLUE:TEAL,2);}text(.55,.96,'frequency',7);}
 else{line([[.12,.5],[.9,.5]],'#A1ABB9',.8);line([[.5,.1],[.5,.9]],'#A1ABB9',.8);oval(.5,.5,.3,.19,'none',BLUE);line([[.68,.35],[.78,.41],[.67,.42]],BLUE,1.2);text(.94,.59,'$E_x$',8);text(.59,.05,'$E_y$',8);}
 return p;
}
function quantum(n:NodeModel):Part[]{
 const {p,rect,text,arrow}=drawing(n);const type=n.spec;
 const matrix=(x:number,y:number,s:number,coherence:number)=>{
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
   const v=row===col?.5:coherence;rect(x+col*s/2,y+row*s/2,s/2-.012,s/2-.012,mix('#FFFFFF','#8BB0D3',v*1.6),'#A1B4C5',0);text(x+(col+.5)*s/2,y+(row+.5)*s/2,v===.5?'0.5':'0',s>.5?12:9,'#3C5268');
  }
 };
 if(type==='dephase'){matrix(.04,.23,.35,.5);arrow([.44,.41],[.57,.41]);matrix(.63,.23,.35,0);text(.2,.83,'coherent',7);text(.8,.83,'dephased',7);}
 else{matrix(.19,.16,.64,type==='pure'?.5:0);text(.51,.91,type==='pure'?'$|+\\rangle\\langle+|$':'I / 2',9);}
 return p;
}
const choose=(values:string[])=>[{mode:'value' as const,choices:values}];
export const TECHNICAL_EXTRA_SHAPES:ShapeDef[]=[
 {kind:'labx-signal',name:'Segnale (analisi)',parts:signal,specLabel:'Analisi',specOptions:choose(['hann','hamming','blackman','bartlett','auto','cross','envelope','cepstrum'])},
 {kind:'labx-polyphase',name:'Banco polifase',parts:polyphase,countLabel:'Rami',countMax:5},
 {kind:'labx-control',name:'Analisi del controllo',parts:control,specLabel:'Grafico',specOptions:choose(['gain','phase','nyquist','phaseportrait','covariance','poles'])},
 {kind:'labx-robotics',name:'Sensori e pianificazione',parts:robotics,specLabel:'Tipo',specOptions:choose(['imu','voxel','costmap','smooth'])},
 {kind:'labx-genomics',name:'Preparazione reads',parts:genomics,specLabel:'Tipo',specOptions:choose(['barcode','umi','adapter','quality','coverage','methylation','atac','paired'])},
 {kind:'labx-protein',name:'Proteina (annotazioni)',parts:protein,specLabel:'Tipo',specOptions:choose(['membrane','disulfide','ptm'])},
 {kind:'labx-material',name:'Proprietà dei materiali',parts:material,specLabel:'Grafico',specOptions:choose(['stress','dos','bands','phase'])},
 {kind:'labx-optics',name:'Spettro e polarizzazione',parts:optics,specLabel:'Tipo',specOptions:choose(['comb','ellipse'])},
 {kind:'labx-density',name:'Matrice densità',parts:quantum,specLabel:'Stato',specOptions:choose(['pure','mixed','dephase'])},
];
